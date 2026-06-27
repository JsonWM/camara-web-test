"use client";

import React, { useRef, useState } from 'react';

export default function CameraView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null); // Holds the raw binary file for the server
  const [uploading, setUploading] = useState(false);

  // 1. Activate the camera stream
  const startCamera = async () => {
    try {
      setPhoto(null);
      setPhotoBlob(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Triggers the rear camera on mobile devices
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not open the camera. Please check your browser permissions.");
    }
  };

  // Helper function: Converts Base64 preview string into a real binary Blob file
  const base64ToBlob = (base64Data, contentType = 'image/jpeg') => {
    const sliceSize = 512;
    const byteCharacters = atob(base64Data.split(',')[1]); // Extract raw data bytes
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

  // 2. Capture frame from the video stream
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageDataUrl = canvas.toDataURL('image/jpeg');
      setPhoto(imageDataUrl); // Saves Base64 string for preview rendering

      // Convert and save as physical file for backend consumption
      const binaryBlob = base64ToBlob(imageDataUrl);
      setPhotoBlob(binaryBlob);

      // Kill camera hardware to conserve device battery
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
    }
  };

  // 3. Upload the binary image file to the Next.js API
  const uploadPhotoToServer = async () => {
    if (!photoBlob) return alert("Please capture a photo first.");

    setUploading(true);

    try {
      const formData = new FormData();
      // 'pictureFile' matches the exact key name parsed by our API route.js file
      formData.append("pictureFile", photoBlob, "snapshot.jpg");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData, // Browser automatically injects 'multipart/form-data' headers
      });

      const data = await response.json();

      if (response.ok) {
        alert("🎉 Success! Image saved at: " + data.url);
        setPhoto(null);
        setPhotoBlob(null);
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch (err) {
      console.error("Network upload execution error: ", err);
      alert("Failed to communicate with the server endpoint.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Camera/Photo Viewport Box */}
      <div className="relative w-full h-64 bg-gray-950 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center">
        {stream && <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />}
        {photo && <img src={photo} alt="Snapshot preview" className="w-full h-full object-cover" />}
        {!stream && !photo && <p className="text-gray-500 text-sm">Camera stream is offline</p>}
      </div>

      {/* Button Layout */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-center w-full">
          {!stream ? (
            <button
              onClick={startCamera}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow transition-colors text-sm"
            >
              {photo ? "🔄 Retake Photo" : "📷 Turn On Camera"}
            </button>
          ) : (
            <button
              onClick={capturePhoto}
              className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg shadow transition-colors text-sm animate-pulse"
            >
              🛑 Capture Snapshot
            </button>
          )}
        </div>

        {/* Upload Button: Only shows up once an image file exists in memory */}
        {photoBlob && (
          <button
            onClick={uploadPhotoToServer}
            disabled={uploading}
            className={`w-full mt-2 py-2 text-white font-bold rounded-lg transition-colors text-sm shadow ${
              uploading ? "bg-gray-600 cursor-not-allowed" : "bg-sky-500 hover:bg-sky-600"
            }`}
          >
            {uploading ? "📤 Transmitting image..." : "🚀 Upload Photo to Server"}
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
