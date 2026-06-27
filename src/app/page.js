import CameraView from "@/components/CameraView";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 text-white">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-6 shadow-xl text-center border border-gray-700">
        <h1 className="text-2xl font-bold mb-2 text-emerald-400">📸 Camera Testing</h1>
        <p className="text-gray-400 mb-6 text-xs">
          Testing native mobile camera stream integration in Next.js
        </p>
        
        {/* Render the camera view component directly */}
        <CameraView />
      </div>
    </main>
  );
}
