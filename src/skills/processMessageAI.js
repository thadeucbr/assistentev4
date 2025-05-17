import sendImage from '../whatsapp/sendImage.js';
import sendMessage from '../whatsapp/sendMessage.js';
import generateImage from './generateImage.js';
import analyzeImage from './analyzeImage.js';
import ollama from 'ollama';
import lotteryCheck from './lotteryCheck.js';
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { addReminder, getReminders } from '../repository/reminderRepository.js';
import { scheduleReminder } from './reminder.js';
import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'Você é um assistente que pode responder perguntas, gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias como Mega-Sena, Quina e Lotofácil. Ao identificar um pedido relacionado a loteria, use a ferramenta "lottery_check".'
};

function sanitizeMessages(messages) {
  return messages.map(msg => {
    if (msg.role === 'assistant' && msg.name && msg.arguments) {
      return { role: 'assistant', name: msg.name, arguments: msg.arguments };
    }
    return { role: msg.role, content: msg.content ?? '' };
  });
}

export default async function processMessage(message) {
  const { data } = message;
  const isGroup = groups.includes(data?.chatId);
  if (
    (isGroup &&
      (data?.mentionedJidList?.includes(process.env.WHATSAPP_NUMBER) ||
        data?.quotedMsgObj?.author === process.env.WHATSAPP_NUMBER)) ||
    !isGroup
  ) {
    const userContent = (data.body || (data.type === 'image' ? 'Analyze this image' : ''))
      .replace(process.env.WHATSAPP_NUMBER, '')
      .trim();
    const userId = data.from.replace('@c.us', '');
    let { messages } = await getUserContext(userId);
    messages.push({ role: 'user', content: userContent });


    const chatMessages = [SYSTEM_PROMPT, ...messages];
    let response = await chatAi(chatMessages);

    messages.push(response.message);
    if ((response.message.tool_calls && response.message.tool_calls.length > 0) || response.message.function_call) {
      messages = await toolCall(messages, response, tools, data.from);
    } else {
      if (response?.message?.content?.length > 0) {
        await sendMessage(data.from, response.message.content);
      }
    }
    await updateUserContext(userId, { messages });
  }
}



async function toolCall(messages, response, tools, from) {
  const newMessages = messages;
  let sendMessageCalled = false;
  console.log('response', response);
 if(response.message.function_call) {
  response.message.tool_calls = [
    {
      function: {
        name: response.message.function_call.name,
        arguments: JSON.parse(response.message.function_call.arguments)
      }
    }
  ];
 }
  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;
      if (toolCall.function.name === 'generate_image') {
        console.log(args);
        const image = await generateImage({ ...args });
        newMessages.push({ role: 'tool', content: `Image generated and sent: "${args.prompt}"` });
        await sendImage(from, image, args.prompt);
      } else if (toolCall.function.name === 'send_message') {
        newMessages.push({ role: 'tool', content: `Mensagem enviada ao usuário: "${args.content}"` });
        await sendMessage(from, args.content);
        sendMessageCalled = true;
      } else if (toolCall.function.name === 'analyze_image') {
        const analysis = await analyzeImage(args.image, args.prompt);
        newMessages.push({ role: 'tool', content: analysis });
      } else if (toolCall.function.name === 'reminder') {
        if (args.action === 'create') {
          const newReminder = await addReminder(from, args.message, args.scheduledTime);
          scheduleReminder(newReminder);
          newMessages.push({ role: 'tool', content: `Lembrete criado: ${JSON.stringify(newReminder)}` });
        } else if (args.action === 'list') {
          const reminders = await getReminders(from);
          newMessages.push({ role: 'tool', content: `Seus lembretes: ${JSON.stringify(reminders)}` });
        }
      } else if (toolCall.function.name === 'lottery_check') {
        const result = await lotteryCheck(args.modalidade, args.sorteio);
        newMessages.push({ role: 'tool', content: JSON.stringify(result) });
      }
    }
    
    const newResponse = await chatAi(newMessages);
    newMessages.push(newResponse.message);
    
    if (newResponse.message.tool_calls && newResponse.message.tool_calls.length > 0) {
      return toolCall(newMessages, newResponse, tools, from);
    }
    if (!sendMessageCalled && newResponse.message.content && newResponse.message.content.length > 0) {
      await sendMessage(from, newResponse.message.content);
    }
    return newMessages;
  }
  if (!sendMessageCalled && response.message.content && response.message.content.length > 0) {
    await sendMessage(from, response.message.content);
    return messages;
  }
  return messages;
}
