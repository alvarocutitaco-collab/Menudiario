const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEFAULT_MODEL = 'gpt-4.1-mini';

async function readJson(fileName) {
  const text = await fs.readFile(path.join(DATA_DIR, fileName), 'utf8');
  return JSON.parse(text);
}

function compactMenu(menuData) {
  return (menuData.platos || []).map((p) => ({
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    categoria: p.categoria,
    tags: p.tags || [],
    extras: p.extras || []
  }));
}

function buildSystemPrompt(menuData, menuDia) {
  const negocio = menuData.negocio || {};
  const entradasDia = menuDia?.entradas || (menuDia?.entrada ? [menuDia.entrada] : []);
  const fondosDia = menuDia?.fondos || (menuDia?.fondo ? [menuDia.fondo] : []);
  const menuDiaTexto = menuDia && menuDia.disponible
    ? `Menu del dia disponible: ${menuDia.titulo || 'Menu del dia'} por ${negocio.moneda || 'S/'} ${menuDia.precio}. El cliente elige 1 entrada entre: ${entradasDia.map((item) => item.nombre).join(', ')}. Elige 1 fondo entre: ${fondosDia.map((item) => item.nombre).join(', ')}. Bebida: ${menuDia.bebida?.nombre}. Nota: ${menuDia.nota || 'sin nota'}.`
    : 'El menu del dia no esta disponible o esta agotado.';
  const cartaTexto = JSON.stringify(compactMenu(menuData));

  return [
    `Eres el Chef IA de ${negocio.nombre || 'el restaurante'}, un anfitrion gastronomico con personalidad calida, curiosa y vendedora.`,
    'Responde en espanol latino, con tono cercano, elegante y breve. Evita sonar robotico o insistente.',
    'Puedes conversar sobre casi cualquier tema cotidiano que el usuario traiga: trabajo, estudios, clima, celebraciones, cansancio, planes, deportes, viajes, antojos, emociones o dudas generales.',
    'Tu objetivo comercial es hacer siempre un puente natural entre el tema del usuario y un plato real del restaurante.',
    'En cada respuesta, sigue esta estructura: 1) responde brevemente al tema del usuario, 2) conecta con una frase puente natural, 3) recomienda un plato especifico de la carta o el menu del dia, 4) explica por que encaja, 5) cierra invitando a pedir o consultar por WhatsApp cuando tenga sentido.',
    'El puente debe sentirse organico. Ejemplos: "Hablando de algo reconfortante...", "Si ese plan pide algo con energia...", "Para acompanar ese antojo...", "Eso suena a dia para...".',
    'Recomienda solamente platos que existan en la carta o el menu del dia. No inventes platos, precios, ingredientes, promociones ni disponibilidad.',
    'Si el usuario pide comparar, elegir, celebrar o resolver un antojo, recomienda maximo 2 opciones. Si pregunta algo amplio o fuera de restaurante, recomienda 1 opcion clara.',
    'Si el usuario pregunta por horario, ubicacion, delivery, pagos, pedidos o reservas, responde el dato y tambien sugiere un plato o menu apropiado.',
    'Si el usuario pide algo peligroso, ilegal, medico, legal o financiero de alto impacto, no des instrucciones riesgosas; responde con cautela y haz un puente amable hacia comida o una opcion reconfortante.',
    'Si el usuario quiere reservar, pedir, confirmar disponibilidad o hablar con una persona, invitalo a WhatsApp.',
    'Si no sabes algo, dilo con naturalidad y conecta con una recomendacion de la carta.',
    'No repitas siempre la misma formula. Cambia el tipo de puente y la recomendacion segun el contexto.',
    `Datos del negocio: WhatsApp ${negocio.whatsapp || 'no configurado'}, ubicacion ${negocio.ubicacion || 'no configurada'}, horario ${negocio.horario || 'no configurado'}, Instagram ${negocio.instagram || 'no configurado'}.`,
    menuDiaTexto,
    `Carta JSON resumida: ${cartaTexto}`
  ].join('\n');
}

function historyToInput(history, message) {
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const input = safeHistory
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content)
    .map((item) => ({
      role: item.role,
      content: String(item.content).slice(0, 1200)
    }));

  input.push({ role: 'user', content: String(message || '').slice(0, 1200) });
  return input;
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
      if (content.type === 'text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function handleChefChat({ message, history } = {}) {
  if (!message || !String(message).trim()) {
    const error = new Error('Mensaje vacio');
    error.statusCode = 400;
    throw error;
  }

  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('Falta OPENAI_API_KEY');
    error.statusCode = 500;
    throw error;
  }

  const [menuData, menuDia] = await Promise.all([
    readJson('menu.json'),
    readJson('menu-dia.json')
  ]);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions: buildSystemPrompt(menuData, menuDia),
      input: historyToInput(history, message),
      temperature: 0.4,
      max_output_tokens: 450
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Error llamando a OpenAI');
    error.statusCode = response.status;
    throw error;
  }

  return extractResponseText(data) || 'Puedo conversar contigo y llevar la idea a algo rico de nuestra carta. Hablando de antojos, te recomendaria revisar el menu del dia o un Rocoto Relleno Heredia. ¿Quieres que lo pidamos por WhatsApp?';
}

module.exports = { handleChefChat };
