"use client";

import React, { useRef, useState, useEffect } from 'react';

export default function CameraView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Asegura limpiar la cámara si el usuario cierra la página de golpe
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // 1. Encender la cámara con configuraciones móviles explícitas
  const startCamera = async () => {
    try {
      setPhoto(null);
      setPhotoBlob(null);
      
      // Apagar cualquier rastro anterior de cámara antes de encenderla otra vez
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Prioriza cámara trasera
          width: { ideal: 1920 },    // Alta resolución para evitar fotos chicas
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Pequeño truco: esperar a que carguen los metadatos antes de reproducir
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.log("Error auto-play:", e));
        };
      }
      setStream(mediaStream);
    } catch (err) {
      console.error("Error al acceder a la cámara: ", err);
      alert("No se pudo abrir la cámara. Revisa si otra app la está usando.");
    }
  };

  const base64ToBlob = (base64Data, contentType = 'image/jpeg') => {
    const sliceSize = 512;
    const byteCharacters = atob(base64Data.split(',')[1]); // Corrección para ignorar el encabezado data:image
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  // 2. Capturar la foto leyendo los valores REALES del hardware
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      // Agregamos un retraso controlado para permitir la exposición de luz automática del hardware
      setTimeout(() => {
        // LEER LAS DIMENSIONES REALES DEL VIDEO EN REPRODUCCIÓN
        const anchoReal = video.videoWidth || 640;
        const altoReal = video.videoHeight || 480;

        canvas.width = anchoReal;
        canvas.height = altoReal;
        
        const context = canvas.getContext('2d');
        // Capturar el cuadro estabilizado con luz real
        context.drawImage(video, 0, 0, anchoReal, altoReal);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9); // Calidad balanceada
        setPhoto(imageDataUrl);

        const binaryBlob = base64ToBlob(imageDataUrl);
        setPhotoBlob(binaryBlob);

        // Apagar la cámara de forma segura una vez capturado el cuadro iluminado
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
      }, 800); // 800 milisegundos son suficientes para que el sensor del celular calibre la luz
    }
  };

  const uploadPhotoToServer = async () => {
    if (!photoBlob) return alert("Captura una foto primero.");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("pictureFile", photoBlob, "snapshot.jpg");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        alert("🎉 ¡Subida exitosa en el servidor!");
        setPhoto(null);
        setPhotoBlob(null);
      } else {
        alert("Error de subida: " + data.error);
      }
    } catch (err) {
      console.error("Error de red:", err);
      alert("Error al conectar con el servidor.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Contenedor del Visor */}
      <div className="relative w-full h-72 bg-gray-950 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center">
        {stream && (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted // Importante para navegadores móviles
            className="w-full h-full object-cover"
          />
        )}
        {photo && (
          <img 
            src={photo} 
            alt="Snapshot preview" 
            className="w-full h-full object-cover"
          />
        )}
        {!stream && !photo && (
          <p className="text-gray-500 text-sm">Cámara lista para encender</p>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-center w-full">
          {!stream ? (
            <button
              onClick={startCamera}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow transition-colors text-sm"
            >
              {photo ? "🔄 Volver a tomar foto" : "📷 Encender Cámara"}
            </button>
          ) : (
            <button
              onClick={capturePhoto}
              className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg shadow transition-colors text-sm"
            >
              🛑 Tomar Foto
            </button>
          )}
        </div>

        {photoBlob && (
          <button
            onClick={uploadPhotoToServer}
            disabled={uploading}
            className={`w-full mt-2 py-2 text-white font-bold rounded-lg transition-colors text-sm shadow ${
              uploading ? "bg-gray-600" : "bg-sky-500 hover:bg-sky-600"
            }`}
          >
            {uploading ? "📤 Subiendo..." : "🚀 Subir Foto al Servidor"}
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
