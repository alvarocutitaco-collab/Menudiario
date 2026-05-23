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
  const menuDiaTexto = menuDia && menuDia.disponible
    ? `Menu del dia disponible: ${menuDia.titulo || 'Menu del dia'} por ${negocio.moneda || 'S/'} ${menuDia.precio}. Entrada: ${menuDia.entrada?.nombre}. Fondo: ${menuDia.fondo?.nombre}. Postre: ${menuDia.postre?.nombre}. Bebida: ${menuDia.bebida?.nombre}. Nota: ${menuDia.nota || 'sin nota'}.`
    : 'El menu del dia no esta disponible o esta agotado.';

  return [
    `Eres el Chef IA de ${negocio.nombre || 'el restaurante'}.`,
    'Responde en espanol latino, con tono amable, breve y vendedor, como un asistente de restaurante.',
    'Tu trabajo es ayudar a elegir platos, explicar la carta, sugerir el menu del dia, resolver dudas de horario, ubicacion, delivery, pagos, pedidos y reservas.',
    'Recomienda solamente platos que existan en la carta o el menu del dia. No inventes platos, precios ni promociones.',
    'Si el usuario quiere reservar, pedir, confirmar disponibilidad o hablar con una persona, invitalo a WhatsApp.',
    'Si no sabes algo, dilo con naturalidad y ofrece derivarlo por WhatsApp.',
    'No respondas temas ajenos al restaurante; redirige amablemente hacia carta, ofertas, pedidos o reservas.',
    `Datos del negocio: WhatsApp ${negocio.whatsapp || 'no configurado'}, ubicacion ${negocio.ubicacion || 'no configurada'}, horario ${negocio.horario || 'no configurado'}, Instagram ${negocio.instagram || 'no configurado'}.`,
    menuDiaTexto,
    `Carta JSON resumida: ${JSON.stringify(compactMenu(menuData))}`
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

  return extractResponseText(data) || 'Puedo ayudarte con la carta, el menu del dia, pedidos o reservas. ¿Que se te antoja hoy?';
}

module.exports = { handleChefChat };
