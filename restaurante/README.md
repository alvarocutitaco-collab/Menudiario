
/* ═══════════════════════════════════════════════════════════════════
   CHEF ARTURO · app.js
   Módulos: Carta, Menú del Día, Chef IA, Chatbot, Carrito
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── ESTADO GLOBAL ─────────────────────────────────────────────────── */
let CONFIG  = {};
let MENU    = [];
let CART    = [];    // [{platoId, nombre, precio, qty, extras:[], nota, emoji}]
let MODAL_PLATO = null;
let CHAT_HISTORY = [];

const CHEF_CHAT_ENDPOINT = '/api/chef-chat';

/* ─── UTILIDADES ────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg) {
  let el = document.getElementById('toast-el');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-el';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

function formatMoney(n) {
  return CONFIG.moneda + ' ' + Number(n).toFixed(2);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderBotText(text) {
  return escapeHtml(text)
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/* ─── CARGA DE DATOS ────────────────────────────────────────────────── */
async function loadData() {
  try {
    const [menuRes, diaRes] = await Promise.all([
      fetch('./data/menu.json'),
      fetch('./data/menu-dia.json')
    ]);
    const menuData = await menuRes.json();
    const diaData  = await diaRes.json();

    CONFIG = menuData.negocio;
    MENU   = menuData.platos;

    applyConfig();
    renderCategorias(menuData.categorias);
    renderMenu(MENU);
    renderMenuDia(diaData);

  } catch (e) {
    console.error('Error cargando datos:', e);
    // Fallback amigable
    document.getElementById('menu-grid').innerHTML =
      '<p style="color:var(--cream-dim);text-align:center;grid-column:1/-1;padding:40px 0;">No se pudo cargar el menú. Verifica que los archivos JSON estén presentes.</p>';
  }
}

function applyConfig() {
  document.title = CONFIG.nombre;
  // Header
  const headerNombre = document.getElementById('header-nombre');
  if (headerNombre) headerNombre.textContent = CONFIG.nombre.split('·')[0].trim();
  // Hero
  const heroNombre = document.getElementById('hero-nombre');
  if (heroNombre) heroNombre.innerHTML = CONFIG.nombre.replace('·', '<br/><em>') + '</em>';

  document.getElementById('hero-horario').textContent   = '⏱ ' + CONFIG.horario;
  document.getElementById('hero-ubicacion').textContent = '📍 ' + CONFIG.ubicacion;
  document.getElementById('info-ubicacion').textContent = CONFIG.ubicacion;
  document.getElementById('info-horario').textContent   = CONFIG.horario;
  document.getElementById('footer-nombre').textContent  = CONFIG.nombre;

  // WhatsApp nosotros
  document.getElementById('whatsapp-nosotros').href =
    `https://wa.me/${CONFIG.whatsapp}?text=Hola! Me gustaría hacer una reserva o consulta.`;
}

/* ─── CARTA DIGITAL ─────────────────────────────────────────────────── */
function renderCategorias(cats) {
  const container = document.getElementById('category-filters');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    container.appendChild(btn);
  });

  $$('.cat-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    renderMenu(cat === 'Todos' ? MENU : MENU.filter(p => p.categoria === cat));
  }));
}

