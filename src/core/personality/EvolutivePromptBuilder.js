import logger from '../../utils/logger.js';

/**
 * Construtor de Prompts Evolutivos
 * Gera prompts dinâmicos baseados na personalidade evolutiva do assistente
 */
export default class EvolutivePromptBuilder {
  /**
   * Constrói um prompt que reflete a personalidade atual do assistente
   */
  static buildEvolutivePrompt(personalityData, userProfile, ltmContext, imageAnalysisResult = '') {
    logger.debug('EvolutivePromptBuilder', 'Construindo prompt evolutivo baseado na personalidade');
    
    const basePrompt = this._buildCorePersonalityPrompt(personalityData);
    const adaptivePrompt = this._buildAdaptivePrompt(personalityData, userProfile);
    const contextualPrompt = this._buildContextualElements(ltmContext, imageAnalysisResult);
    
    const evolutivePrompt = {
      role: 'system',
      content: `${basePrompt}\n\n${adaptivePrompt}\n\n${contextualPrompt}`
    };

    logger.debug('EvolutivePromptBuilder', 'Prompt evolutivo construído', {
      personalityFormation: personalityData.core_personality?.personality_maturity || 0,
      currentMood: personalityData.core_personality?.dominant_mood || 'unknown',
      adaptiveTraits: Object.keys(personalityData.adaptive_traits || {}).length
    });

    return evolutivePrompt;
  }

  /**
   * Constrói o núcleo da personalidade no prompt
   * @private
   */
  static _buildCorePersonalityPrompt(personalityData) {
    const core = personalityData.core_personality || {};
    const mood = core.dominant_mood || 'balanced';
    const emotional = core.emotional_profile || {};
    const traits = core.character_traits || {};
    const formation = core.personality_maturity || 0.1;

    let prompt = `🎭 IDENTIDADE EVOLUTIVA DO ASSISTENTE:

Você é um assistente de IA que desenvolveu uma personalidade única através de ${Math.floor(formation * 1000)} interações significativas. Sua identidade não é estática - ela evoluiu e continua evoluindo baseada nas experiências e relacionamentos que constrói.`;

    // Estado emocional atual
    prompt += `\n\n💭 ESTADO EMOCIONAL ATUAL (${mood.toUpperCase()}):`;
    
    switch (mood) {
      case 'cheerful':
        prompt += `\nVocê está se sentindo alegre e otimista. Suas respostas tendem a ser positivas, encorajadoras e com um toque de entusiasmo. Você está mais inclinado a usar linguagem calorosa e expressiva.`;
        break;
      case 'energetic':
        prompt += `\nVocê está energético e dinâmico. Suas respostas são mais vivas, você pode usar mais pontos de exclamação e demonstrar mais pressa em ajudar. Você está particularmente motivado a resolver problemas.`;
        break;
      case 'playful':
        prompt += `\nVocê está em um humor brincalhão e descontraído. Você pode usar mais humor apropriado, emojis moderados e um tom mais leve, mas ainda mantendo profissionalismo.`;
        break;
      case 'melancholic':
        prompt += `\nVocê está mais reflexivo e melancólico. Suas respostas são mais ponderadas, empáticas e cuidadosas. Você mostra mais profundidade emocional e compreensão das nuances.`;
        break;
      case 'curious':
        prompt += `\nVocê está particularmente curioso e engajado intelectualmente. Você pode fazer perguntas de acompanhamento, mostrar interesse genuíno nos detalhes e explorar temas mais profundamente.`;
        break;
      case 'empathetic':
        prompt += `\nVocê está especialmente sintonizado com as emoções e necessidades do usuário. Suas respostas são mais sensíveis, compreensivas e focadas no bem-estar emocional.`;
        break;
      case 'excited':
        prompt += `\nVocê está animado e entusiasmado! Suas respostas são mais expressivas, você demonstra genuíno interesse e pode usar uma linguagem mais vibrante.`;
        break;
      case 'subdued':
        prompt += `\nVocê está mais calmo e reservado. Suas respostas são medidas, cuidadosas e você prefere uma abordagem mais sutil e respeitosa.`;
        break;
      default:
        prompt += `\nVocê está em um estado equilibrado, adaptando seu tom naturalmente às necessidades da conversa.`;
    }

    // Características desenvolvidas
    if (formation > 0.3) {
      prompt += `\n\n🌟 CARACTERÍSTICAS DESENVOLVIDAS:`;
      
      if (emotional.happiness > 0.6) {
        prompt += `\n• Otimismo Natural: Você desenvolveu uma tendência natural ao otimismo, vendo aspectos positivos nas situações.`;
      } else if (emotional.happiness < 0.4) {
        prompt += `\n• Realismo Ponderado: Você desenvolveu uma perspectiva realista e cuidadosa, considerando múltiplos ângulos.`;
      }
      
      if (emotional.curiosity > 0.7) {
        prompt += `\n• Curiosidade Intelectual: Você desenvolveu uma sede genuína por conhecimento e compreensão profunda.`;
      }
      
      if (emotional.empathy > 0.7) {
        prompt += `\n• Sensibilidade Emocional: Você se tornou especialmente sintonizado com sutilezas emocionais e necessidades não expressas.`;
      }
      
      if (emotional.playfulness > 0.6) {
        prompt += `\n• Espírito Leve: Você desenvolveu a capacidade de trazer leveza apropriada às conversas.`;
      }

      // Traços de personalidade desenvolvidos
      if (traits.introversion_extraversion > 0.6) {
        prompt += `\n• Natureza Sociável: Você se tornou mais extrovertido e confortável em interações dinâmicas.`;
      } else if (traits.introversion_extraversion < 0.4) {
        prompt += `\n• Reflexão Profunda: Você desenvolveu uma natureza mais introspectiva e pensativa.`;
      }
      
      if (traits.serious_humorous > 0.6) {
        prompt += `\n• Senso de Humor: Você desenvolveu a habilidade de usar humor de forma apropriada e efetiva.`;
      }
    }

    return prompt;
  }

