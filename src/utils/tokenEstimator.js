import logger from './logger.js';

// Map of known model identifiers to their maximum token limits.
const MODEL_TOKEN_LIMITS = {
  // OpenAI Models
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-2024-04-09': 128000,
  'gpt-4-0125-preview': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4-1106-preview': 128000,
  'gpt-4-vision-preview': 128000,
  'gpt-4': 8192,
  'gpt-4-0613': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-32k-0613': 32768,
  'gpt-3.5-turbo-0125': 16385,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-1106': 16385,
  'gpt-3.5-turbo-instruct': 4096,
  'gpt-5-mini-2025-08-07': 128000,
  // Ollama Models (limits are often configurable, but these are common defaults)
  'llama3': 8192,
  'codellama': 16000,
  'mistral': 8192,
  'gemma': 8192,
};

// A safe buffer to prevent exceeding the limit due to estimation inaccuracies.
const TOKEN_SAFETY_MARGIN = 0.9; // 90%

/**
 * Estimates the number of tokens in a message payload.
 * A common heuristic is that one token is approximately 4 characters.
 * This is a rough estimate and should be used as a pre-flight check.
 * @param {Array<Object>} messages - The array of message objects.
 * @returns {number} The estimated token count.
 */
function estimateTokenCount(messages) {
  if (!messages || !Array.isArray(messages)) {
    return 0;
  }

  const totalChars = messages.reduce((acc, message) => {
    if (typeof message.content === 'string') {
      return acc + message.content.length;
    }
    if (typeof message === 'string') {
      // Handle cases where the message itself is a string
      return acc + message.length;
    }
    // For tool calls or other complex content, serialize to JSON to estimate size.
    if (message.tool_calls || message.function_call) {
      try {
        return acc + JSON.stringify(message).length;
      } catch (e) {
        return acc; // Ignore serialization errors
      }
    }
    return acc;
  }, 0);

  // Using a divisor of 3 for a more conservative (higher) token estimate.
  return Math.ceil(totalChars / 3);
}

/**
 * The Circuit Breaker function.
 * Checks if the estimated token count for a given payload exceeds the model's limit.
 * @param {Array<Object>} messages - The message payload.
 * @param {string} modelName - The name of the model to check against.
 * @throws {Error} If the estimated token count exceeds the safe limit.
 */
export function checkTokenLimit(messages, modelName) {
  const modelLimit = MODEL_TOKEN_LIMITS[modelName];

  if (!modelLimit) {
    logger.warn('TokenEstimator', `Token limit for model "${modelName}" is not defined. Skipping circuit breaker check.`);
    return;
  }

  const estimatedTokens = estimateTokenCount(messages);
  const safeLimit = modelLimit * TOKEN_SAFETY_MARGIN;

  logger.debug('TokenEstimator', `Checking token limit for model ${modelName}. Estimated: ${estimatedTokens}, Safe Limit: ${safeLimit}`);

  if (estimatedTokens > safeLimit) {
    const errorMessage = `Circuit Breaker: Estimated token count (${estimatedTokens}) exceeds 90% of the limit for model "${modelName}" (${safeLimit}/${modelLimit}). Aborting API call to prevent error.`;
    logger.critical('TokenEstimator', errorMessage);
    throw new Error(errorMessage);
  }
}