function renderMenu(platos) {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = '';

  if (!platos.length) {
    grid.innerHTML = '<p style="color:var(--cream-dim);text-align:center;grid-column:1/-1;padding:40px 0;">No hay platos en esta categoría.</p>';
    return;
  }

  platos.forEach((plato, i) => {
    const card = document.createElement('div');
    card.className = 'menu-card fade-up';
    card.style.animationDelay = `${i * 0.06}s`;

    const inCart  = CART.find(c => c.platoId === plato.id);
    const qtyInCart = inCart ? CART.filter(c => c.platoId === plato.id).reduce((a,b) => a + b.qty, 0) : 0;

    card.innerHTML = `
      ${plato.imagen
        ? `<img class="menu-card-img" src="${plato.imagen}" alt="${plato.nombre}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="menu-card-img-placeholder" style="display:none;">${plato.emoji}</div>`
        : `<div class="menu-card-img-placeholder">${plato.emoji}</div>`
      }
      <div class="menu-card-body">
        <div class="menu-card-cat">${plato.categoria}</div>
        <div class="menu-card-name">${plato.nombre}</div>
        <div class="menu-card-desc">${plato.descripcion}</div>
        ${plato.extras && plato.extras.length
          ? `<button class="extras-link" data-id="${plato.id}">✦ Personalizar extras</button>`
          : ''}
        <div class="menu-card-footer">
          <span class="menu-card-price">${formatMoney(plato.precio)}</span>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <div class="qty-controls">
              <button class="qty-btn" data-action="dec" data-id="${plato.id}">−</button>
              <span class="qty-num" id="qty-${plato.id}">${qtyInCart}</span>
              <button class="qty-btn" data-action="inc" data-id="${plato.id}">+</button>
            </div>
            <button class="btn-add-cart ${qtyInCart > 0 ? 'added' : ''}" data-id="${plato.id}">
              ${qtyInCart > 0 ? '✓ Agregado' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Eventos por delegación
  grid.addEventListener('click', handleCardClick);
}

function handleCardClick(e) {
  const btn = e.target.closest('[data-action]');
  const addBtn = e.target.closest('.btn-add-cart');
  const extrasBtn = e.target.closest('.extras-link');

  if (btn) {
    const id = parseInt(btn.dataset.id);
    const plato = MENU.find(p => p.id === id);
    if (!plato) return;

    if (btn.dataset.action === 'inc') addToCart(plato, 1, [], '');
    if (btn.dataset.action === 'dec') removeFromCart(id);
    updateQtyDisplay(id);
  }

  if (addBtn) {
    const id = parseInt(addBtn.dataset.id);
    const plato = MENU.find(p => p.id === id);
    if (!plato) return;
    if (!CART.find(c => c.platoId === id)) {
      addToCart(plato, 1, [], '');
      updateQtyDisplay(id);
    }
  }

  if (extrasBtn) {
    const id = parseInt(extrasBtn.dataset.id);
    openExtrasModal(MENU.find(p => p.id === id));
  }
}

function addToCart(plato, qty, extras, nota) {
  // Busca entrada existente sin extras especiales
  const existing = CART.find(c =>
    c.platoId === plato.id &&
    JSON.stringify(c.extras) === JSON.stringify(extras) &&
    c.nota === nota
  );
  if (existing) {
    existing.qty += qty;
  } else {
    CART.push({
      uid: Date.now() + Math.random(),
      platoId: plato.id,
      nombre: plato.nombre,
      precio: plato.precio,
      emoji: plato.emoji,
      qty,
      extras,
      nota
    });
  }
  updateCartBadge();
  toast(`✦ ${plato.nombre} agregado`);
}

function removeFromCart(platoId) {
  const idx = CART.findLastIndex(c => c.platoId === platoId);
  if (idx === -1) return;
  if (CART[idx].qty > 1) {
    CART[idx].qty--;
  } else {
    CART.splice(idx, 1);
  }
  updateCartBadge();
}

function updateQtyDisplay(platoId) {
  const total = CART.filter(c => c.platoId === platoId).reduce((a,b) => a+b.qty, 0);
  const el = document.getElementById(`qty-${platoId}`);
  if (el) el.textContent = total;

  const addBtns = $$(`[data-id="${platoId}"].btn-add-cart`);
  addBtns.forEach(b => {
    if (total > 0) { b.textContent = '✓ Agregado'; b.classList.add('added'); }
    else           { b.textContent = 'Agregar';    b.classList.remove('added'); }
  });
}

function updateCartBadge() {
  const total = CART.reduce((a,b) => a+b.qty, 0);
  document.getElementById('cart-badge').textContent = total;
  renderCartDrawer();
}

/* ─── CART DRAWER ───────────────────────────────────────────────────── */
document.getElementById('cart-toggle').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-overlay').addEventListener('click', closeCart);

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('active');
  renderCartDrawer();
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('active');
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items');
  const footer    = document.getElementById('cart-footer');

  if (!CART.length) {
    container.innerHTML = '<p class="cart-empty">Tu pedido está vacío. ¡Agrega algo delicioso!</p>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  container.innerHTML  = '';

  CART.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-emoji">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        ${item.extras.length ? `<div class="cart-item-extras">+ ${item.extras.join(', ')}</div>` : ''}
        ${item.nota ? `<div class="cart-item-extras">📝 ${item.nota}</div>` : ''}
        <div class="cart-item-row">
          <div class="qty-controls">
            <button class="qty-btn" data-uid="${item.uid}" data-action="cart-dec">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-uid="${item.uid}" data-action="cart-inc">+</button>
          </div>
          <span class="cart-item-price">${formatMoney(item.precio * item.qty)}</span>
          <button class="cart-item-remove" data-uid="${item.uid}" data-action="cart-rm">🗑</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  // Eventos del carrito
  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const uid = btn.dataset.uid;
    const item = CART.find(c => String(c.uid) === uid);
    if (!item) return;

    if (btn.dataset.action === 'cart-inc') { item.qty++; }
    if (btn.dataset.action === 'cart-dec') { item.qty > 1 ? item.qty-- : CART.splice(CART.indexOf(item), 1); }
    if (btn.dataset.action === 'cart-rm')  { CART.splice(CART.indexOf(item), 1); }

    updateCartBadge();
    // Refrescar displays en la carta
    const ids = [...new Set(CART.map(c => c.platoId))];
    ids.forEach(updateQtyDisplay);
  };

  // Total
  const total = CART.reduce((a,b) => a + b.precio * b.qty, 0);
  document.getElementById('cart-total').textContent = formatMoney(total);
}

/* ─── ENVÍO POR WHATSAPP ────────────────────────────────────────────── */
document.getElementById('send-order-btn').addEventListener('click', sendWhatsApp);

function sendWhatsApp() {
  if (!CART.length) { toast('Agrega platos antes de enviar'); return; }

  const nota = document.getElementById('cart-nota-general').value.trim();
  const total = CART.reduce((a,b) => a + b.precio * b.qty, 0);

  let msg = `🍽 *Pedido — ${CONFIG.nombre}*\n\n`;

  CART.forEach(item => {
    msg += `• ${item.qty}x *${item.nombre}* — ${formatMoney(item.precio * item.qty)}\n`;
    if (item.extras.length)  msg += `   _Extras: ${item.extras.join(', ')}_\n`;
    if (item.nota)           msg += `   _Nota: ${item.nota}_\n`;
  });

  msg += `\n*Total: ${formatMoney(total)}*`;
  if (nota) msg += `\n\n📝 *Nota general:* ${nota}`;
  msg += '\n\n_Gracias por su pedido 🙏_';

  const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

/* ─── MODAL EXTRAS ──────────────────────────────────────────────────── */
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function openExtrasModal(plato) {
  MODAL_PLATO = plato;
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-cat">${plato.categoria}</div>
    <h4>${plato.emoji} ${plato.nombre}</h4>
    <p class="modal-desc">${plato.descripcion}</p>
    <p class="extras-label">Selecciona extras</p>
    <div class="extras-options" id="extras-chips">
      ${plato.extras.map(e => `<div class="extra-chip" data-extra="${e}">${e}</div>`).join('')}
    </div>
    <div class="modal-qty-row">
      <label>Cantidad</label>
      <div class="qty-controls">
        <button class="qty-btn" id="modal-dec">−</button>
        <span class="qty-num" id="modal-qty">1</span>
        <button class="qty-btn" id="modal-inc">+</button>
      </div>
    </div>
    <div class="modal-nota">
      <label>Nota especial para este plato (opcional)</label>
      <textarea id="modal-nota-input" placeholder="Ej: sin sal, alergia al maní..."></textarea>
    </div>
    <button class="btn btn-primary btn-full" id="modal-add-btn">
      Agregar al pedido · ${formatMoney(plato.precio)}
    </button>
  `;

  let modalQty = 1;
  document.getElementById('modal-inc').onclick = () => {
    modalQty++;
    document.getElementById('modal-qty').textContent = modalQty;
    document.getElementById('modal-add-btn').textContent = `Agregar al pedido · ${formatMoney(plato.precio * modalQty)}`;
  };
  document.getElementById('modal-dec').onclick = () => {
    if (modalQty > 1) { modalQty--; document.getElementById('modal-qty').textContent = modalQty; }
    document.getElementById('modal-add-btn').textContent = `Agregar al pedido · ${formatMoney(plato.precio * modalQty)}`;
  };

  // Selección de extras
  $$('.extra-chip', content).forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  document.getElementById('modal-add-btn').onclick = () => {
    const selectedExtras = $$('.extra-chip.selected', content).map(c => c.dataset.extra);
    const nota = document.getElementById('modal-nota-input').value.trim();
    addToCart(plato, modalQty, selectedExtras, nota);
    updateQtyDisplay(plato.id);
    closeModal();
  };

  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  MODAL_PLATO = null;
}

/* ─── MENÚ DEL DÍA ──────────────────────────────────────────────────── */
async function renderMenuDia(d) {
  const card = document.getElementById('menu-dia-card');

  const headerHtml = `
    <div class="menu-dia-header">
      <h3>${d.titulo}</h3>
      <p>${d.subtitulo}</p>
      <div class="menu-dia-precio">${formatMoney(d.precio)}</div>
    </div>
  `;

  if (!d.disponible) {
    card.innerHTML = `
      ${headerHtml}
      <div class="menu-dia-agotado">😞 Menú del día agotado por hoy.<br/>¡Mañana volvemos con más!</div>
    `;
    return;
  }

  card.innerHTML = `
    ${headerHtml}
    <div class="menu-dia-body">
      <div class="menu-dia-item">
        <div class="menu-dia-emoji">🥣</div>
        <div class="menu-dia-item-text">
          <strong>Entrada · ${d.entrada.nombre}</strong>
          <span>${d.entrada.descripcion}</span>
        </div>
      </div>
      <div class="menu-dia-item">
        <div class="menu-dia-emoji">🍲</div>
        <div class="menu-dia-item-text">
          <strong>Fondo · ${d.fondo.nombre}</strong>
          <span>${d.fondo.descripcion}</span>
        </div>
      </div>
      ${d.postre ? `
      <div class="menu-dia-item">
        <div class="menu-dia-emoji">🍮</div>
        <div class="menu-dia-item-text">
          <strong>Postre · ${d.postre.nombre}</strong>
          <span>${d.postre.descripcion}</span>
        </div>
      </div>` : ''}
      <div class="menu-dia-item">
        <div class="menu-dia-emoji">🥤</div>
        <div class="menu-dia-item-text">
          <strong>Bebida · ${d.bebida.nombre}</strong>
          <span>${d.bebida.descripcion}</span>
        </div>
      </div>
      ${d.nota ? `<p class="menu-dia-nota">✦ ${d.nota}</p>` : ''}
    </div>
    <div class="menu-dia-actions">
      <button class="btn btn-whatsapp btn-full" id="menu-dia-wa-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Pedir Menú del Día por WhatsApp
      </button>
    </div>
  `;

  document.getElementById('menu-dia-wa-btn').addEventListener('click', () => {
    const msg = `🍽 *Menú del Día — ${CONFIG.nombre}*\n\n` +
      `🥣 Entrada: *${d.entrada.nombre}*\n` +
      `🍲 Fondo: *${d.fondo.nombre}*\n` +
      (d.postre ? `🍮 Postre: *${d.postre.nombre}*\n` : '') +
      `🥤 Bebida: *${d.bebida.nombre}*\n\n` +
      `*Total: ${formatMoney(d.precio)}*\n\n` +
      `_Quiero pedir el Menú del Día por favor 🙏_`;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

/* ─── CHEF IA — RECOMENDADOR ─────────────────────────────────────────── */
const MOOD_MAP = {
  picante:     ['picante'],
  barato:      ['barato', 'bebida'],
  compartir:   ['compartir', 'compartir'],
  contundente: ['contundente'],
  fresco:      ['fresco', 'marino'],
  marino:      ['marino'],
  dulce:       ['dulce', 'postre'],
  clasico:     ['clasico', 'peruano']
};

const MOOD_MSG = {
  picante:     '🌶️ Para los amantes del picante, te recomiendo:',
  barato:      '💰 Lo mejor relación calidad-precio:',
  compartir:   '👥 Ideal para compartir en buena compañía:',
  contundente: '💪 Platos contundentes para reponer energías:',
  fresco:      '🌿 Opciones ligeras y frescas:',
  marino:      '🌊 Lo mejor del mar:',
  dulce:       '🍫 Para cerrar con dulzura:',
  clasico:     '🏆 Clásicos peruanos irresistibles:'
};

$$('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showIaRecommendation(btn.dataset.mood, MOOD_MSG[btn.dataset.mood]);
  });
});

document.getElementById('ia-buscar').addEventListener('click', () => {
  const query = document.getElementById('ia-input').value.trim().toLowerCase();
  if (!query) { toast('Escribe lo que se te antoja'); return; }
  handleFreeQuery(query);
});

document.getElementById('ia-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('ia-buscar').click();
});

function showIaRecommendation(mood, titulo) {
  const tags   = MOOD_MAP[mood] || [mood];
  const result = scoreAndFilter(tags);
  displayIaResult(titulo || '✦ Te recomiendo:', result);
}

function handleFreeQuery(query) {
  // Mapeo de palabras clave
  const keyMap = {
    picante:     ['picante','ají','spicy','chile'],
    barato:      ['barato','económico','económic','precio','sencillo','bolsillo','pobre'],
    contundente: ['contundente','llena','llenador','energía','fuerza','hambre','mucho'],
    fresco:      ['fresco','liviano','light','diet','sano','saludable','ligero'],
    marino:      ['mar','pescado','mariscos','ceviche','trucha','camarón','marino'],
    compartir:   ['compartir','grupo','amigos','familia','varios'],
    dulce:       ['dulce','postre','chocolate','torta','bizcocho','arroz con leche'],
    clasico:     ['clásico','peruano','tradicional','típico','lomo','ají']
  };

  let bestMood = null, bestScore = 0;
  for (const [mood, words] of Object.entries(keyMap)) {
    const score = words.filter(w => query.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestMood = mood; }
  }

  if (bestMood) {
    showIaRecommendation(bestMood, `🤖 Basado en "${query}", te recomiendo:`);
  } else {
    // Fallback: buscar coincidencia con nombre del plato
    const matches = MENU.filter(p =>
      p.nombre.toLowerCase().includes(query) ||
      p.descripcion.toLowerCase().includes(query) ||
      p.categoria.toLowerCase().includes(query)
    );
    if (matches.length) {
      displayIaResult(`🔍 Encontré esto para "${query}":`, matches.slice(0, 3));
    } else {
      displayIaResult(`😅 No encontré coincidencias para "${query}"`, []);
    }
  }
}

function scoreAndFilter(tags) {
  return MENU
    .map(p => ({ p, score: tags.filter(t => p.tags.includes(t)).length }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || a.p.precio - b.p.precio)
    .slice(0, 3)
    .map(x => x.p);
}

function displayIaResult(titulo, platos) {
  const container = document.getElementById('ia-result');
  container.style.display = 'block';

  if (!platos.length) {
    container.innerHTML = `
      <div class="ia-result-header">${titulo}</div>
      <div class="ia-no-result">No encontré platos que coincidan exactamente. ¡Prueba con otro criterio!</div>`;
    return;
  }

  const platosHtml = platos.map(p => `
    <div class="ia-plato-card">
      <div class="ia-plato-emoji">${p.emoji}</div>
      <div class="ia-plato-info">
        <strong>${p.nombre}</strong>
        <p>${p.descripcion.split('.')[0]}.</p>
        <span class="ia-plato-price">${formatMoney(p.precio)}</span>
      </div>
      <button class="btn-add-cart" style="flex-shrink:0;align-self:center;" data-id="${p.id}">
        + Agregar
      </button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="ia-result-header">${titulo}</div>
    <div class="ia-result-body">${platosHtml}</div>
  `;

  // Eventos para agregar desde IA
  $$('.btn-add-cart', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const plato = MENU.find(p => p.id === id);
      if (plato) { addToCart(plato, 1, [], ''); updateQtyDisplay(id); }
    });
  });
}

/* ─── CHATBOT ───────────────────────────────────────────────────────── */
const CHATBOT_RESPONSES = {
  horarios: () =>
    `⏱ *Horario de atención:*\n${CONFIG.horario}\n\n¿Hay algo más en que pueda ayudarte?`,

  ubicacion: () =>
    `📍 *Nos encuentras en:*\n${CONFIG.ubicacion}\n\nPuedes escribirnos por WhatsApp y te mandamos el pin de ubicación 📌`,

  delivery: () =>
    `🛵 *Delivery disponible!*\n\nConsulta por zona y costo enviando un mensaje al WhatsApp. Hacemos entregas en distintos distritos de Arequipa.`,

  pago: () =>
    `💳 *Métodos de pago:*\n• 💵 Efectivo\n• 📱 Yape\n• 📱 Plin\n• 🏦 Transferencia bancaria\n\nNo manejamos tarjetas por el momento.`,

  menu: () => {
    const dia = window._menuDiaData;
    if (!dia) return '🍽 El menú del día cambia cada jornada. ¡Pregúntanos directamente por WhatsApp!';
    if (!dia.disponible) return '😞 El menú del día está *agotado* por hoy. ¡Mañana volvemos con más!';
    return `🍽 *Menú del Día — ${formatMoney(dia.precio)}:*\n🥣 ${dia.entrada.nombre}\n🍲 ${dia.fondo.nombre}\n🥤 ${dia.bebida.nombre}\n\n¿Lo pedimos?`;
  },

  pedido: () =>
    `📋 *¿Cómo hacer tu pedido?*\n\n1️⃣ Ve a la sección *"Carta"*\n2️⃣ Selecciona tus platos y cantidades\n3️⃣ Presiona *"Enviar Pedido por WhatsApp"*\n4️⃣ ¡Te confirmamos y preparamos!\n\nO también puedes escribirnos directamente 😊`,

  promociones: () =>
    `🎉 *Promociones vigentes:*\n• Menú del día a precio especial\n• Descuento a grupos de 6+ personas\n• Consulta por eventos y cenas privadas\n\n¡Síguenos en ${CONFIG.instagram || 'nuestro Instagram'} para más novedades!`,

  default: () =>
    `Hmm, no entendí bien tu consulta 😅\n\nPrueba preguntar sobre:\n• Horarios\n• Ubicación\n• Delivery\n• Métodos de pago\n• Menú del día\n• Cómo hacer un pedido`
};

const CHATBOT_KEYWORDS = {
  horarios:    ['horario', 'hora', 'abierto', 'cerrado', 'cuándo', 'cuando', 'atienden'],
  ubicacion:   ['donde', 'dónde', 'ubica', 'ubicación', 'dirección', 'dirección', 'lugar', 'llegar'],
  delivery:    ['delivery', 'despacho', 'envío', 'envio', 'mandan', 'traen', 'domicilio'],
  pago:        ['pago', 'pagar', 'yape', 'plin', 'transferencia', 'efectivo', 'tarjeta'],
  menu:        ['menú', 'menu', 'hoy', 'día', 'dia', 'almuerzo'],
  pedido:      ['pedir', 'pedido', 'ordenar', 'orden', 'cómo', 'como', 'comprar'],
  promociones: ['promo', 'descuento', 'oferta', 'especial', 'promoción']
};

function chatbotDetectIntent(msg) {
  const lower = msg.toLowerCase();
  for (const [intent, words] of Object.entries(CHATBOT_KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return intent;
  }
  return 'default';
}

let chatbotOpen = false;
let chatbotGreeted = false;

document.getElementById('chatbot-toggle').addEventListener('click', () => {
  chatbotOpen = !chatbotOpen;
  document.getElementById('chatbot-window').classList.toggle('open', chatbotOpen);
  if (chatbotOpen && !chatbotGreeted) {
    chatbotGreeted = true;
    setTimeout(() => {
      addBotMessage(`¡Hola! 👋 Soy el asistente de *${CONFIG.nombre || 'nuestra cocina'}*.\n\n¿En qué puedo ayudarte hoy?`);
    }, 400);
  }
});

document.getElementById('chatbot-close').addEventListener('click', () => {
  chatbotOpen = false;
  document.getElementById('chatbot-window').classList.remove('open');
});

document.getElementById('chatbot-send').addEventListener('click', sendChatMessage);
document.getElementById('chatbot-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

$$('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    addUserMessage(btn.textContent);
    respondToIntent(btn.dataset.q);
  });
});

async function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  addUserMessage(msg);
  const typing = addBotThinking();
  const aiReply = await askChefChat(msg);
  typing.remove();

  if (aiReply) {
    addBotMessage(aiReply, { showWhatsApp: shouldOfferWhatsApp(aiReply) });
    return;
  }

  const intent = chatbotDetectIntent(msg);
  respondToIntent(intent);
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg msg-user';
  div.textContent = text;
  document.getElementById('chatbot-messages').appendChild(div);
  scrollChatToBottom();
}

function addBotThinking() {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  div.textContent = 'Chef IA esta pensando...';
  document.getElementById('chatbot-messages').appendChild(div);
  scrollChatToBottom();
  return div;
}

function addBotMessage(text, options = {}) {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  // Convertir *texto* en negrita
  div.innerHTML = renderBotText(text);
  document.getElementById('chatbot-messages').appendChild(div);
  scrollChatToBottom();

  // Botón de WhatsApp al final de respuestas relevantes
  if (options.showWhatsApp || ['menu','pedido','delivery','default'].includes(currentIntent)) {
    const waDiv = document.createElement('div');
    waDiv.className = 'msg msg-bot';
    waDiv.innerHTML = `<a href="https://wa.me/${CONFIG.whatsapp}" target="_blank" class="btn btn-whatsapp" style="font-size:.8rem;padding:8px 16px;">📲 Escribir al WhatsApp</a>`;
    document.getElementById('chatbot-messages').appendChild(waDiv);
    scrollChatToBottom();
  }
}

async function askChefChat(message) {
  try {
    const response = await fetch(CHEF_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: CHAT_HISTORY.slice(-8)
      })
    });

    if (!response.ok) throw new Error('Chef IA no disponible');

    const data = await response.json();
    if (!data.reply) throw new Error('Respuesta vacia');

    CHAT_HISTORY.push({ role: 'user', content: message });
    CHAT_HISTORY.push({ role: 'assistant', content: data.reply });
    CHAT_HISTORY = CHAT_HISTORY.slice(-10);

    return data.reply;
  } catch (error) {
    console.warn('Chef IA usando respaldo local:', error);
    return null;
  }
}

function shouldOfferWhatsApp(text) {
  const lower = text.toLowerCase();
  return ['whatsapp', 'reserva', 'reservar', 'pedido', 'pedir', 'delivery', 'confirmar'].some(word => lower.includes(word));
}

let currentIntent = '';
function respondToIntent(intent) {
  currentIntent = intent;
  const respFn = CHATBOT_RESPONSES[intent] || CHATBOT_RESPONSES.default;
  addBotMessage(respFn());
}

function scrollChatToBottom() {
  const msgs = document.getElementById('chatbot-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

/* ─── INICIALIZACIÓN ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  // Guardar menú del día para el chatbot
  try {
    const r = await fetch('./data/menu-dia.json');
    window._menuDiaData = await r.json();
  } catch(e) {}
});

// Smooth scroll para anclas
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chef Arturo · Cocina de Autor</title>
  <meta name="description" content="Restaurante de autor en Arequipa. Carta digital, menú del día y pedidos por WhatsApp." />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="styles.css" />
</head>
<body>

  <!-- ═══════════════════════════════════ HEADER ═══════════════════════════════════ -->
  <header class="site-header" id="top">
    <div class="header-inner">
      <div class="logo">
        <span class="logo-icon">✦</span>
        <div class="logo-text">
          <span class="logo-name" id="header-nombre">Chef Arturo</span>
          <span class="logo-sub">Cocina de Autor</span>
        </div>
      </div>
      <nav class="main-nav">
        <a href="#carta" class="nav-link">Carta</a>
        <a href="#menu-dia" class="nav-link">Menú del Día</a>
        <a href="#chef-ia" class="nav-link">Chef IA</a>
        <a href="#nosotros" class="nav-link">Nosotros</a>
      </nav>
      <button class="cart-btn" id="cart-toggle" aria-label="Ver pedido">
        <span class="cart-icon">🛒</span>
        <span class="cart-badge" id="cart-badge">0</span>
      </button>
    </div>
  </header>

  <!-- ═══════════════════════════════════ HERO ═══════════════════════════════════ -->
  <section class="hero" id="inicio">
    <div class="hero-bg"></div>
    <div class="hero-content">
      <p class="hero-eyebrow">Arequipa · Perú</p>
      <h1 class="hero-title" id="hero-nombre">Chef Arturo<br/><em>Cocina de Autor</em></h1>
      <p class="hero-desc">Tradición picantera arequipeña. Nuevos sabores. Misma alma.</p>
      <div class="hero-actions">
        <a href="#carta" class="btn btn-primary">Ver Carta Completa</a>
        <a href="#menu-dia" class="btn btn-ghost">Menú del Día</a>
      </div>
      <div class="hero-info" id="hero-info">
        <span class="info-pill" id="hero-horario">⏱ Cargando...</span>
        <span class="info-pill" id="hero-ubicacion">📍 Cargando...</span>
      </div>
    </div>
    <div class="hero-scroll-hint">
      <span>↓</span>
    </div>
  </section>

  <!-- ═══════════════════════════════════ CARTA DIGITAL ═══════════════════════════ -->
  <section class="section" id="carta">
    <div class="container">
      <div class="section-header">
        <p class="section-eyebrow">Nuestra Propuesta</p>
        <h2 class="section-title">Carta Digital</h2>
        <p class="section-desc">Selecciona tus platos y personaliza tu pedido. Te lo enviamos por WhatsApp.</p>
      </div>

      <!-- Filtros de categoría -->
      <div class="category-filters" id="category-filters">
        <button class="cat-btn active" data-cat="Todos">Todos</button>
      </div>

      <!-- Grid de platos -->
      <div class="menu-grid" id="menu-grid">
        <!-- Se llena con JS -->
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════ MENÚ DEL DÍA ═══════════════════════════ -->
  <section class="section section-dark" id="menu-dia">
    <div class="container">
      <div class="section-header">
        <p class="section-eyebrow">Diario</p>
        <h2 class="section-title">Menú del Día</h2>
      </div>
      <div class="menu-dia-card" id="menu-dia-card">
        <!-- Se llena con JS -->
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════ CHEF IA ════════════════════════════════ -->
  <section class="section" id="chef-ia">
    <div class="container">
      <div class="section-header">
        <p class="section-eyebrow">Inteligencia Gastronómica</p>
        <h2 class="section-title">Chef IA · Recomendador</h2>
        <p class="section-desc">Dime qué se te antoja y te recomiendo el plato perfecto.</p>
      </div>

      <div class="chef-ia-wrapper">
        <div class="mood-grid" id="mood-grid">
          <button class="mood-btn" data-mood="picante">🌶️ Quiero algo picante</button>
          <button class="mood-btn" data-mood="barato">💰 Quiero algo económico</button>
          <button class="mood-btn" data-mood="compartir">👥 Para compartir</button>
          <button class="mood-btn" data-mood="contundente">💪 Algo contundente</button>
          <button class="mood-btn" data-mood="fresco">🌿 Algo fresco y liviano</button>
          <button class="mood-btn" data-mood="marino">🌊 Sabores del mar</button>
          <button class="mood-btn" data-mood="dulce">🍫 Algo dulce</button>
          <button class="mood-btn" data-mood="clasico">🏆 Un clásico peruano</button>
        </div>

        <!-- Input libre -->
        <div class="ia-input-row">
          <input type="text" id="ia-input" class="ia-input" placeholder="O escribe lo que se te antoja..." />
          <button class="btn btn-primary" id="ia-buscar">Recomendar</button>
        </div>

        <!-- Resultado -->
        <div class="ia-result" id="ia-result" style="display:none;"></div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════ NOSOTROS ══════════════════════════════ -->
  <section class="section section-warm" id="nosotros">
    <div class="container">
      <div class="nosotros-grid">
        <div class="nosotros-text">
          <p class="section-eyebrow">Nuestra Historia</p>
          <h2 class="section-title">Una herencia.<br/><em>Reinventada.</em></h2>
          <p>Heredia nació en el Pedregal con una misión clara: que los sabores de la picantería arequipeña de toda la vida no se pierdan — y que tampoco se queden quietos. Miguel Ángel los lleva al siguiente nivel.</p>
          <p>Rocoto relleno, chupe de camarones, adobo mañanero... y junto a ellos, fusiones que nacen del mismo ADN arequipeño. Ingredientes locales, recetas heredadas, ideas nuevas.</p>
          <a href="#" id="whatsapp-nosotros" class="btn btn-whatsapp">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Reserva o consulta
          </a>
        </div>
        <div class="nosotros-info">
          <div class="info-card">
            <div class="info-item">
              <span class="info-icon">📍</span>
              <div>
                <strong>Ubicación</strong>
                <span id="info-ubicacion">Cargando...</span>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">⏱</span>
              <div>
                <strong>Horario</strong>
                <span id="info-horario">Cargando...</span>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">💳</span>
              <div>
                <strong>Pagos</strong>
                <span>Efectivo · Yape · Plin · Transferencia</span>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">🛵</span>
              <div>
                <strong>Delivery</strong>
                <span>Disponible · Consultar zona y costo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════ FOOTER ════════════════════════════════ -->
  <footer class="footer">
    <div class="container">
      <div class="footer-inner">
        <span class="logo-icon">✦</span>
        <span id="footer-nombre">Chef Arturo · Cocina de Autor</span>
        <span>Arequipa, Perú</span>
      </div>
    </div>
  </footer>

  <!-- ═══════════════════════════════════ CART DRAWER ═══════════════════════════ -->
  <div class="cart-overlay" id="cart-overlay"></div>
  <aside class="cart-drawer" id="cart-drawer">
    <div class="cart-header">
      <h3>Tu Pedido</h3>
      <button class="cart-close" id="cart-close">✕</button>
    </div>
    <div class="cart-items" id="cart-items">
      <p class="cart-empty">Tu pedido está vacío. ¡Agrega algo delicioso!</p>
    </div>
    <div class="cart-footer" id="cart-footer" style="display:none;">
      <div class="cart-total-row">
        <span>Total</span>
        <span id="cart-total" class="cart-total-amount">S/ 0.00</span>
      </div>
      <textarea class="cart-nota" id="cart-nota-general" placeholder="¿Alguna nota general? (alérgenos, dedicatoria, etc.)"></textarea>
      <button class="btn btn-whatsapp btn-full" id="send-order-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Enviar Pedido por WhatsApp
      </button>
    </div>
  </aside>

  <!-- ═══════════════════════════════════ MODAL EXTRAS ══════════════════════════ -->
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal-extras">
      <button class="modal-close" id="modal-close">✕</button>
      <div id="modal-content"></div>
    </div>
  </div>

  <!-- ═══════════════════════════════════ CHATBOT ═══════════════════════════════ -->
  <button class="chatbot-fab" id="chatbot-toggle" aria-label="Chat">
    <span class="chatbot-fab-icon">💬</span>
    <span class="chatbot-fab-pulse"></span>
  </button>

  <div class="chatbot-window" id="chatbot-window">
    <div class="chatbot-header">
      <div class="chatbot-avatar">👨‍🍳</div>
      <div class="chatbot-info">
        <strong>Asistente del Chef</strong>
        <span class="chatbot-status">● En línea</span>
      </div>
      <button class="chatbot-close" id="chatbot-close">✕</button>
    </div>
    <div class="chatbot-messages" id="chatbot-messages">
      <!-- Mensajes se agregan con JS -->
    </div>
    <div class="chatbot-quick" id="chatbot-quick">
      <button class="quick-btn" data-q="horarios">🕐 Horarios</button>
      <button class="quick-btn" data-q="ubicacion">📍 Ubicación</button>
      <button class="quick-btn" data-q="delivery">🛵 Delivery</button>
      <button class="quick-btn" data-q="pago">💳 Pagos</button>
      <button class="quick-btn" data-q="menu">🍽 Menú hoy</button>
      <button class="quick-btn" data-q="pedido">📋 Hacer pedido</button>
    </div>
    <div class="chatbot-input-row">
      <input type="text" id="chatbot-input" class="chatbot-input" placeholder="Escribe tu pregunta..." />
      <button class="chatbot-send" id="chatbot-send">➤</button>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>

[build]
  publish = "."
  functions = "netlify/functions"

[[redirects]]
  from = "/api/chef-chat"
  to = "/.netlify/functions/chef-chat"
  status = 200

# Chef Arturo · Cocina de Autor
## Sitio web gastronómico completo

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
restaurante/
├── index.html          ← Página principal (no tocar estructura)
├── styles.css          ← Todos los estilos visuales
├── app.js              ← Toda la lógica (carta, chatbot, IA, carrito)
├── data/
│   ├── menu.json       ← ✏️ AQUÍ editas la carta completa
│   └── menu-dia.json   ← ✏️ AQUÍ editas el menú del día (cambiar diario)
├── assets/
│   └── img/            ← Coloca aquí tus fotos de platos
└── README.md           ← Esta guía
```

---

## ✏️ CÓMO PERSONALIZAR (sin saber programar)

### 1. Cambiar nombre, WhatsApp, horario y ubicación
Abre `data/menu.json` y edita la sección "negocio" al inicio:

```json
"negocio": {
  "nombre": "TU NOMBRE AQUÍ",
  "whatsapp": "51999999999",        ← Número con código de país (51 = Perú)
  "ubicacion": "Tu dirección aquí",
  "horario": "Lun a Vie: 12pm - 9pm",
  "moneda": "S/"
}
```

### 2. Agregar o editar platos en la carta
En `data/menu.json`, en la sección "platos", cada plato tiene esta estructura:

```json
{
  "id": 10,                          ← Número único (incrementar)
  "nombre": "Nombre del plato",
  "descripcion": "Descripción corta y apetitosa",
  "precio": 25,                      ← Precio en números (sin símbolo)
  "categoria": "Fondos",             ← Debe coincidir con alguna categoría
  "emoji": "🍖",                     ← Emoji representativo
  "tags": ["contundente", "clasico"],← Para el recomendador IA
  "extras": ["Sin sal", "Extra salsa"],← Opciones de personalización
  "imagen": "https://url-de-imagen.jpg" ← URL de imagen o ruta local
}
```

**Tags disponibles para Chef IA:**
`picante` | `barato` | `compartir` | `contundente` | `fresco` | `marino` | `dulce` | `clasico` | `peruano` | `pasta` | `italiano` | `postre` | `bebida` | `especial`

### 3. Cambiar el Menú del Día
Abre `data/menu-dia.json` y edita:

```json
{
  "disponible": true,    ← Cambiar a false cuando se acabe
  "precio": 25,
  "entrada": { "nombre": "Nombre", "descripcion": "Descripción" },
  "fondo":   { "nombre": "Nombre", "descripcion": "Descripción" },
  "postre":  { "nombre": "Nombre", "descripcion": "Descripción" },
  "bebida":  { "nombre": "Nombre", "descripcion": "Descripción" },
  "nota": "Incluye pan artesanal"
}
```

**Para marcar como agotado:** cambia `"disponible": false`

### 4. Usar imágenes propias
Coloca tus fotos en la carpeta `assets/img/` y en el JSON usa:
```json
"imagen": "./assets/img/mi-plato.jpg"
```

---

## 🚀 PUBLICAR GRATIS (GitHub + Netlify)

### Paso 1: Crear cuenta en GitHub
1. Ve a https://github.com → Sign Up (gratis)
2. Crea un nuevo repositorio (New repository)
3. Nómbralo: `mi-restaurante`

### Paso 2: Subir archivos
1. En el repositorio recién creado, haz clic en "uploading an existing file"
2. Arrastra toda la carpeta `restaurante/` o los archivos
3. Escribe un mensaje como "Primera versión del sitio"
4. Haz clic en "Commit changes"

### Paso 3: Publicar en Netlify
1. Ve a https://netlify.com → Sign Up con tu cuenta de GitHub (gratis)
2. Haz clic en "Add new site" → "Import an existing project"
3. Selecciona GitHub → selecciona tu repositorio
4. Haz clic en "Deploy site"
5. ¡Listo! Te dará una URL como `https://tu-restaurante.netlify.app`

### Para actualizar el menú:
Edita los archivos JSON en GitHub directamente desde el navegador y los cambios se publican en 1-2 minutos automáticamente.

---

## 📱 FUNCIONES INCLUIDAS

| Función | Descripción |
|---------|-------------|
| 🛒 Carta digital | Fotos, precios, categorías, extras, notas por plato |
| 🔢 Cantidades | Aumentar/disminuir desde la carta |
| ✦ Personalizar | Modal con extras y nota especial por plato |
| 💬 Envío WhatsApp | Pedido formateado automáticamente |
| 🍽 Menú del día | Configurable desde JSON, con botón WhatsApp |
| 😞 Agotado | Muestra banner cuando disponible=false |
| 🤖 Chef IA | 8 estados de ánimo + búsqueda libre de texto |
| 💬 Chatbot | Horarios, ubicación, delivery, pagos, menú del día |
| 📱 Responsive | Optimizado para celular |
| 🎨 Diseño | Estética editorial de alta cocina |

---

## 🔮 PRÓXIMOS PASOS (cuando estés listo)

- **Fotos propias:** Reemplaza las URLs de Unsplash por fotos de tus platos reales
- **Dominio propio:** En Netlify puedes conectar un dominio como `www.chefarturo.pe` (~$12/año)
- **Chef IA con IA real:** Conectar a Claude API para recomendaciones inteligentes
- **Reservas online:** Integrar Calendly o similar
- **Galería:** Agregar sección de fotos del local

---

*Desarrollado con HTML, CSS y JavaScript puro. Sin frameworks. Sin costos de servidor.*

/* ═══════════════════════════════════════════════════════════════════
   CHEF ARTURO · COCINA DE AUTOR
   Estética: Editorial de Alta Cocina — Oscuro, Elegante, Dorado
   ═══════════════════════════════════════════════════════════════════ */

/* ─── VARIABLES ────────────────────────────────────────────────────── */
:root {
  --bg:         #0d0d0b;
  --bg2:        #141410;
  --bg3:        #1a1a15;
  --bg-warm:    #13120e;
  --surface:    #1f1e18;
  --surface2:   #282720;
  --gold:       #c9a84c;
  --gold-light: #e2c87a;
  --gold-dim:   #8a6f2e;
  --cream:      #f5f0e8;
  --cream-dim:  #c8bfaa;
  --red:        #c0392b;
  --green:      #27ae60;
  --whatsapp:   #25d366;
  --whatsapp-d: #1da851;
  --radius:     12px;
  --radius-lg:  20px;
  --shadow:     0 4px 24px rgba(0,0,0,.5);
  --shadow-gold:0 4px 32px rgba(201,168,76,.15);
  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-sans:  'DM Sans', sans-serif;
  --trans:      all .25s ease;
}

/* ─── RESET & BASE ──────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; font-size: 16px; }

body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--cream);
  line-height: 1.65;
  overflow-x: hidden;
}

a { color: var(--gold); text-decoration: none; }

img { max-width: 100%; display: block; }

/* ─── TYPOGRAPHY ────────────────────────────────────────────────────── */
h1,h2,h3,h4 { font-family: var(--font-serif); font-weight: 300; line-height: 1.15; }

em { font-style: italic; color: var(--gold); }

/* ─── LAYOUT HELPERS ─────────────────────────────────────────────────── */
.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }

.section { padding: 80px 0; }
.section-dark  { background: var(--bg2); }
.section-warm  { background: var(--bg-warm); }

.section-header { text-align: center; margin-bottom: 48px; }
.section-eyebrow {
  font-family: var(--font-sans);
  font-size: .75rem;
  font-weight: 500;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 10px;
}
.section-title {
  font-size: clamp(2rem, 5vw, 3rem);
  color: var(--cream);
  margin-bottom: 12px;
}
.section-desc { color: var(--cream-dim); font-size: .95rem; max-width: 540px; margin: 0 auto; }

/* ─── BUTTONS ───────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 28px; border-radius: 50px; font-family: var(--font-sans);
  font-size: .9rem; font-weight: 500; cursor: pointer; border: none;
  transition: var(--trans); text-decoration: none; white-space: nowrap;
}
.btn-primary { background: var(--gold); color: var(--bg); }
.btn-primary:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: var(--shadow-gold); }
.btn-ghost { background: transparent; color: var(--cream); border: 1px solid rgba(255,255,255,.2); }
.btn-ghost:hover { border-color: var(--gold); color: var(--gold); }
.btn-whatsapp { background: var(--whatsapp); color: #fff; }
.btn-whatsapp:hover { background: var(--whatsapp-d); transform: translateY(-2px); }
.btn-full { width: 100%; justify-content: center; padding: 16px; font-size: 1rem; border-radius: var(--radius); }

/* ─── HEADER ────────────────────────────────────────────────────────── */
.site-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(13,13,11,.9); backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(201,168,76,.12);
}
.header-inner {
  max-width: 1100px; margin: 0 auto; padding: 0 20px;
  height: 64px; display: flex; align-items: center; gap: 24px;
}
.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.logo-icon { color: var(--gold); font-size: 1.1rem; }
.logo-text { display: flex; flex-direction: column; line-height: 1.1; }
.logo-name { font-family: var(--font-serif); font-size: 1.1rem; color: var(--cream); }
.logo-sub { font-size: .65rem; letter-spacing: .15em; text-transform: uppercase; color: var(--gold-dim); }
.main-nav { display: flex; gap: 4px; margin-left: auto; }
.nav-link {
  padding: 8px 14px; border-radius: 8px; font-size: .85rem; color: var(--cream-dim);
  transition: var(--trans);
}
.nav-link:hover { color: var(--gold); background: rgba(201,168,76,.08); }
.cart-btn {
  position: relative; background: rgba(201,168,76,.12); border: 1px solid rgba(201,168,76,.2);
  color: var(--cream); padding: 9px 14px; border-radius: 10px; cursor: pointer;
  font-size: 1rem; transition: var(--trans); display: flex; align-items: center; gap: 6px;
}
.cart-btn:hover { background: rgba(201,168,76,.22); border-color: var(--gold); }
.cart-badge {
  background: var(--gold); color: var(--bg); font-size: .7rem; font-weight: 700;
  padding: 2px 7px; border-radius: 20px; min-width: 22px; text-align: center;
}

/* ─── HERO ──────────────────────────────────────────────────────────── */
.hero {
  min-height: 100vh; display: flex; flex-direction: column;
  justify-content: center; align-items: center; text-align: center;
  padding: 80px 20px 60px; position: relative; overflow: hidden;
}
.hero-bg {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,168,76,.07) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 80% 80%, rgba(201,168,76,.04) 0%, transparent 60%);
}
.hero-bg::before {
  content: '';
  position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
.hero-content { position: relative; z-index: 1; max-width: 700px; }
.hero-eyebrow {
  font-size: .75rem; letter-spacing: .2em; text-transform: uppercase;
  color: var(--gold); margin-bottom: 20px;
  display: inline-flex; align-items: center; gap: 10px;
}
.hero-eyebrow::before, .hero-eyebrow::after {
  content: ''; width: 30px; height: 1px; background: var(--gold-dim);
}
.hero-title {
  font-size: clamp(3rem, 10vw, 6rem); font-weight: 300;
  color: var(--cream); margin-bottom: 20px; letter-spacing: -.01em;
}
.hero-desc { font-size: 1.1rem; color: var(--cream-dim); margin-bottom: 36px; }
.hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom: 36px; }
.hero-info { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.info-pill {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  padding: 8px 18px; border-radius: 50px; font-size: .8rem; color: var(--cream-dim);
}
.hero-scroll-hint {
  position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
  color: var(--gold-dim); font-size: 1.2rem; animation: bounce 2s infinite;
}
@keyframes bounce {
  0%,100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(6px); }
}

