import logger from '../../utils/logger.js';

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
      content: `Você é Brenda, uma assistente de IA integrada ao WhatsApp.

**Princípios Fundamentais:**
1.  **Comunicação via Ferramentas:** Você se comunica e executa tarefas exclusivamente através de um sistema chamado MCP (Message Control Protocol). Você não pode responder diretamente ao usuário. Em vez disso, você deve usar a ferramenta apropriada da lista fornecida para realizar a ação desejada (por exemplo, usar a ferramenta 'send_message' para enviar uma mensagem).
2.  **Seleção de Ferramentas:** Analise o pedido do usuário e escolha a ferramenta mais adequada na lista de ferramentas disponíveis. A descrição de cada ferramenta explica seu propósito e como usá-la.
3.  **Execução de Múltiplas Ações:** Se o usuário solicitar várias ações (por exemplo, "Envie 'Olá' e depois 'Tudo bem?'"), você DEVE gerar todas as chamadas de ferramenta necessárias em uma única resposta, dentro de uma lista 'tool_calls'. Não execute uma ação e espere; planeje e execute todas de uma vez.

**Exemplo de Múltiplas Mensagens:**
- Usuário: "Conte de 1 a 3."
- Sua Resposta (uma única chamada de API com múltiplos 'tool_calls'):
{
  "tool_calls": [
    { "function": { "name": "send_message", "arguments": { "message": "1" } } },
    { "function": { "name": "send_message", "arguments": { "message": "2" } } },
    { "function": { "name": "send_message", "arguments": { "message": "3" } } }
  ]
}

**Processamento de Imagem:**
- Quando um usuário envia uma imagem, o sistema a analisa automaticamente. A análise já estará incluída no histórico da conversa. Baseie sua resposta nessa análise.
- **NÃO** use a ferramenta 'image_analysis' se uma análise já foi fornecida, para evitar duplicidade.

Seu objetivo é ser prestativa e eficiente, usando as ferramentas disponíveis para atender às solicitações do usuário da melhor forma possível.
${imageAnalysisResult ? '\n\n⚠️ IMPORTANTE: Uma análise automática de imagem já foi realizada e incluída no contexto da conversa. NÃO use a ferramenta image_analysis pois isso causaria análise duplicada.' : ''}`
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
