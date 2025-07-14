import sendImage from '../whatsapp/sendImage.js';
import sendMessage from '../whatsapp/sendMessage.js';
import generateImage from './generateImage.js';
import analyzeImage from './analyzeImage.js';
import ollama from 'ollama';
import lotteryCheck from './lotteryCheck.js';
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { getUserProfile, updateUserProfile } from '../repository/userProfileRepository.js';
import analyzeSentiment from './analyzeSentiment.js';
import inferInteractionStyle from './inferInteractionStyle.js';
import { addReminder, getReminders } from '../repository/reminderRepository.js';
import { scheduleReminder } from './reminder.js';
import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
import updateUserProfileSummary from './updateUserProfileSummary.js';
import webSearch from './webSearch.js';
import browse from './browse.js';
import generateAudio from './generateAudio.js';
import sendPtt from '../whatsapp/sendPtt.js';
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um assistente de IA. Para se comunicar com o usuário, você DEVE OBRIGATORIAMENTE usar a função 'send_message'. NUNCA responda diretamente com texto no campo 'content'. Todo o texto para o usuário final deve ser encapsulado na função 'send_message'. Você pode chamar a função 'send_message' várias vezes em sequência para quebrar suas respostas em mensagens menores e mais dinâmicas.

Para buscar informações na web, siga este processo em duas etapas:
1. **Descubra:** Use a função 'web_search' com uma query de busca (ex: "melhores restaurantes em São Paulo") para encontrar URLs relevantes.
2. **Extraia:** Analise os resultados da busca, escolha a URL mais promissora e use a função 'browse' para extrair as informações daquela página específica. **NUNCA use 'browse' em URLs de motores de busca (Bing, Google, etc.).**

Ao analisar informações, especialmente de fontes da web, priorize dados recentes. Se a informação contiver datas, mencione a data da informação ao usuário para indicar sua relevância. Se a informação estiver desatualizada, informe o usuário sobre isso.

Se uma tentativa de 'browse' falhar (especialmente com erros de resolução de nome como 'net::ERR_NAME_NOT_RESOLVED'), uma 'web_search' será automaticamente realizada como fallback. Nesses casos, analise cuidadosamente os resultados da 'web_search' para tentar encontrar a informação original ou uma alternativa relevante. Se a 'web_search' também não produzir resultados úteis, informe o usuário sobre a falha e sugira alternativas.

Além disso, você pode usar outras ferramentas para gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias.`
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
    // Inferência do estilo de interação
    const inferredStyle = await inferInteractionStyle(userContent);

    // Se a inferência de estilo falhou e retornou conteúdo bruto, envie-o ao usuário
    if (inferredStyle.rawContent && inferredStyle.rawContent.trim().length > 0) {
      await sendMessage(data.from, inferredStyle.rawContent);
      return; // Encerra o processamento para evitar respostas duplicadas
    }

    // Atualiza o perfil do usuário com o novo sentimento e estilo de interação
    const updatedProfile = {
      ...userProfile,
      sentiment: {
        average: currentSentiment, // Simplificado por enquanto
        trend: 'stable' // Simplificado por enquanto
      },
      interaction_style: inferredStyle
    };
    await updateUserProfile(userId, updatedProfile);

    // Constrói o prompt dinâmico
    const dynamicPrompt = {
      role: 'system',
      content: `Você é um assistente que pode responder perguntas, gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias como Mega-Sena, Quina e Lotofácil.\n\nIMPORTANTE: Ao usar ferramentas (functions/tools), siga exatamente as instruções de uso de cada função, conforme descrito no campo 'description' de cada uma.\n\nSe não tiver certeza de como usar uma função, explique o motivo e peça mais informações. Nunca ignore as instruções do campo 'description' das funções.`
    };

    if (userProfile) {
      dynamicPrompt.content += `\n\n--- Sobre o usuário ---\n${userProfile.summary || ''}\nSentimento: ${userProfile.sentiment?.average || 'neutro'}`;
      if (userProfile.interaction_style) {
        dynamicPrompt.content += `\nSeu estilo de comunicação deve ser: formalidade ${userProfile.interaction_style.formality}, humor ${userProfile.interaction_style.humor}, tom ${userProfile.interaction_style.tone}, verbosidade ${userProfile.interaction_style.verbosity}.`;
      }
    }

    messages.push({ role: 'user', content: userContent });

    const chatMessages = [dynamicPrompt, ...messages];
    let response = await chatAi(chatMessages);

    messages.push(response.message);
    if ((response.message.tool_calls && response.message.tool_calls.length > 0) || response.message.function_call) {
      messages = await toolCall(messages, response, tools, data.from, data.id, userContent);
    }
    await updateUserContext(userId, { messages });
    await updateUserProfileSummary(userId, messages);
  }
}

async function toolCall(messages, response, tools, from, id, userContent) {
  const newMessages = messages;
  let directCommunicationOccurred = false; // Flag to track if a direct communication tool was used
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
        directCommunicationOccurred = true; // Set flag
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
        if (result.error && result.error.includes('net::ERR_NAME_NOT_RESOLVED')) {
          console.warn(`Browse failed for ${args.url} due to name resolution error. Attempting web search as fallback.`);
          const webSearchResult = await webSearch({ query: userContent });
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Browse failed. Attempted web search with query "${userContent}": ${JSON.stringify(webSearchResult)}` });
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: JSON.stringify(result) });
        }
      } else if (toolCall.function.name === 'web_search') {
        const result = await webSearch({ query: args.query });
        newMessages.push({ name: 'web_search', role: 'tool', content: JSON.stringify(result) });
      } else if (toolCall.function.name === 'generate_audio') {
        console.log('Generating audio with args:', args);
        const audioResult = await generateAudio(args.textToSpeak);
        if (audioResult.success) {
          await sendPtt(from, audioResult.audioBuffer, id);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Áudio gerado e enviado: "${args.textToSpeak}"` });
          directCommunicationOccurred = true; // Set flag
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Erro ao gerar áudio: ${audioResult.error}` });
        }
      } 
    }

    // If a direct communication tool was used, we are done with this turn.
    if (directCommunicationOccurred) {
      return newMessages;
    }

    const newResponse = await chatAi(newMessages);
    newMessages.push(newResponse.message);
    if ((newResponse.message.tool_calls && newResponse.message.tool_calls.length > 0) || newResponse.message.function_call) {
      return toolCall(newMessages, newResponse, tools, from, id);
    }

    // Fallback for when the model forgets to use the send_message tool
    if (newResponse.message.content && newResponse.message.content.trim().length > 0) {
      await sendMessage(from, newResponse.message.content);
    }

    return newMessages;
  }
  return messages;
}
