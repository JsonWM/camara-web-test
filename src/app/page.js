'use client';

import { useRef, useState } from 'react';

export default function CameraPrototype() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoInfo, setPhotoInfo] = useState({ compressedSize: 0 });
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      setServerMessage('');
    } catch (err) {
      console.error("Error de cámara:", err);
      alert("Revisa los permisos de tu cámara.");
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

  const uploadPhoto = async () => {
    if (!photo) return;
    setLoading(true);
    setServerMessage('');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo }),
      });

      const data = await response.json();

      if (response.ok) {
        setServerMessage(`✅ ¡Éxito! ${data.message}`);
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-6">
        
        {/* Encabezado */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Prototipo Full-Stack</h1>
          <p className="text-sm text-slate-500">Módulo de captura con compresión nativa</p>
        </div>
        
        {/* Visor de Cámara y Foto */}
        <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-200">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover ${stream ? 'block' : 'hidden'}`}
          />
          
          {photo && !stream && (
            <img 
              src={photo} 
              alt="Captura" 
              className="w-full h-full object-cover"
            />
          )}

          {!stream && !photo && (
            <div className="text-center p-4">
              <p className="text-sm text-slate-400 font-medium">La cámara está apagada</p>
            </div>
          )}
        </div>

        {/* Peso del archivo optimizado */}
        {photo && !stream && (
          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
            <p className="text-xs text-blue-700">
              Peso optimizado: <span className="font-semibold">{photoInfo.compressedSize} KB</span>
            </p>
          </div>
        )}

        {/* Acciones principales */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!stream && !photo && (
            <button 
              onClick={startCamera}
              className="w-full bg-slate-900 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-sm hover:bg-slate-800 transition-colors active:scale-[0.98]"
            >
              Encender Cámara
            </button>
          )}
          
          {stream && (
            <button 
              onClick={takePhoto} 
              className="w-full bg-emerald-600 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-sm hover:bg-emerald-500 transition-colors active:scale-[0.98]"
            >
              Capturar y Optimizar
            </button>
          )}
          
          {photo && !stream && (
            <>
              <button 
                onClick={() => { setPhoto(null); startCamera(); }}
                className="w-full sm:w-1/2 bg-slate-100 text-slate-700 font-medium text-sm py-3 px-4 rounded-xl hover:bg-slate-200 transition-colors active:scale-[0.98]"
              >
                Tomar Otra
              </button>
              <button 
                onClick={uploadPhoto} 
                disabled={loading} 
                className="w-full sm:w-1/2 bg-blue-600 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-md hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Subiendo...
                  </>
                ) : 'Enviar al Servidor'}
              </button>
            </>
          )}
        </div>

        {/* Canvas técnico (siempre oculto) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Notificaciones del Servidor */}
        {serverMessage && (
          <div className={`p-4 rounded-xl text-sm font-medium text-center ${
            serverMessage.includes('✅') 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
              : 'bg-rose-50 text-rose-800 border border-rose-100'
          }`}>
            {serverMessage}
          </div>
        )}
        
      </div>
    </div>
  );
}
