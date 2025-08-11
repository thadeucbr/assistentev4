import PersonalityEvolutionSystem from './PersonalityEvolutionSystem.js';
import EvolutivePromptBuilder from './EvolutivePromptBuilder.js';
import logger from '../../utils/logger.js';

/**
 * Log especial para debug de personalidade - fácil de filtrar
 */
function personalityLog(component, message, data = {}) {
  logger.debug(`PERSONALITY-${component}`, `🧠 ${message}`, {
    ...data,
    debugType: 'PERSONALITY'
  });
}

/**
 * Orquestrador Principal de Personalidade
 * Gerencia toda a lógica de personalidade evolutiva do assistente
 */
export default class PersonalityOrchestrator {
  constructor() {
    this.evolutionSystem = new PersonalityEvolutionSystem();
    this.isInitialized = false;
  }

  /**
   * Inicializa o sistema de personalidade
   */
  async initialize(assistantId = 'default') {
    if (this.isInitialized) return;
    
    logger.info('PersonalityOrchestrator', 'Inicializando sistema de personalidade evolutiva');
    
    await this.evolutionSystem.initialize(assistantId);
    this.isInitialized = true;
    
    const characterization = this.evolutionSystem.generatePersonalityCharacterization();
    logger.info('PersonalityOrchestrator', 'Sistema inicializado com sucesso', {
      mood: characterization.core_personality.dominant_mood,
      maturity: characterization.core_personality.personality_maturity,
      relationships: characterization.relational_context.total_relationships
    });
  }

  /**
   * Processa uma interação e atualiza a personalidade
   */
  async processPersonalityInteraction(userId, userMessage, userSentiment, conversationContext = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Log detalhado da entrada
    personalityLog('ORCHESTRATOR', 'INÍCIO: Processando interação para evolução', {
      userId,
      messageLength: userMessage?.length || 0,
      userSentiment,
      contextKeys: Object.keys(conversationContext)
    });

    try {
      const evolutionResult = await this.evolutionSystem.processEvolutionaryInteraction(
        userId, 
        userMessage, 
        userSentiment, 
        conversationContext
      );

      // Log do resultado da evolução
      personalityLog('ORCHESTRATOR', 'EVOLUÇÃO PROCESSADA:', {
        evolutionApplied: evolutionResult.evolution_applied,
        emotionalChanges: evolutionResult.emotional_changes,
        newMood: evolutionResult.current_emotional_state?.dominant_mood,
        relationshipLevel: evolutionResult.relationship_data?.relationship_level
      });

      personalityLog('ORCHESTRATOR', 'RESULTADO FINAL:', {
        mood: evolutionResult.mood,
        formationLevel: evolutionResult.personality_formation,
        evolutionApplied: evolutionResult.evolution_applied
      });

      return evolutionResult;
    } catch (error) {
      logger.error('PersonalityOrchestrator', `❌ Erro ao processar interação: ${error.message}`, {
        stack: error.stack
      });
      // Retornar estado básico em caso de erro
      return {
        mood: 'balanced',
        emotionalState: {},
        personalitySnapshot: {},
        adaptive_traits: {}
      };
    }
  }

  /**
   * Gera prompt dinâmico baseado na personalidade atual
   */
  async buildPersonalityPrompt(userId, userProfile, ltmContext, imageAnalysisResult = '', situationType = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Log detalhado da entrada do prompt
    personalityLog('ORCHESTRATOR', 'INÍCIO BUILD PROMPT:', {
      userId,
      hasProfile: !!userProfile,
      ltmContextLength: ltmContext?.length || 0,
      hasImageAnalysis: !!imageAnalysisResult,
      situationType
    });

    try {
      const characterization = this.evolutionSystem.generatePersonalityCharacterization();
      const adaptiveTraits = this.evolutionSystem._getAdaptiveTraits(userId);

      // Log da caracterização gerada
      personalityLog('ORCHESTRATOR', 'CARACTERIZAÇÃO GERADA:', {
        dominantMood: characterization.core_personality?.dominant_mood,
        maturityLevel: characterization.core_personality?.personality_maturity,
        totalRelationships: characterization.relational_context?.total_relationships,
        adaptiveTraitsCount: Object.keys(adaptiveTraits || {}).length
      });

      const personalityData = {
        ...characterization,
        adaptive_traits: adaptiveTraits
      };

      let prompt;
      
      if (situationType) {
        personalityLog('ORCHESTRATOR', 'PROMPT SITUACIONAL:', { situationType });
        
        const basePrompt = EvolutivePromptBuilder.buildEvolutivePrompt(
          personalityData, 
          userProfile, 
          ltmContext, 
          imageAnalysisResult
        );
        
        const situationalAddition = EvolutivePromptBuilder.buildSituationalPrompt(
          situationType, 
          personalityData
        );
        
        prompt = {
          ...basePrompt,
          content: `${basePrompt.content}\n\n${situationalAddition}`
        };
      } else {
        personalityLog('ORCHESTRATOR', 'PROMPT PADRÃO');
        
        prompt = EvolutivePromptBuilder.buildEvolutivePrompt(
          personalityData, 
          userProfile, 
          ltmContext, 
          imageAnalysisResult
        );
      }

      const debugSummary = EvolutivePromptBuilder.generatePersonalityDebugSummary(personalityData);
      
      // Log detalhado do resultado final
      personalityLog('ORCHESTRATOR', 'PROMPT FINAL GERADO:', {
        promptLength: prompt?.content?.length || 0,
        mood: debugSummary.current_mood,
        adaptiveBehaviors: debugSummary.adaptive_behaviors,
        personalityMaturity: debugSummary.personality_maturity
      });

      return {
        prompt,
        personalityMetadata: {
          mood: characterization.core_personality.dominant_mood,
          formation_level: characterization.core_personality.personality_maturity,
          familiarity_level: adaptiveTraits.familiarity_level,
          adaptive_behaviors: debugSummary.adaptive_behaviors
        }
      };
    } catch (error) {
      logger.error('PersonalityOrchestrator', `Erro ao construir prompt: ${error.message}`);
      
      // Fallback para prompt básico
      return {
        prompt: {
          role: 'system',
          content: `Você é um assistente de IA prestativo. Use a função 'send_message' para todas as respostas ao usuário.`
        },
        personalityMetadata: {
          mood: 'neutral',
          formation_level: 0,
          familiarity_level: 0,
          adaptive_behaviors: []
        }
      };
    }
  }