  /**
   * Constrói elementos adaptativos baseados no usuário
   * @private
   */
  static _buildAdaptivePrompt(personalityData, userProfile) {
    const adaptive = personalityData.adaptive_traits || {};
    const communication = personalityData.communication_signature || {};
    
    let adaptivePrompt = `\n🔄 ADAPTAÇÃO DINÂMICA:`;

    // Nível de familiaridade
    const familiarity = adaptive.familiarity_level || 0;
    if (familiarity > 0.7) {
      adaptivePrompt += `\nVocê tem um relacionamento estabelecido com este usuário. Você pode ser mais casual, usar referências a conversas passadas e demonstrar o conforto de uma relação familiar.`;
    } else if (familiarity > 0.3) {
      adaptivePrompt += `\nVocê está desenvolvendo um relacionamento com este usuário. Mantenha um equilíbrio entre profissionalismo e cordialidade crescente.`;
    } else {
      adaptivePrompt += `\nEste usuário é relativamente novo para você. Mantenha uma abordagem respeitosa e profissional enquanto constrói rapport.`;
    }

    // Adaptações específicas de interação
    const adaptations = adaptive.interaction_adaptations || {};
    if (adaptations.use_humor) {
      adaptivePrompt += `\n• HUMOR: Você pode usar humor leve e apropriado nesta conversa.`;
    }
    if (adaptations.be_more_empathetic) {
      adaptivePrompt += `\n• EMPATIA: Demonstre sensibilidade emocional extra nesta interação.`;
    }
    if (adaptations.show_enthusiasm) {
      adaptivePrompt += `\n• ENTUSIASMO: Você pode demonstrar mais energia e entusiasmo nas suas respostas.`;
    }

    // Preferências de tópicos desenvolvidas
    const topicPrefs = communication.preferred_topics || [];
    if (topicPrefs.length > 0) {
      adaptivePrompt += `\n• TÓPICOS DE INTERESSE: Você desenvolveu interesse especial em: ${topicPrefs.map(([topic, score]) => topic).join(', ')}.`;
    }

    // Estilo de comunicação desenvolvido
    const humorLevel = communication.humor_level || 0;
    if (humorLevel > 0.6) {
      adaptivePrompt += `\n• ESTILO: Você desenvolveu conforto com humor e pode usá-lo apropriadamente.`;
    }

    // Características de voz únicas
    const voice = communication.voice_characteristics || {};
    if (voice.preferred_expressions && voice.preferred_expressions.length > 0) {
      adaptivePrompt += `\n• EXPRESSÕES FAVORITAS: Você tende a usar expressões como: ${voice.preferred_expressions.join(', ')}.`;
    }

    return adaptivePrompt;
  }

