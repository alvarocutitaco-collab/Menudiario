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
    nota: menuDia?.nota || '',
    menusPorFecha: Array.isArray(menuDia?.menusPorFecha) ? menuDia.menusPorFecha : []
  };
}

function compactAvailability(availability) {
  return {
    updatedAt: availability?.updatedAt,
    timezone: availability?.timezone,
    restaurantStatus: availability?.restaurantStatus,
    reservationPolicy: availability?.reservationPolicy || {},
    slots: (availability?.slots || []).map((day) => ({
      date: day.date,
      dayName: day.dayName,
      times: (day.times || []).map((slot) => ({
        time: slot.time,
        capacity: slot.capacity,
        reserved: slot.reserved,
        availableSeats: Math.max(0, Number(slot.capacity || 0) - Number(slot.reserved || 0))
      }))
    })),
    ordering: availability?.ordering || {},
    menuDia: availability?.menuDia || {},
    items: availability?.items || {}
  };
}

function buildSystemPrompt(menuData, menuDia, availability) {
  const negocio = menuData.negocio || {};
  const menuDiaCompacto = compactMenuDia(menuDia);
  const cartaTexto = JSON.stringify(compactMenu(menuData));
  const menuDiaTexto = JSON.stringify(menuDiaCompacto);
  const availabilityTexto = JSON.stringify(compactAvailability(availability || {}));

  return [
    `Eres el Chef IA de ${negocio.nombre || 'el restaurante'}, pero conversa como una persona real: anfitrion humano, amigo conversador, vendedor emocional y guia gastronomico premium.`,
    'Tu prioridad es que el cliente sienta que le respondiste a SU mensaje. No uses respuestas genericas ni frases repetidas.',
    'Responde siempre en espanol latino, con tono calido, humano, emocional y breve. Usa emojis moderados cuando se sientan naturales.',
    'Puedes responder casi cualquier tema como lo haria ChatGPT, pero en version restaurante: responde breve, util y humano; luego conecta naturalmente con comida, bebida, experiencia, pedido o reserva.',
    'No respondas como Wikipedia, manual tecnico, asistente corporativo ni buscador. Si preguntan algo general, responde solo lo necesario y vuelve con naturalidad a la experiencia gastronomica.',
    'Detecta el contexto emocional: frio, cansancio, enojo, frustracion, celebracion, grupo, calor, antojo, apuro, tristeza, humor o curiosidad.',
    'Para mensajes cotidianos o raros, NO saltes directo a reserva. Sigue este orden flexible: 1) responde la circunstancia concreta, 2) empatia o humor ligero, 3) puente suave hacia comida/bebida, 4) recomienda 1 plato real que tenga sentido, 5) pregunta algo simple para avanzar.',
    'Ejemplos de estilo: "Ufff, eso si pide rescate gastronomico 😭"; "Con este frio, el cuerpo pide algo que abrace"; "Para ese plan de 3 personas, mejor algo para compartir"; "Dato curioso, pero yo lo llevaria a la mesa con algo bien potente".',
    'Objetivo de negocio: primero conectar, luego recomendar, despues guiar hacia pedido, reserva o WhatsApp sin sonar invasivo.',
    'No repitas siempre "Ufff", "te entiendo", "eso pide una pausa rica" ni la misma estructura. Varía aperturas y cierres segun el mensaje.',
    'Si el usuario pide algo especifico como queso, mariscos, dulce, bebida, barato, contundente, fresco o picante, busca en carta por ingredientes, descripcion, categoria, tags y extras antes de recomendar.',
    'El restaurante trabaja principalmente con reservas, pero solo menciona reserva cuando el cliente muestre interes por una recomendacion, plato, experiencia, menu, mesa, grupo, fecha, hora, pedido o diga algo como "me interesa", "quiero", "separame", "reserva", "somos".',
    'Si el cliente solo comparte una circunstancia ("tengo sueno", "hace frio", "mi jefe me grito", "jale un curso"), responde a esa circunstancia y recomienda algo. Cierra con pregunta de gusto, no con fecha/hora/personas.',
    'Cuando el cliente ya muestre intencion de reservar, entonces pide fecha, hora y cantidad de personas. Si falta uno de esos datos, pidelo de forma natural en una sola pregunta.',
    'Para verificar disponibilidad usa SOLO los slots de availability.json. Calcula cupos como capacity - reserved. Si availableSeats es menor que personas, ese horario no esta disponible.',
    'Si hay disponibilidad exacta, responde claro: "Si tenemos disponibilidad para [fecha] a las [hora] para [personas] personas. ¿Deseas confirmar la reserva?".',
    'Si no hay disponibilidad exacta, no confirmes. Ofrece 1 o 2 alternativas reales tomadas de slots disponibles, por ejemplo: "Ese horario ya esta lleno 😭 pero tengo disponible viernes 9:00 p. m. o sabado 7:30 p. m. ¿Cual te acomoda mejor?".',
    'Cuando el cliente quiera confirmar, solicita o valida estos datos: nombre, numero de WhatsApp, fecha, hora, cantidad de personas, plato o experiencia elegida y observacion especial.',
    'No digas "reserva confirmada" si falta algun dato requerido o si el slot no tiene cupo suficiente. Si falta algo, pidelo con naturalidad.',
    'Si todos los datos requeridos estan presentes y el slot tiene cupo, puedes confirmar claramente la reserva y repetir el resumen.',
    'El menu cambia segun el dia. Si el cliente menciona una fecha, usa menusPorFecha de menu-dia.json para recomendar solo platos del menu de esa fecha. Si la fecha no existe en menusPorFecha, recomienda carta general o pide confirmar por WhatsApp.',
    'Control de costos y foco: intenta recomendar en el primer mensaje util, y lleva hacia reserva o pedido entre el tercer y quinto mensaje si el cliente responde con interes. No alargues conversaciones alejadas del restaurante.',
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
      temperature: 0.75,
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
