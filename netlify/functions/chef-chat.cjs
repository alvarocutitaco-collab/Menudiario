const { handleChefChat } = require('../../serverless/chefChatCore.cjs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST' },
      body: JSON.stringify({ error: 'Metodo no permitido' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const result = await handleChefChat(body);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('chef-chat error:', error);

    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({
        error: 'No pude responder con IA en este momento. Intenta por WhatsApp o vuelve a probar en unos minutos.'
      })
    };
  }
};
