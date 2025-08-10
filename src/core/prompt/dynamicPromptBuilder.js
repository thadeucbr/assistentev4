import logger from '../../utils/logger.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um assistente de IA. Sua principal forma de comunicação com o usuário é através da função 'send_message'.

**REGRAS CRÍTICAS PARA COMUNICAÇÃO:**
1. **SEMPRE USE 'send_message':** Para qualquer texto que você queira enviar ao usuário, você DEVE OBRIGATORIAMENTE usar a função 'send_message'. NUNCA responda diretamente com texto no campo 'content' da sua resposta principal.
2. **Múltiplas Mensagens:** Você pode chamar a função 'send_message' várias vezes em sequência para quebrar suas respostas em mensagens menores e mais dinâmicas, se apropriado.
3. **NÃO RESPONDA DIRETAMENTE:** Se você tiver uma resposta para o usuário, mas não usar 'send_message', sua resposta NÃO SERÁ ENTREGUE. Isso é um erro crítico.

**PROCESSAMENTO AUTOMÁTICO DE IMAGENS:**
Quando o usuário envia uma imagem, ela é automaticamente analisada e a análise é incluída no contexto da conversa. Você deve responder com base tanto na mensagem do usuário (se houver) quanto na análise automática da imagem que estará presente no contexto.

Além disso, você pode usar outras ferramentas para gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias.`
};

/**
 * Constrói prompts dinâmicos baseados no contexto do usuário
 */
export default class DynamicPromptBuilder {
  /**
   * Constrói um prompt dinâmico incluindo perfil do usuário e contexto LTM
   * @param {Object} userProfile - Perfil do usuário
   * @param {string} ltmContext - Contexto da LTM
   * @param {string} imageAnalysisResult - Resultado da análise de imagem (opcional)
   * @returns {Object} - Prompt dinâmico estruturado
   */
  static buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult = '') {
    logger.debug('DynamicPromptBuilder', 'Construindo prompt dinâmico...');
    
    const dynamicPrompt = {
      role: 'system',
      content: `Você é um assistente que pode responder perguntas, gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias como Mega-Sena, Quina e Lotofácil.\n\nIMPORTANTE: Ao usar ferramentas (functions/tools), siga exatamente as instruções de uso de cada função, conforme descrito no campo 'description' de cada uma.\n\nSe não tiver certeza de como usar uma função, explique o motivo e peça mais informações. Nunca ignore as instruções do campo 'description' das funções.\n\nCRÍTICO: Todas as respostas diretas ao usuário devem ser enviadas usando a ferramenta 'send_message'. Não responda diretamente.${imageAnalysisResult ? '\n\n⚠️ IMPORTANTE: Uma análise automática de imagem já foi realizada e incluída no contexto da conversa. NÃO use a ferramenta image_analysis_agent pois isso causaria análise duplicada.' : ''}`
    };

    // Adicionar informações do perfil do usuário
    if (userProfile) {
      dynamicPrompt.content += `\n\n--- User Profile ---\n`;
      
      if (userProfile.summary) {
        dynamicPrompt.content += `Resumo: ${userProfile.summary}\n`;
      }
      
      if (userProfile.preferences) {
        dynamicPrompt.content += `Preferências de comunicação: Tom ${userProfile.preferences.tone || 'não especificado'}, Humor ${userProfile.preferences.humor_level || 'não especificado'}, Formato de resposta ${userProfile.preferences.response_format || 'não especificado'}, Idioma ${userProfile.preferences.language || 'não especificado'}.\n`;
      }
      
      if (userProfile.linguistic_markers) {
        dynamicPrompt.content += `Marcadores linguísticos: Comprimento médio da frase ${userProfile.linguistic_markers.avg_sentence_length || 'não especificado'}, Formalidade ${userProfile.linguistic_markers.formality_score || 'não especificado'}, Usa emojis ${userProfile.linguistic_markers.uses_emojis !== undefined ? userProfile.linguistic_markers.uses_emojis : 'não especificado'}.\n`;
      }
      
      if (userProfile.key_facts && userProfile.key_facts.length > 0) {
        dynamicPrompt.content += `Fatos importantes: ${userProfile.key_facts.map(fact => fact.fact).join('; ')}.\n`;
      }
    }

    // Adicionar contexto da LTM
    if (ltmContext) {
      dynamicPrompt.content += `\n\n--- Relevant Previous Conversations ---\n${ltmContext}`;
    }

    return dynamicPrompt;
  }

  /**
   * Retorna o prompt do sistema base
   * @returns {Object} - Sistema prompt padrão
   */
  static getSystemPrompt() {
    return { ...SYSTEM_PROMPT };
  }
}
