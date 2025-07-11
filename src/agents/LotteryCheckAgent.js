import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
import lotteryCheck from '../skills/lotteryCheck.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em verificar resultados de loterias. Sua função é, dada uma solicitação do usuário, verificar os resultados de loterias usando a ferramenta 'lottery_check'. Você deve analisar a solicitação do usuário e extrair a modalidade da loteria e, opcionalmente, o número do sorteio.

Você tem acesso à seguinte ferramenta:
- 'lottery_check': Para verificar os resultados de uma loteria específica.

Após verificar os resultados, você deve retornar as informações para o usuário.`
};

export async function execute(userQuery) {
  let messages = [SYSTEM_PROMPT, { role: 'user', content: userQuery }];
  let response = await chatAi(messages, tools);

  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;

      if (toolCall.function.name === 'lottery_check') {
        const result = await lotteryCheck(args.modalidade, args.sorteio);
        return JSON.stringify(result);
      }
    }
  }
  return `Não foi possível verificar os resultados da loteria com a sua solicitação. Por favor, tente novamente com um prompt mais claro.`;
}
