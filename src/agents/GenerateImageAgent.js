import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';

const GENERATE_IMAGE_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image using the Stable Diffusion API based on a text prompt. The default output size is 512x512 pixels. The prompt MUST be in English.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Text prompt for image generation. Must be in English.' },
          seed: { type: 'number', description: 'Seed for reproducibility. Use -1 for a random seed.' },
          subseed: { type: 'number', description: 'Subseed for additional variation. Use -1 to disable.' },
          subseed_strength: { type: 'number', description: 'Strength of subseed effect (0 to 1).' },
          steps: { type: 'integer', description: 'Diffusion steps. Higher improves quality but increases time.' },
          width: { type: 'integer', default: 512, description: 'Output width in pixels. Minimum 512.' },
          height: { type: 'integer', default: 512, description: 'Output height in pixels. Minimum 512.' },
          pag_scale: { type: 'number', default: 7.5, description: 'Attention guidance scale. Default 7.5.' },
          negative_prompt: { type: 'string', description: 'Negative prompt to exclude unwanted elements.' }
        },
        required: ['prompt']
      }
    }
  }
];
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
  let response = await chatAi(messages, GENERATE_IMAGE_AGENT_TOOLS);

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