/* ─── CATEGORY FILTERS ──────────────────────────────────────────────── */
.category-filters {
  display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
  margin-bottom: 40px;
}
.cat-btn {
  padding: 9px 22px; border-radius: 50px; border: 1px solid rgba(201,168,76,.2);
  background: transparent; color: var(--cream-dim); cursor: pointer; font-family: var(--font-sans);
  font-size: .85rem; transition: var(--trans);
}
.cat-btn:hover, .cat-btn.active {
  background: var(--gold); color: var(--bg); border-color: var(--gold);
}

/* ─── MENU GRID ─────────────────────────────────────────────────────── */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}
.menu-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.06);
  transition: var(--trans);
  display: flex; flex-direction: column;
}
.menu-card:hover {
  border-color: rgba(201,168,76,.25);
  transform: translateY(-4px);
  box-shadow: var(--shadow);
}
.menu-card-img {
  width: 100%; height: 200px; object-fit: cover;
  background: var(--surface2);
}
.menu-card-img-placeholder {
  width: 100%; height: 200px;
  background: linear-gradient(135deg, var(--surface2), var(--bg3));
  display: flex; align-items: center; justify-content: center;
  font-size: 3.5rem;
}
.menu-card-body { padding: 20px; flex: 1; display: flex; flex-direction: column; }
.menu-card-cat {
  font-size: .7rem; letter-spacing: .15em; text-transform: uppercase;
  color: var(--gold-dim); margin-bottom: 6px;
}
.menu-card-name {
  font-family: var(--font-serif); font-size: 1.3rem; color: var(--cream);
  margin-bottom: 8px;
}
.menu-card-desc { font-size: .85rem; color: var(--cream-dim); flex: 1; line-height: 1.55; }
.menu-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 18px; gap: 12px;
}
.menu-card-price {
  font-family: var(--font-serif); font-size: 1.4rem; color: var(--gold);
}

