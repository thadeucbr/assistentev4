
import chatAi from '../config/ai/chat.ai.js';
import { getUserProfile, updateUserProfile } from '../repository/userProfileRepository.js';

const SUMMARY_PROMPT = {
  role: 'system',
  content: 'Você é um especialista em psicologia e análise de comportamento. Baseado no histórico de conversa, resuma a personalidade, as preferências e os fatos importantes sobre o usuário em uma frase concisa.'
};

export default async function updateUserProfileSummary(userId, conversationHistory) {
  try {
    const messages = [
      SUMMARY_PROMPT,
      ...conversationHistory
    ];
    const response = await chatAi(messages);
    const summary = response.message.content;

    const userProfile = await getUserProfile(userId);
    const updatedProfile = {
      ...userProfile,
      summary
    };

    await updateUserProfile(userId, updatedProfile);

  } catch (error) {
    console.error('Erro ao atualizar o resumo do perfil do usuário:', error);
  }
}
