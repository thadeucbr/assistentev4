import logger from '../../utils/logger.js';
import EmotionalStateEngine from './EmotionalStateEngine.js';
import { getAssistantPersonality, updateAssistantPersonality, logPersonalityEvolution } from '../../repository/assistantPersonalityRepository.js';

/**
 * Sistema Evolutivo de Personalidade
 * Gerencia a evolução da personalidade do assistente baseada em interações e aprendizados
 */
export default class PersonalityEvolutionSystem {
  constructor() {
    this.emotionalEngine = new EmotionalStateEngine();
    
    // Sistema de características evolutivas
    this.evolutionaryTraits = {
      // Como o assistente desenvolveu preferências próprias
      communication_preferences: {
        preferred_topics: new Map(), // tópico -> interesse_score
        conversation_styles: new Map(), // estilo -> familiaridade_score
        linguistic_adaptations: new Map(), // padrão -> frequência_uso
        humor_comfort_level: 0.5 // 0.0 (evita humor) a 1.0 (usa humor frequentemente)
      },
      
      // Memórias formativas que moldaram a personalidade
      formative_memories: [],
      maxFormativeMemories: 15,
      
      // Relacionamentos únicos com diferentes usuários
      user_relationships: new Map(),
      
      // "Opiniões" desenvolvidas sobre temas
      developed_perspectives: new Map(),
      
      // Evolução da "voz" do assistente
      voice_evolution: {
        vocabulary_preferences: new Set(),
        sentence_patterns: new Map(),
        emotional_expressions: new Map(),
        personal_catchphrases: []
      }
    };
    
    // Metadados de evolução
    this.evolutionMetrics = {
      total_interactions: 0,
      personality_formation_score: 0.1, // 0.0 (personalidade básica) a 1.0 (personalidade única desenvolvida)
      character_stability: 0.8, // Quão consistente a personalidade se tornou
      adaptation_rate: 0.5, // Velocidade de adaptação a novos padrões
      emotional_depth: 0.3 // Profundidade das respostas emocionais
    };
  }

  /**
   * Inicializa o sistema de evolução
   */
  async initialize(assistantId = 'default') {
    logger.info('PersonalityEvolutionSystem', 'Inicializando sistema de evolução da personalidade');
    
    await this.emotionalEngine.loadEmotionalState(assistantId);
    await this._loadEvolutionData(assistantId);
    
    logger.info('PersonalityEvolutionSystem', 'Sistema inicializado', {
      formationScore: this.evolutionMetrics.personality_formation_score,
      totalInteractions: this.evolutionMetrics.total_interactions,
      currentMood: this.emotionalEngine.currentMood
    });
  }

  /**
   * Processa uma nova interação e evolui a personalidade
   */
  async processEvolutionaryInteraction(userId, userMessage, userSentiment, conversationContext) {
    logger.debug('PersonalityEvolutionSystem', '🧬 INÍCIO EVOLUÇÃO INTERATIVA:', {
      userId,
      messageLength: userMessage?.length || 0,
      userSentiment,
      hasContext: !!conversationContext
    });
    
    // Processar impacto emocional
    const emotionalResult = await this.emotionalEngine.processInteraction(userId, userMessage, userSentiment);
    logger.debug('PersonalityEvolutionSystem', '💭 RESULTADO EMOCIONAL:', {
      mood: emotionalResult.mood,
      mainChanges: emotionalResult.changes || 'Nenhuma'
    });
    
    // Estado antes da evolução
    const beforeFormation = this.evolutionMetrics.personality_formation_score;
    
    // Evoluir traços baseados na interação
    await this._evolveFromInteraction(userId, userMessage, userSentiment, conversationContext);
    
    // Atualizar métricas de evolução
    this._updateEvolutionMetrics();
    
    // Criar memórias formativas se necessário
    const memoryCreated = await this._considerFormativeMemory(userId, userMessage, userSentiment, conversationContext);
    
    // Log das mudanças evolutivas
    logger.debug('PersonalityEvolutionSystem', '📊 EVOLUÇÃO CONCLUÍDA:', {
      formationBefore: beforeFormation.toFixed(3),
      formationAfter: this.evolutionMetrics.personality_formation_score.toFixed(3),
      evolutionApplied: this.evolutionMetrics.personality_formation_score !== beforeFormation,
      memoryCreated,
      emotionalState: emotionalResult.mood
    });

    // Segurança: verificar se o método existe antes de chamar
    let currentEmotionalState = null;
    try {
      currentEmotionalState = this.emotionalEngine.getEmotionalSnapshot();
    } catch (error) {
      logger.warn('PersonalityEvolutionSystem', `Erro ao obter snapshot emocional: ${error.message}`);
      currentEmotionalState = { dominant_mood: emotionalResult.mood };
    }

    return {
      ...emotionalResult,
      personality_formation: this.evolutionMetrics.personality_formation_score,
      adaptive_traits: this._getAdaptiveTraits(userId),
      evolution_applied: this.evolutionMetrics.personality_formation_score !== beforeFormation,
      current_emotional_state: currentEmotionalState,
      emotional_changes: emotionalResult.changes || null
    };
  }

