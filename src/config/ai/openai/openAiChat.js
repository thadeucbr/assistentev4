import logger from '../../../utils/logger.js';

const OPENAI_URL = process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions';
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

// Detecta se o texto é uma URL de imagem ou base64 de imagem
function isImageContent(content) {
  if (!content || typeof content !== 'string') return false;
  // Base64 JPEG/PNG
  if (content.startsWith('data:image/')) return true;
  // URL simples
  if (/^https?:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(content)) return true;
  // WhatsApp CDN
  if (/^https?:\/\/mmg\.whatsapp\.net\//.test(content)) return true;
  return false;
}

/**
 * Sanitiza e adapta mensagens para o formato da OpenAI, incluindo suporte a imagens.
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

    // Suporte a imagem para mensagens do usuário
    if (message.role === 'user' && isImageContent(message.content)) {
      // Se vier só a imagem, transforma em array content
      message.content = [
        {
          type: 'image_url',
          image_url: {
            url: message.content,
            detail: 'auto'
          }
        }
      ];
    } else if (
      message.role === 'user' &&
      Array.isArray(message.content) &&
      message.content.some(
        c => c.type === 'image_url' || isImageContent(c.text || c.url || c)
      )
    ) {
      // Já está no formato vision ou misto texto+imagem
      message.content = message.content.map(c => {
        if (typeof c === 'string' && isImageContent(c)) {
          return {
            type: 'image_url',
            image_url: { url: c, detail: 'auto' }
          };
        }
        if (c.type === 'image_url') return c;
        if (c.text && isImageContent(c.text)) {
          return {
            type: 'image_url',
            image_url: { url: c.text, detail: 'auto' }
          };
        }
        if (c.url && isImageContent(c.url)) {
          return {
            type: 'image_url',
            image_url: { url: c.url, detail: 'auto' }
          };
        }
        if (c.text) {
          return { type: 'text', text: c.text };
        }
        return c;
      });
    } else if (message.role === 'user' && typeof message.content === 'string' && message.content !== null) {
      // Mensagem normal de texto
      message.content = message.content;
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
      // Find the most recent assistant message with tool_calls
      let assistantMessage = null;
      for (let j = cleanMessages.length - 1; j >= 0; j--) {
        if (cleanMessages[j].role === 'assistant' && cleanMessages[j].tool_calls) {
          assistantMessage = cleanMessages[j];
          break;
        }
      }

      // A 'tool' message must follow an 'assistant' message with 'tool_calls'.
      if (!assistantMessage) {
        // This is an orphaned tool message, so we discard it.
        continue;
      }

      // The 'tool' message needs a 'tool_call_id'.
      // First check if it already has a valid tool_call_id
      if (message.tool_call_id) {
        // Verify this tool_call_id exists in the assistant message
        const matchingToolCall = assistantMessage.tool_calls.find(
          (tc) => tc.id === message.tool_call_id
        );
        if (matchingToolCall) {
          delete message.name; // 'name' is deprecated for the 'tool' role.
        } else {
          // tool_call_id doesn't match any in the assistant message, discard
          continue;
        }
      } else {
        // Fallback: try to match by function name if tool_call_id is missing
        const matchingToolCall = assistantMessage.tool_calls.find(
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
    }

    cleanMessages.push(message);
  }

  return cleanMessages;
}


export default async function openAiChat(chatMessages, toolsParam) {
  const startTime = Date.now();
  
  chatMessages = sanitizeMessages(chatMessages);
  if (!OPENAI_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }


  // Log detalhado do payload enviado ao OpenAI
  logger.debug('OpenAI', 'Iniciando chamada para OpenAI', {
    model: OPENAI_MODEL,
    messagesCount: chatMessages.length,
    toolsCount: toolsParam?.length || 0,
    userMessages: chatMessages
      .filter(m => m.role === 'user')
      .map(m => ({
        content: m.content,
        contentType: Array.isArray(m.content)
          ? m.content.map(c => c.type || typeof c)
          : typeof m.content
      }))
  });

  const body = {
    model: OPENAI_MODEL,
    messages: chatMessages,
  };

  const toolsToUse = toolsParam && toolsParam.length > 0 ? toolsParam : undefined;

  if (toolsToUse) {
    body.tools = toolsToUse;
    body.tool_choice = 'required'; // Force the model to use a tool
    logger.debug('OpenAI', `Usando ${toolsToUse.length} ferramentas com tool_choice=required`);
  }

  try {
    logger.systemStatus('OpenAI-API', 'connecting');
    
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(body)
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      
      logger.error('OpenAI', `Resposta HTTP ${response.status}`, {
        status: response.status,
        responseText: errText.substring(0, 500),
        requestModel: OPENAI_MODEL,
        responseTime: `${responseTime}ms`
      });
      
      // Parse error details for better handling
      let errorDetails;
      try {
        errorDetails = JSON.parse(errText);
      } catch {
        errorDetails = { error: { message: errText } };
      }
      
      // Handle rate limits gracefully
      if (response.status === 429) {
        logger.systemStatus('OpenAI-API', 'warning', { 
          reason: 'rate-limit',
          responseTime: `${responseTime}ms`
        });
        const error = new Error(`OpenAI Rate Limit: ${errorDetails.error?.message || 'Rate limit exceeded'}`);
        error.isRateLimit = true;
        error.statusCode = 429;
        throw error;
      }
      
      // Handle other errors
      logger.systemStatus('OpenAI-API', 'error', {
        status: response.status,
        responseTime: `${responseTime}ms`
      });
      const error = new Error(`OpenAI chat failed: ${response.status} ${errorDetails.error?.message || errText}`);
      error.statusCode = response.status;
      throw error;
    }

    const result = await response.json();
    const { choices, usage } = result;

    logger.systemStatus('OpenAI-API', 'online', {
      responseTime: `${responseTime}ms`,
      usage: usage
    });

    // Log detalhado da resposta
    logger.aiResponse('OpenAI', 'OpenAI', {
      message: choices[0]?.message,
      usage: usage,
      model: OPENAI_MODEL
    }, {
      requestTime: responseTime,
      messageLength: chatMessages.length,
      toolsAvailable: toolsParam?.length || 0
    });

    return {
      message: choices[0]?.message
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (!error.statusCode) {
      // Network or other unexpected errors
      logger.systemStatus('OpenAI-API', 'error', {
        error: error.message,
        responseTime: `${responseTime}ms`,
        type: 'network-error'
      });
    }
    
    logger.error('OpenAI', `Erro na chamada OpenAI: ${error.message}`, {
      responseTime: `${responseTime}ms`,
      isRateLimit: error.isRateLimit || false,
      statusCode: error.statusCode
    });
    
    throw error;
  }
}
