import MCPClient from '../../services/MCPClient.js';
import logger from '../../utils/logger.js';

/**
 * Executor de ferramentas que usa apenas MCP
 * Substitui o HybridToolExecutor com comunicação 100% MCP
 */
export default class MCPToolExecutor {
  constructor() {
    this.mcpClient = new MCPClient();
    this.availableTools = null; // Cache das tools disponíveis
  }

  /**
   * Carrega dinamicamente as tools disponíveis do MCP
   * @returns {Promise<Array>} - Lista de tools disponíveis
   */
  async getAvailableTools() {
    if (this.availableTools) {
      return this.availableTools; // Retorna do cache
    }

    try {
      logger.info('MCPToolExecutor', '🔍 Consultando tools disponíveis no MCP...');
      this.availableTools = await this.mcpClient.listTools();
      logger.info('MCPToolExecutor', `✅ ${this.availableTools.length} tools encontradas no MCP`);
      
      // Log das tools encontradas
      this.availableTools.forEach(tool => {
        logger.debug('MCPToolExecutor', `📋 Tool disponível: ${tool.name} - ${tool.description}`);
      });
      
      return this.availableTools;
    } catch (error) {
      logger.error('MCPToolExecutor', `❌ Erro ao consultar tools do MCP: ${error.message}`);
      return [];
    }
  }

  /**
   * Converte as tools do MCP para o formato esperado pela OpenAI
   * @returns {Promise<Array>} - Tools no formato OpenAI
   */
  async getToolsForOpenAI() {
    const mcpTools = await this.getAvailableTools();
    
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }

  /**
   * Executa ferramentas via MCP
   * @param {Array} messages - Mensagens da conversa
   * @param {Object} response - Resposta da IA com tool_calls
   * @param {Array} tools - Tools disponíveis (ignorado, pois usamos MCP)
   * @param {string} from - ID do usuário
   * @param {string} messageId - ID da mensagem
   * @param {string} userContent - Conteúdo da mensagem do usuário
   * @param {Object} messageData - Dados completos da mensagem
   * @param {Object} imageAnalysisResult - Resultado da análise de imagem
   * @returns {Promise<Array>} - Mensagens atualizadas
   */
  async executeTools(messages, response, tools, from, messageId, userContent, messageData, imageAnalysisResult) {
    logger.milestone('MCPToolExecutor', '🎯 🚀 Executando tools via MCP');
    
    let newMessages = [...messages];
    const toolResponses = [];

    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      logger.milestone('MCPToolExecutor', `🎯 Executando tool: "${toolName}" via MCP`);
      logger.debug('MCPToolExecutor', `📝 Args para ${toolName}:`, args);

      try {
        // Adaptar argumentos para MCP
        const mcpArgs = this.adaptArgsForMCP(toolName, args, from, messageData);
        
        // Executar via MCP com retry
        const mcpResult = await this.executeWithRetry(toolName, mcpArgs);
        
        // Processar resultado do MCP
        const toolResult = this.processMCPResult(toolName, mcpResult, from);
        
        const toolResponse = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        };
        
        toolResponses.push(toolResponse);
        
        logger.milestone('MCPToolExecutor', `✅ Tool "${toolName}" executada via MCP com sucesso`);
        
      } catch (error) {
        logger.error('MCPToolExecutor', `❌ Erro ao executar "${toolName}" via MCP:`, error.message);
        
        // Criar resposta de erro mais informativa
        const errorMessage = this.createErrorMessage(toolName, error);
        const errorResponse = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: errorMessage,
        };
        
        toolResponses.push(errorResponse);
        logger.warn('MCPToolExecutor', `⚠️ Resposta de erro criada para "${toolName}"`);
      }
    }

    // Adicionar todas as respostas das ferramentas
    newMessages.push(...toolResponses);
    
    logger.debug('MCPToolExecutor', `📨 Total de ${toolResponses.length} respostas de ferramentas adicionadas`);
    return newMessages;
  }

  /**
   * Adapta argumentos para o formato esperado pelo MCP
   */
  adaptArgsForMCP(toolName, args, from, messageData) {
    const adaptedArgs = { ...args };

    switch (toolName) {
      case 'send_message':
        // Para send_message, precisamos do destinatário e ID da mensagem para reply
        adaptedArgs.to = from;
        adaptedArgs.from = from; // Compatibilidade
        if (messageData?.id) {
          adaptedArgs.quotedMsgId = messageData.id;
        }
        break;
        
      case 'audio_generation':
        // Para audio_generation, configurar envio automático
        adaptedArgs.sendAudio = true; // Sempre enviar áudio quando gerado
        adaptedArgs.to = from;
        if (messageData?.id) {
          adaptedArgs.quotedMsgId = messageData.id;
        }
        break;
        
      case 'send_audio':
        // Para send_audio, especificar destinatário
        adaptedArgs.to = from;
        if (messageData?.id) {
          adaptedArgs.quotedMsgId = messageData.id;
        }
        break;
        
      case 'calendar_management':
        adaptedArgs.userId = from;
        break;
        
      case 'reminder_management':
        adaptedArgs.userId = from;
        break;
        
      case 'image_analysis':
        if (messageData?.type === 'image' && messageData.id) {
          adaptedArgs.id = messageData.id;
        }
        break;
        
      case 'user_profile_update':
        adaptedArgs.userId = from;
        break;
    }

    return adaptedArgs;
  }

  /**
   * Executa uma tool via MCP com retry
   */
  async executeWithRetry(toolName, mcpArgs, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('MCPToolExecutor', `🔄 Tentativa ${attempt}/${maxRetries} para "${toolName}"`);
        const result = await this.mcpClient.callTool(toolName, mcpArgs);
        
        if (attempt > 1) {
          logger.milestone('MCPToolExecutor', `✅ "${toolName}" executada com sucesso na tentativa ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        logger.warn('MCPToolExecutor', `⚠️ Tentativa ${attempt}/${maxRetries} falhou para "${toolName}": ${error.message}`);
        
        if (attempt < maxRetries) {
          // Aguardar antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Cria uma mensagem de erro mais informativa
   */
  createErrorMessage(toolName, error) {
    const errorMessage = error.message || 'Erro desconhecido';
    
    if (errorMessage.includes('Rate limit')) {
      return `⏳ Temporariamente indisponível devido ao limite de uso da API. Tente novamente em alguns segundos.`;
    }
    
    if (errorMessage.includes('timeout')) {
      return `⏱️ A operação demorou mais que o esperado e foi cancelada. Tente uma consulta mais simples.`;
    }
    
    if (errorMessage.includes('Resposta válida não encontrada')) {
      return `🔧 Problema na comunicação interna. A operação será processada novamente automaticamente.`;
    }
    
    return `❌ Erro ao executar ${toolName}: ${errorMessage}`;
  }

  /**
   * Processa o resultado do MCP e formata para o formato esperado
   */
  processMCPResult(toolName, mcpResult, from) {
    if (!mcpResult.content || !mcpResult.content[0]) {
      return 'Erro: resposta MCP inválida';
    }

    const content = mcpResult.content[0];
    
    if (content.type === 'text') {
      return content.text;
    }
    
    return JSON.stringify(mcpResult, null, 2);
  }
}
