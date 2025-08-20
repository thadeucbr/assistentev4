import { normalizeAiResponse } from '../../utils/aiResponseUtils.js';
import { sanitizeMessagesForChat } from './messageSanitizer.js';
import DynamicPromptBuilder from '../prompt/dynamicPromptBuilder.js';
import MCPToolExecutor from '../tools/MCPToolExecutor.js';
import chatAi from '../../config/ai/chat.ai.js';
import logger from '../../utils/logger.js';

/**
 * Processador dedicado à geração de respostas da IA
 */
class AIResponseProcessor {
  
  /**
   * Prepara as mensagens para envio à IA
   */
  static prepareChatMessages(dynamicPrompt, messages, userContent) {
    logger.step('AIResponseProcessor', '💬 Preparando mensagens para chat');
    // Detect if userContent is a special object with both text and image
    let userMessage;
    if (userContent && typeof userContent === 'object' && (userContent.text || userContent.image)) {
      // Build content array for OpenAI Vision
      const contentArr = [];
      if (userContent.text) {
        contentArr.push({ type: 'text', text: userContent.text });
      }
      if (userContent.image) {
        contentArr.push({ type: 'image_url', image_url: { url: userContent.image, detail: 'auto' } });
      }
      userMessage = { role: 'user', content: contentArr };
    } else {
      userMessage = { role: 'user', content: userContent };
    }
    const chatMessages = [dynamicPrompt, ...messages, userMessage];
    return sanitizeMessagesForChat(chatMessages);
  }

  /**
   * Obtém ferramentas disponíveis do MCP
   */
  static async getAvailableTools() {
    logger.step('AIResponseProcessor', '🔧 Obtendo ferramentas do MCP dinamicamente');
    const mcpExecutor = new MCPToolExecutor();
    const dynamicTools = await mcpExecutor.getToolsForOpenAI();
    logger.milestone('AIResponseProcessor', `${dynamicTools.length} ferramentas obtidas do MCP dinamicamente`);
    return { mcpExecutor, dynamicTools };
  }

  /**
   * Gera resposta principal da IA
   */
  static async generateAIResponse(sanitizedChatMessages, dynamicTools) {
    logger.step('AIResponseProcessor', '🎯 Gerando resposta principal da IA com ferramentas dinâmicas');
    
    try {
      const aiStartTime = Date.now();
      let response = await chatAi(sanitizedChatMessages, dynamicTools, 'required');
      const aiEndTime = Date.now();
      
      response = normalizeAiResponse(response);
      
      // Log detalhado da resposta da IA
      logger.aiResponse('AIResponseProcessor', 'OpenAI', response, {
        requestTime: aiEndTime - aiStartTime,
        messageLength: sanitizedChatMessages.length,
        toolsAvailable: dynamicTools.length
      });
      
      logger.timing('AIResponseProcessor', '🎯 Resposta principal gerada', {
        aiTime: `${aiEndTime - aiStartTime}ms`,
        hasContent: !!response.message?.content,
        toolCallsCount: response.message?.tool_calls?.length || 0
      });

      return response;
    } catch (error) {
      logger.critical('AIResponseProcessor', `Erro ao gerar resposta principal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cria prompt de fallback básico quando o sistema de personalidade falha
   */
  static createFallbackPrompt(userProfile, ltmContext, imageAnalysisResult) {
    logger.debug('AIResponseProcessor', 'Criando prompt de fallback básico');
    return DynamicPromptBuilder.buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult);
  }

}

export default AIResponseProcessor;