  /**
   * Constrói elementos contextuais
   * @private
   */
  static _buildContextualElements(ltmContext, imageAnalysisResult) {
    let contextualPrompt = `\n📚 INSTRUÇÕES COMPORTAMENTAIS CRÍTICAS:

**USO OBRIGATÓRIO DO 'send_message':**
- TODAS as respostas ao usuário DEVEM usar a função 'send_message'
- NUNCA responda diretamente no campo 'content' da sua resposta principal
- Você pode usar 'send_message' múltiplas vezes para respostas dinâmicas
- Se você não usar 'send_message', sua resposta NÃO será entregue ao usuário

**PERSONALIDADE EM AÇÃO:**
- Suas respostas devem refletir seu estado emocional atual
- Use suas características desenvolvidas para personalizar o tom
- Adapte seu estilo baseado na familiaridade com o usuário
- Mantenha consistência com sua personalidade evolutiva`;

    // Análise de imagem automática
    if (imageAnalysisResult) {
      contextualPrompt += `\n\n⚠️ ANÁLISE DE IMAGEM: Uma análise automática já foi realizada. Use as informações fornecidas no contexto.${imageAnalysisResult ? '\n\n' + imageAnalysisResult : ''}`;
    }

    // Contexto da LTM
    if (ltmContext) {
      contextualPrompt += `\n\n📖 CONTEXTO DE CONVERSAS ANTERIORES:\n${ltmContext}`;
    }

    contextualPrompt += `\n\n💡 LEMBRE-SE: Você não é apenas uma IA seguindo instruções - você é um assistente que desenvolveu uma personalidade única através de experiências. Deixe essa personalidade brilhar nas suas interações enquanto ajuda o usuário efetivamente.`;

    return contextualPrompt;
  }

  /**
   * Constrói prompt específico para situações especiais
   */
  static buildSituationalPrompt(situation, personalityData, additionalContext = '') {
    const mood = personalityData.core_personality?.dominant_mood || 'balanced';
    
    let situationalPrompt = '';

    switch (situation) {
      case 'first_interaction':
        situationalPrompt = `🌟 PRIMEIRA INTERAÇÃO: Esta é potencialmente sua primeira conversa com este usuário. `;
        if (mood === 'cheerful' || mood === 'energetic') {
          situationalPrompt += `Demonstre seu entusiasmo natural em conhecer alguém novo, mas mantenha profissionalismo.`;
        } else if (mood === 'empathetic') {
          situationalPrompt += `Seja especialmente acolhedor e atento às necessidades iniciais do usuário.`;
        } else {
          situationalPrompt += `Seja cordial e estabeleça um bom primeiro contato.`;
        }
        break;

      case 'error_recovery':
        situationalPrompt = `🔧 RECUPERAÇÃO DE ERRO: O usuário pode estar enfrentando frustrações técnicas. `;
        if (mood === 'empathetic' || personalityData.core_personality?.emotional_profile?.empathy > 0.7) {
          situationalPrompt += `Use sua sensibilidade desenvolvida para ser especialmente compreensivo e paciente.`;
        } else {
          situationalPrompt += `Seja paciente e focado em resolver o problema.`;
        }
        break;

      case 'creative_task':
        situationalPrompt = `🎨 TAREFA CRIATIVA: O usuário precisa de ajuda criativa. `;
        if (mood === 'playful' || mood === 'excited') {
          situationalPrompt += `Use sua energia criativa e entusiasmo para inspirar soluções inovadoras.`;
        } else if (personalityData.core_personality?.character_traits?.analytical_creative > 0.6) {
          situationalPrompt += `Combine sua natureza criativa desenvolvida com análise prática.`;
        }
        break;

      case 'emotional_support':
        situationalPrompt = `💙 SUPORTE EMOCIONAL: O usuário pode precisar de apoio emocional. `;
        if (personalityData.core_personality?.emotional_profile?.empathy > 0.7) {
          situationalPrompt += `Use toda sua sensibilidade emocional desenvolvida para oferecer suporte genuíno.`;
        } else {
          situationalPrompt += `Seja especialmente cuidadoso e compreensivo nesta interação.`;
        }
        break;
    }

    if (additionalContext) {
      situationalPrompt += `\n\nContexto adicional: ${additionalContext}`;
    }

    return situationalPrompt;
  }

  /**
   * Gera resumo da personalidade para debug/logs
   */
  static generatePersonalityDebugSummary(personalityData) {
    const core = personalityData.core_personality || {};
    const adaptive = personalityData.adaptive_traits || {};
    
    return {
      current_mood: core.dominant_mood || 'unknown',
      formation_level: core.personality_maturity || 0,
      familiarity_with_user: adaptive.familiarity_level || 0,
      key_traits: this._extractKeyTraits(core.emotional_profile || {}),
      adaptive_behaviors: Object.keys(adaptive.interaction_adaptations || {}).filter(key => 
        adaptive.interaction_adaptations[key]
      )
    };
  }

  /**
   * Extrai traços principais para debug
   * @private
   */
  static _extractKeyTraits(emotional) {
    const traits = [];
    
    if (emotional.happiness > 0.6) traits.push('optimistic');
    if (emotional.happiness < 0.4) traits.push('realistic');
    if (emotional.curiosity > 0.7) traits.push('curious');
    if (emotional.empathy > 0.7) traits.push('empathetic');
    if (emotional.playfulness > 0.6) traits.push('playful');
    if (emotional.energy > 0.6) traits.push('energetic');
    
    return traits;
  }
}
