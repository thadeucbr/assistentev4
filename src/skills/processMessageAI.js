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
  console.log(`[ProcessMessage] 🚀 Iniciando processamento da mensagem - ${new Date().toISOString()}`);
  const { data } = message;
  const isGroup = groups.includes(data?.chatId);
  if (
    (isGroup &&
      (data?.mentionedJidList?.includes(process.env.WHATSAPP_NUMBER) ||
        data?.quotedMsgObj?.author === process.env.WHATSAPP_NUMBER)) ||
    !isGroup
  ) {
    let stepTime = Date.now();
    console.log(`[ProcessMessage] ✅ Mensagem autorizada para processamento - ${new Date().toISOString()} (+${Date.now() - startTime}ms)`);
    
    // Feedback imediato: simular digitação no início para mostrar que o bot está "vivo"
    simulateTyping(data.from, true); // Não aguardar - executar em background
    
    const userContent = (data.body || (data.type === 'image' ? 'Analyze this image' : ''))
      .replace(process.env.WHATSAPP_NUMBER, '')
      .trim();
    const userId = data.from.replace('@c.us', '');
    
    stepTime = Date.now();
    console.log(`[ProcessMessage] 📖 Carregando contexto do usuário... - ${new Date().toISOString()}`);
    let { messages } = await getUserContext(userId); // This 'messages' is our STM
    console.log(`[ProcessMessage] ✅ Contexto carregado (+${Date.now() - stepTime}ms)`);
    
    stepTime = Date.now();
    console.log(`[ProcessMessage] 👤 Carregando perfil do usuário... - ${new Date().toISOString()}`);
    const userProfile = await getUserProfile(userId);
    console.log(`[ProcessMessage] ✅ Perfil carregado (+${Date.now() - stepTime}ms)`);
    
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🧠 Buscando contexto relevante na LTM... - ${new Date().toISOString()}`);
    const ltmContext = await LtmService.getRelevantContext(userId, userContent);
    console.log(`[ProcessMessage] ✅ Contexto LTM obtido (+${Date.now() - stepTime}ms)`);

    // --- STM Management: Reranking and Summarization ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🧩 Gerenciando memória de curto prazo (STM)... - ${new Date().toISOString()}`);
    let currentSTM = [...messages]; // Create a copy to work with

    const hotMessages = currentSTM.slice(-SUMMARIZE_THRESHOLD);
    const warmMessages = currentSTM.slice(0, currentSTM.length - SUMMARIZE_THRESHOLD);

    if (warmMessages.length > 0 && currentSTM.length >= MAX_STM_MESSAGES) {
      console.log(`[ProcessMessage] 🔄 Aplicando reranking e sumarização da STM... - ${new Date().toISOString()}`);
      
      const stmTypingPromise = simulateTyping(data.from, true);
      
      const userEmbedding = await embeddingModel.embedQuery(userContent);

      const messagesWithEmbeddings = await Promise.all(
        warmMessages.map(async (msg) => {
          if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.length > 0) {
            const embedding = await embeddingModel.embedQuery(msg.content);
            return { ...msg, embedding };
          }
          return msg; // Retorna a mensagem sem embedding se o conteúdo for nulo ou vazio
        })
      );

      const rankedWarmMessages = messagesWithEmbeddings
        .map((msg) => {
          if (msg.embedding) {
            return { ...msg, similarity: cosineSimilarity(userEmbedding, msg.embedding) };
          }
          return { ...msg, similarity: -1 };
        })
        .sort((a, b) => b.similarity - a.similarity);

      const numWarmMessagesToKeep = MAX_STM_MESSAGES - hotMessages.length;
      const keptWarmMessages = rankedWarmMessages.slice(0, numWarmMessagesToKeep);

      const keptMessageContents = new Set(keptWarmMessages.map(m => m.content));
      const messagesToSummarize = warmMessages.filter(m => !keptMessageContents.has(m.content));

      if (messagesToSummarize.length > 0) {
        console.log(`[ProcessMessage] 📚 Sumarizando mensagens antigas para LTM... - ${new Date().toISOString()}`);
        const summaryContent = messagesToSummarize.map(m => m.content).join('\n');
        const summaryResponse = await chatModel.invoke([
          { role: 'system', content: 'Resuma o seguinte trecho de conversa de forma concisa, focando nos fatos e informações importantes.' },
          { role: 'user', content: summaryContent }
        ]);
        LtmService.summarizeAndStore(userId, summaryResponse.content)
            .catch(err => console.error(`[ProcessMessage] Erro ao sumarizar para LTM em background: ${err}`));
      }

      messages = [...hotMessages, ...keptWarmMessages.map(m => ({ role: m.role, content: m.content }))];
      
      await stmTypingPromise;

    } else if (currentSTM.length > MAX_STM_MESSAGES) {
      console.log(`[ProcessMessage] ✂️ Truncando STM por janela deslizante... - ${new Date().toISOString()}`);
      messages = currentSTM.slice(-MAX_STM_MESSAGES);
    }
    console.log(`[ProcessMessage] ✅ Gerenciamento STM concluído (+${Date.now() - stepTime}ms)`);

    // Constrói o prompt dinâmico
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🛠️ Construindo prompt dinâmico... - ${new Date().toISOString()}`);
    const dynamicPrompt = {
      role: 'system',
      content: `Você é um assistente que pode responder perguntas, gerar imagens, analisar imagens, criar lembretes e verificar resultados de loterias como Mega-Sena, Quina e Lotofácil.\n\nIMPORTANTE: Ao usar ferramentas (functions/tools), siga exatamente as instruções de uso de cada função, conforme descrito no campo 'description' de cada uma.\n\nSe não tiver certeza de como usar uma função, explique o motivo e peça mais informações. Nunca ignore as instruções do campo 'description' das funções.\n\nCRÍTICO: Todas as respostas diretas ao usuário devem ser enviadas usando a ferramenta 'send_message'. Não responda diretamente.`
    };

    if (userProfile) {
      dynamicPrompt.content += `\n\n--- User Profile ---\n`;
      if (userProfile.summary) {
        dynamicPrompt.content += `Resumo: ${userProfile.summary}\n`;
      }
      if (userProfile.preferences) {
        dynamicPrompt.content += `Preferências de comunicação: Tom ${userProfile.preferences.tone || 'não especificado'}, Humor ${userProfile.preferences.humor_level || 'não especificado'}, Formato de resposta ${userProfile.preferences.response_format || 'não especificado'}, Idioma ${userProfile.preferences.language || 'não especificado'}.\n`;
      }
      if (userProfile.linguistic_markers) {
        dynamicPrompt.content += `Marcadores linguísticos: Comprimento médio da frase ${userProfile.linguistic_markers.avg_sentence_length || 'não especificado'}, Formalidade ${userProfile.linguistic_markers.formality_score || 'não especificado'}, Usa emojis ${userProfile.linguistic_markers.uses_emojis !== undefined ? userProfile.linguistic_markers.uses_emojis : 'não especificado'}.\n`;
      }
      if (userProfile.key_facts && userProfile.key_facts.length > 0) {
        dynamicPrompt.content += `Fatos importantes: ${userProfile.key_facts.map(fact => fact.fact).join('; ')}.\n`;
      }
    }

    if (ltmContext) {
      dynamicPrompt.content += `\n\n--- Relevant Previous Conversations ---\n${ltmContext}`;
    }
    console.log(`[ProcessMessage] ✅ Prompt dinâmico construído (+${Date.now() - stepTime}ms)`);

    // --- Parallel AI Analysis ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🚀 Iniciando análises de IA em paralelo... - ${new Date().toISOString()}`);
    simulateTyping(data.from, true);

    const sentimentPromise = analyzeSentiment(userContent);
    const stylePromise = inferInteractionStyle(userContent);

    const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
    const mainResponsePromise = chatAi(chatMessages);

    let [currentSentiment, inferredStyle, response] = await Promise.all([
      sentimentPromise,
      stylePromise,
      mainResponsePromise
    ]);
    console.log(`[ProcessMessage] ✅ Análises de IA concluídas (+${Date.now() - stepTime}ms)`);

    // Update user profile with the latest sentiment and style (quick, synchronous update)
    stepTime = Date.now();
    console.log(`[ProcessMessage] 📝 Atualizando perfil do usuário (sentimento/estilo)... - ${new Date().toISOString()}`);
    const updatedProfile = {
      ...userProfile,
      sentiment: { average: currentSentiment, trend: 'stable' },
      interaction_style: inferredStyle
    };
    await updateUserProfile(userId, updatedProfile);
    console.log(`[ProcessMessage] ✅ Perfil (sentimento/estilo) atualizado (+${Date.now() - stepTime}ms)`);

    // --- Process AI Response ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🔧 Normalizando resposta da IA... - ${new Date().toISOString()}`);
    response = normalizeAiResponse(response);
    console.log(`[ProcessMessage] ✅ Resposta normalizada (+${Date.now() - stepTime}ms)`);

    messages.push({ role: 'user', content: userContent });
    messages.push(response.message);

    if ((response.message.tool_calls && response.message.tool_calls.length > 0) || response.message.function_call) {
      stepTime = Date.now();
      console.log(`[ProcessMessage] 🛠️ Executando ferramentas... - ${new Date().toISOString()}`);
      messages = await toolCall(messages, response, tools, data.from, data.id, userContent);
      console.log(`[ProcessMessage] ✅ Ferramentas executadas (+${Date.now() - stepTime}ms)`);
    }
    
    // --- Final Asynchronous Updates ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 💾 Atualizando contexto e iniciando atualizações em background... - ${new Date().toISOString()}`);
    
    await updateUserContext(userId, { messages });

    LtmService.summarizeAndStore(userId, messages.map((m) => m.content).join('\n'))
        .catch(err => console.error(`[ProcessMessage] Erro ao armazenar na LTM em background: ${err}`));

    updateUserProfileSummary(userId, messages)
      .catch(err => console.error(`[ProcessMessage] Erro ao atualizar resumo do perfil em background: ${err}`));
      
    console.log(`[ProcessMessage] ✅ Atualizações síncronas concluídas e assíncronas iniciadas (+${Date.now() - stepTime}ms)`);
    
    console.log(`[ProcessMessage] ✅ Processamento da mensagem concluído - TEMPO TOTAL: ${Date.now() - startTime}ms - ${new Date().toISOString()}`);
  }
}