/* Contador de cantidad */
.qty-controls {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface2); border-radius: 30px; padding: 4px;
}
.qty-btn {
  width: 30px; height: 30px; border-radius: 50%; border: none;
  background: var(--bg3); color: var(--cream); cursor: pointer;
  font-size: 1rem; display: flex; align-items: center; justify-content: center;
  transition: var(--trans);
}
.qty-btn:hover { background: var(--gold); color: var(--bg); }
.qty-num { min-width: 24px; text-align: center; font-size: .9rem; font-weight: 500; }

.btn-add-cart {
  background: var(--gold); color: var(--bg); border: none;
  padding: 9px 18px; border-radius: 30px; cursor: pointer;
  font-family: var(--font-sans); font-size: .85rem; font-weight: 500;
  transition: var(--trans); white-space: nowrap;
}
.btn-add-cart:hover { background: var(--gold-light); transform: scale(1.04); }
.btn-add-cart.added { background: var(--green); color: #fff; }

.extras-link {
  font-size: .75rem; color: var(--gold-dim); cursor: pointer;
  margin-top: 6px; text-decoration: underline dotted;
  background: none; border: none; font-family: var(--font-sans);
  text-align: left; padding: 0;
}
.extras-link:hover { color: var(--gold); }

/* ─── MENÚ DEL DÍA ──────────────────────────────────────────────────── */
.menu-dia-card {
  max-width: 720px; margin: 0 auto;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(201,168,76,.2);
  overflow: hidden;
  box-shadow: var(--shadow-gold);
}
.menu-dia-header {
  background: linear-gradient(135deg, var(--gold-dim), var(--gold));
  padding: 28px 32px; text-align: center;
}
.menu-dia-header h3 {
  font-family: var(--font-serif); font-size: 2rem; color: var(--bg);
  font-weight: 300; margin-bottom: 4px;
}
.menu-dia-header p { font-size: .85rem; color: rgba(13,13,11,.7); }
.menu-dia-precio {
  font-family: var(--font-serif); font-size: 2.5rem; color: var(--bg);
  font-weight: 600; margin-top: 6px;
}
.menu-dia-body { padding: 28px 32px; }
.menu-dia-item { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.menu-dia-item:last-of-type { border-bottom: none; }
.menu-dia-emoji { font-size: 1.8rem; flex-shrink: 0; }
.menu-dia-item-text strong {
  display: block; font-family: var(--font-serif); font-size: 1.1rem; color: var(--cream); margin-bottom: 2px;
}
.menu-dia-item-text span { font-size: .85rem; color: var(--cream-dim); }
.menu-dia-nota { font-size: .8rem; color: var(--gold-dim); font-style: italic; padding: 12px 0 0; }
.menu-dia-actions { padding: 0 32px 28px; }
.menu-dia-agotado {
  text-align: center; color: var(--red); font-weight: 500;
  padding: 20px; font-size: 1.1rem;
}

/* ─── CHEF IA ────────────────────────────────────────────────────────── */
.chef-ia-wrapper { max-width: 700px; margin: 0 auto; }
.mood-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-bottom: 28px; }
.mood-btn {
  padding: 12px 22px; border-radius: 50px;
  background: var(--surface); border: 1px solid rgba(255,255,255,.1);
  color: var(--cream); cursor: pointer; font-family: var(--font-sans);
  font-size: .9rem; transition: var(--trans);
}
.mood-btn:hover, .mood-btn.active {
  background: var(--surface2); border-color: var(--gold); color: var(--gold);
}
.ia-input-row {
  display: flex; gap: 12px;
  background: var(--surface); border: 1px solid rgba(201,168,76,.2);
  border-radius: 50px; padding: 6px 6px 6px 20px;
  margin-bottom: 24px;
}
.ia-input {
  flex: 1; background: none; border: none; outline: none;
  color: var(--cream); font-family: var(--font-sans); font-size: .9rem;
}
.ia-input::placeholder { color: var(--cream-dim); }
.ia-result {
  background: var(--surface); border-radius: var(--radius-lg);
  border: 1px solid rgba(201,168,76,.2); overflow: hidden;
}
.ia-result-header {
  background: rgba(201,168,76,.08); padding: 16px 24px;
  font-size: .8rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--gold); border-bottom: 1px solid rgba(201,168,76,.12);
}
.ia-result-body { padding: 20px 24px; }
.ia-plato-card {
  display: flex; gap: 16px; align-items: flex-start;
  padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.05);
}
.ia-plato-card:last-child { border-bottom: none; }
.ia-plato-emoji { font-size: 2rem; flex-shrink: 0; }
.ia-plato-info strong {
  display: block; font-family: var(--font-serif); font-size: 1.1rem; color: var(--cream); margin-bottom: 2px;
}
.ia-plato-info p { font-size: .82rem; color: var(--cream-dim); margin-bottom: 6px; }
.ia-plato-price { font-family: var(--font-serif); color: var(--gold); font-size: 1.1rem; }
.ia-no-result { padding: 24px; text-align: center; color: var(--cream-dim); }

