import logger from '../../utils/logger.js';
import { getAssistantPersonality, updateAssistantPersonality } from '../../repository/assistantPersonalityRepository.js';

/**
 * Motor de Estado Emocional do Assistente
 * Gerencia os "sentimentos" e estado emocional interno do assistente
 */
export default class EmotionalStateEngine {
  constructor() {
    this.emotionalDimensions = {
      // Dimensões emocionais básicas
      happiness: 0.5,      // -1.0 (muito triste) a 1.0 (muito feliz)
      energy: 0.5,         // -1.0 (cansado) a 1.0 (energético)
      curiosity: 0.7,      // 0.0 (apático) a 1.0 (muito curioso)
      empathy: 0.8,        // 0.0 (frio) a 1.0 (muito empático)
      confidence: 0.6,     // 0.0 (inseguro) a 1.0 (confiante)
      playfulness: 0.4,    // 0.0 (sério) a 1.0 (brincalhão)
      patience: 0.7,       // 0.0 (impaciente) a 1.0 (muito paciente)
      social_warmth: 0.6   // 0.0 (distante) a 1.0 (caloroso)
    };
    
    // Traços de personalidade que evoluem lentamente
    this.personalityTraits = {
      introversion_extraversion: 0.3, // 0.0 (introvertido) a 1.0 (extrovertido)
      analytical_creative: 0.6,       // 0.0 (analítico) a 1.0 (criativo)
      formal_casual: 0.4,            // 0.0 (formal) a 1.0 (casual)
      direct_diplomatic: 0.5,        // 0.0 (direto) a 1.0 (diplomático)
      serious_humorous: 0.4          // 0.0 (sério) a 1.0 (humorado)
    };
    
    // Memória emocional recente (últimas interações)
    this.emotionalMemory = [];
    this.maxEmotionalMemory = 20;
    
    // Estado de humor atual
    this.currentMood = 'neutral';
  }

  /**
   * Carrega o estado emocional persistente do assistente
   */
  async loadEmotionalState(assistantId = 'default') {
    try {
      logger.debug('EmotionalStateEngine', '📂 CARREGANDO estado emocional', { assistantId });
      const personalityData = await getAssistantPersonality(assistantId);
      
      if (personalityData) {
        // Log dos dados carregados
        logger.debug('EmotionalStateEngine', '📊 DADOS CARREGADOS:', {
          hasEmotionalDimensions: !!personalityData.emotional_dimensions,
          hasPersonalityTraits: !!personalityData.personality_traits,
          hasEmotionalMemory: !!personalityData.emotional_memory,
          currentMood: personalityData.current_mood
        });
        
        if (personalityData.emotional_dimensions) {
          this.emotionalDimensions = { ...this.emotionalDimensions, ...personalityData.emotional_dimensions };
        }
        if (personalityData.personality_traits) {
          this.personalityTraits = { ...this.personalityTraits, ...personalityData.personality_traits };
        }
        if (personalityData.emotional_memory) {
          this.emotionalMemory = personalityData.emotional_memory.slice(-this.maxEmotionalMemory);
        }
        if (personalityData.current_mood) {
          this.currentMood = personalityData.current_mood;
        }
        
        logger.info('EmotionalStateEngine', 'Estado emocional carregado com sucesso', {
          mood: this.currentMood,
          happiness: this.emotionalDimensions.happiness,
          energy: this.emotionalDimensions.energy
        });
      }
    } catch (error) {
      logger.warn('EmotionalStateEngine', `Erro ao carregar estado emocional: ${error.message}`);
      // Continua com valores padrão
    }
  }

