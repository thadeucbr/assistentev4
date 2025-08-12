import LtmService from '../../services/LtmService.js';
import { sanitizeMessagesForChat } from './messageSanitizer.js';
import STMManager from '../memory/stmManager.js';
import ImageProcessor from './imageProcessor.js';
import MessageAuthHandler from './messageAuthHandler.js';
import AIAnalysisHandler from './aiAnalysisHandler.js';
import { getUserContext, updateUserContext } from '../../repository/contextRepository.js';
import { getUserProfile } from '../../repository/userProfileRepository.js';
import logger from '../../utils/logger.js';

/**
 * Processador dedicado ao carregamento e preparação de dados do usuário
 */
class UserDataProcessor {
  
  /**
   * Carrega todos os dados necessários do usuário
   */
  static async loadUserData(data, userContent) {
    const userId = MessageAuthHandler.extractUserId(data.from);
    
    logger.step('UserDataProcessor', 'Carregando contexto e perfil do usuário');
    
    const [
      { messages: rawMessages }, 
      userProfile, 
      ltmContext
    ] = await Promise.all([
      getUserContext(userId),
      getUserProfile(userId),
      LtmService.getRelevantContext(userId, userContent)
    ]);

    logger.timing('UserDataProcessor', 'Dados do usuário carregados', {
      messagesCount: rawMessages.length,
      hasUserProfile: !!userProfile,
      ltmContextSize: ltmContext?.length || 0
    });

    return {
      userId,
      rawMessages,
      userProfile,
      ltmContext
    };
  }

  /**
   * Processa e sanitiza o contexto de mensagens
   */
  static async processMessageContext(rawMessages, userContent, userId, from) {
    logger.step('UserDataProcessor', 'Sanitizando contexto histórico');
    let messages = sanitizeMessagesForChat(rawMessages);
    
    logger.timing('UserDataProcessor', 'Contexto histórico sanitizado', {
      originalCount: rawMessages.length,
      sanitizedCount: messages.length
    });

    // Gerenciar STM (Short Term Memory)
    logger.step('UserDataProcessor', '🧠 Iniciando gerenciamento STM');
    try {
      messages = await STMManager.manageSTM(messages, userContent, userId, from);
      logger.timing('UserDataProcessor', '🧠 Gerenciamento STM concluído', {
        finalMessageCount: messages.length
      });
    } catch (error) {
      logger.critical('UserDataProcessor', `Erro no gerenciamento STM: ${error.message}`, {
        stack: error.stack
      });
      throw error;
    }

    return messages;
  }

  /**
   * Processa imagens e extrai conteúdo do usuário
   */
  static async processImageData(data) {
    logger.step('UserDataProcessor', 'Processando imagens detectadas');
    const { userContent, imageAnalysisResult } = await ImageProcessor.processImage(data);
    return { userContent, imageAnalysisResult };
  }

  /**
   * Executa análises de IA sobre o conteúdo do usuário
   */
  static async performAIAnalysis(userContent, userId, userProfile) {
    logger.step('UserDataProcessor', '🤖 Iniciando análises de IA');
    
    try {
      const aiAnalysis = await AIAnalysisHandler.performAIAnalysis(userContent, userId, userProfile);
      const { currentSentiment, inferredStyle } = aiAnalysis;
      
      logger.timing('UserDataProcessor', '🤖 Análises de IA concluídas', {
        sentiment: currentSentiment,
        style: inferredStyle
      });

      return { currentSentiment, inferredStyle };
    } catch (error) {
      logger.error('UserDataProcessor', `Erro nas análises de IA: ${error.message}`);
      // Valores padrão em caso de erro
      return {
        currentSentiment: 'neutro',
        inferredStyle: 'neutral'
      };
    }
  }

  /**
   * Salva o contexto atualizado do usuário
   */
  static async saveUserContext(userId, messages) {
    logger.step('UserDataProcessor', '💾 Salvando contexto do usuário');
    await updateUserContext(userId, { messages });
    logger.timing('UserDataProcessor', '💾 Contexto salvo');
  }
}

export default UserDataProcessor;