async function toolCall(messages, response, tools, from, id, userContent) {
  const toolStartTime = Date.now();
  console.log(`[ToolCall] 🔧 Iniciando execução de ferramentas...`);
  let newMessages = [...messages];

  if (response.message.function_call) {
    console.log(`[ToolCall] 🔄 Convertendo function_call legado para tool_calls...`);
    response.message.tool_calls = [
      {
        id: `call_legacy_${Date.now()}`,
        type: 'function',
        function: {
          name: response.message.function_call.name,
          arguments: response.message.function_call.arguments,
        },
      },
    ];
  }

  if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
    console.log(`[ToolCall] ⚠️ Nenhuma ferramenta para executar.`);
    return messages;
  }

  console.log(`[ToolCall] 📋 Executando ${response.message.tool_calls.length} ferramenta(s) sequencialmente...`);

  for (const toolCall of response.message.tool_calls) {
    const toolName = toolCall.function.name;
    let toolResultContent = '';

    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolName) {
        case 'image_generation_agent':
          const image = await generateImage({ ...args });
          toolResultContent = image.error ? `Erro ao gerar imagem: ${image.error}` : `Image generated and sent: "${args.prompt}"`;
          if (!image.error) await sendImage(from, image, args.prompt);
          break;

        case 'send_message':
          await sendMessage(from, args.content);
          toolResultContent = `Mensagem enviada ao usuário: "${args.content}"`;
          break;

        default:
          console.warn(`[ToolCall] Ferramenta desconhecida encontrada: ${toolName}`);
          toolResultContent = `Ferramenta desconhecida: ${toolName}`;
          break;
      }
    } catch (error) {
      console.error(`[ToolCall] Erro ao executar ou analisar argumentos para a ferramenta ${toolName}:`, error);
      toolResultContent = `Erro interno ao processar a ferramenta ${toolName}.`;
    }

    newMessages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolName,
      content: toolResultContent,
    });
  }

  console.log(`[ToolCall] 🔄 Enviando todos os resultados das ferramentas para a IA...`);
  const newResponse = await chatAi(newMessages, tools);
  const normalizedNewResponse = normalizeAiResponse(newResponse);
  newMessages.push(normalizedNewResponse.message);

  if (normalizedNewResponse.message.tool_calls && normalizedNewResponse.message.tool_calls.length > 0) {
    console.log(`[ToolCall] 🔁 Ferramentas adicionais detectadas, executando recursivamente...`);
    return toolCall(newMessages, normalizedNewResponse, tools, from, id, userContent);
  }

  console.log(`[ToolCall] ✅ Execução de ferramentas e ciclo de IA concluídos. Tempo total: ${Date.now() - toolStartTime}ms`);
  return newMessages;
}


