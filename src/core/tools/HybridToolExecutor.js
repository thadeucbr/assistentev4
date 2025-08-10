import logger from '../../utils/logger.js';
import MCPClient from '../../services/MCPClient.js';
import ToolExecutor from './toolExecutor.js';

/**
 * Executor híbrido que pode usar tanto tools locais quanto MCP
 */
export class HybridToolExecutor {
  constructor() {
    this.mcpClient = new MCPClient();
    this.mcpEnabled = process.env.MCP_ENABLED === 'true';
    this.mcpAvailable = false;
    this.toolMappings = this.initializeToolMappings();
  }

  /**
   * Inicializa os mapeamentos entre tools OpenAI e MCP
   */
  initializeToolMappings() {
    return {
      // Mapeamento de nomes de tools OpenAI para MCP
      'send_message': 'send_message',
      'image_generation_agent': 'image_generation',
      'image_analysis_agent': 'image_analysis',
      'audio_generation_agent': 'audio_generation',
      'calendar_agent': 'calendar_management',
      'lottery_check_agent': 'lottery_check',
      'reminder_agent': 'reminder_management',
      'sentiment_analysis': 'sentiment_analysis',
      'interaction_style_inference': 'interaction_style_inference',
      'user_profile_update': 'user_profile_update',
      'http_request': 'http_request'
    };
  }

  /**
   * Verifica se o MCP está disponível e se a tool deve usar MCP
   */
  async checkMCPAvailability() {
    if (!this.mcpEnabled) {
      return false;
    }

    try {
      this.mcpAvailable = await this.mcpClient.isAvailable();
      logger.info('HybridToolExecutor', `MCP disponível: ${this.mcpAvailable}`);
      return this.mcpAvailable;
    } catch (error) {
      this.mcpAvailable = false;
      logger.warn('HybridToolExecutor', 'MCP não disponível, usando tools locais');
      return false;
    }
  }

  /**
   * Verifica se uma tool deve usar MCP
   */
  shouldUseMCP(toolName) {
    return this.mcpEnabled && this.mcpAvailable && this.toolMappings.hasOwnProperty(toolName);
  }

  /**
   * Executa tools usando MCP quando possível, fallback para local
   */
  async executeTools(messages, response, tools, from, id, userContent, messageData = null, imageAnalysisResult = '') {
    // Log inicial para debug
    const toolNames = response.message.tool_calls?.map(tc => tc.function.name) || [];
    logger.info('HybridToolExecutor', `🔧 Processando tools: [${toolNames.join(', ')}]`);
    logger.info('HybridToolExecutor', `⚙️ MCP Status - Enabled: ${this.mcpEnabled}, Available: ${this.mcpAvailable}`);
    
    // Usar apenas MCP_ENABLED para consistência
    if (this.mcpEnabled) {
      logger.milestone('HybridToolExecutor', '🚀 Modo MCP habilitado, tentando usar MCP');
      
      if (!this.mcpAvailable) {
        logger.info('HybridToolExecutor', '🔍 Verificando disponibilidade do MCP...');
        await this.checkMCPAvailability();
      }

      if (this.mcpAvailable && response.message.tool_calls) {
        logger.milestone('HybridToolExecutor', '✅ MCP disponível, executando via MCP');
        return await this.executeToolsWithMCP(messages, response, from, id, userContent, messageData, imageAnalysisResult);
      } else {
        logger.milestone('HybridToolExecutor', '❌ MCP não disponível, usando fallback local');
      }
    } else {
      logger.info('HybridToolExecutor', '🔒 MCP desabilitado via configuração');
    }

    // Fallback para executor local
    logger.milestone('HybridToolExecutor', '🏠 Usando executor de tools local');
    return await ToolExecutor.executeTools(messages, response, tools, from, id, userContent, messageData, imageAnalysisResult);
  }

