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
        model: 'gemini-1.5-flash',
        contents: customPrompt,
      });
      return NextResponse.json({ success: true, message: `Gemini responde: "${response.text.trim()}"` });
    }

    // === MODO ANÁLISIS DE IMAGEN (DOCUMENTO DE IDENTIDAD) ===
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

    // PROMPT DE ALTA PRECISIÓN: Le indicamos su rol exacto y reglas de negocio
    const promptEspecializado = `
      Actúa como un sistema experto en verificación de identidad (KYC) y OCR. 
      Analiza minuciosamente la imagen adjunta para determinar si corresponde a un documento de identidad oficial, cédula, DNI o pasaporte.
      
      Reglas estrictas de validación:
      1. Debe ser un documento de identidad oficial visible (no una foto de un paisaje, ni una selfie común sin documento).
      2. El documento debe estar bien enfocado, ser legible y no estar excesivamente tapado con los dedos.
      3. Extrae la información visible más importante si es posible (Nombre, Apellido, Número de documento).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [partImagen, promptEspecializado],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valido: { 
              type: Type.BOOLEAN, 
              description: "true si la imagen contiene un documento de identidad legible y válido. false si no lo es." 
            },
            motivo: { 
              type: Type.STRING, 
              description: "Breve explicación en español de por qué el documento se considera válido o fue rechazado." 
            },
            datosExtraidos: {
              type: Type.OBJECT,
              description: "Objeto con los datos de texto identificados dentro del documento. Si no es válido, dejar los campos vacíos.",
              properties: {
                nombreCompleto: { type: Type.STRING, description: "Nombres y apellidos que aparecen en el documento." },
                numeroDocumento: { type: Type.STRING, description: "Número de identificación, ID, RUT, DNI o pasaporte." }
              },
              required: ["nombreCompleto", "numeroDocumento"]
            }
          },
          required: ["valido", "motivo", "datosExtraidos"],
        }
      }
    });

    const resultadoIA = JSON.parse(response.text);
    console.log("[Análisis Especializado Gemini]:", resultadoIA);

    // Evaluación de la regla de negocio
    if (!resultadoIA.valido) {
      return NextResponse.json({ 
        error: `Documento Rechazado: ${resultadoIA.motivo}` 
      }, { status: 422 });
    }

    // Si es válido, devolvemos la confirmación y los datos que el OCR de Gemini extrajo
    return NextResponse.json({ 
      success: true, 
      message: `Documento aprobado. Datos detectados -> Nombre: ${resultadoIA.datosExtraidos.nombreCompleto || 'No legible'}, ID: ${resultadoIA.datosExtraidos.numeroDocumento || 'No legible'}. (${resultadoIA.motivo})` 
    });

  } catch (error) {
    console.error("Error en procesamiento especializado:", error);
    return NextResponse.json({ error: `Error técnico interno: ${error.message || error}` }, { status: 500 });
  }
}