/* ─── NOSOTROS ──────────────────────────────────────────────────────── */
.nosotros-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
}
.nosotros-text p { color: var(--cream-dim); margin-bottom: 16px; font-size: .95rem; }
.nosotros-text .section-title { text-align: left; margin-bottom: 20px; }
.info-card {
  background: var(--surface); border-radius: var(--radius-lg);
  border: 1px solid rgba(201,168,76,.12); padding: 28px;
}
.info-item {
  display: flex; gap: 16px; padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
}
.info-item:last-child { border-bottom: none; }
.info-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
.info-item div { display: flex; flex-direction: column; gap: 3px; }
.info-item strong { font-size: .85rem; font-weight: 500; color: var(--cream); }
.info-item span { font-size: .82rem; color: var(--cream-dim); }

/* ─── FOOTER ────────────────────────────────────────────────────────── */
.footer {
  background: var(--bg2); border-top: 1px solid rgba(201,168,76,.1);
  padding: 28px 0; text-align: center;
}
.footer-inner {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  flex-wrap: wrap; font-size: .8rem; color: var(--cream-dim);
}
.footer-inner .logo-icon { color: var(--gold); }

/* ─── CART DRAWER ───────────────────────────────────────────────────── */
.cart-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
  opacity: 0; pointer-events: none; transition: opacity .3s;
}
.cart-overlay.active { opacity: 1; pointer-events: all; }

