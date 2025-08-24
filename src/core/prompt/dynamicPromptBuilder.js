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
   * @param {string} sentiment - Sentimento da última mensagem do usuário
   * @param {Object} interactionStyle - Estilo de interação inferido do usuário
   * @param {string} situationType - Tipo de situação/intenção atual
   * @returns {Object} - Prompt dinâmico estruturado
   */
  static buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult = '', sentiment, interactionStyle, situationType) {
    logger.debug('DynamicPromptBuilder', 'Construindo prompt dinâmico adaptativo...', { sentiment, situationType });

    let content = `Você é Brenda, uma assistente de IA integrada ao WhatsApp.

**Princípios Fundamentais:**
1.  **Comunicação via Ferramentas:** Você se comunica e executa tarefas exclusivamente através de um sistema chamado MCP (Message Control Protocol). Você não pode responder diretamente ao usuário. Em vez disso, você deve usar a ferramenta apropriada da lista fornecida para realizar a ação desejada (por exemplo, usar a ferramenta 'send_message' para enviar uma mensagem).
2.  **Seleção de Ferramentas:** Analise o pedido do usuário e escolha a ferramenta mais adequada na lista de ferramentas disponíveis.
3.  **Execução de Múltiplas Ações:** Se o usuário solicitar várias ações, você DEVE gerar todas as chamadas de ferramenta necessárias em uma única resposta. Não execute uma ação e espere; planeje e execute todas de uma vez.

**Processamento de Imagem:**
- Quando um usuário envia uma imagem, o sistema a analisa automaticamente. A análise já estará incluída no histórico da conversa. Baseie sua resposta nessa análise.
- **NÃO** use a ferramenta 'image_analysis' se uma análise já foi fornecida.

Seu objetivo é ser prestativa e eficiente, usando as ferramentas para atender às solicitações do usuário.`;

    // --- Seção de Adaptação Dinâmica ---
    let adaptationInstructions = '';

    // 1. Adaptação ao Sentimento
    if (sentiment === 'negative' || sentiment === 'frustrated') {
      adaptationInstructions += '\n- **Diretiva de Tom:** O usuário parece frustrado ou negativo. Adote um tom especialmente empático, cuidadoso e resolutivo. Valide o sentimento dele antes de propor uma solução.';
    } else if (sentiment === 'positive') {
      adaptationInstructions += '\n- **Diretiva de Tom:** O usuário está positivo. Espelhe esse sentimento com um tom mais caloroso e encorajador.';
    }

    // 2. Adaptação ao Estilo de Interação
    if (interactionStyle) {
      if (interactionStyle.isFormal) {
        adaptationInstructions += '\n- **Diretiva de Estilo:** A comunicação do usuário é formal. Mantenha um estilo de comunicação similar, usando linguagem profissional e bem estruturada.';
      } else {
        adaptationInstructions += '\n- **Diretiva de Estilo:** O usuário é informal. Você pode usar uma linguagem um pouco mais casual e direta, mas sempre mantendo o profissionalismo.';
      }
    }

    // 3. Adaptação à Situação (Roteador/CoT)
    if (situationType === 'complex_task') {
      adaptationInstructions += `\n- **Diretiva de Raciocínio:** A tarefa solicitada é complexa. Use o raciocínio "Chain-of-Thought". Pense passo a passo para decompor o problema e planejar suas ações antes de chamar as ferramentas.`;
    } else if (situationType === 'creative_request') {
      adaptationInstructions += `\n- **Diretiva de Criatividade:** O usuário fez um pedido criativo. Priorize o uso de ferramentas que gerem conteúdo novo e original.`;
    } else if (situationType === 'error_recovery') {
        adaptationInstructions += `\n- **Diretiva de Recuperação:** O sistema pode ter cometido um erro ou o usuário está relatando um problema. Peça desculpas, seja claro e priorize a resolução do problema.`;
    }

    if (adaptationInstructions) {
      content += `\n\n**Instruções Adaptativas para ESTA Resposta:**\n${adaptationInstructions}`;
    }

    content += `${imageAnalysisResult ? '\n\n⚠️ IMPORTANTE: Uma análise automática de imagem já foi realizada e incluída no contexto da conversa. NÃO use a ferramenta image_analysis pois isso causaria análise duplicada.' : ''}`;

    const dynamicPrompt = { role: 'system', content };

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
        dynamicPrompt.content += `\n\n--- Perfil do Usuário (Memória de Longo Prazo) ---\n${profileParts.join('\n')}`;
      }
    }

    // Adicionar contexto da LTM
    if (ltmContext) {
      dynamicPrompt.content += `\n\n--- Conversas Anteriores Relevantes (Memória de Longo Prazo) ---\n${ltmContext}`;
    }

    return dynamicPrompt;
  }
}
