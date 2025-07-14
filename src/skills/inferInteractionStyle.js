import chatAi from '../config/ai/chat.ai.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um analista de estilo de comunicação. Sua tarefa é analisar a mensagem do usuário e inferir seu estilo de interação em termos de formalidade, humor, tom e verbosidade. Sua resposta DEVE ser APENAS um objeto JSON.

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
}
`
};

export default async function inferInteractionStyle(userMessage) {
  try {
    const messages = [
      SYSTEM_PROMPT,
      { role: 'user', content: userMessage }
    ];
    const response = await chatAi(messages);
    const rawContent = response.message.content;
    // Extract JSON from markdown code block
    const jsonMatch = rawContent.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      const inferredStyle = JSON.parse(jsonMatch[1]);
      return inferredStyle;
    } else {
      console.error('Erro: Resposta do AI não contém JSON válido em bloco de código markdown:', rawContent);
      throw new Error('Invalid AI response format');
    }
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
