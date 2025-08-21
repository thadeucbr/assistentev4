import logger from '../../utils/logger.js';
import { persona } from '../../config/persona.js';

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
    
    // Monta o conteúdo base do prompt a partir do módulo de persona
    let baseContent = [
      persona.core,
      persona.rules,
      persona.examples,
    ].join('\n\n---\n\n');

    // Adiciona o aviso sobre a análise de imagem, se aplicável
    const imageWarning = imageAnalysisResult
      ? '\n\n⚠️ IMPORTANTE: Uma análise automática de imagem já foi realizada e incluída no contexto da conversa. NÃO use a ferramenta image_analysis pois isso causaria análise duplicada.'
      : '';

    const dynamicPrompt = {
      role: 'system',
      content: `${baseContent}${imageWarning}`
    };

    // Adicionar informações do perfil do usuário de forma concisa
    if (userProfile) {
      const profileParts = [];
      
      if (userProfile.summary) {
        profileParts.push(`Resumo: ${userProfile.summary}`);
      }
      
      if (userProfile.preferences) {
        const prefs = [];
        if (userProfile.preferences.tone) prefs.push(`Tom: ${userProfile.preferences.tone}`);
        if (userProfile.preferences.humor_level) prefs.push(`Humor: ${userProfile.preferences.humor_level}`);
        if (userProfile.preferences.language) prefs.push(`Idioma: ${userProfile.preferences.language}`);
        if (prefs.length > 0) {
          profileParts.push(`Preferências: ${prefs.join(', ')}`);
        }
      }
      
      if (userProfile.key_facts && userProfile.key_facts.length > 0) {
        profileParts.push(`Fatos importantes: ${userProfile.key_facts.map(fact => fact.fact).join('; ')}`);
      }
      
      if (profileParts.length > 0) {
        dynamicPrompt.content += `\n\n--- Perfil do Usuário ---\n${profileParts.join('\n')}`;
      }
    }

    // Adicionar contexto da LTM
    if (ltmContext) {
      dynamicPrompt.content += `\n\n--- Conversas Anteriores Relevantes ---\n${ltmContext}`;
    }

    return dynamicPrompt;
  }
}