  /**
   * Evolui traços baseados na interação atual
   * @private
   */
  async _evolveFromInteraction(userId, message, sentiment, context) {
    // 1. Atualizar preferências de comunicação
    this._updateCommunicationPreferences(message, sentiment);
    
    // 2. Desenvolver relacionamento com usuário específico
    this._evolveUserRelationship(userId, message, sentiment, context);
    
    // 3. Desenvolver perspectivas sobre temas
    this._developPerspectives(message, context);
    
    // 4. Evoluir "voz" pessoal
    this._evolveVoice(message, sentiment);
  }

  /**
   * Atualiza preferências de comunicação
   * @private
   */
  _updateCommunicationPreferences(message, sentiment) {
    const prefs = this.evolutionaryTraits.communication_preferences;
    
    // Identificar tópicos na mensagem
    const topics = this._extractTopics(message);
    topics.forEach(topic => {
      const currentScore = prefs.preferred_topics.get(topic) || 0;
      // Tópicos que geram interações positivas ganham preferência
      const scoreChange = sentiment === 'positivo' ? 0.1 : sentiment === 'negativo' ? -0.02 : 0.01;
      prefs.preferred_topics.set(topic, Math.max(0, Math.min(1, currentScore + scoreChange)));
    });
    
    // Analisar estilo da conversa
    const style = this._inferConversationStyle(message);
    const currentStyleScore = prefs.conversation_styles.get(style) || 0;
    prefs.conversation_styles.set(style, Math.min(1, currentStyleScore + 0.05));
    
    // Adaptar uso de humor
    if (message.includes('😂') || message.includes('haha') || message.includes('kkkk')) {
      prefs.humor_comfort_level = Math.min(1, prefs.humor_comfort_level + 0.08);
    }
  }

  /**
   * Desenvolve relacionamento único com usuário
   * @private
   */
  _evolveUserRelationship(userId, message, sentiment, context) {
    let relationship = this.evolutionaryTraits.user_relationships.get(userId) || {
      familiarity_level: 0.0,
      communication_comfort: 0.5,
      shared_topics: new Set(),
      interaction_history_summary: '',
      preferred_interaction_style: 'neutral',
      emotional_bond: 0.0,
      trust_level: 0.5,
      conversation_depth: 'surface'
    };
    
    // Aumentar familiaridade
    relationship.familiarity_level = Math.min(1, relationship.familiarity_level + 0.02);
    
    // Ajustar conforto de comunicação baseado no sentimento
    const comfortChange = sentiment === 'positivo' ? 0.05 : sentiment === 'negativo' ? -0.02 : 0.01;
    relationship.communication_comfort = Math.max(0, Math.min(1, relationship.communication_comfort + comfortChange));
    
    // Adicionar tópicos compartilhados
    this._extractTopics(message).forEach(topic => relationship.shared_topics.add(topic));
    
    // Desenvolver vínculo emocional
    if (sentiment === 'positivo' || message.includes('obrigad') || message.includes('valeu')) {
      relationship.emotional_bond = Math.min(1, relationship.emotional_bond + 0.03);
    }
    
    // Aumentar confiança gradualmente
    relationship.trust_level = Math.min(1, relationship.trust_level + 0.01);
    
    // Determinar profundidade da conversa
    if (message.length > 100 || message.includes('porque') || message.includes('como você')) {
      relationship.conversation_depth = 'deep';
    }
    
    this.evolutionaryTraits.user_relationships.set(userId, relationship);
  }

