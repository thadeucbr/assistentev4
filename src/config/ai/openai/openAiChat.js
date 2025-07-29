import tools from '../tools.ai.js';
import logError from '../../../utils/logger.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
function sanitizeMessages(messages) {
  const sanitized = messages
    .map(m => {
      const message = { ...m };

      // Standardize tool calls
      if (message.role === 'assistant' && message.tool_calls) {
        message.tool_calls = message.tool_calls.map(tc => {
          // Ollama fallback might not have all properties
          const functionName = tc.function?.name || tc.name;
          let functionArguments = tc.function?.arguments || tc.arguments;

          if (typeof functionArguments === 'object') {
            functionArguments = JSON.stringify(functionArguments);
          }

          return {
            id: tc.id || functionName,
            type: 'function',
            function: {
              name: functionName,
              arguments: functionArguments
            }
          };
        });
      }

      // Standardize function/tool role
      if (message.role === 'function') {
        message.role = 'tool';
        message.tool_call_id = message.name;
      }

      // Ensure content is a string
      if (typeof message.content !== 'string' && message.content !== null) {
        message.content = JSON.stringify(message.content);
      } else if (message.content === null) {
        message.content = '';
      }

      return message;
    })
    .filter(m => {
      // Filter out empty assistant messages that don't have tool calls
      return !(m.role === 'assistant' && !m.content && !m.tool_calls);
    });

  return sanitized;
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