'use client';

import { useRef, useState } from 'react';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoInfo, setPhotoInfo] = useState({ compressedSize: 0 });
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  
  // Estado para el prompt de prueba manual
  const [testPrompt, setTestPrompt] = useState('');

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      setServerMessage('');
    } catch (err) {
      console.error("Error de cámara:", err);
      alert("Por favor, da permisos a la cámara.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const context = canvas.getContext('2d');
      const MAX_WIDTH = 1280; 
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      setPhoto(compressedDataUrl);

      const compressedSize = Math.round((compressedDataUrl.length * 3) / 4 / 1024);
      setPhotoInfo({ compressedSize });
      stopCamera();
    }
  };

  // Función unificada que envía la foto o solo el texto de prueba
  const sendToServer = async (isTestText = false) => {
    if (!photo && !isTestText) return;
    if (isTestText && !testPrompt.trim()) return;

    setLoading(true);
    setServerMessage('');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: isTestText ? null : photo,
          customPrompt: isTestText ? testPrompt : null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setServerMessage(`✅ Respuesta: ${data.message}`);
      } else {
        setServerMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setServerMessage('❌ Error de red al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-6">
        
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Consola de Pruebas IA</h1>
          <p className="text-sm text-slate-500">Módulo de desarrollo local</p>
        </div>
        
        {/* Visor Multimedia */}
        <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
          <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${stream ? 'block' : 'hidden'}`} />
          {photo && !stream && <img src={photo} alt="Captura" className="w-full h-full object-cover" />}
          {!stream && !photo && <p className="text-sm text-slate-400 font-medium">Modo Cámara Listo</p>}
        </div>

        {/* Botonera de Cámara */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!stream && !photo && (
            <button onClick={startCamera} className="w-full bg-slate-900 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-sm hover:bg-slate-800 transition-colors">
              Encender Cámara
            </button>
          )}
          {stream && (
            <button onClick={takePhoto} className="w-full bg-emerald-600 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-sm hover:bg-emerald-500 transition-colors">
              Capturar Foto
            </button>
          )}
          {photo && !stream && (
            <>
              <button onClick={() => { setPhoto(null); startCamera(); }} className="w-full sm:w-1/2 bg-slate-100 text-slate-700 font-medium text-sm py-3 px-4 rounded-xl hover:bg-slate-200">
                Tomar Otra
              </button>
              <button onClick={() => sendToServer(false)} disabled={loading} className="w-full sm:w-1/2 bg-blue-600 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-md hover:bg-blue-500 disabled:opacity-50">
                {loading ? 'Procesando...' : 'Validar Foto'}
              </button>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* SECCIÓN NUEVA: Input para chatear/probar directamente con el Servidor */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Prueba de Texto Directa (Sin Cámara)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Escribe algo (ej: Hola Gemini, ¿estás activo?)" 
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-700"
            />
            <button 
              onClick={() => sendToServer(true)}
              disabled={loading || !testPrompt.trim()}
              className="bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Probar
            </button>
          </div>
        </div>

        {/* Notificaciones del Servidor */}
        {serverMessage && (
          <div className={`p-4 rounded-xl text-sm font-medium text-center break-words ${
            serverMessage.includes('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
          }`}>
            {serverMessage}
          </div>
        )}
        
      </div>
    </div>
  );
}
