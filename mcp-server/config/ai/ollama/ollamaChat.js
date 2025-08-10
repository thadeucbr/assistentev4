const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

function sanitizeMessagesForOllama(messages) {
  return messages.map(message => {
    if (message.role === 'assistant' && message.tool_calls) {
      // Ollama expects arguments as objects, not strings
      const sanitizedToolCalls = message.tool_calls.map(toolCall => {
        try {
          return {
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments: typeof toolCall.function.arguments === 'string' 
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments
            }
          };
        } catch (parseError) {
          console.warn('Erro ao parsear arguments para Ollama:', toolCall.function.arguments);
          return {
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments: {} // Fallback para objeto vazio
            }
          };
        }
      });
      
      return {
        ...message,
        tool_calls: sanitizedToolCalls
      };
    }
    return message;
  });
}

export default async function ollamaChat(chatMessages, toolsParam) { 
  // console.log('ollamaChat', chatMessages);
  
  // Sanitize messages for Ollama compatibility
  chatMessages = sanitizeMessagesForOllama(chatMessages);
  
  const body = {
    model: OLLAMA_MODEL,
    messages: chatMessages,
    tools: toolsParam || [],
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