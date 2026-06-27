import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

// Inicializamos el cliente oficial de Google Gen AI
// El SDK toma automáticamente la variable de entorno GEMINI_API_KEY
const ai = new GoogleGenAI();

async function analizarConGemini(bufferImagen) {
  try {
    // 1. Convertimos el Buffer binario a un formato que el SDK de Gemini entienda inline
    const partImagen = {
      inlineData: {
        data: bufferImagen.toString("base64"),
        mimeType: "image/jpeg"
      },
    };

    const promptDefinido = `
      Analiza estrictamente esta imagen capturada por la cámara de la aplicación.
      Reglas de validación:
      1. Debe contener un rostro humano visible o un objeto claro (no una pantalla negra o borrosa).
      2. No debe contener desnudez, violencia, ni contenido ofensivo o inapropiado.
      3. Determina si la foto es apropiada para ser guardada como foto de perfil o registro de usuario.
    `;

    // 2. Llamamos al modelo gemini-2.5-flash exigiendo una respuesta JSON estructurada
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [partImagen, promptDefinido],
      config: {
        // Forzamos al modelo a responder exclusivamente con la estructura JSON que definimos
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aprobada: { 
              type: Type.BOOLEAN, 
              description: "true si la imagen cumple con todas las reglas, false si es inapropiada, negra o basura." 
            },
            motivo: { 
              type: Type.STRING, 
              description: "Breve explicación en español de por qué se aprobó o rechazó la imagen." 
            }
          },
          required: ["aprobada", "motivo"],
        }
      }
    });

    // 3. Parseamos la respuesta estructurada de la IA
    const resultadoIA = JSON.parse(response.text);
    console.log("[Gemini API Response]:", resultadoIA);
    return resultadoIA;

  } catch (error) {
    console.error("Error al conectar con la API de Gemini:", error);
    // En caso de caída de la API, por seguridad del flujo fallamos de forma controlada
    return { aprobada: false, motivo: "Error técnico al validar la imagen con el servicio de IA." };
  }
}

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
    }

    // 1. Preparar la imagen desde el Base64 recibido del frontend
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // 2. FILTRO REAL DE IA (Validación Temprana)
    const evaluacion = await analizarConGemini(buffer);

    if (!evaluacion.aprobada) {
      // Si la IA no la aprueba, cortamos el flujo inmediatamente sin gastar almacenamiento
      return NextResponse.json({ 
        error: `Validación de IA rechazada: ${evaluacion.motivo}` 
      }, { status: 422 });
    }

    // 3. SI LA IA LA APRUEBA -> Flujo de guardado exitoso
    const idUnico = `foto_${Date.now()}.jpg`;
    
    // (Simulación de Storage usando la URL limpia)
    const urlPublicaSimulada = `https://mock-storage.co{idUnico}`;

    console.log(`[Éxito] Foto aprobada por Gemini AI. Motivo: ${evaluacion.motivo}`);

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
