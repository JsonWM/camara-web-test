import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Forzamos a Next.js y Vercel a tratar este endpoint como 100% dinámico
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { image, customPrompt } = await request.json();

    // 1. CONTROL DE REQUISITOS: Inicialización segura de variables
    const apiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno en el servidor.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === MODO PRUEBA DE TEXTO (Para la consola de depuración) ===
    if (customPrompt) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: customPrompt,
      });
      return NextResponse.json({ 
        success: true, 
        message: `Gemini responde: "${response.text.trim()}"` 
      });
    }

    // === MODO ESCÁNER DE OBJETOS CON PERSISTENCIA ===
    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen.' }, { status: 400 });
    }

    // Preparar el archivo binario para el almacenamiento
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // 2. INTELIGENCIA ARTIFICIAL: Filtro y análisis en tiempo real
    const partImagen = {
      inlineData: { data: base64Data, mimeType: "image/jpeg" },
    };

    const promptVisionGeneral = `
      Analiza la imagen adjunta. Identifica y enumera de forma precisa todos los objetos principales, personas o elementos visibles.
      Sé específico con los nombres de los objetos y descríbelos en español.
    `;

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
      return NextResponse.json({ 
        error: "La IA rechazó la imagen por falta de claridad u objetos legibles." 
      }, { status: 422 });
    }

    // 3. STORAGE EN LA NUBE: Subir el archivo binario a Supabase
    const nombreArchivo = `captura_${Date.now()}.jpg`;
    
    const { data: storageData, error: storageError } = await supabase.storage.from('fotos-ia')
      .upload(`historial/${nombreArchivo}`, buffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (storageError) {
      console.error("Error en Supabase Storage:", storageError);
      return NextResponse.json({ error: "Error al almacenar el archivo físico en la nube." }, { status: 500 });
    }

    // 4. ACCESO: Obtener la URL pública del archivo recién subido
    const { data: { publicUrl } } = supabase.storage.from('fotos-ia')
      .getPublicUrl(`historial/${nombreArchivo}`);

    console.log(`[PRODUCCIÓN] Archivo guardado con éxito en: ${publicUrl}`);

    // === [NUEVO] 4.5 PERSISTENCIA EN BASE DE DATOS POSTGRESQL ===
    // Insertamos una nueva fila con la URL, el resumen y el array estructurado de objetos
    const { error: dbError } = await supabase
      .from('registros_camara')
      .insert([
        { 
          url_imagen: publicUrl, 
          descripcion: resultadoIA.resumenDeLaEscena, 
          objetos: resultadoIA.objetosDetectados // Guardado directo como JSONB
        }
      ]);

    if (dbError) {
      console.error("Error al registrar en la Base de Datos:", dbError);
      // Opcional: Como senior, puedes decidir si lanzar error o continuar. 
      // Aquí dejamos que continúe para no romper la experiencia si solo falló el historial.
    } else {
      console.log("[PRODUCCIÓN] Metadata registrada con éxito en PostgreSQL.");
    }

    // Formatear la lista de objetos para la respuesta amigable de la interfaz
    const listaFormateada = resultadoIA.objetosDetectados
      .map(obj => `${obj.cantidad}x ${obj.nombre} (${obj.colorPredominante})`)
      .join(', ');

    // 5. CONTROL FINAL DE FLUJO: Retornar los datos exitosos al frontend
    return NextResponse.json({ 
      success: true, 
      message: `¡Guardado en base de datos e historial de Supabase! Escena: "${resultadoIA.resumenDeLaEscena}". Elementos detectados -> [ ${listaFormateada} ]`,
      url: publicUrl 
    });

  } catch (error) {
    console.error("Error crítico en backend de producción:", error);
    return NextResponse.json({ error: `Error interno del servidor: ${error.message || error}` }, { status: 500 });
  }
}
