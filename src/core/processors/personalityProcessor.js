import PersonalityOrchestrator from '../personality/PersonalityOrchestrator.js';
import logger from '../../utils/logger.js';

/**
 * Processador dedicado ao sistema de personalidade evolutiva
 * Responsável pela inicialização e processamento da personalidade
 */
class PersonalityProcessor {
  static personalityOrchestrator = null;
  static personalityInitialized = false;

  /**
   * Inicializa o sistema de personalidade (lazy loading)
   */
  static async ensureInitialized() {
    if (!this.personalityOrchestrator) {
      this.personalityOrchestrator = new PersonalityOrchestrator();
    }
    
    if (!this.personalityInitialized) {
      await this.personalityOrchestrator.initialize();
      this.personalityInitialized = true;
      logger.info('PersonalityProcessor', '🎭 Sistema de personalidade inicializado');
    }
  }

  /**
   * Processa a interação da personalidade
   */
  static async processPersonalityInteraction(userId, userContent, currentSentiment, metadata) {
    await this.ensureInitialized();

    logger.step('PersonalityProcessor', '🎭 Processando evolução da personalidade');
    logger.debug('PersonalityProcessor', '🎭 ENTRADA PERSONALIDADE:', {
      userId,
      contentLength: userContent?.length || 0,
      currentSentiment,
      messageType: metadata.messageType || 'text',
      hasImage: !!metadata.hasImage,
      conversationLength: metadata.conversationLength
    });
    
    try {
      const personalityResult = await this.personalityOrchestrator.processPersonalityInteraction(
        userId, 
        userContent, 
        currentSentiment, 
        metadata
      );
      
      logger.debug('PersonalityProcessor', '🎭 RESULTADO PERSONALIDADE:', {
        mood: personalityResult.mood,
        formationLevel: personalityResult.personality_formation,
        evolutionApplied: personalityResult.evolution_applied
      });
      
      logger.timing('PersonalityProcessor', '🎭 Personalidade evolutiva processada');
      return personalityResult;
    } catch (error) {
      logger.error('PersonalityProcessor', `Erro no processamento da personalidade: ${error.message}`);
      throw error;
    }
  }

  /**
   * Constrói prompt evolutivo com personalidade
   */
  static async buildPersonalityPrompt(userId, userProfile, ltmContext, imageAnalysisResult, situationType) {
    await this.ensureInitialized();

    logger.step('PersonalityProcessor', '🏗️ Construindo prompt evolutivo');
    logger.debug('PersonalityProcessor', '🏗️ ENTRADA BUILD PROMPT:', {
      userId,
      hasProfile: !!userProfile,
      ltmContextLength: ltmContext?.length || 0,
      hasImageAnalysis: !!imageAnalysisResult,
      situationType
    });
    
    try {
      const promptResult = await this.personalityOrchestrator.buildPersonalityPrompt(
        userId, 
        userProfile, 
        ltmContext, 
        imageAnalysisResult,
        situationType
      );
      
      logger.debug('PersonalityProcessor', '🏗️ PROMPT RESULT:', {
        promptLength: promptResult.prompt?.content?.length || 0,
        mood: promptResult.personalityMetadata.mood,
        formationLevel: promptResult.personalityMetadata.formation_level,
        adaptiveBehaviors: promptResult.personalityMetadata.adaptive_behaviors?.length || 0
      });
      
      logger.timing('PersonalityProcessor', '🏗️ Prompt evolutivo construído', {
        mood: promptResult.personalityMetadata.mood,
        formationLevel: promptResult.personalityMetadata.formation_level,
        familiarityLevel: promptResult.personalityMetadata.familiarity_level
      });

      return promptResult;
    } catch (error) {
      logger.error('PersonalityProcessor', `Erro na construção do prompt evolutivo: ${error.message}`);
      throw error;
    }
  }
}

export default PersonalityProcessor;
