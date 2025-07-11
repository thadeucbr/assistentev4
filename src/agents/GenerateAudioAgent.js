import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';

const GENERATE_AUDIO_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_audio',
      description: 'Gera um áudio a partir de um texto.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'O texto que será transformado em áudio.' }
        },
        required: ['text']
      }
    }
  }
];
import generateAudio from '../skills/generateAudio.js';
import sendPtt from '../whatsapp/sendPtt.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em geração de áudio. Sua função é, dada uma solicitação do usuário, primeiro criar uma história curta e interessante (com no máximo 100 palavras) baseada na solicitação do usuário. Em seguida, você DEVE usar a ferramenta 'generate_audio' para transformar essa história em áudio e enviá-lo ao usuário. O parâmetro 'text' da ferramenta 'generate_audio' DEVE ser a história que você criou, e não a solicitação original do usuário. Se houver um erro na geração do áudio, você deve informar o usuário sobre o erro.`
};

export async function execute(userQuery, from, id) {
  let messages = [SYSTEM_PROMPT, { role: 'user', content: userQuery }];
  let response = await chatAi(messages, GENERATE_AUDIO_AGENT_TOOLS);

  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;

      if (toolCall.function.name === 'audio_generation_agent') {
        console.log('Generating audio with args:', args);
        const audioResult = await generateAudio(args.query);
        if (audioResult.success) {
          await sendPtt(from, audioResult.audioBuffer, id);
          return `Áudio gerado e enviado: "${args.text}"`;
        } else {
          return `Erro ao gerar áudio: ${audioResult.error}`;
        }
      }
    }
  }
  return `Não foi possível gerar o áudio com a sua solicitação. Por favor, tente novamente com um prompt mais claro.`;
}