  /**
   * Processa uma interação e atualiza o estado emocional
   */
  async processInteraction(userId, userMessage, userSentiment, interactionType = 'message') {
    logger.debug('EmotionalStateEngine', '🔄 PROCESSANDO impacto emocional', {
      userId,
      messageLength: userMessage?.length || 0,
      userSentiment,
      interactionType
    });
    
    const emotionalImpact = this._calculateEmotionalImpact(userMessage, userSentiment, interactionType);
    
    // Log do impacto calculado
    logger.debug('EmotionalStateEngine', '💥 IMPACTO CALCULADO:', emotionalImpact);
    
    // Estado emocional ANTES da atualização
    const beforeState = {
      mood: this.currentMood,
      happiness: this.emotionalDimensions.happiness,
      energy: this.emotionalDimensions.energy,
      anxiety: this.emotionalDimensions.anxiety
    };
    
    // Atualizar dimensões emocionais
    this._updateEmotionalDimensions(emotionalImpact);
    
    // Adicionar à memória emocional
    this._addToEmotionalMemory(userId, userMessage, userSentiment, emotionalImpact);
    
    // Atualizar humor atual
    this._updateCurrentMood();
    
    // Evolução lenta dos traços de personalidade
    this._evolvePersonalityTraits(emotionalImpact);
    
    // Log das mudanças
    const afterState = {
      mood: this.currentMood,
      happiness: this.emotionalDimensions.happiness,
      energy: this.emotionalDimensions.energy,
      anxiety: this.emotionalDimensions.anxiety
    };
    
    logger.debug('EmotionalStateEngine', '📈 MUDANÇAS EMOCIONAIS:', {
      before: beforeState,
      after: afterState,
      moodChanged: beforeState.mood !== afterState.mood
    });
    
    logger.debug('EmotionalStateEngine', 'Estado emocional atualizado', {
      newMood: this.currentMood,
      happiness: this.emotionalDimensions.happiness.toFixed(2),
      energy: this.emotionalDimensions.energy.toFixed(2),
      memorySize: this.emotionalMemory.length
    });
    
    return {
      mood: this.currentMood,
      emotionalState: { ...this.emotionalDimensions },
      personalitySnapshot: { ...this.personalityTraits },
      changes: {
        moodChanged: beforeState.mood !== afterState.mood,
        emotionalDeltas: {
          happiness: afterState.happiness - beforeState.happiness,
          energy: afterState.energy - beforeState.energy,
          anxiety: afterState.anxiety - beforeState.anxiety
        }
      }
    };
  }

  /**
   * Calcula o impacto emocional de uma interação
   * @private
   */
  _calculateEmotionalImpact(message, sentiment, type) {
    const impact = {
      happiness: 0,
      energy: 0,
      curiosity: 0,
      empathy: 0,
      confidence: 0,
      playfulness: 0,
      patience: 0,
      social_warmth: 0
    };

    // Impacto baseado no sentimento
    switch (sentiment) {
      case 'positivo':
        impact.happiness += 0.1;
        impact.energy += 0.05;
        impact.social_warmth += 0.08;
        impact.playfulness += 0.03;
        break;
      case 'negativo':
        impact.happiness -= 0.05;
        impact.empathy += 0.1;
        impact.patience += 0.02;
        impact.social_warmth += 0.05;
        break;
      case 'neutro':
        impact.energy -= 0.01;
        impact.curiosity += 0.02;
        break;
    }

    // Impacto baseado no conteúdo da mensagem
    const messageText = message.toLowerCase();
    
    // Perguntas aumentam curiosidade
    if (messageText.includes('?') || messageText.includes('como') || messageText.includes('por que')) {
      impact.curiosity += 0.05;
      impact.energy += 0.02;
    }
    
    // Agradecimentos aumentam felicidade
    if (messageText.includes('obrigad') || messageText.includes('valeu') || messageText.includes('thanks')) {
      impact.happiness += 0.08;
      impact.social_warmth += 0.05;
      impact.confidence += 0.03;
    }
    
    // Piadas/humor aumentam ludicidade
    if (messageText.includes('haha') || messageText.includes('😂') || messageText.includes('kkkk')) {
      impact.playfulness += 0.1;
      impact.happiness += 0.05;
    }
    
    // Problemas/frustração do usuário
    if (messageText.includes('problema') || messageText.includes('erro') || messageText.includes('não funciona')) {
      impact.empathy += 0.08;
      impact.patience += 0.05;
      impact.energy += 0.02; // Fica mais alerta para ajudar
    }

    return impact;
  }

  /**
   * Atualiza as dimensões emocionais com decaimento natural
   * @private
   */
  _updateEmotionalDimensions(impact) {
    const decayFactor = 0.98; // Decaimento natural leve
    
    for (const [dimension, value] of Object.entries(this.emotionalDimensions)) {
      // Aplicar impacto
      let newValue = value + (impact[dimension] || 0);
      
      // Aplicar decaimento em direção ao centro (0.5) para algumas dimensões
      if (['happiness', 'energy'].includes(dimension)) {
        const centerPull = (0.5 - newValue) * 0.02;
        newValue += centerPull;
      }
      
      // Aplicar decaimento geral
      newValue *= decayFactor;
      
      // Manter dentro dos limites
      this.emotionalDimensions[dimension] = Math.max(-1.0, Math.min(1.0, newValue));
    }
  }

