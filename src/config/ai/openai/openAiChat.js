import tools from './tools.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
function sanitizeMessages(messages) {
  return messages
    .map(m => {
      if (m.role === 'function' || m.role === 'tool') {
        return {
          role: 'function',
          name: m.name,
          content: typeof m.content === 'string'
            ? m.content
            : JSON.stringify(m.content)
        };
      }
      return {
        role: m.role,
        content: m.content ?? ''
      };
    });
}

export default async function openAiChat(chatMessages, toolsParam) {
  const openaiStartTime = Date.now();
  console.log(`[OpenAI] 🚀 Iniciando chamada para OpenAI (${OPENAI_MODEL}) - ${new Date().toISOString()}`);
  console.log(`[OpenAI] 📊 Mensagens: ${chatMessages.length}, Tokens estimados: ~${JSON.stringify(chatMessages).length / 4}`);
  
  chatMessages = sanitizeMessages(chatMessages);
  if (!OPENAI_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const body = {
    model: OPENAI_MODEL,
    messages: chatMessages,
    function_call: 'auto',
    // Otimizações de performance
    temperature: 0.7,        // Reduzir variabilidade para resposta mais rápida
    max_tokens: 1000,        // Limitar tokens para respostas mais focadas
    top_p: 0.9,             // Reduzir espaço de busca
    frequency_penalty: 0.1,  // Evitar repetições
    presence_penalty: 0.1    // Encorajar novos tópicos
  };

  if (toolsParam !== undefined && toolsParam.length === 0) {
    // Do nothing, functions property will be omitted
  } else if (toolsParam) {
    body.functions = toolsParam;
  } else {
    body.functions = tools;
  }
  
  console.log(`[OpenAI] 📤 Enviando request - ${new Date().toISOString()}`);
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI chat failed: ${response.status} ${errText}`);
  }

  const { choices } = await response.json();
  console.log(`[OpenAI] ✅ Resposta recebida - TEMPO OPENAI: ${Date.now() - openaiStartTime}ms - ${new Date().toISOString()}`);
  console.log(`[OpenAI] 📊 Tokens resposta: ~${JSON.stringify(choices[0]).length / 4}, Função chamada: ${choices[0].message.function_call ? 'Sim' : 'Não'}`);
  return choices[0];
}