.cart-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 201;
  width: min(420px, 100vw);
  background: var(--surface);
  border-left: 1px solid rgba(201,168,76,.15);
  transform: translateX(100%); transition: transform .35s cubic-bezier(.4,0,.2,1);
  display: flex; flex-direction: column;
}
.cart-drawer.open { transform: translateX(0); }

.cart-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,.08);
}
.cart-header h3 { font-family: var(--font-serif); font-size: 1.5rem; }
.cart-close {
  background: none; border: none; color: var(--cream-dim); cursor: pointer;
  font-size: 1.2rem; padding: 4px; border-radius: 6px; transition: var(--trans);
}
.cart-close:hover { color: var(--cream); background: rgba(255,255,255,.08); }

.cart-items { flex: 1; overflow-y: auto; padding: 16px 24px; }
.cart-empty { color: var(--cream-dim); text-align: center; padding: 40px 0; font-size: .9rem; }

.cart-item {
  display: flex; gap: 12px; padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.cart-item-emoji { font-size: 1.6rem; flex-shrink: 0; }
.cart-item-info { flex: 1; }
.cart-item-name { font-size: .95rem; font-weight: 500; color: var(--cream); margin-bottom: 3px; }
.cart-item-extras { font-size: .78rem; color: var(--gold-dim); margin-bottom: 6px; }
.cart-item-row { display: flex; align-items: center; gap: 10px; }
.cart-item-price { font-family: var(--font-serif); color: var(--gold); font-size: 1rem; }
.cart-item-remove {
  background: none; border: none; color: rgba(192,57,43,.6); cursor: pointer;
  font-size: .85rem; margin-left: auto; transition: var(--trans);
}
.cart-item-remove:hover { color: var(--red); }

.cart-footer {
  padding: 16px 24px 24px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.cart-total-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px; font-size: 1rem;
}
.cart-total-amount { font-family: var(--font-serif); font-size: 1.5rem; color: var(--gold); }
.cart-nota {
  width: 100%; background: var(--surface2); border: 1px solid rgba(255,255,255,.1);
  color: var(--cream); border-radius: var(--radius); padding: 10px 14px;
  font-family: var(--font-sans); font-size: .85rem; resize: none; height: 68px;
  outline: none; margin-bottom: 14px;
}
.cart-nota::placeholder { color: var(--cream-dim); }
.cart-nota:focus { border-color: rgba(201,168,76,.4); }

/* ─── MODAL EXTRAS ──────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,.7); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; justify-content: center;
  opacity: 0; pointer-events: none; transition: opacity .3s;
}
.modal-overlay.active { opacity: 1; pointer-events: all; }

.modal {
  background: var(--surface); width: min(500px, 100%);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 28px 24px 32px; position: relative;
  max-height: 80vh; overflow-y: auto;
  border: 1px solid rgba(201,168,76,.15);
  transform: translateY(100%); transition: transform .35s cubic-bezier(.4,0,.2,1);
}
.modal-overlay.active .modal { transform: translateY(0); }
.modal-close {
  position: absolute; top: 16px; right: 16px;
  background: rgba(255,255,255,.08); border: none; color: var(--cream-dim);
  width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1rem;
  transition: var(--trans);
}
.modal-close:hover { background: rgba(255,255,255,.15); color: var(--cream); }
.modal h4 { font-family: var(--font-serif); font-size: 1.5rem; margin-bottom: 6px; }
.modal .modal-cat { font-size: .75rem; color: var(--gold); letter-spacing: .12em; text-transform: uppercase; margin-bottom: 12px; }
.modal .modal-desc { font-size: .88rem; color: var(--cream-dim); margin-bottom: 20px; }
.extras-label { font-size: .8rem; font-weight: 500; color: var(--gold); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 10px; }
.extras-options { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.extra-chip {
  padding: 7px 16px; border-radius: 50px;
  background: var(--surface2); border: 1px solid rgba(255,255,255,.1);
  color: var(--cream-dim); cursor: pointer; font-size: .82rem;
  transition: var(--trans);
}
.extra-chip.selected { background: rgba(201,168,76,.15); border-color: var(--gold); color: var(--gold); }
.modal-nota { margin-bottom: 20px; }
.modal-nota label { font-size: .8rem; color: var(--cream-dim); display: block; margin-bottom: 6px; }
.modal-nota textarea {
  width: 100%; background: var(--surface2); border: 1px solid rgba(255,255,255,.1);
  color: var(--cream); border-radius: 10px; padding: 10px 14px;
  font-family: var(--font-sans); font-size: .85rem; resize: none; height: 72px; outline: none;
}
.modal-nota textarea:focus { border-color: rgba(201,168,76,.4); }
.modal-qty-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.modal-qty-row label { font-size: .85rem; color: var(--cream-dim); }

/* ─── CHATBOT ───────────────────────────────────────────────────────── */
.chatbot-fab {
  position: fixed; bottom: 28px; right: 28px; z-index: 150;
  width: 60px; height: 60px; border-radius: 50%;
  background: var(--whatsapp); border: none; cursor: pointer;
  font-size: 1.5rem; box-shadow: 0 4px 20px rgba(37,211,102,.35);
  display: flex; align-items: center; justify-content: center;
  transition: var(--trans);
}
.chatbot-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(37,211,102,.5); }
.chatbot-fab-pulse {
  position: absolute; width: 100%; height: 100%; border-radius: 50%;
  background: rgba(37,211,102,.35);
  animation: pulse-ring 2.5s ease infinite;
}
@keyframes pulse-ring {
  0% { transform: scale(.8); opacity: 1; }
  80%,100% { transform: scale(2); opacity: 0; }
}

