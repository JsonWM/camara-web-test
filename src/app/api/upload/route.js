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
            console.log(`[Depuración] Ejecutando prompt de prueba: "${customPrompt}"`);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-lite', // <-- CAMBIADO AQUÍ
                contents: customPrompt,
            });

            return NextResponse.json({
                success: true,
                message: `Gemini respondió correctamente: "${response.text.trim()}"`
            });
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
      Que ves en la imagen. Responde en forma breve y corta
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite', // <-- CAMBIADO AQUÍ TAMBIÉN
            contents: [partImagen, promptEspecializado],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        valido: { type: Type.BOOLEAN },
                        motivo: { type: Type.STRING },
                        datosExtraidos: {
                            type: Type.OBJECT,
                            properties: {
                                nombreCompleto: { type: Type.STRING },
                                numeroDocumento: { type: Type.STRING }
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
