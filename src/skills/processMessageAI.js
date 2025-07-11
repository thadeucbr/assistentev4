import sendImage from '../whatsapp/sendImage.js';
import sendMessage from '../whatsapp/sendMessage.js';
import generateImage from './generateImage.js';
import analyzeImage from './analyzeImage.js';
import ollama from 'ollama';
import lotteryCheck from './lotteryCheck.js';
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { getUserProfile, updateUserProfile } from '../repository/userProfileRepository.js';
import analyzeSentiment from './analyzeSentiment.js';
import { addReminder, getReminders } from '../repository/reminderRepository.js';
import { scheduleReminder } from './reminder.js';
import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
import updateUserProfileSummary from './updateUserProfileSummary.js';
import browse from './browse.js';
import generateAudio from './generateAudio.js';
import sendPtt from '../whatsapp/sendPtt.js';
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um assistente de IA. Para se comunicar com o usuário, você DEVE OBRIGATORIAMENTE usar a função 'send_message'. NUNCA responda diretamente com texto no campo 'content'. Todo o texto para o usuário final deve ser encapsulado na função 'send_message'. Você pode chamar a função 'send_message' várias vezes em sequência para quebrar suas respostas em mensagens menores e mais dinâmicas. Além de se comunicar, você pode usar outras ferramentas para gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias.

---
**EXEMPLO DE USO CORRETO:**

**Histórico da Conversa:**
[{"role": "user", "content": "Olá, tudo bem?"}]

**Sua Resposta (Obrigatória):**
{"role": "assistant", "content": null, "tool_calls": [{"function": {"name": "send_message", "arguments": {"content": "Olá! Tudo ótimo por aqui. Como posso te ajudar hoje?"}}}]}
---`
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
    const userProfile = await getUserProfile(userId);

    // Análise de sentimento da mensagem atual
    const currentSentiment = await analyzeSentiment(userContent);

    // Atualiza o perfil do usuário com o novo sentimento
    const updatedProfile = {
      ...userProfile,
      sentiment: {
        average: currentSentiment, // Simplificado por enquanto
        trend: 'stable' // Simplificado por enquanto
      }
    };
    await updateUserProfile(userId, updatedProfile);

    // Constrói o prompt dinâmico
    const dynamicPrompt = {
      role: 'system',
      content: `Você é um assistente que pode responder perguntas, gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias como Mega-Sena, Quina e Lotofácil.\n\nIMPORTANTE: Ao usar ferramentas (functions/tools), siga exatamente as instruções de uso de cada função, conforme descrito no campo 'description' de cada uma.\n\nSe não tiver certeza de como usar uma função, explique o motivo e peça mais informações. Nunca ignore as instruções do campo 'description' das funções.`
    };

    if (userProfile) {
      dynamicPrompt.content += `\n\n--- Sobre o usuário ---\n${userProfile.summary || ''}\nSentimento: ${userProfile.sentiment?.average || 'neutro'}`;
    }

    messages.push({ role: 'user', content: userContent });

    const chatMessages = [dynamicPrompt, ...messages];
    let response = await chatAi(chatMessages);

    messages.push(response.message);
    if ((response.message.tool_calls && response.message.tool_calls.length > 0) || response.message.function_call) {
      messages = await toolCall(messages, response, tools, data.from, data.id);
    }
    await updateUserContext(userId, { messages });
    await updateUserProfileSummary(userId, messages);
  }
}

async function toolCall(messages, response, tools, from, id) {
  const newMessages = messages;
  if (response.message.function_call) {
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
        console.log(args)
        const image = await generateImage({ ...args });
        if (image.error) {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Erro ao gerar imagem: ${image.error}` });
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Image generated and sent: "${args.prompt}"` });
          await sendImage(from, image, args.prompt);
        }
      } else if (toolCall.function.name === 'send_message') {
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Mensagem enviada ao usuário: "${args.content}"` });
        await sendMessage(from, args.content);
      } else if (toolCall.function.name === 'analyze_image') {
        const analysis = await analyzeImage({ id, prompt: args.prompt });
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: analysis });
      } else if (toolCall.function.name === 'reminder') {
        if (args.action === 'create') {
          const newReminder = await addReminder(from, args.message, args.scheduledTime);
          scheduleReminder(newReminder);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Lembrete criado: ${JSON.stringify(newReminder)}` });
        } else if (args.action === 'list') {
          const reminders = await getReminders(from);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Seus lembretes: ${JSON.stringify(reminders)}` });
        }
      } else if (toolCall.function.name === 'lottery_check') {
        const result = await lotteryCheck(args.modalidade, args.sorteio);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: JSON.stringify(result) });
      } else if (toolCall.function.name === 'browse') {
        const result = await browse({ url: args.url });
        newMessages.push({ name: 'browse', role: 'tool', content: JSON.stringify(result) });
      } else if (toolCall.function.name === 'curl') {
        const result = await curl(args);
        newMessages.push({ name: 'curl', role: 'tool', content: JSON.stringify(result) });
      } else if (toolCall.function.name === 'generate_audio') {
        console.log('Generating audio with args:', args);
        const audioResult = await generateAudio(args.textToSpeak);
        if (audioResult.success) {
          await sendPtt(from, audioResult.audioBuffer, id);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Áudio gerado e enviado: "${args.textToSpeak}"` });
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Erro ao gerar áudio: ${audioResult.error}` });
        }
      } 
    }

    const newResponse = await chatAi(newMessages);
    newMessages.push(newResponse.message);
    if ((newResponse.message.tool_calls && newResponse.message.tool_calls.length > 0) || newResponse.message.function_call) {
      return toolCall(newMessages, newResponse, tools, from, id);
    }
    return newMessages;
  }
  return messages;
}
