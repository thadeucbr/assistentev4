/**
 * Função auxiliar para normalizar as respostas dos diferentes provedores de IA
 * @param {object} response - Resposta bruta da API de IA
 * @returns {object} - Resposta normalizada com estrutura consistente
 */
export function normalizeAiResponse(response) {
  // Se já tem a estrutura correta, retorna como está
  if (response && response.message) {
    return response;
  }
  
  // Se a resposta é do formato direto (como Ollama)
  if (response && (response.role || response.content || response.tool_calls || response.function_call)) {
    return {
      message: {
        role: response.role || 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls || null,
        function_call: response.function_call || null
      }
    };
  }
  
  // Fallback para estrutura mínima
  return {
    message: {
      role: 'assistant',
      content: typeof response === 'string' ? response : '',
      tool_calls: null,
      function_call: null
    }
  };
}

/**
 * Extrai o conteúdo de texto de uma resposta de IA, independente da estrutura
 * @param {object} response - Resposta da API de IA
 * @returns {string} - Conteúdo de texto extraído
 */
export function extractContent(response) {
  if (!response) return '';
  
  // Tenta diferentes estruturas possíveis
  if (response?.message?.content) {
    return response.message.content;
  } else if (response?.content) {
    return response.content;
  } else if (typeof response === 'string') {
    return response;
  }
  
  return '';
}

/**
 * Tenta fazer parse de JSON com retry e limpeza automática
 * @param {string} content - Conteúdo para fazer parse
 * @returns {object|null} - Objeto parseado ou null se falhar
 */
export function safeJsonParse(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  try {
    // Tentar limpar o conteúdo antes de fazer parse
    const cleanContent = content.trim();
    
    // Se o conteúdo parece ser JSON, tenta fazer parse
    if (cleanContent.startsWith('{') && cleanContent.endsWith('}')) {
      return JSON.parse(cleanContent);
    } else if (cleanContent.startsWith('[') && cleanContent.endsWith(']')) {
      return JSON.parse(cleanContent);
    }
    
    // Tentar encontrar JSON dentro do texto
    const jsonMatch = cleanContent.match(/\{.*\}/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao fazer parse do JSON:', error);
    return null;
  }
}

/**
 * Função para fazer retry de chamadas de IA com JSON esperado
 * @param {function} aiCallFunction - Função que faz a chamada de IA
 * @param {number} maxRetries - Número máximo de tentativas
 * @param {number} delayMs - Delay entre tentativas em ms
 * @returns {object} - Resultado parseado ou fallback
 */
export async function retryAiJsonCall(aiCallFunction, maxRetries = 3, delayMs = 1000) {
  let lastResponse = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await aiCallFunction(i);
      lastResponse = response;
      
      const content = extractContent(response);
      const parsed = safeJsonParse(content);
      
      if (parsed) {
        return { success: true, data: parsed, response };
      }
      
      console.warn(`Tentativa ${i + 1} - JSON inválido recebido:`, content);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Tentativa ${i + 1} - Erro na chamada de IA:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  return { 
    success: false, 
    data: null, 
    response: lastResponse,
    fallback: extractContent(lastResponse)
  };
}
