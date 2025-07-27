import chatAi from '../config/ai/chat.ai.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um analista de estilo de comunicação. Sua tarefa é analisar a mensagem do usuário e inferir seu estilo de interação em termos de formalidade, humor, tom e verbosidade. Sua resposta DEVE ser APENAS um objeto JSON, sem nenhum texto adicional.

Exemplos de formalidade: 'formal', 'informal', 'neutro'.
Exemplos de humor: 'sarcastic', 'funny', 'direct', 'none'.
Exemplos de tom: 'friendly', 'neutral', 'demanding', 'curious'.
Exemplos de verbosidade: 'concise', 'detailed'.

Se não conseguir inferir uma característica, use 'unknown'.

Exemplo de resposta JSON:
{
  "formality": "informal",
  "humor": "sarcastic",
  "tone": "friendly",
  "verbosity": "concise"
}`
};

export default async function inferInteractionStyle(userMessage) {
  const MAX_RETRIES = 3;
  let inferredStyle = {
    formality: 'unknown',
    humor: 'unknown',
    tone: 'unknown',
    verbosity: 'unknown',
  };

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const messages = [
        SYSTEM_PROMPT,
        { role: 'user', content: userMessage }
      ];
      const response = await chatAi(messages, []);
      const rawContent = response.message.content;
      inferredStyle = JSON.parse(rawContent);
      return inferredStyle; // Return immediately on success
    } catch (error) {
      console.error(`Tentativa ${i + 1} - Erro ao inferir estilo de interação:`, error);
      // If it's the last retry, log the content that caused the error
      if (i === MAX_RETRIES - 1) {
        console.error(`Última tentativa falhou. Conteúdo recebido:`, response?.message?.content);
      }
    }
  }
  console.warn('Todas as tentativas de inferir estilo de interação falharam. Usando estilo padrão.');
  return inferredStyle; // Return default/last inferred style after all retries
}
