import chatAi from '../config/ai/chat.ai.js';
import generateAudio from '../skills/generateAudio.js';
import sendPtt from '../whatsapp/sendPtt.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em geração de áudio. Sua função é, dada uma solicitação do usuário, gerar um áudio a partir de um texto usando a ferramenta 'generate_audio' e enviá-lo ao usuário. Você deve analisar o prompt do usuário e extrair o texto que será transformado em áudio.

Você tem acesso à seguinte ferramenta:
- 'generate_audio': Para gerar um áudio a partir de um texto.

Após gerar o áudio, você deve informar o usuário sobre o sucesso da operação e enviar o áudio gerado. Se houver um erro na geração do áudio, você deve informar o usuário sobre o erro.`
};

export async function execute(userQuery, from, id) {
  let messages = [SYSTEM_PROMPT, { role: 'user', content: userQuery }];
  let response = await chatAi(messages);

  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;

      if (toolCall.function.name === 'generate_audio') {
        console.log('Generating audio with args:', args);
        const audioResult = await generateAudio(args.text);
        if (audioResult.success) {
          await sendPtt(from, audioResult.audioBuffer, id);
          return `Áudio gerado e enviado: "${args.query}"`;
        } else {
          return `Erro ao gerar áudio: ${audioResult.error}`;
      }
    }
  }
  return `Não foi possível gerar o áudio com a sua solicitação. Por favor, tente novamente com um prompt mais claro.`;
}
}