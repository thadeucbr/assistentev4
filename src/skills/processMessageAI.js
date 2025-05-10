import sendImage from '../whatsapp/sendImage.js';
import sendMessage from '../whatsapp/sendMessage.js';
import generateImage from './generateImage.js';
import analyzeImage from './analyzeImage.js';
import ollama from 'ollama';
import lotteryCheck from './lotteryCheck.js';
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { addReminder, getReminders } from '../repository/reminderRepository.js';
import { scheduleReminder } from './reminder.js';

const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'Você é um assistente que pode responder perguntas, gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias como Mega-Sena, Quina e Lotofácil. Ao identificar um pedido relacionado a loteria, use a ferramenta "lottery_check".'
};

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

    const tools = [
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
      },      
      {
        type: 'function',
        function: {
          name: 'send_message',
          description: 'Send a text message to the user.',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Message content to send.' }
            },
            required: ['content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_image',
          description: 'Analyze an image using a provided prompt to describe its contents.',
          parameters: {
            type: 'object',
            properties: {
              image: { type: 'string', description: 'Base64 encoded image to analyze.' },
              prompt: { type: 'string', description: 'Prompt guiding the analysis. Must be in English.' }
            },
            required: ['image']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder',
          description: 'Gerencia os lembretes do usuário: "create" para criar e "list" para listar.',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Ação a ser executada: "create" ou "list".' },
              message: { type: 'string', description: 'Mensagem do lembrete (necessário para criação).' },
              scheduledTime: { type: 'string', description: 'Horário agendado (ISO 8601 ou "now + PT..." ).' }
            },
            required: ['action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'lottery_check',
          description: 'Verifica resultados de loteria para uma modalidade e sorteio opcionais usando a API da Caixa.',
          parameters: {
            type: 'object',
            properties: {
              modalidade: { type: 'string', description: 'Modalidade da loteria: megasena, lotofacil, quina, lotomania, timemania, duplasena, supersete, loteca, diadesorte.' },
              sorteio: { type: 'string', description: 'Número do concurso. Se omitido, retorna o último resultado.' }
            },
            required: ['modalidade']
          }
        }
      }
    ];

    const chatMessages = [SYSTEM_PROMPT, ...messages];
    let response = await ollama.chat({
      model: process.env.OLLAMA_MODEL || 'mistral',
      messages: chatMessages,
      tools: tools,
    });

    messages.push(response.message);
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      messages = await toolCall(messages, response, tools, data.from);
    } else {
      if (response.message.content.length > 0) {
        await sendMessage(data.from, response.message.content);
      }
    }
    await updateUserContext(userId, { messages });
  }
}

async function toolCall(messages, response, tools, from) {
  const newMessages = messages;
  let sendMessageCalled = false;
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
    
    const newResponse = await ollama.chat({
      model: process.env.OLLAMA_MODEL || 'mistral',
      messages: [SYSTEM_PROMPT, ...newMessages],
      tools: tools,
    });
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
