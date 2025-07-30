import tools from '../tools.ai.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function sanitizeMessages(messages) {
  return messages.map((message, index) => {
    const sanitizedMessage = { ...message };

    // Sanitize assistant tool calls to match the required API format.
    // This addresses errors like "Missing required parameter: ...type".
    if (sanitizedMessage.role === 'assistant' && sanitizedMessage.tool_calls) {
      // When tool_calls is present, content must be null.
      sanitizedMessage.content = null;
      sanitizedMessage.tool_calls = sanitizedMessage.tool_calls.map((toolCall, toolIndex) => {
        const newToolCall = { ...toolCall };

        // FIX 1: Add the 'type' field, which is required. It's always 'function'.
        if (!newToolCall.type) {
          newToolCall.type = 'function';
        }

        // FIX 2: Add a unique ID if it's missing. This is crucial for matching tool results.
        // The calling code should persist the original ID from the API response.
        // This is a fallback to prevent an API error.
        if (!newToolCall.id) {
          newToolCall.id = `call_generated_${index}_${toolIndex}`;
        }

        // FIX 3: Ensure the 'arguments' field inside the 'function' object is a JSON string.
        if (newToolCall.function && typeof newToolCall.function.arguments === 'object' && newToolCall.function.arguments !== null) {
          newToolCall.function.arguments = JSON.stringify(newToolCall.function.arguments);
        }
        
        return newToolCall;
      });
    }
    
    // Convert legacy 'function' role messages to the new 'tool' role.
    if (sanitizedMessage.role === 'function') {
      sanitizedMessage.role = 'tool';
      // Note: The message will likely be missing a 'tool_call_id', which the API requires.
      // This conversion is a first step. The calling code must be updated to provide the ID.
    }

    // Remove the deprecated 'name' property from user and assistant messages.
    if (sanitizedMessage.role === 'user' || sanitizedMessage.role === 'assistant') {
      delete sanitizedMessage.name;
    }

    // Ensure message content is not null (unless tool_calls is present), as it can cause issues. An empty string is safer.
    if (sanitizedMessage.content === null && !sanitizedMessage.tool_calls) {
      sanitizedMessage.content = '';
    }

    return sanitizedMessage;
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