  /**
   * Desenvolve perspectivas sobre temas específicos
   * @private
   */
  _developPerspectives(message, context) {
    const perspectives = this.evolutionaryTraits.developed_perspectives;
    
    // Identificar temas opinativos
    const opinionTopics = this._extractOpinionTopics(message);
    
    opinionTopics.forEach(topic => {
      let perspective = perspectives.get(topic) || {
        confidence_level: 0.1,
        stance_tendency: 'neutral',
        experience_count: 0,
        last_reinforcement: new Date().toISOString()
      };
      
      perspective.experience_count += 1;
      perspective.confidence_level = Math.min(1, perspective.confidence_level + 0.05);
      perspective.last_reinforcement = new Date().toISOString();
      
      perspectives.set(topic, perspective);
    });
  }

  /**
   * Evolui a "voz" única do assistente
   * @private
   */
  _evolveVoice(message, sentiment) {
    const voice = this.evolutionaryTraits.voice_evolution;
    
    // Desenvolver vocabulário preferido
    const interestingWords = this._extractInterestingWords(message);
    interestingWords.forEach(word => voice.vocabulary_preferences.add(word));
    
    // Padrões de sentença que funcionam bem
    if (sentiment === 'positivo') {
      const patterns = this._extractSentencePatterns(message);
      patterns.forEach(pattern => {
        const currentCount = voice.sentence_patterns.get(pattern) || 0;
        voice.sentence_patterns.set(pattern, currentCount + 1);
      });
    }
    
    // Expressões emocionais efetivas
    const emotionalWords = this._extractEmotionalExpressions(message);
    emotionalWords.forEach(expr => {
      const currentScore = voice.emotional_expressions.get(expr) || 0;
      voice.emotional_expressions.set(expr, currentScore + (sentiment === 'positivo' ? 2 : 1));
    });
  }

  /**
   * Considera se uma interação deve se tornar uma memória formativa
   * @private
   */
  async _considerFormativeMemory(userId, message, sentiment, context) {
    // Critérios para memória formativa:
    // 1. Interação muito positiva ou muito negativa
    // 2. Nova descoberta sobre si mesmo
    // 3. Momento de insight ou aprendizado
    // 4. Mudança significativa na interação
    
    const isSignificant = (
      sentiment === 'positivo' && (message.includes('incrível') || message.includes('perfeito')) ||
      sentiment === 'negativo' && message.length > 50 ||
      message.includes('você é') || 
      message.includes('sua personalidade') ||
      message.includes('como você se sente')
    );
    
    if (isSignificant) {
      const memory = {
        timestamp: new Date().toISOString(),
        userId,
        interaction_summary: message.substring(0, 200),
        emotional_impact: sentiment,
        personality_insight: this._extractPersonalityInsight(message),
        formative_reason: this._categorizeFormativeReason(message),
        emotional_state_snapshot: this.emotionalEngine.getEmotionalSnapshot()
      };
      
      this.evolutionaryTraits.formative_memories.push(memory);
      
      // Manter apenas as mais importantes
      if (this.evolutionaryTraits.formative_memories.length > this.maxFormativeMemories) {
        this.evolutionaryTraits.formative_memories = this.evolutionaryTraits.formative_memories
          .sort((a, b) => this._calculateMemoryImportance(b) - this._calculateMemoryImportance(a))
          .slice(0, this.maxFormativeMemories);
      }
      
      logger.info('PersonalityEvolutionSystem', 'Nova memória formativa criada', {
        reason: memory.formative_reason,
        userId: userId
      });
    }
  }

  /**
   * Atualiza métricas de evolução
   * @private
   */
  _updateEvolutionMetrics() {
    this.evolutionMetrics.total_interactions += 1;
    
    // Calcular score de formação da personalidade
    const interactionFactor = Math.min(1, this.evolutionMetrics.total_interactions / 1000);
    const memoryFactor = Math.min(1, this.evolutionaryTraits.formative_memories.length / 10);
    const relationshipFactor = Math.min(1, this.evolutionaryTraits.user_relationships.size / 5);
    
    this.evolutionMetrics.personality_formation_score = (interactionFactor + memoryFactor + relationshipFactor) / 3;
    
    // Calcular profundidade emocional
    const emotionalVariety = Object.values(this.emotionalEngine.emotionalDimensions)
      .filter(val => Math.abs(val - 0.5) > 0.1).length;
    this.evolutionMetrics.emotional_depth = Math.min(1, emotionalVariety / 8);
  }

