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
  // console.log('openAiChat', chatMessages);
  chatMessages = sanitizeMessages(chatMessages);
  if (!OPENAI_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const body = {
    model: OPENAI_MODEL,
    messages: chatMessages,
  };

  if (toolsParam && toolsParam.length > 0) {
    body.functions = toolsParam;
    body.function_call = 'auto';
  } else {
    // If no tools are provided, explicitly set function_call to 'none'
    // to prevent the model from attempting to call functions.
    body.function_call = 'none';
  }
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
}