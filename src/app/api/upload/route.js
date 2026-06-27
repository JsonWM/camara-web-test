import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { image, customPrompt } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno en el servidor.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === MODO PRUEBA DE TEXTO ===
    if (customPrompt) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: customPrompt,
      });
      return NextResponse.json({ success: true, message: `Gemini responde: "${response.text.trim()}"` });
    }

    // === MODO ESCÁNER DE OBJETOS ===
    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen.' }, { status: 400 });
    }

    // 1. Limpieza y preparación segura del Base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    // Convertimos a Uint8Array (Este formato es universal y es 100% aceptado por Vercel y Supabase)
    const bufferArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // 2. IA FILTRO EN TIEMPO REAL
    const partImagen = {
      inlineData: { data: base64Data, mimeType: "image/jpeg" },
    };

    const promptVisionGeneral = "Analiza la imagen. Identifica objetos visibles y sus cantidades.";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [partImagen, promptVisionGeneral],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exito: { type: Type.BOOLEAN },
            resumenDeLaEscena: { type: Type.STRING },
            objetosDetectados: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING },
                  cantidad: { type: Type.INTEGER },
                  colorPredominante: { type: Type.STRING }
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

    if (!resultadoIA.exito) {
      return NextResponse.json({ error: "La IA rechazó la imagen por falta de claridad." }, { status: 422 });
    }

    // 3. STORAGE EN LA NUBE: Guardado simplificado en la raíz del Bucket
    // Eliminamos el prefijo 'historial/' para guardarlo directamente y evitar fallos de carpetas inexistentes.
    const nombreArchivo = `captura_${Date.now()}.jpg`;
    
    const { data: storageData, error: storageError } = await supabase.storage.from('fotos-ia') // <-- Asegúrate de que en Supabase se llame exactamente así
      .upload(nombreArchivo, bufferArray, {
        contentType: 'image/jpeg',
        duplex: 'half', // Requisito de estabilidad para streams en plataformas Serverless como Vercel
        upsert: true
      });

    if (storageError) {
      console.error("Error detallado de Supabase Storage:", storageError);
      // Cambiamos el mensaje para que el servidor nos diga EXACTAMENTE qué falló en tus logs
      return NextResponse.json({ 
        error: `Fallo en almacenamiento: ${storageError.message || JSON.stringify(storageError)}` 
      }, { status: 500 });
    }

    // 4. ACCESO: Obtener URL pública
    const { data: { publicUrl } } = supabase.storage.from('fotos-ia')
      .getPublicUrl(nombreArchivo);

    // 5. REGISTRO EN LA BASE DE DATOS
    const { error: dbError } = await supabase
      .from('registros_camara')
      .insert([
        { 
          url_imagen: publicUrl, 
          descripcion: resultadoIA.resumenDeLaEscena, 
          objetos: resultadoIA.objetosDetectados 
        }
      ]);

    if (dbError) {
      console.error("Error al registrar en la Base de Datos PostgreSQL:", dbError);
    }

    const listaFormateada = resultadoIA.objetosDetectados
      .map(obj => `${obj.cantidad}x ${obj.nombre} (${obj.colorPredominante})`)
      .join(', ');

    return NextResponse.json({ 
      success: true, 
      message: `¡Guardado exitoso! Escena: "${resultadoIA.resumenDeLaEscena}". Objetos -> [ ${listaFormateada} ]`,
      url: publicUrl 
    });

  } catch (error) {
    console.error("Error crítico general en backend:", error);
    return NextResponse.json({ error: `Error interno del servidor: ${error.message || error}` }, { status: 500 });
  }
}
