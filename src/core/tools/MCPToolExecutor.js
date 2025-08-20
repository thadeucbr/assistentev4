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
      logger.step('MCPToolExecutor', 'Consultando tools disponíveis no MCP');
      this.availableTools = await this.mcpClient.listTools();
      logger.timing('MCPToolExecutor', `${this.availableTools.length} tools encontradas no MCP`);
      
      // Log das tools encontradas (apenas debug)
      this.availableTools.forEach(tool => {
        logger.debug('MCPToolExecutor', `Tool disponível: ${tool.name} - ${tool.description}`);
      });
      
      return this.availableTools;
    } catch (error) {
      logger.critical('MCPToolExecutor', `Erro ao consultar tools do MCP: ${error.message}`);
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
    logger.milestone('MCPToolExecutor', 'Executando tools via MCP');
    
    let newMessages = [...messages];
    const toolResponses = [];
    const respondedToolCallIds = new Set();

    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolId = toolCall.id;
      let args;

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        logger.error('MCPToolExecutor', `Erro ao parsear argumentos para ${toolName}: ${parseError.message}`);
        args = {};
      }

      // Iniciar tracking da tool
      logger.toolStart(toolName, toolId, args);

      try {
        // Encontrar a definição completa da tool para inspecionar o schema
        const toolDefinition = this.availableTools.find(t => t.name === toolName);

        // Adaptar argumentos para MCP de forma dinâmica
        const mcpArgs = this.adaptArgsForMCP(toolDefinition, args, from, messageData);

        // Executar via MCP com retry
        const mcpResult = await this.executeWithRetry(toolName, mcpArgs);


        // Processar resultado do MCP
        const toolResult = this.processMCPResult(toolName, mcpResult, from);

        // Validação de sucesso MCP para evitar loops de envio duplicado
        let mcpSuccess = false;
        if (
          mcpResult &&
          mcpResult.success === true &&
          mcpResult.data &&
          mcpResult.data.success === true
        ) {
          mcpSuccess = true;
          logger.debug('MCPToolExecutor', `Execução bem-sucedida para "${toolName}", evitando reenvio.`);
        }



        // Mensagem de tool, seguindo padrão OpenAI
        const toolResponse = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        };
        toolResponses.push(toolResponse);
        respondedToolCallIds.add(toolCall.id);

        // Após tool, sempre adicionar uma mensagem assistant normal para encerrar ciclo function-calling
        if (mcpSuccess) {
          const assistantMsg = {
            role: 'assistant',
            content: typeof toolResult === 'string' ? toolResult : 'Operação realizada com sucesso.'
          };
          toolResponses.push(assistantMsg);
          newMessages.push(assistantMsg);
        }

        // Finalizar tracking da tool com sucesso
        logger.toolEnd(toolName, toolId, toolResult);

      } catch (error) {
        // Finalizar tracking da tool com erro
        logger.toolEnd(toolName, toolId, null, error);

        // Criar resposta de erro mais informativa
        const errorMessage = this.createErrorMessage(toolName, error);
        const errorResponse = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: errorMessage,
        };

        toolResponses.push(errorResponse);
        respondedToolCallIds.add(toolCall.id);
      }
    }

    // Fallback: garantir que todos os tool_call_ids recebam resposta
    for (const toolCall of response.message.tool_calls) {
      if (!respondedToolCallIds.has(toolCall.id)) {
        toolResponses.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: '❌ Erro desconhecido: tool_call_id não processado. Nenhuma resposta gerada para esta ferramenta.'
        });
      }
    }

    // Adicionar todas as respostas das ferramentas
    newMessages.push(...toolResponses);

    logger.timing('MCPToolExecutor', `${toolResponses.length} tools executadas via MCP`);
    return newMessages;
  }

  /**
   * Adapta dinamicamente os argumentos para o formato esperado pelo MCP,
   * inspecionando o schema da ferramenta.
   */
  adaptArgsForMCP(tool, args, from, messageData) {
    const adaptedArgs = { ...args };

    if (!tool || !tool.inputSchema || !tool.inputSchema.properties) {
      return adaptedArgs;
    }

    const schemaProperties = tool.inputSchema.properties;

    // Injeção dinâmica de argumentos com base no schema
    const injectionMap = {
      to: from,
      recipient: from,
      recipientId: from,
      userId: from,
      from: from, // Para compatibilidade e contexto
      quotedMsgId: messageData?.id,
    };

    for (const prop in schemaProperties) {
      if (prop === 'to') {
        // Se 'to' existe, mas não contém @c.us ou @g.us, sobrescreve por 'from'
        if (
          typeof adaptedArgs.to === 'string' &&
          !adaptedArgs.to.includes('@c.us') &&
          !adaptedArgs.to.includes('@g.us')
        ) {
          adaptedArgs.to = from;
          logger.debug('MCPToolExecutor', `Sobrescrevendo 'to' por não conter @c.us/@g.us. Novo valor: ${from} para a tool "${tool.name}"`);
        } else if (!adaptedArgs.to && injectionMap.to) {
          adaptedArgs.to = injectionMap.to;
          logger.debug('MCPToolExecutor', `Injetado 'to=${injectionMap.to}' dinamicamente para a tool "${tool.name}"`);
        }
      } else if (prop in injectionMap && !adaptedArgs[prop]) {
        const value = injectionMap[prop];
        if (value) {
          adaptedArgs[prop] = value;
          logger.debug('MCPToolExecutor', `Injetado '${prop}=${value}' dinamicamente para a tool "${tool.name}"`);
        }
      }
    }

    // Lógica específica que não pode ser inferida pelo schema
    if (tool.name === 'audio_generation') {
      adaptedArgs.sendAudio = true;
    }
    
    if (tool.name === 'image_analysis' && messageData?.type === 'image' && messageData.id) {
      adaptedArgs.id = messageData.id;
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
        
        // Se é erro de buffer overflow, não tentar novamente - é inútil
        if (error.message.includes('maxBuffer length exceeded') || 
            error.message.includes('stdout maxBuffer') || 
            error.message.includes('Buffer overflow')) {
          logger.error('MCPToolExecutor', `🚫 Buffer overflow detectado para "${toolName}" - interrompendo tentativas`);
          throw new Error(`Buffer overflow: A resposta da ferramenta "${toolName}" é muito grande. Isso geralmente acontece com imagens em base64. A ferramenta deve ser otimizada para não retornar dados grandes.`);
        }
        
        // Se é erro de timeout muito longo, não tentar novamente imediatamente
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
          logger.error('MCPToolExecutor', `⏱️ Timeout detectado para "${toolName}" - interrompendo tentativas`);
          throw new Error(`Timeout: A ferramenta "${toolName}" demorou muito para responder.`);
        }
        
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
    
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return `⏱️ A operação demorou mais que o esperado e foi cancelada. Tente uma consulta mais simples.`;
    }
    
    if (errorMessage.includes('maxBuffer length exceeded') || 
        errorMessage.includes('stdout maxBuffer') || 
        errorMessage.includes('Buffer overflow')) {
      return `📋 A resposta foi muito grande para ser processada. ${toolName === 'image_generation' ? 'A imagem foi processada diretamente.' : 'Tente uma operação mais simples.'}`;
    }
    
    if (errorMessage.includes('Resposta válida não encontrada')) {
      return `🔧 Problema na comunicação interna. A operação será processada novamente automaticamente.`;
    }
    
    if (toolName === 'image_generation' && errorMessage.includes('Cannot find module')) {
      return `🎨 Problema na configuração do gerador de imagens. Verifique se todos os módulos estão instalados.`;
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
