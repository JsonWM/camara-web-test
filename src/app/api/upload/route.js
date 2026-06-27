import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { image, customPrompt } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la variable de entorno GEMINI_API_KEY.' }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey });

    // === MODO PRUEBA DE TEXTO ===
    if (customPrompt) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: customPrompt,
      });
      return NextResponse.json({ success: true, message: `Gemini responde: "${response.text.trim()}"` });
    }

    // === MODO RECONOCIMIENTO DE OBJETOS ===
    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen.' }, { status: 400 });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const partImagen = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "image/jpeg"
      },
    };

    // PROMPT DE VISIÓN GENERAL: Le ordenamos contar e identificar todo lo que vea
    const promptVisionGeneral = `
      Analiza minuciosamente la imagen adjunta capturada por la cámara.
      Identifica y enumera de forma precisa todos los objetos principales, personas, animales o elementos visibles en la escena.
      Sé específico con los nombres de los objetos (ej: 'taza de café', 'teclado mecánico', 'teléfono celular', 'persona').
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [partImagen, promptVisionGeneral],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exito: { 
              type: Type.BOOLEAN, 
              description: "true si se pudieron identificar elementos en la imagen, false si la imagen es completamente negra o ilegible." 
            },
            resumenDeLaEscena: { 
              type: Type.STRING, 
              description: "Una breve descripción en español del entorno general que se observa en la foto." 
            },
            objetosDetectados: {
              type: Type.ARRAY,
              description: "Lista ordenada de los objetos individuales encontrados en la imagen.",
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING, description: "Nombre común del objeto en español." },
                  cantidad: { type: Type.INTEGER, description: "Número de objetos iguales de este tipo detectados." },
                  colorPredominante: { type: Type.STRING, description: "El color principal del objeto." }
                },
                required: ["nombre", "cantidad", "colorPredominante"]
              }
            }
          },
          required: ["exito", "resumenDeLaEscena", "objetosDetectados"],
        }
      }
    });

    const resultadoIA = JSON.parse(response.text);
    console.log("[Análisis de Objetos Gemini]:", resultadoIA);

    if (!resultadoIA.exito) {
      return NextResponse.json({ 
        error: "La IA no logró identificar nada. Asegúrate de que la foto tenga buena luz y no esté tapada." 
      }, { status: 422 });
    }

    // 🛠️ Mapeamos la lista de objetos para formatear un mensaje de texto amigable para el frontend
    const listaFormateada = resultadoIA.objetosDetectados
      .map(obj => `${obj.cantidad}x ${obj.nombre} (${obj.colorPredominante})`)
      .join(', ');

    return NextResponse.json({ 
      success: true, 
      message: `Entorno detectado: "${resultadoIA.resumenDeLaEscena}". Objetos encontrados -> [ ${listaFormateada} ]` 
    });

  } catch (error) {
    console.error("Error en procesamiento de visión:", error);
    return NextResponse.json({ error: `Error técnico interno: ${error.message || error}` }, { status: 500 });
  }
}
