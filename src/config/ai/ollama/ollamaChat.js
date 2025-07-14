import tools from './functions.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

export default async function ollamaChat(chatMessages, toolsParam) { 
  // console.log('ollamaChat', chatMessages);
  const body = {
    model: OLLAMA_MODEL,
    messages: chatMessages,
    tools: toolsParam || tools,
    stream: false
  };

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
const raw = await response.text();
if (!response.ok) throw new Error(`Ollama error ${response.status}\n${raw}`);
const payload = JSON.parse(raw);
// console.log('Ollama response:', payload);
return payload;
}