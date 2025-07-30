
import chatAi from '../config/ai/chat.ai.js';
import { getUserProfile, updateUserProfile } from '../repository/userProfileRepository.js';
import { retryAiJsonCall } from '../utils/aiResponseUtils.js';
import logError from '../utils/logger.js';

// Função para sanitizar mensagens antes de enviar para a IA (cópia da função do processMessageAI.js)
function sanitizeMessagesForChat(messages) {
  const cleanMessages = [];
  const validToolCallIds = new Set();
  
  // Primeira passada: coletar todos os tool_call_ids válidos
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      
      // Verificar se todas as tool responses existem para esta mensagem assistant
      let allToolResponsesFound = true;
      const toolResponsesMap = new Map();
      
      // Procurar por todas as tool responses correspondentes
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        if (nextMsg.role === 'tool' && toolCallIds.includes(nextMsg.tool_call_id)) {
          toolResponsesMap.set(nextMsg.tool_call_id, nextMsg);
        }
      }
      
      // Verificar se encontrou resposta para todos os tool_calls
      if (toolResponsesMap.size === toolCallIds.length) {
        // Todas as tool responses existem, adicionar os IDs como válidos
        toolCallIds.forEach(id => validToolCallIds.add(id));
      }
    }
  }
  
  // Segunda passada: construir mensagens limpas
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      // Só incluir se todos os tool_calls desta mensagem são válidos
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      const allToolCallsValid = toolCallIds.every(id => validToolCallIds.has(id));
      
      if (allToolCallsValid) {
        cleanMessages.push(message);
      }
    } else if (message.role === 'assistant') {
      // Para mensagens assistant sem tool_calls, verificar se têm conteúdo válido
      if (message.content && message.content.trim().length > 0) {
        cleanMessages.push(message);
      }
    } else if (message.role === 'tool') {
      // Só incluir tool messages que correspondem a tool_calls válidos
      if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
        cleanMessages.push(message);
      }
    } else {
      // Para outras mensagens (user, system), sempre incluir
      cleanMessages.push(message);
    }
  }
  
  return cleanMessages;
}

const SUMMARY_PROMPT = {
  role: 'system',
  content: `Você é um especialista em análise de comportamento e perfil de usuário. Sua tarefa é analisar o histórico de conversa fornecido e extrair informações detalhadas sobre o usuário, incluindo sua personalidade, preferências de comunicação, marcadores linguísticos e fatos importantes.

Sua resposta DEVE ser APENAS um objeto JSON, sem nenhum texto adicional antes ou depois. O objeto JSON deve seguir o seguinte esquema:

{
  "profile_summary": "<Resumo conciso da personalidade e fatos importantes do usuário em uma frase.>",
  "preferences": {
    "tone": "<formal|casual|ludico|neutro>",
    "humor_level": "<nenhum|baixo|alto>",
    "response_format": "<paragrafo|bullet-points|conciso>",
    "language": "<pt-BR|en-US|etc.>"
  },
  "linguistic_markers": {
    "avg_sentence_length": <numero>,
    "formality_score": <0.0 a 1.0>,
    "uses_emojis": <true|false>
  },
  "key_facts": [
    { "fact": "<fato importante>", "source": "<message_id_ou_contexto>", "timestamp": "<ISO_DATE_STRING>" }
  ]
}

Instruções detalhadas:
- **profile_summary:** Uma frase concisa que resume a personalidade, preferências e fatos importantes. Ex: "Alex é um desenvolvedor de software que prefere comunicação formal e direta. Os principais tópicos de interesse incluem IA e caminhadas."
- **preferences:** Inferir o tom, nível de humor, formato de resposta preferido e idioma. Se não for possível inferir, use 'unknown'.
- **linguistic_markers:** Analisar a mensagem do usuário para inferir características como comprimento médio da frase, pontuação de formalidade (0.0 a 1.0) e uso de emojis.
- **key_facts:** Extrair fatos explícitos mencionados pelo usuário (ex: nome, planos de viagem, hobbies). Inclua a fonte (ID da mensagem ou contexto) e o timestamp.

Se não houver informações suficientes para preencher um campo, use valores padrão ou vazios (ex: [], "unknown", 0.0).
`
};

export default async function updateUserProfileSummary(userId, conversationHistory) {
  try {
    const userProfile = await getUserProfile(userId);
    
    // Função que faz a chamada de IA, recebendo o número da tentativa
    const makeAiCall = async (attemptNumber) => {
      // CRÍTICO: Sanitizar conversationHistory antes de enviar para evitar tool_calls órfãs
      const sanitizedHistory = sanitizeMessagesForChat(conversationHistory);
      
      let currentMessages = [
        SUMMARY_PROMPT,
        ...sanitizedHistory
      ];

      // Para retries, adiciona instrução específica sobre o formato JSON
      if (attemptNumber > 0) {
        currentMessages.push({
          role: 'user',
          content: 'Por favor, responda APENAS com um objeto JSON válido, sem nenhum texto adicional antes ou depois. Certifique-se de que é um JSON bem formado.'
        });
      }

      return await chatAi(currentMessages, []);
    };

    // Usar a função de retry com JSON
    const result = await retryAiJsonCall(makeAiCall, 3, 1000);
    
    let parsedSummary = {};
    
    if (result.success) {
      parsedSummary = result.data;
      // console.log('JSON parseado com sucesso:', parsedSummary);
    } else {
      console.warn('Todas as tentativas de obter JSON válido para o resumo do perfil falharam. Usando fallback.');
      // Usar o conteúdo bruto como summary se disponível
      if (result.fallback && result.fallback.trim() !== '') {
        parsedSummary.profile_summary = result.fallback;
      } else {
        parsedSummary.profile_summary = userProfile?.summary || '';
      }
    }

    const updatedProfile = {
      ...userProfile,
      summary: parsedSummary.profile_summary || userProfile?.summary || '',
      preferences: parsedSummary.preferences || userProfile?.preferences || {},
      linguistic_markers: parsedSummary.linguistic_markers || userProfile?.linguistic_markers || {},
      key_facts: parsedSummary.key_facts || userProfile?.key_facts || [],
      updatedAt: new Date(),
    };

    await updateUserProfile(userId, updatedProfile);

  } catch (error) {
    console.error('Erro ao atualizar o resumo do perfil do usuário:', error);
  }
}
