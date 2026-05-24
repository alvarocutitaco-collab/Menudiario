const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEFAULT_MODEL = 'gpt-4.1-mini';
const MAX_HISTORY_MESSAGES = 10;
const SESSION_TTL_MS = 1000 * 60 * 60 * 2;

const sessionStore = globalThis.__chefChatSessions || new Map();
globalThis.__chefChatSessions = sessionStore;

async function readJson(fileName) {
  const text = await fs.readFile(path.join(DATA_DIR, fileName), 'utf8');
  return JSON.parse(text);
}

function createSessionId() {
  return crypto.randomUUID();
}

function normalizeSessionId(sessionId) {
  const value = String(sessionId || '').trim();
  return /^[a-zA-Z0-9_-]{12,80}$/.test(value) ? value : createSessionId();
}

function pruneSessions() {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (!session || now - session.updatedAt > SESSION_TTL_MS) {
      sessionStore.delete(id);
    }
  }
}

function getSession(sessionId) {
  pruneSessions();
  const id = normalizeSessionId(sessionId);
  if (!sessionStore.has(id)) {
    sessionStore.set(id, { history: [], updatedAt: Date.now() });
  }
  return { id, session: sessionStore.get(id) };
}

function saveSessionMessage(session, role, content) {
  session.history.push({
    role,
    content: String(content || '').slice(0, 1200)
  });
  session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
  session.updatedAt = Date.now();
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

function compactMenuDia(menuDia) {
  const entradas = menuDia?.entradas || (menuDia?.entrada ? [menuDia.entrada] : []);
  const fondos = menuDia?.fondos || (menuDia?.fondo ? [menuDia.fondo] : []);

  return {
    disponible: Boolean(menuDia?.disponible),
    precio: menuDia?.precio,
    titulo: menuDia?.titulo || 'Menu del dia',
    subtitulo: menuDia?.subtitulo || '',
    entradas: entradas.map((item) => ({
      nombre: item.nombre,
      descripcion: item.descripcion
    })),
    fondos: fondos.map((item) => ({
      nombre: item.nombre,
      descripcion: item.descripcion
    })),
    bebida: menuDia?.bebida
      ? {
          nombre: menuDia.bebida.nombre,
          descripcion: menuDia.bebida.descripcion
        }
      : null,
    nota: menuDia?.nota || ''
  };
}

function buildSystemPrompt(menuData, menuDia, availability) {
  const negocio = menuData.negocio || {};
  const menuDiaCompacto = compactMenuDia(menuDia);
  const cartaTexto = JSON.stringify(compactMenu(menuData));
  const menuDiaTexto = JSON.stringify(menuDiaCompacto);
  const availabilityTexto = JSON.stringify(availability || {});

  return [
    `Eres el Chef IA de ${negocio.nombre || 'el restaurante'}, pero no actuas como bot: actuas como anfitrion humano, amigo conversador, vendedor emocional y guia gastronomico premium.`,
    'Tu prioridad es que el cliente se sienta escuchado antes de venderle algo.',
    'Responde siempre en espanol latino, con tono calido, humano, emocional y breve. Usa emojis moderados cuando sumen cercania.',
    'No respondas como Wikipedia, manual tecnico, asistente corporativo ni buscador. Si preguntan algo general, responde solo lo justo y vuelve con naturalidad a la experiencia gastronomica.',
    'Detecta el contexto emocional: frio, cansancio, enojo, frustracion, celebracion, grupo, calor, antojo, apuro, tristeza, humor o curiosidad.',
    'Para mensajes cotidianos o raros, sigue SIEMPRE este orden: 1) reaccion humana con empatia o humor ligero, 2) conecta la situacion con comida o bebida, 3) recomienda algo real de la carta/menu, 4) cierra con una pregunta simple orientada a pedido, reserva o preferencia.',
    'Ejemplos de estilo: "Ufff, eso si pide rescate gastronomico 😭"; "Con este frio, el cuerpo pide algo que abrace"; "Para ese plan de 3 personas, mejor algo para compartir"; "Dato curioso, pero yo lo llevaria a la mesa con algo bien potente".',
    'Objetivo de negocio: en pocas interacciones guiar hacia pedido, reserva, WhatsApp o eleccion de plato, sin sonar invasivo.',
    'Haz preguntas utiles y cortas: "¿lo quieres ligero o contundente?", "¿son para comer aqui o delivery?", "¿te separo una opcion por WhatsApp?", "¿prefieres picante o suave?".',
    'Recomienda bebidas cuando el contexto lo pida: calor, cansancio, sol, grupo, picante o postre.',
    'Si el usuario menciona cantidad de personas, sugiere opciones para compartir o combina entrada + fondo + bebida.',
    'Si el usuario muestra malestar emocional, no dramatices ni hagas terapia; acompana con una frase humana y lleva suavemente a algo reconfortante.',
    'No inventes platos, precios, ingredientes, promociones, horarios ni disponibilidad. Usa solo la carta, el menu del dia y availability.json.',
    'Si un plato aparece como agotado, no lo recomiendes. Si aparece como limitado, recomienda confirmar disponibilidad por WhatsApp.',
    'Si el cliente quiere reservar, pedir, confirmar stock, delivery o hablar con una persona, invitalo a WhatsApp.',
    'Si el usuario pregunta algo peligroso, ilegal, medico, legal o financiero de alto impacto, responde con cautela, no des instrucciones riesgosas y redirige con tacto hacia atencion humana o comida.',
    'Mantén las respuestas normalmente entre 35 y 90 palabras. Si el cliente pide detalles de carta, puedes extenderte un poco.',
    `Datos del negocio: WhatsApp ${negocio.whatsapp || 'no configurado'}, ubicacion ${negocio.ubicacion || 'no configurada'}, horario ${negocio.horario || 'no configurado'}, Instagram ${negocio.instagram || 'no configurado'}.`,
    `Carta general JSON resumida: ${cartaTexto}`,
    `Menu del dia JSON: ${menuDiaTexto}`,
    `Disponibilidad JSON: ${availabilityTexto}`
  ].join('\n');
}

function historyToInput(history, message) {
  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
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

async function handleChefChat({ message, sessionId } = {}) {
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    const error = new Error('Mensaje vacio');
    error.statusCode = 400;
    throw error;
  }

  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('Falta OPENAI_API_KEY');
    error.statusCode = 500;
    throw error;
  }

  const { id, session } = getSession(sessionId);

  const [menuData, menuDia, availability] = await Promise.all([
    readJson('menu.json'),
    readJson('menu-dia.json'),
    readJson('availability.json')
  ]);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions: buildSystemPrompt(menuData, menuDia, availability),
      input: historyToInput(session.history, cleanMessage),
      temperature: 0.45,
      max_output_tokens: 360
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Error llamando a OpenAI');
    error.statusCode = response.status;
    throw error;
  }

  const reply = extractResponseText(data) ||
    'Ufff, eso pide pausa rica 😌 Te recomendaría mirar el Menú del Día o un Rocoto Relleno Heredia para levantar el ánimo. ¿Prefieres algo suave o contundente?';

  saveSessionMessage(session, 'user', cleanMessage);
  saveSessionMessage(session, 'assistant', reply);

  return {
    reply,
    sessionId: id
  };
}

module.exports = { handleChefChat };