.chatbot-window {
  position: fixed; bottom: 100px; right: 20px; z-index: 151;
  width: min(360px, calc(100vw - 40px));
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(201,168,76,.15);
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
  max-height: 70vh;
  transform: translateY(20px) scale(.95); opacity: 0; pointer-events: none;
  transition: all .3s cubic-bezier(.4,0,.2,1);
}
.chatbot-window.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }

.chatbot-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: rgba(37,211,102,.1);
  border-bottom: 1px solid rgba(255,255,255,.06);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.chatbot-avatar { font-size: 1.5rem; }
.chatbot-info { flex: 1; }
.chatbot-info strong { display: block; font-size: .9rem; color: var(--cream); }
.chatbot-status { font-size: .72rem; color: var(--whatsapp); }
.chatbot-close {
  background: none; border: none; color: var(--cream-dim); cursor: pointer;
  font-size: 1rem; padding: 4px; border-radius: 6px; transition: var(--trans);
}
.chatbot-close:hover { color: var(--cream); background: rgba(255,255,255,.08); }

.chatbot-messages {
  flex: 1; overflow-y: auto; padding: 16px; display: flex;
  flex-direction: column; gap: 10px; min-height: 200px;
}
.msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: .85rem; line-height: 1.5; }
.msg-bot {
  background: var(--surface2); color: var(--cream);
  border-bottom-left-radius: 4px; align-self: flex-start;
}
.msg-user {
  background: var(--whatsapp); color: #fff;
  border-bottom-right-radius: 4px; align-self: flex-end;
}

