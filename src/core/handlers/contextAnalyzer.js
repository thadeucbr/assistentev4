import logger from '../../utils/logger.js';

/**
 * Analisador dedicado à determinação de contexto e situações
 */
class ContextAnalyzer {
  
  /**
   * Determina o tipo de situação para personalização contextual
   */
  static determineSituationType(messages, userContent) {
    logger.debug('ContextAnalyzer', 'Determinando tipo de situação', {
      messagesCount: messages.length,
      contentLength: userContent.length
    });

    // Primeira interação
    if (messages.length === 0) {
      logger.debug('ContextAnalyzer', 'Situação: primeira interação');
      return 'first_interaction';
    }

    // Tarefa criativa
    const creativeKeywords = ['criar', 'gerar', 'desenhar', 'imagem', 'arte', 'criativo', 'inventar'];
    if (creativeKeywords.some(keyword => userContent.toLowerCase().includes(keyword))) {
      logger.debug('ContextAnalyzer', 'Situação: tarefa criativa');
      return 'creative_task';
    }

    // Suporte emocional
    const emotionalKeywords = ['triste', 'feliz', 'ansioso', 'preocupado', 'deprimido', 'estressado', 'ajuda', 'como você se sente'];
    if (emotionalKeywords.some(keyword => userContent.toLowerCase().includes(keyword))) {
      logger.debug('ContextAnalyzer', 'Situação: suporte emocional');
      return 'emotional_support';
    }

    // Recuperação de erro
    const errorKeywords = ['erro', 'problema', 'não funciona', 'bug', 'falha', 'ajuda urgente'];
    if (errorKeywords.some(keyword => userContent.toLowerCase().includes(keyword))) {
      logger.debug('ContextAnalyzer', 'Situação: recuperação de erro');
      return 'error_recovery';
    }

    logger.debug('ContextAnalyzer', 'Situação: normal');
    return null; // Situação normal
  }

  /**
   * Analisa o sentimento geral da conversa
   */
  static analyzeContinuousSentiment(messages) {
    if (!messages || messages.length === 0) {
      return 'neutral';
    }

    const recentMessages = messages.slice(-5);
    const positiveWords = ['obrigado', 'legal', 'ótimo', 'perfeito', 'adorei', 'excelente'];
    const negativeWords = ['problema', 'erro', 'ruim', 'péssimo', 'odeio', 'irritado'];

    let positiveScore = 0;
    let negativeScore = 0;

    recentMessages.forEach(msg => {
      if (msg.role === 'user' && msg.content) {
        const content = msg.content.toLowerCase();
        positiveWords.forEach(word => {
          if (content.includes(word)) positiveScore++;
        });
        negativeWords.forEach(word => {
          if (content.includes(word)) negativeScore++;
        });
      }
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Identifica padrões de comunicação do usuário
   */
  static identifyUserCommunicationPatterns(messages) {
    if (!messages || messages.length < 3) {
      return { isVerbose: false, isDirective: false, isCasual: true };
    }

    const userMessages = messages.filter(msg => msg.role === 'user');
    
    // Calcular verbosidade média
    const avgMessageLength = userMessages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / userMessages.length;
    const isVerbose = avgMessageLength > 100;

    // Detectar linguagem diretiva
    const directivePatterns = ['faça', 'crie', 'gere', 'mostre', 'explique'];
    const directiveCount = userMessages.filter(msg => 
      directivePatterns.some(pattern => msg.content?.toLowerCase().includes(pattern))
    ).length;
    const isDirective = directiveCount > userMessages.length * 0.3;

    // Detectar informalidade
    const casualPatterns = ['oi', 'olá', 'beleza', 'valeu', 'show'];
    const casualCount = userMessages.filter(msg => 
      casualPatterns.some(pattern => msg.content?.toLowerCase().includes(pattern))
    ).length;
    const isCasual = casualCount > 0;

    return {
      isVerbose,
      isDirective,
      isCasual,
      avgMessageLength
    };
  }
}

export default ContextAnalyzer;
