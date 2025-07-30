import LtmService from '../services/LtmService.js';
import sendImage from '../whatsapp/sendImage.js';
import { embeddingModel, chatModel } from '../lib/langchain.js'; // Importar embeddingModel e chatModel
import { normalizeAiResponse } from '../utils/aiResponseUtils.js';

const MAX_STM_MESSAGES = 10; // Número máximo de mensagens na STM
const SUMMARIZE_THRESHOLD = 7; // Limite para acionar a sumarização (ex: se tiver mais de 7 mensagens, sumariza as mais antigas)

// Função auxiliar para calcular similaridade de cosseno
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

import sendMessage from '../whatsapp/sendMessage.js';
import simulateTyping from '../whatsapp/simulateTyping.js'; // Importar simulateTyping

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
  content: `Você é um assistente de IA. Sua principal forma de comunicação com o usuário é através da função 'send_message'.

**REGRAS CRÍTICAS PARA COMUNICAÇÃO:**
1. **SEMPRE USE 'send_message':** Para qualquer texto que você queira enviar ao usuário, você DEVE OBRIGATORIAMENTE usar a função 'send_message'. NUNCA responda diretamente com texto no campo 'content' da sua resposta principal.
2. **Múltiplas Mensagens:** Você pode chamar a função 'send_message' várias vezes em sequência para quebrar suas respostas em mensagens menores e mais dinâmicas, se apropriado.
3. **NÃO RESPONDA DIRETAMENTE:** Se você tiver uma resposta para o usuário, mas não usar 'send_message', sua resposta NÃO SERÁ ENTREGUE. Isso é um erro crítico.

Para buscar informações na web, siga este processo em duas etapas:
1. **Descubra:** Use a função 'web_search' com uma query de busca (ex: "melhores restaurantes em São Paulo") para encontrar URLs relevantes.
2. **Extraia:** Analise os resultados da busca, escolha a URL mais promissora e use a função 'browse' para extrair as informações daquela página específica. **NUNCA use 'browse' em URLs de motores de busca (Bing, Google, etc.).**

Ao analisar informações, especialmente de fontes da web, priorize dados recentes. Se a informação contiver datas, mencione a data da informação ao usuário para indicar sua relevância. Se a informação estiver desatualizada, informe o usuário sobre isso.

Se uma tentativa de 'browse' falhar (especialmente com erros de resolução de nome como 'net::ERR_NAME_NOT_RESOLVED'), uma 'web_search' será automaticamente realizada como fallback. Nesses casos, analise cuidadosamente os resultados da 'web_search' para tentar encontrar a informação original ou uma alternativa relevante. Se a 'web_search' também não produzir resultados úteis, informe o usuário sobre a falha e sugira alternativas.

Além disso, você pode usar outras ferramentas para gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias.`
};

export default async function processMessage(message) {
  const startTime = Date.now();
  const { data } = message;
  const userId = data.from.replace('@c.us', '');
  const userContent = (data.body || (data.type === 'image' ? 'Analyze this image' : '')).trim();

  // Initial setup: load context, profile, and build the initial prompt
  let { messages } = await getUserContext(userId);
  const userProfile = await getUserProfile(userId);
  const ltmContext = await LtmService.getRelevantContext(userId, userContent);
  const dynamicPrompt = buildDynamicPrompt(userProfile, ltmContext);

  // Add the current user message to the history
  messages.push({ role: 'user', content: userContent });

  let continueConversation = true;
  while (continueConversation) {
    const chatMessages = [dynamicPrompt, ...messages];
    const response = await chatAi(chatMessages, tools);
    const aiMessage = normalizeAiResponse(response).message;

    messages.push(aiMessage);

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const toolResults = await executeAllToolCalls(aiMessage.tool_calls, data);
      messages.push(...toolResults);
      // The loop will continue, sending tool results back to the AI
    } else {
      // If there are no more tool calls, the conversation turn is over.
      continueConversation = false;
    }
  }

  // Final updates after the conversation loop is complete
  await updateUserContext(userId, { messages });
  // Trigger background updates without waiting
  LtmService.summarizeAndStore(userId, messages.map(m => m.content).join('\n')).catch(console.error);
  updateUserProfileSummary(userId, messages).catch(console.error);

  console.log(`[ProcessMessage] ✅ Processamento concluído. Tempo total: ${Date.now() - startTime}ms`);
}

async function executeAllToolCalls(toolCalls, messageData) {
  const toolResults = [];
  for (const toolCall of toolCalls) {
    const toolName = toolCall.function.name;
    let toolResultContent = '';
    try {
      const args = JSON.parse(toolCall.function.arguments);
      switch (toolName) {
        case 'send_message':
          await sendMessage(messageData.from, args.content);
          toolResultContent = `Message sent: "${args.content}"`;
          break;
        case 'image_generation_agent':
          const image = await generateImage({ ...args });
          if (image.error) {
            toolResultContent = `Error generating image: ${image.error}`;
          } else {
            await sendImage(messageData.from, image, args.prompt);
            toolResultContent = `Image generated and sent: "${args.prompt}"`;
          }
          break;
        default:
          toolResultContent = `Unknown tool: ${toolName}`;
          break;
      }
    } catch (error) {
      toolResultContent = `Error executing tool ${toolName}: ${error.message}`;
    }
    toolResults.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolName,
      content: toolResultContent,
    });
  }
  return toolResults;
}

function buildDynamicPrompt(userProfile, ltmContext) {
  // This function remains the same as before, responsible for constructing the system prompt
  // ... (implementation of buildDynamicPrompt)
  return { role: 'system', content: '...' }; // Placeholder for actual implementation
}


