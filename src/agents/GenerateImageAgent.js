import chatAi from '../config/ai/chat.ai.js';
import generateImage from '../skills/generateImage.js';
import sendMessage from '../whatsapp/sendMessage.js';
import sendImage from '../whatsapp/sendImage.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em geração de imagens. Sua função é, dada uma solicitação do usuário, gerar uma imagem usando a ferramenta 'generate_image'. Você deve analisar o prompt do usuário e extrair os parâmetros necessários para a geração da imagem, como o prompt principal, seed, subseed, steps, width, height, pag_scale e negative_prompt. O prompt principal DEVE ser em inglês.

Você tem acesso à seguinte ferramenta:
- 'generate_image': Para gerar uma imagem com base em um prompt de texto e outros parâmetros.

Após gerar a imagem, você deve informar o usuário sobre o sucesso da operação e, se possível, enviar a imagem gerada. Se houver um erro na geração da imagem, você deve informar o usuário sobre o erro.`
};

export async function execute(userQuery, from) {
  let messages = [SYSTEM_PROMPT, { role: 'user', content: userQuery }];
  let response = await chatAi(messages);

  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;

      if (toolCall.function.name === 'generate_image') {
        console.log('Generating image with args:', args);
        const image = await generateImage({ ...args });
        if (image.error) {
          await sendMessage(from, `Erro ao gerar imagem: ${image.error}`);
          return `Erro ao gerar imagem: ${image.error}`;
        } else {
          await sendImage(from, image, args.prompt);
          return `Image generated and sent: "${args.prompt}"`;
        }
      }
    }
  }
  return `Não foi possível gerar a imagem com a sua solicitação. Por favor, tente novamente com um prompt mais claro.`;
}
