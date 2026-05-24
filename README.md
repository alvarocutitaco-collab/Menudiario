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

## 🤖 CONECTAR CHEF IA A CHATGPT / OPENAI

El sitio ya incluye una función de Netlify en `netlify/functions/chef-chat.cjs` que llama a OpenAI desde el servidor. La clave API nunca debe ponerse en `app.js` ni en el navegador.

### Variables en Netlify

En Netlify ve a:
`Site configuration` → `Environment variables` → `Add variable`

Agrega:

```txt
OPENAI_API_KEY=tu_api_key_de_openai
```

Opcionalmente puedes elegir modelo:

```txt
OPENAI_MODEL=gpt-4.1-mini
```

Si no configuras `OPENAI_MODEL`, el sistema usa `gpt-4.1-mini` por defecto.

### Comportamiento del Chef IA

El Chef IA puede conversar sobre temas cotidianos, pero siempre debe hacer un puente natural hacia un plato real de la carta o el menú del día. No debe inventar platos, precios ni promociones.

Después de guardar las variables, vuelve a publicar el sitio en Netlify para que la función tome la configuración.

---

## 🔮 PRÓXIMOS PASOS (cuando estés listo)

- **Fotos propias:** Reemplaza las URLs de Unsplash por fotos de tus platos reales
- **Dominio propio:** En Netlify puedes conectar un dominio como `www.chefarturo.pe` (~$12/año)
- **Chef IA con IA real:** Conectar a Claude API para recomendaciones inteligentes
- **Reservas online:** Integrar Calendly o similar
- **Galería:** Agregar sección de fotos del local

---

*Desarrollado con HTML, CSS y JavaScript puro. Sin frameworks. Sin costos de servidor.*
