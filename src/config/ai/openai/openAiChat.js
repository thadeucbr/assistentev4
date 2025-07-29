import tools from '../tools.ai.js';
import logError from '../../../utils/logger.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  let lastToolCallMessageIndex = -1;

  return messages.map((message, index) => {
    const newMessage = { ...message };

    // Garantir que 'role' sempre exista
    if (!newMessage.role) {
      newMessage.role = 'user'; // Ou um padrão mais apropriado
    }

    // Lidar com 'tool_calls'
    if (newMessage.role === 'assistant' && newMessage.tool_calls) {
      lastToolCallMessageIndex = index;
      newMessage.tool_calls = newMessage.tool_calls.map(tc => {
        const functionName = tc.function?.name || tc.name;
        let functionArguments = tc.function?.arguments || tc.arguments;
        if (typeof functionArguments === 'object') {
          functionArguments = JSON.stringify(functionArguments);
        }
        return {
          id: tc.id || functionName,
          type: 'function',
          function: { name: functionName, arguments: functionArguments }
        };
      });
    }

    // Transformar role 'function' em 'tool' e garantir 'tool_call_id'
    if (newMessage.role === 'function') {
      newMessage.role = 'tool';
      newMessage.tool_call_id = newMessage.tool_call_id || newMessage.name;
    }

    // Garantir que 'content' seja uma string
    if (typeof newMessage.content !== 'string') {
      newMessage.content = JSON.stringify(newMessage.content);
    }

    // O OpenAI não aceita mensagens de assistente vazias a menos que tenham tool_calls
    if (newMessage.role === 'assistant' && !newMessage.content && !newMessage.tool_calls) {
      return null;
    }

    return newMessage;
  }).filter(Boolean); // Remove mensagens nulas
}
export default async function openAiChat(chatMessages, toolsParam) {
  try {
    // console.log('openAiChat toolsParam:', toolsParam);
    chatMessages = sanitizeMessages(chatMessages);
    if (!OPENAI_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }

    const body = {
      model: OPENAI_MODEL,
      messages: chatMessages
    };

    if (toolsParam && toolsParam.length > 0) {
      body.tools = toolsParam;
      body.tool_choice = 'auto';
    } else if (toolsParam === undefined) {
      body.tools = tools; // Default tools
      body.tool_choice = 'auto';
    }
    // console.log('openAiChat body:', JSON.stringify(body, null, 2));
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
    // console.log('OpenAI response:', choices);
    return choices[0];
  } catch (error) {
    logError(error, 'openAiChat - OpenAI API call failed');
    throw error;
  }
}