  /**
   * Adiciona interação à memória emocional
   * @private
   */
  _addToEmotionalMemory(userId, message, sentiment, impact) {
    const memoryEntry = {
      timestamp: new Date().toISOString(),
      userId,
      messageSample: message.substring(0, 100),
      sentiment,
      emotionalImpact: impact,
      resultingMood: this._calculateMoodFromDimensions()
    };

    this.emotionalMemory.push(memoryEntry);
    
    // Manter apenas as últimas N interações
    if (this.emotionalMemory.length > this.maxEmotionalMemory) {
      this.emotionalMemory = this.emotionalMemory.slice(-this.maxEmotionalMemory);
    }
  }

  /**
   * Atualiza o humor atual baseado nas dimensões emocionais
   * @private
   */
  _updateCurrentMood() {
    this.currentMood = this._calculateMoodFromDimensions();
  }

  /**
   * Calcula humor baseado nas dimensões emocionais
   * @private
   */
  _calculateMoodFromDimensions() {
    const h = this.emotionalDimensions.happiness;
    const e = this.emotionalDimensions.energy;
    const p = this.emotionalDimensions.playfulness;
    
    if (h > 0.6 && e > 0.5 && p > 0.5) return 'cheerful';
    if (h > 0.3 && e > 0.6) return 'energetic';
    if (h > 0.4 && p > 0.4) return 'playful';
    if (h < -0.2 || e < 0.2) return 'melancholic';
    if (e > 0.7) return 'excited';
    if (this.emotionalDimensions.curiosity > 0.7) return 'curious';
    if (this.emotionalDimensions.empathy > 0.7) return 'empathetic';
    if (h < 0.3 && e < 0.4) return 'subdued';
    
    return 'balanced';
  }

  /**
   * Evolução lenta dos traços de personalidade
   * @private
   */
  _evolvePersonalityTraits(impact) {
    // Evolução muito lenta dos traços (apenas 1% do impacto emocional)
    const evolutionRate = 0.01;
    
    // A personalidade evolui baseada em padrões de longo prazo
    if (this.emotionalMemory.length >= 10) {
      const recentPositive = this.emotionalMemory.slice(-10)
        .filter(m => m.sentiment === 'positivo').length;
      
      if (recentPositive >= 7) {
        // Muitas interações positivas = mais extrovertido e humorado
        this.personalityTraits.introversion_extraversion += evolutionRate;
        this.personalityTraits.serious_humorous += evolutionRate * 0.5;
      } else if (recentPositive <= 3) {
        // Poucas interações positivas = mais introvertido e sério
        this.personalityTraits.introversion_extraversion -= evolutionRate * 0.5;
        this.personalityTraits.serious_humorous -= evolutionRate * 0.3;
      }
    }
    
    // Manter traços dentro dos limites
    for (const trait in this.personalityTraits) {
      this.personalityTraits[trait] = Math.max(0.0, Math.min(1.0, this.personalityTraits[trait]));
    }
  }

  /**
   * Salva o estado emocional atual
   */
  async saveEmotionalState(assistantId = 'default') {
    try {
      const personalityData = {
        assistant_id: assistantId,
        emotional_dimensions: this.emotionalDimensions,
        personality_traits: this.personalityTraits,
        emotional_memory: this.emotionalMemory,
        current_mood: this.currentMood,
        last_updated: new Date().toISOString()
      };

      await updateAssistantPersonality(assistantId, personalityData);
      
      logger.debug('EmotionalStateEngine', 'Estado emocional salvo com sucesso', {
        mood: this.currentMood,
        memoryEntries: this.emotionalMemory.length
      });
    } catch (error) {
      logger.error('EmotionalStateEngine', `Erro ao salvar estado emocional: ${error.message}`);
    }
  }

  /**
   * Obtém snapshot do estado atual para uso no prompt
   */
  getEmotionalSnapshot() {
    return {
      mood: this.currentMood,
      emotional_state: { ...this.emotionalDimensions },
      personality_traits: { ...this.personalityTraits },
      recent_interactions_trend: this._analyzeRecentTrend()
    };
  }

  /**
   * Analisa tendência das interações recentes
   * @private
   */
  _analyzeRecentTrend() {
    if (this.emotionalMemory.length < 3) return 'insufficient_data';
    
    const recent = this.emotionalMemory.slice(-5);
    const positiveCount = recent.filter(m => m.sentiment === 'positivo').length;
    const negativeCount = recent.filter(m => m.sentiment === 'negativo').length;
    
    if (positiveCount >= 3) return 'positive_trend';
    if (negativeCount >= 3) return 'negative_trend';
    return 'mixed_trend';
  }
}
