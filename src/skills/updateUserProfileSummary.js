
import chatAi from '../config/ai/chat.ai.js';
import { getUserProfile, updateUserProfile } from '../repository/userProfileRepository.js';

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
    const messages = [
      SUMMARY_PROMPT,
      ...conversationHistory
    ];
    const MAX_RETRIES = 3;
    let parsedSummary = {};
    let success = false;

    for (let i = 0; i < MAX_RETRIES; i++) {
      const response = await chatAi(messages, []);
      console.log(`Tentativa ${i + 1} - Conteúdo completo da resposta do chatAi para o resumo do perfil:`, response.message);
      try {
        parsedSummary = JSON.parse(response.message.content);
        success = true;
        break;
      } catch (jsonError) {
        console.error(`Tentativa ${i + 1} - Erro ao fazer parse do JSON do resumo do perfil:`, jsonError);
        console.error(`Tentativa ${i + 1} - Conteúdo recebido (para parse):`, response.message.content);
        // If it's the last retry and still failing, prepare a fallback
        if (i === MAX_RETRIES - 1) {
          parsedSummary.profile_summary = response.message.content && response.message.content.trim() !== '' ? response.message.content : userProfile?.summary || '';
        }
      }
    }

    if (!success) {
      console.warn('Todas as tentativas de obter JSON válido para o resumo do perfil falharam. Usando fallback.');
    }

    const userProfile = await getUserProfile(userId);
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