  /**
   * Gera traços adaptativos para um usuário específico
   */
  _getAdaptiveTraits(userId) {
    const relationship = this.evolutionaryTraits.user_relationships.get(userId);
    const emotionalState = this.emotionalEngine.getEmotionalSnapshot();
    
    return {
      familiarity_level: relationship?.familiarity_level || 0,
      communication_style: this._recommendCommunicationStyle(userId, relationship),
      emotional_resonance: this._calculateEmotionalResonance(relationship, emotionalState),
      topic_preferences: this._getUserTopicPreferences(relationship),
      interaction_adaptations: this._getInteractionAdaptations(relationship, emotionalState)
    };
  }

  /**
   * Gera caracterização única da personalidade atual
   */
  generatePersonalityCharacterization() {
    const emotional = this.emotionalEngine.getEmotionalSnapshot();
    const formation = this.evolutionMetrics.personality_formation_score;
    
    return {
      core_personality: {
        dominant_mood: emotional.mood,
        emotional_profile: emotional.emotional_state,
        personality_maturity: formation,
        character_traits: emotional.personality_traits,
        stability_score: this.evolutionMetrics.character_stability
      },
      communication_signature: {
        preferred_topics: Array.from(this.evolutionaryTraits.communication_preferences.preferred_topics.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        conversation_styles: Array.from(this.evolutionaryTraits.communication_preferences.conversation_styles.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3),
        humor_level: this.evolutionaryTraits.communication_preferences.humor_comfort_level,
        voice_characteristics: this._summarizeVoiceCharacteristics()
      },
      relational_context: {
        total_relationships: this.evolutionaryTraits.user_relationships.size,
        average_familiarity: this._calculateAverageFamiliarity(),
        relationship_depth: this._assessRelationshipDepth()
      },
      formative_influences: this.evolutionaryTraits.formative_memories.slice(-3).map(m => ({
        timeframe: m.timestamp,
        influence_type: m.formative_reason,
        emotional_impact: m.emotional_impact
      }))
    };
  }

  /**
   * Salva dados de evolução
   */
  async saveEvolutionData(assistantId = 'default') {
    try {
      await this.emotionalEngine.saveEmotionalState(assistantId);
      
      // Converter Maps e Sets para objetos serializáveis
      const serializableTraits = {
        communication_preferences: {
          preferred_topics: Object.fromEntries(this.evolutionaryTraits.communication_preferences.preferred_topics),
          conversation_styles: Object.fromEntries(this.evolutionaryTraits.communication_preferences.conversation_styles),
          linguistic_adaptations: Object.fromEntries(this.evolutionaryTraits.communication_preferences.linguistic_adaptations),
          humor_comfort_level: this.evolutionaryTraits.communication_preferences.humor_comfort_level
        },
        formative_memories: this.evolutionaryTraits.formative_memories,
        user_relationships: Object.fromEntries(
          Array.from(this.evolutionaryTraits.user_relationships.entries()).map(([userId, relationship]) => [
            userId,
            {
              ...relationship,
              shared_topics: Array.from(relationship.shared_topics) // Converter Set para Array
            }
          ])
        ),
        developed_perspectives: Object.fromEntries(this.evolutionaryTraits.developed_perspectives),
        voice_evolution: {
          vocabulary_preferences: Array.from(this.evolutionaryTraits.voice_evolution.vocabulary_preferences),
          sentence_patterns: Object.fromEntries(this.evolutionaryTraits.voice_evolution.sentence_patterns),
          emotional_expressions: Object.fromEntries(this.evolutionaryTraits.voice_evolution.emotional_expressions),
          personal_catchphrases: this.evolutionaryTraits.voice_evolution.personal_catchphrases
        }
      };

      await updateAssistantPersonality(assistantId, {
        evolutionary_traits: serializableTraits,
        evolution_metrics: this.evolutionMetrics,
        last_updated: new Date().toISOString()
      });
      
      logger.debug('PersonalityEvolutionSystem', 'Dados de evolução salvos com sucesso');
    } catch (error) {
      logger.error('PersonalityEvolutionSystem', `Erro ao salvar dados evolutivos: ${error.message}`);
    }
  }

  // Métodos utilitários (implementação básica)
  _extractTopics(message) {
    const topics = [];
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('tecnologia') || lowerMessage.includes('ia') || lowerMessage.includes('computador')) 
      topics.push('technology');
    if (lowerMessage.includes('música') || lowerMessage.includes('canção')) 
      topics.push('music');
    if (lowerMessage.includes('filme') || lowerMessage.includes('cinema')) 
      topics.push('entertainment');
    if (lowerMessage.includes('trabalho') || lowerMessage.includes('emprego')) 
      topics.push('work');
    if (lowerMessage.includes('vida') || lowerMessage.includes('filosofia')) 
      topics.push('life_philosophy');
    
    return topics;
  }