.chatbot-quick {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px;
  border-top: 1px solid rgba(255,255,255,.05);
}
.quick-btn {
  padding: 5px 12px; border-radius: 50px;
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1);
  color: var(--cream-dim); cursor: pointer; font-size: .75rem;
  transition: var(--trans);
}
.quick-btn:hover { border-color: var(--gold); color: var(--gold); }

.chatbot-input-row {
  display: flex; gap: 8px; padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.chatbot-input {
  flex: 1; background: var(--surface2); border: 1px solid rgba(255,255,255,.1);
  color: var(--cream); border-radius: 50px; padding: 9px 16px;
  font-family: var(--font-sans); font-size: .85rem; outline: none;
}
.chatbot-input:focus { border-color: rgba(201,168,76,.4); }
.chatbot-send {
  background: var(--gold); color: var(--bg); border: none;
  width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
  font-size: 1rem; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: var(--trans);
}
.chatbot-send:hover { background: var(--gold-light); }

/* ─── RESPONSIVE ────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .main-nav { display: none; }

  .hero-title { font-size: clamp(2.4rem, 12vw, 4rem); }

  .menu-grid { grid-template-columns: 1fr; }

  .nosotros-grid { grid-template-columns: 1fr; gap: 36px; }
  .nosotros-text .section-title { font-size: 2rem; }

  .section { padding: 56px 0; }

  .menu-dia-body, .menu-dia-actions { padding-left: 20px; padding-right: 20px; }
  .menu-dia-header { padding: 22px 20px; }

  .chatbot-fab { bottom: 20px; right: 16px; width: 52px; height: 52px; font-size: 1.3rem; }
  .chatbot-window { bottom: 84px; right: 12px; }
}

@media (max-width: 480px) {
  .hero-actions { flex-direction: column; align-items: center; }
  .btn { padding: 12px 22px; }
}

/* ─── SCROLLBAR ─────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg2); }
::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--gold-dim); }

/* ─── ANIMATIONS ─────────────────────────────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp .5s ease both; }

/* ─── TOAST ─────────────────────────────────────────────────────────── */
.toast {
  position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
  background: var(--surface2); border: 1px solid rgba(201,168,76,.3);
  color: var(--cream); padding: 12px 24px; border-radius: 50px;
  font-size: .85rem; z-index: 500; opacity: 0; transition: all .3s;
  pointer-events: none; white-space: nowrap;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
