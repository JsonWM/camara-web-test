import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
    }

    // 1. Limpiar el prefijo Base64 (ej: data:image/jpeg;base64,)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    // 2. Convertir la cadena Base64 a un Buffer binario
    const buffer = Buffer.from(base64Data, 'base64');

    // [AQUÍ] En producción, aquí subirías el 'buffer' a AWS S3, Cloudinary, etc.
    // Ejemplo ficticio: const imageUrl = await uploadToS3(buffer);
    
    console.log(`Imagen recibida con éxito. Tamaño: ${buffer.length} bytes`);

    // 3. Simulamos una respuesta exitosa con la URL de la imagen guardada
    return NextResponse.json({ 
      success: true, 
      message: 'Foto guardada correctamente en el servidor',
      url: 'https://tu-almacenamiento.com' 
    });

  } catch (error) {
    console.error('Error en el servidor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