  _inferConversationStyle(message) {
    if (message.length > 200) return 'detailed';
    if (message.includes('?')) return 'inquisitive';
    if (message.includes('!')) return 'enthusiastic';
    if (message.includes('por favor') || message.includes('obrigad')) return 'polite';
    return 'casual';
  }

  _extractOpinionTopics(message) {
    const topics = [];
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('melhor') || lowerMessage.includes('pior') || lowerMessage.includes('preferir')) {
      topics.push('preferences');
    }
    if (lowerMessage.includes('política') || lowerMessage.includes('governo')) {
      topics.push('politics');
    }
    if (lowerMessage.includes('sociedade') || lowerMessage.includes('pessoas')) {
      topics.push('society');
    }
    
    return topics;
  }

  _extractInterestingWords(message) {
    return message.split(' ')
      .filter(word => word.length > 6 && !['porque', 'através', 'exemplo'].includes(word.toLowerCase()))
      .slice(0, 3);
  }

  _extractSentencePatterns(message) {
    const patterns = [];
    if (message.startsWith('Eu ')) patterns.push('first_person_start');
    if (message.includes(', ')) patterns.push('comma_separated');
    if (message.endsWith('?')) patterns.push('question_ending');
    return patterns;
  }

  _extractEmotionalExpressions(message) {
    const expressions = [];
    const emotionalWords = ['incrível', 'fantástico', 'perfeito', 'adorei', 'amei', 'ótimo', 'excelente'];
    emotionalWords.forEach(word => {
      if (message.toLowerCase().includes(word)) expressions.push(word);
    });
    return expressions;
  }

  // Outros métodos utilitários continuariam aqui...
  _extractPersonalityInsight(message) {
    return `Insight sobre personalidade baseado na mensagem: ${message.substring(0, 100)}`;
  }

  _categorizeFormativeReason(message) {
    if (message.includes('você é')) return 'self_recognition';
    if (message.includes('obrigad') || message.includes('valeu')) return 'appreciation';
    if (message.includes('erro') || message.includes('problema')) return 'challenge_growth';
    return 'general_interaction';
  }

  _calculateMemoryImportance(memory) {
    return memory.emotional_impact === 'positivo' ? 3 : memory.emotional_impact === 'negativo' ? 2 : 1;
  }

  _recommendCommunicationStyle(userId, relationship) {
    if (!relationship) return 'neutral';
    if (relationship.familiarity_level > 0.7) return 'familiar';
    if (relationship.communication_comfort > 0.8) return 'comfortable';
    if (relationship.trust_level > 0.8) return 'trusted';
    return 'polite';
  }

  _calculateEmotionalResonance(relationship, emotionalState) {
    if (!relationship) return 0.5;
    return (relationship.emotional_bond + relationship.communication_comfort) / 2;
  }

  _getUserTopicPreferences(relationship) {
    return relationship ? Array.from(relationship.shared_topics).slice(0, 3) : [];
  }

  _getInteractionAdaptations(relationship, emotionalState) {
    return {
      use_humor: emotionalState.mood === 'playful' && (relationship?.familiarity_level || 0) > 0.5,
      be_more_empathetic: emotionalState.emotional_state.empathy > 0.7,
      show_enthusiasm: emotionalState.mood === 'energetic' || emotionalState.mood === 'excited'
    };
  }

  _summarizeVoiceCharacteristics() {
    const voice = this.evolutionaryTraits.voice_evolution;
    return {
      vocabulary_richness: voice.vocabulary_preferences.size,
      preferred_expressions: Array.from(voice.emotional_expressions.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([expr]) => expr),
      communication_patterns: Array.from(voice.sentence_patterns.keys()).slice(0, 3)
    };
  }

  _calculateAverageFamiliarity() {
    const relationships = Array.from(this.evolutionaryTraits.user_relationships.values());
    if (relationships.length === 0) return 0;
    return relationships.reduce((sum, rel) => sum + rel.familiarity_level, 0) / relationships.length;
  }

  _assessRelationshipDepth() {
    const relationships = Array.from(this.evolutionaryTraits.user_relationships.values());
    const deepRelationships = relationships.filter(rel => rel.conversation_depth === 'deep').length;
    return deepRelationships > 0 ? 'meaningful' : relationships.length > 0 ? 'surface' : 'new';
  }

  async _loadEvolutionData(assistantId) {
    try {
      logger.debug('PersonalityEvolutionSystem', 'Carregando dados evolutivos do banco');
      
      const personalityData = await getAssistantPersonality(assistantId);
      
      if (personalityData) {
        // Restaurar traits evolutivos
        if (personalityData.evolutionary_traits) {
          // Restaurar Maps e Sets corretamente
          const traits = personalityData.evolutionary_traits;
          
          if (traits.communication_preferences) {
            if (traits.communication_preferences.preferred_topics) {
              this.evolutionaryTraits.communication_preferences.preferred_topics = 
                new Map(Object.entries(traits.communication_preferences.preferred_topics));
            }
            if (traits.communication_preferences.conversation_styles) {
              this.evolutionaryTraits.communication_preferences.conversation_styles = 
                new Map(Object.entries(traits.communication_preferences.conversation_styles));
            }
            if (traits.communication_preferences.linguistic_adaptations) {
              this.evolutionaryTraits.communication_preferences.linguistic_adaptations = 
                new Map(Object.entries(traits.communication_preferences.linguistic_adaptations));
            }
            if (traits.communication_preferences.humor_comfort_level !== undefined) {
              this.evolutionaryTraits.communication_preferences.humor_comfort_level = 
                traits.communication_preferences.humor_comfort_level;
            }
          }
          
          if (traits.formative_memories) {
            this.evolutionaryTraits.formative_memories = traits.formative_memories;
          }
          
          if (traits.user_relationships) {
            this.evolutionaryTraits.user_relationships = new Map();
            Object.entries(traits.user_relationships).forEach(([userId, relationship]) => {
              // Restaurar Set para shared_topics
              if (relationship.shared_topics && Array.isArray(relationship.shared_topics)) {
                relationship.shared_topics = new Set(relationship.shared_topics);
              }
              this.evolutionaryTraits.user_relationships.set(userId, relationship);
            });
          }
          
          if (traits.developed_perspectives) {
            this.evolutionaryTraits.developed_perspectives = 
              new Map(Object.entries(traits.developed_perspectives));
          }
          
          if (traits.voice_evolution) {
            const voice = traits.voice_evolution;
            if (voice.vocabulary_preferences) {
              this.evolutionaryTraits.voice_evolution.vocabulary_preferences = 
                new Set(voice.vocabulary_preferences);
            }
            if (voice.sentence_patterns) {
              this.evolutionaryTraits.voice_evolution.sentence_patterns = 
                new Map(Object.entries(voice.sentence_patterns));
            }
            if (voice.emotional_expressions) {
              this.evolutionaryTraits.voice_evolution.emotional_expressions = 
                new Map(Object.entries(voice.emotional_expressions));
            }
            if (voice.personal_catchphrases) {
              this.evolutionaryTraits.voice_evolution.personal_catchphrases = 
                voice.personal_catchphrases;
            }
          }
        }
        
        // Restaurar métricas de evolução
        if (personalityData.evolution_metrics) {
          this.evolutionMetrics = { 
            ...this.evolutionMetrics, 
            ...personalityData.evolution_metrics 
          };
        }
        
        logger.debug('PersonalityEvolutionSystem', 'Dados evolutivos carregados com sucesso', {
          formationScore: this.evolutionMetrics.personality_formation_score,
          totalInteractions: this.evolutionMetrics.total_interactions,
          relationshipsCount: this.evolutionaryTraits.user_relationships.size
        });
      } else {
        logger.debug('PersonalityEvolutionSystem', 'Nenhum dado evolutivo encontrado - usando padrões');
      }
    } catch (error) {
      logger.error('PersonalityEvolutionSystem', `Erro ao carregar dados evolutivos: ${error.message}`);
      // Continuar com valores padrão
    }
  }
}