  /**
   * Executa tools usando o servidor MCP
   */
  async executeToolsWithMCP(messages, response, from, id, userContent, messageData, imageAnalysisResult) {
    logger.info('HybridToolExecutor', '🔄 Executando tools via MCP');
    
    let newMessages = [...messages];
    const toolResponses = [];

    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      logger.milestone('HybridToolExecutor', `🎯 Executando tool: "${toolName}" via MCP`);
      logger.debug('HybridToolExecutor', `📝 Args para ${toolName}:`, args);

      try {
        // Mapear nome da tool para MCP se necessário
        const mcpToolName = this.toolMappings[toolName] || toolName;
        
        if (mcpToolName !== toolName) {
          logger.info('HybridToolExecutor', `🔄 Mapeamento: "${toolName}" → "${mcpToolName}"`);
        }
        
        // Adaptar argumentos para MCP
        const mcpArgs = this.adaptArgsForMCP(toolName, args, from, messageData);
        
        // Executar via MCP
        const mcpResult = await this.mcpClient.callTool(mcpToolName, mcpArgs);
        
        // Processar resultado do MCP
        const toolResult = this.processMCPResult(toolName, mcpResult, from);
        
        const toolResponse = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        };
        
        toolResponses.push(toolResponse);
        
        logger.milestone('HybridToolExecutor', `✅ Tool "${toolName}" executada via MCP com sucesso`);
        
      } catch (error) {
        logger.error('HybridToolExecutor', `❌ Erro ao executar "${toolName}" via MCP:`, error.message);
        
        // Fallback para execução local
        logger.milestone('HybridToolExecutor', `🔄 Tentando fallback local para "${toolName}"`);
        
        try {
          const fallbackResult = await this.executeSingleToolLocally(toolName, args, from, messageData, imageAnalysisResult);
          
          const toolResponse = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: fallbackResult,
          };
          
          toolResponses.push(toolResponse);
          
          logger.milestone('HybridToolExecutor', `✅ Tool "${toolName}" executada via fallback local`);
          
        } catch (fallbackError) {
          logger.error('HybridToolExecutor', `❌ Fallback local também falhou para "${toolName}":`, fallbackError.message);
          
          const errorResponse = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Erro ao executar ${toolName}: ${error.message}`,
          };
          
          toolResponses.push(errorResponse);
        }
      }
    }

    newMessages.push(...toolResponses);
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
        
      case 'calendar_agent':
        adaptedArgs.userId = from;
        break;
        
      case 'reminder_agent':
        adaptedArgs.userId = from;
        break;
        
      case 'image_analysis_agent':
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
   * Processa o resultado do MCP e formata para o formato esperado
   */
  processMCPResult(toolName, mcpResult, from) {
    if (!mcpResult.content || !mcpResult.content[0]) {
      return 'Erro: resposta MCP inválida';
    }

    const content = mcpResult.content[0].text;
    
    try {
      const parsedContent = JSON.parse(content);
      
      // Formatação específica por tipo de tool
      switch (toolName) {
        case 'image_generation_agent':
          if (parsedContent.success) {
            return `Imagem gerada com sucesso: ${parsedContent.message}`;
          } else {
            return `Erro na geração de imagem: ${parsedContent.error}`;
          }
          
        case 'calendar_agent':
          if (parsedContent.success) {
            return `Solicitação de calendário processada: ${parsedContent.message}`;
          } else {
            return `Erro no calendário: ${parsedContent.error}`;
          }
          
        case 'audio_generation_agent':
          return `Áudio processado via MCP: ${parsedContent.message || 'Processamento concluído'}`;
          
        default:
          return content;
      }
      
    } catch (error) {
      // Se não for JSON, retornar como string
      return content;
    }
  }

  /**
   * Executa uma tool específica usando o executor local como fallback
   */
  async executeSingleToolLocally(toolName, args, from, messageData, imageAnalysisResult) {
    // Usar a implementação do ToolExecutor original
    const mockToolCall = {
      id: 'fallback_' + Date.now(),
      function: {
        name: toolName,
        arguments: JSON.stringify(args)
      }
    };

    const mockResponse = {
      message: {
        tool_calls: [mockToolCall]
      }
    };

    // Importar dinamicamente as skills necessárias baseado no toolName
    return await this.executeLocalTool(toolName, args, from, messageData);
  }

  /**
   * Executa uma tool local diretamente
   */
  async executeLocalTool(toolName, args, from, messageData) {
    logger.milestone('HybridToolExecutor', `🏠 Executando tool local: "${toolName}"`);
    
    switch (toolName) {
      case 'send_message':
        logger.debug('HybridToolExecutor', `📤 Enviando mensagem local: "${args.content}"`);
        // Importar dinamicamente para evitar dependências circulares
        const { default: sendMessage } = await import('../../whatsapp/sendMessage.js');
        await sendMessage(from, args.content);
        return `Mensagem enviada ao usuário: "${args.content}"`;

      case 'sentiment_analysis':
        logger.debug('HybridToolExecutor', `🎭 Analisando sentimento local: "${args.text}"`);
        const { default: analyzeSentiment } = await import('../../skills/analyzeSentiment.js');
        const sentimentResult = await analyzeSentiment(args.text);
        return `Análise de sentimento: ${sentimentResult}`;

      default:
        logger.warn('HybridToolExecutor', `❓ Tool local "${toolName}" não implementada no fallback`);
        return `Tool local ${toolName} não implementada no fallback`;
    }
  }
}

export default HybridToolExecutor;
