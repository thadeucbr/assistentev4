import logger from '../utils/logger.js';

// Core processors
import UserDataProcessor from './processors/userDataProcessor.js';
import AIResponseProcessor from './processors/aiResponseProcessor.js';

// Orchestrators
import ToolExecutionOrchestrator from './orchestrators/toolExecutionOrchestrator.js';

// Handlers
import ErrorHandler from './handlers/errorHandler.js';
import ContextAnalyzer from './handlers/contextAnalyzer.js';
import BackgroundTaskManager from './handlers/backgroundTaskManager.js';

// External dependencies
import MessageAuthHandler from './processors/messageAuthHandler.js';
import simulateTyping from '../whatsapp/simulateTyping.js';

// Environment config
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

/**
 * Processador principal de mensagens - Refatorado e Modularizado
 * Atua como orquestrador central, delegando responsabilidades para módulos especializados
 */
class MessageProcessor {

  /**
   * Processa mensagem recebida - Método principal orquestrador
   * @param {Object} message - Mensagem recebida
   */
  static async processMessage(message) {
    const messageId = logger.generateMessageId();
    const startTime = Date.now();
    
    logger.start('MessageProcessor', 'Processamento de mensagem iniciado');
    
    try {
      const { data } = message;
      
      // Log da interação inicial
      logger.interaction('MessageProcessor', 'webhook-received', {
        from: data.from,
        messageType: data.messageType || 'text',
        hasImage: !!data.image
      });
      
      // === FASE 1: AUTORIZAÇÃO ===
      if (!MessageAuthHandler.isMessageAuthorized(data, groups)) {
        logger.debug('MessageProcessor', 'Mensagem não autorizada - ignorando');
        return;
      }
      logger.milestone('MessageProcessor', 'Mensagem autorizada para processamento');

      // === FASE 2: INICIALIZAÇÃO ===
      // Sistema de personalidade removido - usando fallback simples
      
      // Feedback imediato: simular digitação
      simulateTyping(data.from, true);

      // === FASE 3: PROCESSAMENTO DE DADOS ===
      const { userContent, imageAnalysisResult } = await UserDataProcessor.processImageData(data);
      const { userId, rawMessages, userProfile, ltmContext } = await UserDataProcessor.loadUserData(data, userContent);
      let messages = await UserDataProcessor.processMessageContext(rawMessages, userContent, userId, data.from);

      // === FASE 4: ANÁLISES ===
      const { currentSentiment, inferredStyle } = await UserDataProcessor.performAIAnalysis(userContent, userId, userProfile);

      // === FASE 5: PERSONALIDADE EVOLUTIVA ===
      // Sistema de personalidade removido - continuando sem processamento de personalidade

      // === FASE 6: CONSTRUÇÃO DE PROMPT ===
      let dynamicPrompt;
      try {
        const situationType = ContextAnalyzer.determineSituationType(messages, userContent);
        dynamicPrompt = AIResponseProcessor.createFallbackPrompt(userProfile, ltmContext, imageAnalysisResult);
      } catch (error) {
        logger.error('MessageProcessor', `Erro no prompt (usando fallback): ${error.message}`);
        dynamicPrompt = AIResponseProcessor.createFallbackPrompt(userProfile, ltmContext, imageAnalysisResult);
      }

      // === FASE 7: PREPARAÇÃO E GERAÇÃO DE RESPOSTA ===
      const sanitizedChatMessages = AIResponseProcessor.prepareChatMessages(dynamicPrompt, messages, userContent);
      const { mcpExecutor, dynamicTools } = await AIResponseProcessor.getAvailableTools();
      
      let response;
      try {
        response = await AIResponseProcessor.generateAIResponse(sanitizedChatMessages, dynamicTools);
      } catch (error) {
        const handled = await ErrorHandler.handleAIResponseError(error, data);
        if (handled) return; // Erro tratado, sair graciosamente
        throw error;
      }

      // === FASE 8: EXECUÇÃO DE FERRAMENTAS ===
      messages.push({ role: 'user', content: userContent });
      messages.push(response.message);

      logger.step('MessageProcessor', '🔧 Iniciando ciclo de ferramentas');
      await ToolExecutionOrchestrator.executeToolCycle(
        messages, response, dynamicTools, data, userContent, imageAnalysisResult, mcpExecutor
      );
      logger.timing('MessageProcessor', '🔧 Ciclo de ferramentas concluído');

      // === FASE 9: FINALIZAÇÃO ===
      await UserDataProcessor.saveUserContext(userId, messages);
      
      // Tarefas em background (não bloquear)
      BackgroundTaskManager.executeBackgroundTasks(userId, messages);
      
      logger.end('MessageProcessor', `Processamento concluído - TEMPO TOTAL: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      await ErrorHandler.handleCriticalError(error, message);
    }
  }
}

/**
 * Exportar função compatível com a API existente
 */
export default async function processMessage(message) {
  return MessageProcessor.processMessage(message);
}
