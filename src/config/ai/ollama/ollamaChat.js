import tools from '../tools.ai.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

// Sanitizes messages to ensure tool call arguments are objects, not strings.
function sanitizeMessagesForOllama(messages) {
  return messages.map(msg => {
    if (msg.tool_calls) {
      const newToolCalls = msg.tool_calls.map(toolCall => {
        if (toolCall.function && typeof toolCall.function.arguments === 'string') {
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            return {
              ...toolCall,
              function: {
                ...toolCall.function,
                arguments: parsedArgs,
              },
            };
          } catch (e) {
            console.error('Error parsing tool call arguments for Ollama:', e);
            // Return original tool call if parsing fails
            return toolCall;
          }
        }
        return toolCall;
      });
      return { ...msg, tool_calls: newToolCalls };
    }
    return msg;
  });
}

export default async function ollamaChat(chatMessages, toolsParam) { 
  const sanitizedMessages = sanitizeMessagesForOllama(chatMessages);

  const body = {
    model: OLLAMA_MODEL,
    messages: sanitizedMessages,
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
  return payload;
}