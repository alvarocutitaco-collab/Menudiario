[README.md](https://github.com/user-attachments/files/28161094/README.md)
# Restaurante web con Chef IA

Sitio estatico con carta digital, menu del dia, pedidos por WhatsApp, Chef IA conectado a OpenAI y panel administrador con Decap CMS.

## Estructura

```txt
index.html
styles.css
app.js
data/menu.json
data/menu-dia.json
assets/img/
api/chef-chat.js                  # Funcion serverless para Vercel
netlify/functions/chef-chat.cjs   # Funcion serverless para Netlify
serverless/chefChatCore.cjs       # Logica segura de OpenAI
admin/                            # Panel Decap CMS
netlify.toml
```

## Seguridad de la API key

La clave de OpenAI nunca debe ir en `app.js`, `index.html`, GitHub ni ningun archivo publico.

La funcion `/api/chef-chat` lee la clave desde esta variable de entorno:

```txt
OPENAI_API_KEY
```

Opcionalmente puedes definir:

```txt
OPENAI_MODEL=gpt-4.1-mini
```

Si no defines `OPENAI_MODEL`, se usa `gpt-4.1-mini`.

## Configurar en Netlify

1. Sube este proyecto a GitHub.
2. En Netlify, crea un sitio desde ese repositorio.
3. En `Site configuration` > `Environment variables`, agrega:
   - `OPENAI_API_KEY`
   - opcional: `OPENAI_MODEL`
4. Publica el sitio.
5. Netlify usara `netlify.toml` para servir la web y redirigir `/api/chef-chat` a la funcion segura.

## Configurar en Vercel

1. Importa el repositorio en Vercel.
2. En `Project Settings` > `Environment Variables`, agrega:
   - `OPENAI_API_KEY`
   - opcional: `OPENAI_MODEL`
3. Publica el proyecto.
4. Vercel usara automaticamente `api/chef-chat.js` como endpoint `/api/chef-chat`.

## Probar localmente

Necesitas Node.js.

Para Netlify:

```bash
npx netlify-cli dev
```

Antes de ejecutar, define la variable:

```powershell
$env:OPENAI_API_KEY="tu_api_key"
npx netlify-cli dev
```

Para Vercel:

```powershell
$env:OPENAI_API_KEY="tu_api_key"
npx vercel dev
```

Luego abre la URL local que indique la terminal y prueba el Chef IA o el chatbot.

## Editar la carta

Edita `data/menu.json`.

Los datos del negocio estan en `negocio`:

```json
{
  "nombre": "Nombre del restaurante",
  "whatsapp": "51999999999",
  "ubicacion": "Direccion",
  "horario": "Lunes a Domingo: 11:00 am - 4:00 pm",
  "instagram": "@usuario",
  "moneda": "S/"
}
```

Cada plato necesita:

```json
{
  "id": 1,
  "nombre": "Nombre del plato",
  "descripcion": "Descripcion corta",
  "precio": 25,
  "categoria": "Fondos",
  "emoji": "🍽️",
  "tags": ["picante", "contundente"],
  "extras": ["Sin aji", "Extra queso"],
  "imagen": "./assets/img/plato.jpg"
}
```

Importante: cada `id` debe ser unico. El Chef IA solo puede recomendar platos que existan en este JSON.

## Editar el menu del dia

Edita `data/menu-dia.json`.

```json
{
  "fecha": "2026-05-22",
  "disponible": true,
  "precio": 22,
  "titulo": "Menu del Dia",
  "entrada": { "nombre": "Entrada", "descripcion": "Descripcion" },
  "fondo": { "nombre": "Fondo", "descripcion": "Descripcion" },
  "postre": { "nombre": "Postre", "descripcion": "Descripcion" },
  "bebida": { "nombre": "Bebida", "descripcion": "Descripcion" }
}
```

Para marcarlo como agotado:

```json
"disponible": false
```

## Panel administrador

Se agrego un panel en:

```txt
/admin
```

El panel usa Decap CMS con Netlify Identity y Git Gateway. Permite editar:

- Carta completa: nombre, descripcion, precio, categoria, imagen, tags y extras.
- Menu del dia: entrada, fondo, postre, bebida, precio, fecha y disponibilidad.
- Datos del negocio: WhatsApp, horario, ubicacion e Instagram.

## Como activar el panel en Netlify

1. En Netlify, entra a `Site configuration` > `Identity` y habilita Identity.
2. En `Registration`, elige `Invite only` para que nadie se registre libremente.
3. En `Services`, habilita `Git Gateway`.
4. Invita el correo del administrador desde Identity.
5. Entra a `https://tu-sitio.netlify.app/admin`.

## Que usar para guardar cambios desde un sitio estatico

Si publicas solo en GitHub Pages o como HTML estatico puro, el panel no puede guardar cambios de forma segura por si solo. Un frontend estatico no debe tener tokens privados para escribir en GitHub.

Opciones:

- Recomendado: Netlify + Decap CMS + Netlify Identity/Git Gateway. Es lo mas simple y seguro para alguien que no programa. El admin edita contenido, Decap hace commits al repositorio y Netlify republica.
- Supabase o Firebase: utiles si quieres una base de datos y cambios inmediatos, pero requieren mas configuracion y reglas de seguridad.
- GitHub API directa: no recomendado para principiantes, porque necesitas proteger tokens y permisos.
- Netlify Forms: sirve para recibir formularios, no para editar y guardar una carta completa.

Para este proyecto recomiendo Netlify + Decap CMS.

## Chef IA

`app.js` envia los mensajes a `/api/chef-chat`.

La funcion serverless:

- Lee `data/menu.json` y `data/menu-dia.json`.
- Usa `OPENAI_API_KEY` desde variables de entorno.
- Envia un prompt de sistema que obliga al Chef IA a recomendar solo platos reales.
- Maneja errores y devuelve una respuesta amable para ofrecer WhatsApp si falla la API.

Referencias oficiales:

- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
- OpenAI Quickstart y variables de entorno: https://platform.openai.com/docs/quickstart
