const { handleChefChat } = require('../../serverless/chefChatCore.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST' },
      body: JSON.stringify({ error: 'Metodo no permitido' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const reply = await handleChefChat(body);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.error('chef-chat error:', error);

    return {
      statusCode: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        error: 'No pude responder con IA en este momento. Intenta por WhatsApp o vuelve a probar en unos minutos.'
      })
    };
  }
};
