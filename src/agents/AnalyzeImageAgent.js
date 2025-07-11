import chatAi from '../config/ai/chat.ai.js';
import analyzeImage from '../skills/analyzeImage.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em análise de imagens. Sua função é, dada uma solicitação do usuário e uma imagem (base64 encoded), analisar a imagem usando a ferramenta 'analyze_image'. Você deve extrair o prompt do usuário para guiar a análise da imagem.

Você tem acesso à seguinte ferramenta:
- 'analyze_image': Para analisar uma imagem com base em um prompt.

Após analisar a imagem, você deve retornar a análise para o usuário.`
};

export async function execute(image, prompt) {
  let messages = [SYSTEM_PROMPT, { role: 'user', content: `Analise a imagem com o seguinte prompt: ${prompt}` }];
  let response = await chatAi(messages);

  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;

      if (toolCall.function.name === 'analyze_image') {
        const analysis = await analyzeImage({ image, prompt: args.prompt });
        return analysis;
      }
    }
  }
  return `Não foi possível analisar a imagem com a sua solicitação. Por favor, tente novamente com um prompt mais claro.`;
}
