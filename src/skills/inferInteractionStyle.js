import chatAi from '../config/ai/chat.ai.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um analista de estilo de comunicação. Sua tarefa é analisar a mensagem do usuário e inferir seu estilo de interação em termos de formalidade, humor, tom e verbosidade. Responda APENAS com um objeto JSON contendo essas inferências.

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
  try {
    const messages = [
      SYSTEM_PROMPT,
      { role: 'user', content: userMessage }
    ];
    const response = await chatAi(messages);
    const inferredStyle = JSON.parse(response.message.content);
    return inferredStyle;
  } catch (error) {
    console.error('Erro ao inferir estilo de interação:', error);
    return {
      formality: 'unknown',
      humor: 'unknown',
      tone: 'unknown',
      verbosity: 'unknown'
    };
  }
}
