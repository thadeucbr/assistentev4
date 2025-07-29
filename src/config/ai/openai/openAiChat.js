import tools from '../tools.ai.js';
import logError from '../../../utils/logger.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
function sanitizeMessages(messages) {
  // console.log('Sanitizing messages:', messages);
  const sanitized = messages.map(m => {
    const message = { ...m };
    if (message.role === 'function') {
      message.role = 'tool';
      message.tool_call_id = message.name;
    }
    if (typeof message.content !== 'string') {
      message.content = JSON.stringify(message.content);
    }
    return message;
  });
  // console.log('Sanitized messages:', sanitized);
  return sanitized;
}


export default async function openAiChat(chatMessages, toolsParam) {
  try {
    chatMessages = sanitizeMessages(chatMessages);
    if (!OPENAI_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }

    const body = {
      model: OPENAI_MODEL,
      messages: chatMessages,
      tool_choice: 'auto'
    };

    if (toolsParam !== undefined && toolsParam.length === 0) {
      // Do nothing, tools property will be omitted
    } else if (toolsParam) {
      body.tools = toolsParam;
    } else {
      body.tools = tools;
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
  } catch (error) {
    logError(error, 'openAiChat - OpenAI API call failed');
    throw error;
  }
}