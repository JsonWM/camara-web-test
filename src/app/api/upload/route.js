import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

// 1. REGLA DE ORO DE VERCEL: Forzamos a Next.js a tratar este backend como 100% dinámico.
// Esto evita que intente compilarlo de forma estática durante el build de Vercel.
export const dynamic = 'force-dynamic';

async function analizarConGemini(bufferImagen) {
  try {
    // 2. Inicializamos el SDK ADENTRO de la función. 
    // De esta forma nos aseguramos de que se ejecute en Runtime (cuando el usuario mande la foto) 
    // y no durante el proceso de compilación de Vercel.
    const ai = new GoogleGenAI();

    const partImagen = {
      inlineData: {
        data: bufferImagen.toString("base64"),
        mimeType: "image/jpeg"
      },
    };

    const promptDefinido = `
      Analiza estrictamente esta imagen capturada por la cámara de la aplicación.
      Reglas de validación:
      1. Debe contener un rostro humano visible o un objeto claro.
      2. No debe contener desnudez, violencia, ni contenido ofensivo.
      3. Determina si la foto es apropiada para el sistema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [partImagen, promptDefinido],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aprobada: { type: Type.BOOLEAN },
            motivo: { type: Type.STRING }
          },
          required: ["aprobada", "motivo"],
        }
      }
    });

    const resultadoIA = JSON.parse(response.text);
    return resultadoIA;

  } catch (error) {
    console.error("Error al conectar con la API de Gemini:", error);
    return { aprobada: false, motivo: "Error técnico al validar la imagen." };
  }
}

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const evaluacion = await analizarConGemini(buffer);

    if (!evaluacion.aprobada) {
      return NextResponse.json({ 
        error: `Validación de IA rechazada: ${evaluacion.motivo}` 
      }, { status: 422 });
    }

    const idUnico = `foto_${Date.now()}.jpg`;
    const urlPublicaSimulada = `https://mock-storage.co{idUnico}`;

    return NextResponse.json({ 
      success: true, 
      message: `Foto aprobada por IA (${evaluacion.motivo}).`,
      url: urlPublicaSimulada 
    });

  } catch (error) {
    console.error('Error crítico en el servidor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
