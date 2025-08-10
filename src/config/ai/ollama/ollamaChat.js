
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

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
    stream: false
  };

  // Only add tools if provided via parameter
  if (toolsParam && toolsParam.length > 0) {
    body.tools = toolsParam;
  }

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  const raw = await response.text();
  
  if (!response.ok) {
    console.log('Ollama chat response:', raw);
    
    // Parse error details if possible
    let errorDetails;
    try {
      errorDetails = JSON.parse(raw);
    } catch {
      errorDetails = { error: raw };
    }
    
    const error = new Error(`Ollama error: ${response.status} ${errorDetails.error || raw}`);
    error.statusCode = response.status;
    throw error;
  }
  
  const payload = JSON.parse(raw);
  // console.log('Ollama response:', payload);
  return payload;
}