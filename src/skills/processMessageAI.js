import sendImage from '../whatsapp/sendImage.js';
import sendMessage from '../whatsapp/sendMessage.js';

import ollama from 'ollama';
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { getUserProfile, updateUserProfile } from '../repository/userProfileRepository.js';
import analyzeSentiment from './analyzeSentiment.js';
import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
import updateUserProfileSummary from './updateUserProfileSummary.js';
import { execute as browseAgentExecute } from '../agents/BrowseAgent.js';
import { execute as generateImageAgentExecute } from '../agents/GenerateImageAgent.js';
import { execute as analyzeImageAgentExecute } from '../agents/AnalyzeImageAgent.js';
import { execute as reminderAgentExecute } from '../agents/ReminderAgent.js';
import { execute as lotteryCheckAgentExecute } from '../agents/LotteryCheckAgent.js';
import { execute as generateAudioAgentExecute } from '../agents/GenerateAudioAgent.js';
import sendPtt from '../whatsapp/sendPtt.js';
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um assistente de IA. Para se comunicar com o usuário, você DEVE OBRIGATORIAMENTE usar a função 'send_message'. NUNCA responda diretamente com texto no campo 'content'. Todo o texto para o usuário final deve ser encapsulado na função 'send_message'. Você pode chamar a função 'send_message' várias vezes em sequência para quebrar suas respostas em mensagens menores e mais dinâmicas.

Você tem acesso a agentes especializados para realizar tarefas específicas. Use o agente apropriado para cada tipo de solicitação:
- Para buscar informações na web, navegar em URLs ou realizar pesquisas, use o agente 'information_retrieval_agent'.
- Para gerar imagens, use o agente 'image_generation_agent'.
- Para analisar imagens, use o agente 'image_analysis_agent'.
- Para gerenciar lembretes (criar ou listar), use o agente 'reminder_agent'.
- Para verificar resultados de loterias, use o agente 'lottery_check_agent'.
- Para gerar áudio a partir de texto, use o agente 'audio_generation_agent'.

Ao analisar informações, especialmente de fontes da web, priorize dados recentes. Se a informação contiver datas, mencione a data da informação ao usuário para indicar sua relevância. Se a informação estiver desatualizada, informe o usuário sobre isso.

Sempre que usar um agente, você deve passar a consulta completa do usuário ou uma descrição clara da tarefa para o parâmetro 'query' do agente.`
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
      content: `Você é um assistente que pode responder perguntas, usar agentes especializados para gerar imagens, analisar imagens, criar lembretes, verificar resultados de loterias e **gerar áudio usando a ferramenta 'audio_generation_agent'**.IMPORTANTE: Ao usar ferramentas (functions/tools), siga exatamente as instruções de uso de cada função, conforme descrito no campo 'description' de cada uma.Se não tiver certeza de como usar uma função, explique o motivo e peça mais informações. Nunca ignore as instruções do campo 'description' das funções.`
    };

    if (userProfile) {
      dynamicPrompt.content += `\n\n--- Sobre o usuário ---\n${userProfile.summary || ''}\nSentimento: ${userProfile.sentiment?.average || 'neutro'}`;
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
      if (toolCall.function.name === 'image_generation_agent') {
        const result = await generateImageAgentExecute(args.prompt, from);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: result });
      } else if (toolCall.function.name === 'send_message') {
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Mensagem enviada ao usuário: "${args.content}"` });
        await sendMessage(from, args.content);
      } else if (toolCall.function.name === 'image_analysis_agent') {
        const result = await analyzeImageAgentExecute(data.body, args.prompt);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: result });
      } else if (toolCall.function.name === 'reminder_agent') {
        const result = await reminderAgentExecute(args.query, from);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: result });
      } else if (toolCall.function.name === 'lottery_check_agent') {
        const result = await lotteryCheckAgentExecute(args.query);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: result });
      } else if (toolCall.function.name === 'information_retrieval_agent') {
        const result = await browseAgentExecute(args.query);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: result });
      } else if (toolCall.function.name === 'audio_generation_agent') {
        const result = await generateAudioAgentExecute(args.query, from, id);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: result }); 
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
}