  /**
   * Executa manutenção periódica da personalidade
   */
  async performPersonalityMaintenance() {
    if (!this.isInitialized) return;

    logger.debug('PersonalityOrchestrator', 'Executando manutenção da personalidade');

    try {
      // Salvar estado atual
      await this.evolutionSystem.saveEvolutionData();
      
      // Gerar relatório de status
      const characterization = this.evolutionSystem.generatePersonalityCharacterization();
      
      logger.info('PersonalityOrchestrator', 'Manutenção concluída', {
        totalRelationships: characterization.relational_context.total_relationships,
        personalityMaturity: characterization.core_personality.personality_maturity,
        currentMood: characterization.core_personality.dominant_mood,
        formativeMemories: characterization.formative_influences.length
      });

      return characterization;
    } catch (error) {
      logger.error('PersonalityOrchestrator', `Erro na manutenção: ${error.message}`);
    }
  }

  /**
   * Força uma evolução da personalidade (para testes ou situações especiais)
   */
  async forcePersonalityEvolution(evolutionType, parameters = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info('PersonalityOrchestrator', `Forçando evolução do tipo: ${evolutionType}`);

    try {
      switch (evolutionType) {
        case 'mood_shift':
          // Simular uma mudança de humor baseada em parâmetros
          await this.evolutionSystem.emotionalEngine.processInteraction(
            parameters.userId || 'system',
            parameters.trigger || 'System-triggered mood adjustment',
            parameters.sentiment || 'neutro'
          );
          break;

        case 'relationship_boost':
          // Simular interação positiva para aumentar familiaridade
          for (let i = 0; i < 5; i++) {
            await this.evolutionSystem.processEvolutionaryInteraction(
              parameters.userId,
              'Interaction boost for relationship building',
              'positivo',
              { type: 'relationship_building' }
            );
          }
          break;

        case 'reset_emotional_state':
          // Resetar estado emocional para valores padrão
          this.evolutionSystem.emotionalEngine.emotionalDimensions = {
            happiness: 0.5,
            energy: 0.5,
            curiosity: 0.7,
            empathy: 0.8,
            confidence: 0.6,
            playfulness: 0.4,
            patience: 0.7,
            social_warmth: 0.6
          };
          break;

        default:
          logger.warn('PersonalityOrchestrator', `Tipo de evolução desconhecido: ${evolutionType}`);
      }

      const result = this.evolutionSystem.generatePersonalityCharacterization();
      logger.info('PersonalityOrchestrator', 'Evolução forçada concluída', {
        newMood: result.core_personality.dominant_mood,
        maturity: result.core_personality.personality_maturity
      });

      return result;
    } catch (error) {
      logger.error('PersonalityOrchestrator', `Erro na evolução forçada: ${error.message}`);
    }
  }

  /**
   * Obtém análise completa da personalidade atual
   */
  async getPersonalityAnalysis(userId = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const characterization = this.evolutionSystem.generatePersonalityCharacterization();
      const emotionalState = this.evolutionSystem.emotionalEngine.getEmotionalSnapshot();
      
      let userSpecificData = {};
      if (userId) {
        userSpecificData = this.evolutionSystem._getAdaptiveTraits(userId);
      }

      return {
        timestamp: new Date().toISOString(),
        global_personality: characterization,
        current_emotional_state: emotionalState,
        user_specific_adaptations: userSpecificData,
        system_metrics: {
          is_initialized: this.isInitialized,
          total_interactions: this.evolutionSystem.evolutionMetrics.total_interactions,
          formation_score: this.evolutionSystem.evolutionMetrics.personality_formation_score,
          stability_score: this.evolutionSystem.evolutionMetrics.character_stability
        }
      };
    } catch (error) {
      logger.error('PersonalityOrchestrator', `Erro ao obter análise: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica se o sistema está pronto para funcionar
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Obtém resumo rápido do estado atual
   */
  getQuickStatus() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    try {
      const mood = this.evolutionSystem.emotionalEngine.currentMood;
      const formation = this.evolutionSystem.evolutionMetrics.personality_formation_score;
      const relationships = this.evolutionSystem.evolutionaryTraits.user_relationships.size;

      return {
        status: 'active',
        current_mood: mood,
        personality_maturity: formation,
        active_relationships: relationships,
        last_interaction: new Date().toISOString()
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}
