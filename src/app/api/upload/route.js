import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    // 1. Extract the standard web multipart FormData from the request
    const formData = await request.formData();
    
    // 'pictureFile' matches the key name we will send from our React frontend
    const file = formData.get("pictureFile");

    // Validation: Check if a file was actually uploaded
    if (!file) {
      return NextResponse.json(
        { error: "No image file provided in the request." },
        { status: 400 }
      );
    }

    // 2. Convert the incoming web stream file into a Node.js Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 3. Define the destination folder path (we will save it inside the public/uploads directory)
    const uploadDirectory = path.join(process.cwd(), "public", "uploads");

    // Automatically create the 'public/uploads' directory tree if it doesn't exist yet
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }

    // 4. Generate a completely unique, timestamped filename to prevent naming collisions
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.name || ".jpg")}`;
    const fullFilePath = path.join(uploadDirectory, uniqueFilename);

    // 5. Physically write the image binary file onto the server disk
    fs.writeFileSync(fullFilePath, buffer);

    // Return the absolute public URL string so the frontend can display it later
    const publicUrl = `/uploads/${uniqueFilename}`;

    return NextResponse.json({
      message: "Photo uploaded and saved successfully on the server!",
      url: publicUrl,
    }, { status: 201 });

  } catch (error) {
    console.error("Server error during file write execution:", error);
    return NextResponse.json(
      { error: "Internal server error occurred while processing the file save." },
      { status: 500 }
    );
  }
}
