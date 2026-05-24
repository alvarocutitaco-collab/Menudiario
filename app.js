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
let CHAT_SESSION_ID = getChefSessionId();

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

function getChefSessionId() {
  const storageKey = 'herediaChefSessionId';
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const id = crypto.randomUUID ? crypto.randomUUID() : `chef_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(storageKey, id);
    return id;
  } catch (error) {
    return `chef_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
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
    renderMenuDiaOffers(diaData);

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
async function renderMenuDiaOffers(d) {
  const card = document.getElementById('menu-dia-card');
  const entradas = d.entradas || (d.entrada ? [d.entrada] : []);
  const fondos = d.fondos || (d.fondo ? [d.fondo] : []);
  const bebida = d.bebida;

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

  const optionHtml = (item, tipo) => `
    <article class="menu-dia-option">
      ${item.imagen
        ? `<img class="menu-dia-option-img" src="${item.imagen}" alt="${escapeHtml(item.nombre)}" loading="lazy">`
        : `<div class="menu-dia-option-placeholder">${item.emoji || '🍽️'}</div>`
      }
      <div class="menu-dia-option-body">
        <div class="menu-dia-option-type">${tipo}</div>
        <strong>${item.emoji || ''} ${item.nombre}</strong>
        <span>${item.descripcion}</span>
      </div>
    </article>
  `;

  card.innerHTML = `
    ${headerHtml}
    <div class="menu-dia-body">
      <div class="menu-dia-group">
        <h4>Elige una entrada</h4>
        <div class="menu-dia-options menu-dia-options-entrada">
          ${entradas.map(item => optionHtml(item, 'Entrada')).join('')}
        </div>
      </div>
      <div class="menu-dia-group">
        <h4>Elige un plato de fondo</h4>
        <div class="menu-dia-options">
          ${fondos.map(item => optionHtml(item, 'Fondo')).join('')}
        </div>
      </div>
      ${bebida ? `
      <div class="menu-dia-group">
        <h4>Bebida incluida</h4>
        <div class="menu-dia-options menu-dia-options-bebida">
          ${optionHtml(bebida, 'Bebida')}
        </div>
      </div>` : ''}
      ${d.nota ? `<p class="menu-dia-nota">✦ ${d.nota}</p>` : ''}
    </div>
    <div class="menu-dia-actions">
      <button class="btn btn-whatsapp btn-full" id="menu-dia-wa-btn">
        Pedir Menú del Día por WhatsApp
      </button>
    </div>
  `;

  document.getElementById('menu-dia-wa-btn').addEventListener('click', () => {
    const entradasTexto = entradas.map(item => `• ${item.nombre}`).join('\n');
    const fondosTexto = fondos.map(item => `• ${item.nombre}`).join('\n');
    const msg = `🍽 *Menú del Día — ${CONFIG.nombre}*\n\n` +
      `*Entradas disponibles:*\n${entradasTexto}\n\n` +
      `*Fondos disponibles:*\n${fondosTexto}\n\n` +
      (bebida ? `*Bebida:* ${bebida.nombre}\n\n` : '') +
      `*Total: ${formatMoney(d.precio)}*\n\n` +
      `_Quiero pedir el Menú del Día. Por favor confirmen disponibilidad para elegir entrada y fondo 🙏_`;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

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

document.getElementById('ia-buscar').addEventListener('click', async () => {
  const query = document.getElementById('ia-input').value.trim();
  if (!query) { toast('Escribe lo que se te antoja'); return; }
  await handleFreeQuery(query);
});

document.getElementById('ia-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('ia-buscar').click();
});

function showIaRecommendation(mood, titulo) {
  const tags   = MOOD_MAP[mood] || [mood];
  const result = scoreAndFilter(tags);
  displayIaResult(titulo || '✦ Te recomiendo:', result);
}

async function handleFreeQuery(query) {
  const aiButton = document.getElementById('ia-buscar');
  const originalText = aiButton.textContent;
  aiButton.textContent = 'Pensando...';
  aiButton.disabled = true;

  try {
    const aiReply = await askChefChat(query);
    if (aiReply) {
      displayIaTextResult(`Chef IA responde a "${query}"`, aiReply);
      return;
    }
  } finally {
    aiButton.textContent = originalText;
    aiButton.disabled = false;
  }

  displayIaTextResult(`Chef IA responde a "${query}"`, fallbackBridgeResponse(query));
  return;

  const normalizedQuery = query.toLowerCase();
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
    const score = words.filter(w => normalizedQuery.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestMood = mood; }
  }

  if (bestMood) {
    showIaRecommendation(bestMood, `🤖 Basado en "${query}", te recomiendo:`);
  } else {
    // Fallback: buscar coincidencia con nombre del plato
    const matches = MENU.filter(p =>
      p.nombre.toLowerCase().includes(normalizedQuery) ||
      p.descripcion.toLowerCase().includes(normalizedQuery) ||
      p.categoria.toLowerCase().includes(normalizedQuery)
    );
    if (matches.length) {
      displayIaResult(`🔍 Encontré esto para "${query}":`, matches.slice(0, 3));
    } else {
      displayIaTextResult(`Chef IA responde a "${query}"`, fallbackBridgeResponse(query));
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

function displayIaTextResult(titulo, text) {
  const container = document.getElementById('ia-result');
  container.style.display = 'block';
  container.innerHTML = `
    <div class="ia-result-header">${escapeHtml(titulo)}</div>
    <div class="ia-result-body">
      <div class="ia-no-result" style="text-align:left;">${renderBotText(text)}</div>
    </div>
  `;
}

/* ─── CHATBOT ───────────────────────────────────────────────────────── */
function fallbackBridgeResponse(message = '') {
    const normalize = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normalized = normalize(message);
    const lower = normalized;
    const wantsReservation = [
      'reserv', 'mesa', 'separ', 'quiero ir', 'me interesa', 'somos', 'personas',
      'para hoy', 'para manana', 'viernes', 'sabado', 'domingo', 'hora', 'pm', 'a las'
    ].some(word => lower.includes(word));

    const hasAny = (words) => words.some(word => lower.includes(word));
    const hasNumberGroup = /\b([3-9]|1[0-9])\b/.test(lower);
    const needsDrink = hasAny(['sed', 'tomar', 'bebida', 'refresco', 'hidratar', 'calor', 'sol', 'queme']);
    const wantsSoft = hasAny(['suave', 'ligero', 'liviano', 'delicado', 'novia', 'pareja', 'cita']);
    const wantsFilling = hasAny(['llene', 'llenar', 'hambre', 'almuerzo', 'examen', 'energia', 'fuerza', 'contundente']);
    const wantsBreakfast = hasAny(['desayuno', 'manana', 'rapido', 'apurado', 'carro', 'dejo']);
    const isColdGroup = hasAny(['frio', 'helado']) || hasAny(['amigos', 'grupo', 'familia', 'personas']) || hasNumberGroup;
    const wantsCheese = hasAny(['queso', 'cremoso', 'crema']);
    const wantsSweet = hasAny(['dulce', 'postre', 'torta', 'chocolate']);
    const wantsSpicy = hasAny(['picante', 'rocoto', 'aji']);
    const wantsSea = hasAny(['mar', 'marino', 'camaron', 'pescado', 'trucha']);

    const prefer = [];
    const avoid = [];
    if (needsDrink) {
      prefer.push('bebida', 'fresco', 'sed', 'calor', 'citrico');
      avoid.push('contundente', 'frito', 'plato de fondo', 'mucha hambre solo');
    }
    if (wantsSoft) {
      prefer.push('suave', 'ligero', 'pareja', 'cremoso', 'fresco', 'delicado');
      avoid.push('contundente', 'frito', 'picante fuerte', 'visceras', 'potente');
    }
    if (wantsFilling) {
      prefer.push('contundente', 'almuerzo', 'hambre', 'reconfortante', 'caliente');
      avoid.push('bebida', 'postre', 'algo ligero', 'sed');
    }
    if (wantsBreakfast) {
      prefer.push('desayuno', 'rapido', 'reconfortante', 'calido', 'tradicional');
      avoid.push('postre', 'bebida', 'marino');
    }
    if (isColdGroup) prefer.push('caliente', 'compartir', 'amigos', 'grupo', 'reconfortante');
    if (wantsCheese) prefer.push('queso', 'cremoso', 'suave');
    if (wantsSweet) prefer.push('dulce', 'postre', 'cierre');
    if (wantsSpicy) prefer.push('picante', 'rocoto');
    if (wantsSea) prefer.push('marino', 'camaron', 'pescado');

    const queryWords = lower
      .split(/[^a-z0-9n]+/i)
      .filter(word => word.length > 2 && !['algo', 'con', 'para', 'quiero', 'tengo', 'estoy', 'esta', 'una', 'uno'].includes(word));

    const profileWords = (plato) => {
      const perfil = plato.perfil || {};
      return [
        perfil.intensidad,
        ...(perfil.temperatura || []),
        ...(perfil.momento || []),
        ...(perfil.ocasion || []),
        ...(perfil.sensacion || []),
        ...(perfil.idealPara || []),
        ...(perfil.evitarSi || [])
      ];
    };

    const scorePlate = (plato) => {
      const perfil = plato.perfil || {};
      const haystack = normalize([
        plato.nombre,
        plato.descripcion,
        plato.categoria,
        ...(plato.tags || []),
        ...(plato.extras || []),
        ...profileWords(plato)
      ].join(' '));

      let score = queryWords.reduce((total, word) => total + (haystack.includes(word) ? 2 : 0), 0);
      score += prefer.reduce((total, word) => total + (haystack.includes(normalize(word)) ? 5 : 0), 0);
      score -= avoid.reduce((total, word) => total + (haystack.includes(normalize(word)) ? 7 : 0), 0);

      if (needsDrink) score += plato.categoria === 'Bebidas' ? 18 : -12;
      if (wantsFilling) score += plato.categoria !== 'Bebidas' && plato.categoria !== 'Postres' ? 8 : -14;
      if (wantsSoft && !needsDrink && plato.categoria === 'Bebidas') score -= 8;
      if (wantsBreakfast) score += (perfil.momento || []).includes('desayuno') ? 14 : 0;
      if (wantsSoft && perfil.intensidad === 'suave') score += 12;
      if (wantsSoft && perfil.intensidad === 'contundente') score -= 14;
      if (isColdGroup && (perfil.temperatura || []).includes('caliente')) score += 6;
      if (hasNumberGroup && (perfil.ocasion || []).includes('compartir')) score += 8;
      if (wantsCheese && haystack.includes('queso')) score += 10;
      return score;
    };

    let plato = MENU
      .map(p => ({ plato: p, score: scorePlate(p) }))
      .sort((a, b) => b.score - a.score || a.plato.precio - b.plato.precio)[0]?.plato;

    if (!plato || scorePlate(plato) < 1) {
      plato = MENU.find(p => (p.perfil?.intensidad === 'suave' && p.categoria !== 'Bebidas')) || MENU[0];
    }

    let opening = 'Te entiendo.';
    let context = 'Te llevo a una opcion con sentido, no a una recomendacion al azar.';
    let close = 'Quieres que te sugiera una segunda opcion o lo llevamos a WhatsApp?';

    if (needsDrink) {
      opening = 'Uff, si hay sed de por medio, primero hidratamos; no te voy a mandar de frente a un plato pesado.';
      context = 'Para refrescarte y seguir con algo rico despues, iria por una bebida fresca.';
      close = 'La quieres mas citrica o mas suave?';
    } else if (wantsSoft) {
      opening = 'Buena jugada: si es para tu novia o para algo suave, mejor algo amable, cremoso y sin golpe fuerte.';
      context = 'Aqui conviene una opcion delicada, con sabor arequipeno pero facil de disfrutar.';
      close = 'Prefieren algo cremoso o algo fresco?';
    } else if (wantsFilling) {
      opening = 'Con examen o un dia largo, ahi si necesitas comida que sostenga, no una cosita testimonial.';
      context = 'Te conviene un fondo sabroso, caliente y con energia para seguir el dia.';
      close = 'Lo quieres mas casero o mas potente?';
    } else if (wantsBreakfast) {
      opening = 'Que mala pasada lo del carro. Para un desayuno rapido, la idea es algo de casa, caliente y sin complicarte mas.';
      context = 'Me iria por una opcion tradicional que levante el animo y te deje operativo.';
      close = 'Quieres que sea rapido para llevar o para comer aqui?';
    } else if (isColdGroup) {
      opening = 'Con frio y gente reunida, la mesa pide algo caliente y compartible.';
      context = 'Lo mejor es algo que abrace un poco y alcance para conversar rico.';
      close = 'Son para compartir al centro o cada uno quiere su plato?';
    } else if (hasAny(['jefe', 'grit', 'estres', 'cansado', 'sueno'])) {
      opening = 'Ufff, ese tipo de dia merece bajar revoluciones con algo rico.';
      context = 'Te recomendaria algo reconfortante, sabroso y sin hacerlo complicado.';
      close = 'Quieres algo suave para recuperar energia o algo contundente para reiniciar el dia?';
    }

    if (!plato) {
      if (wantsReservation) {
        return 'Me gusta ese plan. Para ver disponibilidad real, dime fecha, hora y cuantas personas serian.';
      }
      return `${opening} ${context} Prefieres algo ligero o contundente?`;
    }

    if (wantsReservation) {
      return `${opening} Para esa experiencia te recomendaria *${plato.nombre}*: ${plato.descripcion.split('.')[0]}. Para revisar disponibilidad, dime fecha, hora y cuantas personas serian.`;
    }

    return `${opening} ${context} Te recomendaria *${plato.nombre}*: ${plato.descripcion.split('.')[0]}. ${close}`;
  }
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
    const entradas = dia.entradas || (dia.entrada ? [dia.entrada] : []);
    const fondos = dia.fondos || (dia.fondo ? [dia.fondo] : []);
    const entradasTexto = entradas.map(item => `• ${item.nombre}`).join('\n');
    const fondosTexto = fondos.map(item => `• ${item.nombre}`).join('\n');
    return `🍽 *Menú del Día — ${formatMoney(dia.precio)}*\n\n*Entradas:*\n${entradasTexto}\n\n*Fondos:*\n${fondosTexto}\n\n🥤 ${dia.bebida.nombre}\n\nPuedes elegir 1 entrada + 1 fondo. ¿Lo pedimos por WhatsApp?`;
  },

  pedido: () =>
    `📋 *¿Cómo hacer tu pedido?*\n\n1️⃣ Ve a la sección *"Carta"*\n2️⃣ Selecciona tus platos y cantidades\n3️⃣ Presiona *"Enviar Pedido por WhatsApp"*\n4️⃣ ¡Te confirmamos y preparamos!\n\nO también puedes escribirnos directamente 😊`,

  promociones: () =>
    `🎉 *Promociones vigentes:*\n• Menú del día a precio especial\n• Descuento a grupos de 6+ personas\n• Consulta por eventos y cenas privadas\n\n¡Síguenos en ${CONFIG.instagram || 'nuestro Instagram'} para más novedades!`,

  default: (message = '') => fallbackBridgeResponse(message)
};

const CHATBOT_KEYWORDS = {
  horarios:    ['horario', 'hora', 'abierto', 'cerrado', 'cuándo', 'cuando', 'atienden'],
  ubicacion:   ['donde', 'dónde', 'ubica', 'ubicación', 'dirección', 'dirección', 'lugar', 'llegar'],
  delivery:    ['delivery', 'despacho', 'envío', 'envio', 'mandan', 'traen', 'domicilio'],
  pago:        ['pago', 'pagar', 'yape', 'plin', 'transferencia', 'efectivo', 'tarjeta'],
  menu:        ['menú', 'menu', 'menú del día', 'menu del dia', 'almuerzo', 'comida de hoy'],
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
  respondToIntent(intent, msg);
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
        sessionId: CHAT_SESSION_ID
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Chef IA no disponible (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.reply) throw new Error('Respuesta vacia');
    if (data.sessionId) {
      CHAT_SESSION_ID = data.sessionId;
      try { sessionStorage.setItem('herediaChefSessionId', CHAT_SESSION_ID); } catch (error) {}
    }

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
function respondToIntent(intent, message = '') {
  currentIntent = intent;
  const respFn = CHATBOT_RESPONSES[intent] || CHATBOT_RESPONSES.default;
  addBotMessage(respFn(message));
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
