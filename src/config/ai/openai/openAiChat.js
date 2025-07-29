import tools from '../tools.ai.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function sanitizeMessages(messages) {
  return messages.map(m => {
    const message = { ...m };
    if (message.role === 'user' || message.role === 'assistant') {
      delete message.name;
    }
    if ((message.role === 'user' || message.role === 'assistant') && message.content === null) {
      message.content = '';
    }
    if (message.role === 'tool' && typeof message.content === 'object' && message.content !== null) {
      message.content = JSON.stringify(message.content);
    }
    return message;
  });
}

export default async function openAiChat(chatMessages, toolsParam) {
  chatMessages = sanitizeMessages(chatMessages);
  if (!OPENAI_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const body = {
    model: OPENAI_MODEL,
    messages: chatMessages,
  };

  const toolsToUse = toolsParam === undefined ? tools : (toolsParam.length > 0 ? toolsParam : undefined);

  if (toolsToUse) {
    body.tools = toolsToUse;
    body.tool_choice = 'auto';
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
  return choices[0];
}
