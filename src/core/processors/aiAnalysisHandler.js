import analyzeSentiment from '../../skills/analyzeSentiment.js';
import inferInteractionStyle from '../../skills/inferInteractionStyle.js';
import { getUserProfile, updateUserProfile } from '../../repository/userProfileRepository.js';
import logger from '../../utils/logger.js';

/**
 * Gerencia análises de IA sequenciais (sentimento, estilo, etc.)
 */
export default class AIAnalysisHandler {
  /**
   * Executa análises de IA sequencialmente
   * @param {string} userContent - Conteúdo da mensagem do usuário
   * @param {string} userId - ID do usuário
   * @param {Object} userProfile - Perfil atual do usuário
   * @returns {Promise<Object>} - { currentSentiment, inferredStyle, updatedProfile }
   */
  static async performAIAnalysis(userContent, userId, userProfile) {
    logger.info('AIAnalysisHandler', 'Iniciando análises de IA sequencialmente...');
    
    logger.debug('AIAnalysisHandler', 'Analisando sentimento...');
    const currentSentiment = await analyzeSentiment(userContent);
    
    logger.debug('AIAnalysisHandler', 'Inferindo estilo de interação...');
    const inferredStyle = await inferInteractionStyle(userContent);

    // Atualizar perfil do usuário com sentimento e estilo
    logger.debug('AIAnalysisHandler', 'Atualizando perfil do usuário (sentimento/estilo)...');
    const updatedProfile = {
      ...userProfile,
      sentiment: { average: currentSentiment, trend: 'stable' },
      interaction_style: inferredStyle
    };
    
    await updateUserProfile(userId, updatedProfile);
    
    return {
      currentSentiment,
      inferredStyle,
      updatedProfile
    };
  }
}
