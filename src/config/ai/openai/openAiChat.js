import tools from '../tools.ai.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * Sanitizes and filters a list of chat messages to ensure they conform to the OpenAI API specifications.
 * This function addresses several common issues:
 * 1.  **Orphaned Tool Messages**: Removes 'tool' messages that do not follow an 'assistant' message with 'tool_calls'.
 * 2.  **Missing tool_call_id**: Assigns the correct 'tool_call_id' to 'tool' messages based on the preceding 'assistant' message.
 * 3.  **Malformed tool_calls**: Ensures 'assistant' tool calls have the required 'type', 'id', and stringified 'arguments'.
 * 4.  **Null Content**: Sets 'content' to null for assistant messages with 'tool_calls', as required.
 * 5.  **Legacy Roles/Properties**: Converts legacy 'function' roles to 'tool' and removes deprecated 'name' properties.
 *
 * @param {Array<Object>} messages The raw array of chat messages.
 * @returns {Array<Object>} A new array of sanitized and filtered messages ready for the API.
 */
function sanitizeMessages(messages) {
  const cleanMessages = [];
  
  for (let i = 0; i < messages.length; i++) {
    let message = { ...messages[i] };

    // Convert legacy 'function' role to 'tool' before processing
    if (message.role === 'function') {
      message.role = 'tool';
    }

    // Remove deprecated 'name' from user/assistant roles
    if (message.role === 'user' || message.role === 'assistant') {
      delete message.name;
    }

    // Ensure content is not null (unless tool_calls are present)
    if (message.content === null && !message.tool_calls) {
      message.content = '';
    }

    if (message.role === 'assistant' && message.tool_calls) {
      // Assistant message with tool calls must have null content
      message.content = null;
      // Sanitize the tool calls themselves
      message.tool_calls = message.tool_calls.map((toolCall, toolIndex) => {
        const newToolCall = { ...toolCall };
        if (!newToolCall.type) newToolCall.type = 'function';
        if (!newToolCall.id) newToolCall.id = `call_generated_${i}_${toolIndex}`;
        if (newToolCall.function && typeof newToolCall.function.arguments === 'object' && newToolCall.function.arguments !== null) {
          newToolCall.function.arguments = JSON.stringify(newToolCall.function.arguments);
        }
        return newToolCall;
      });
    }

    if (message.role === 'tool') {
      const prevMessage = cleanMessages[cleanMessages.length - 1];
      
      // A 'tool' message must follow an 'assistant' message with 'tool_calls'.
      if (!prevMessage || prevMessage.role !== 'assistant' || !prevMessage.tool_calls) {
        // This is an orphaned tool message, so we discard it.
        continue;
      }

      // The 'tool' message needs a 'tool_call_id'. We find the corresponding call
      // in the previous assistant message by matching the function name.
      const matchingToolCall = prevMessage.tool_calls.find(
        (tc) => tc.function && tc.function.name === message.name
      );

      if (matchingToolCall && matchingToolCall.id) {
        message.tool_call_id = matchingToolCall.id;
        delete message.name; // 'name' is deprecated for the 'tool' role.
      } else {
        // This tool message doesn't correspond to any tool call, so we discard it.
        continue;
      }
    }
    
    cleanMessages.push(message);
  }

  return cleanMessages;
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
    body.tool_choice = 'required'; // Force the model to use a tool
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
      console.log('OpenAI chat response:', errText);
  console.log('Body:', JSON.stringify(body));
    throw new Error(`OpenAI chat failed: ${response.status} ${errText}`);
  }

  const { choices } = await response.json();

  return choices[0];
}
