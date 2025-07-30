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

// Função para sanitizar mensagens antes de enviar para a IA
function sanitizeMessagesForChat(messages) {
  const cleanMessages = [];
  const validToolCallIds = new Set();
  
  // Primeira passada: coletar todos os tool_call_ids válidos
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      
      // Verificar se todas as tool responses existem para esta mensagem assistant
      let allToolResponsesFound = true;
      const toolResponsesMap = new Map();
      
      // Procurar por todas as tool responses correspondentes
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        if (nextMsg.role === 'tool' && toolCallIds.includes(nextMsg.tool_call_id)) {
          toolResponsesMap.set(nextMsg.tool_call_id, nextMsg);
        }
      }
      
      // Verificar se encontrou resposta para todos os tool_calls
      if (toolResponsesMap.size === toolCallIds.length) {
        // Todas as tool responses existem, adicionar os IDs como válidos
        toolCallIds.forEach(id => validToolCallIds.add(id));
      } else {
        console.log(`[Sanitize] ⚠️ Mensagem assistant com tool_calls incompletas será removida: esperado ${toolCallIds.length}, encontrado ${toolResponsesMap.size}`);
      }
    }
  }
  
  // Segunda passada: construir mensagens limpas
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      // Só incluir se todos os tool_calls desta mensagem são válidos
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      const allToolCallsValid = toolCallIds.every(id => validToolCallIds.has(id));
      
      if (allToolCallsValid) {
        cleanMessages.push(message);
      } else {
        console.log(`[Sanitize] 🗑️ Removendo mensagem assistant órfã com tool_calls: ${toolCallIds.join(', ')}`);
        console.log(`[Sanitize] 🔍 Detalhes da mensagem assistant removida:`, JSON.stringify(message, null, 2));
      }
    } else if (message.role === 'assistant') {
      // Para mensagens assistant sem tool_calls, verificar se têm conteúdo válido
      if (message.content && message.content.trim().length > 0) {
        cleanMessages.push(message);
      } else {
        console.log(`[Sanitize] 🗑️ Removendo mensagem assistant vazia ou sem conteúdo`);
        console.log(`[Sanitize] 🔍 Detalhes da mensagem assistant vazia:`, JSON.stringify(message, null, 2));
      }
    } else if (message.role === 'tool') {
      // Só incluir tool messages que correspondem a tool_calls válidos
      if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
        cleanMessages.push(message);
      } else {
        console.log(`[Sanitize] 🗑️ Removendo mensagem tool órfã: tool_call_id=${message.tool_call_id}`);
        console.log(`[Sanitize] 🔍 Detalhes da mensagem tool removida:`, JSON.stringify(message, null, 2));
      }
    } else {
      // Para outras mensagens (user, system, assistant sem tool_calls), sempre incluir
      cleanMessages.push(message);
    }
  }
  
  console.log(`[Sanitize] 🧹 Mensagens sanitizadas: ${messages.length} -> ${cleanMessages.length}`);
  return cleanMessages;
}

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
    
    // CRÍTICO: Sanitizar contexto histórico para remover mensagens órfãs corrompidas
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🧹 Sanitizando contexto histórico... - ${new Date().toISOString()}`);
    messages = sanitizeMessagesForChat(messages);
    console.log(`[ProcessMessage] ✅ Contexto histórico sanitizado (+${Date.now() - stepTime}ms)`);
    
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

    // --- Sequential AI Analysis ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🚀 Iniciando análises de IA sequencialmente... - ${new Date().toISOString()}`);
    simulateTyping(data.from, true);

    console.log(`[ProcessMessage] 📊 Analisando sentimento... - ${new Date().toISOString()}`);
    const currentSentiment = await analyzeSentiment(userContent);
    
    console.log(`[ProcessMessage] 🎨 Inferindo estilo de interação... - ${new Date().toISOString()}`);
    const inferredStyle = await inferInteractionStyle(userContent);

    const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
    
    // CRÍTICO: Sanitizar mensagens antes de enviar para evitar tool_calls órfãs
    const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
    console.log(`[ProcessMessage] 💬 Gerando resposta principal... - ${new Date().toISOString()}`);
    let response = await chatAi(sanitizedChatMessages);

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

    // Forçar ciclo até receber uma resposta send_message ou atingir limite de tentativas
    let toolCycleCount = 0;
    const MAX_TOOL_CYCLES = 3;
    let lastResponse = response.message;
    while (toolCycleCount < MAX_TOOL_CYCLES) {
      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        stepTime = Date.now();
        console.log(`[ProcessMessage] 🛠️ Executando ferramentas... - ${new Date().toISOString()}`);
        messages = await toolCall(messages, { message: lastResponse }, tools, data.from, data.id, userContent);
        console.log(`[ProcessMessage] ✅ Ferramentas executadas (+${Date.now() - stepTime}ms)`);
        // Buscar a última mensagem assistant gerada
        const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
        if (lastAssistantMsg) {
          lastResponse = lastAssistantMsg;
        } else {
          break;
        }
        // Se a última resposta assistant contém send_message, encerra ciclo
        if (lastResponse.tool_calls && lastResponse.tool_calls.some(tc => tc.function.name === 'send_message')) {
          break;
        }
      } else if (lastResponse.tool_calls && lastResponse.tool_calls.length > 0) {
        // Fallback: garantir que toda tool_call tenha uma mensagem tool, mesmo se não houver execução
        for (const toolCall of lastResponse.tool_calls) {
          const fallbackResponse = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Erro: ferramenta não encontrada ou falhou ao executar.',
          };
          messages.push(fallbackResponse);
          console.log(`[ProcessMessage] 🆘 Fallback: Adicionada resposta de erro para tool_call_id=${toolCall.id}`);
        }
        break;
      } else {
        // Se não há tool_calls, encerra ciclo
        break;
      }
      toolCycleCount++;
    }

    // Fallback final: se não houve resposta send_message, peça para a LLM gerar uma mensagem amigável de falha conforme o contexto
    const hasSendMessage = messages.some(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.some(tc => tc.function.name === 'send_message'));
    if (!hasSendMessage) {
      console.log('[ProcessMessage] 🆘 Fallback final: Solicitando à LLM uma mensagem amigável de erro.');
      // Sanitize o histórico antes de enviar para o fallbackPrompt
      const sanitizedFallbackHistory = sanitizeMessagesForChat(messages.slice(-MAX_STM_MESSAGES));
      const fallbackPrompt = [
        {
          role: 'system',
          content: 'Você falhou em obter uma resposta útil usando ferramentas. Gere uma mensagem amigável para o usuário explicando que não foi possível atender ao pedido, sem citar ferramentas ou detalhes técnicos. Seja educado e sugira alternativas se possível.'
        },
        ...sanitizedFallbackHistory
      ];
      let fallbackResponse;
      try {
        fallbackResponse = await chatAi(fallbackPrompt);
      } catch (err) {
        fallbackResponse = { message: { content: 'Desculpe, não consegui atender ao seu pedido neste momento.' } };
      }
      const fallbackContent = fallbackResponse?.message?.content || 'Desculpe, não consegui atender ao seu pedido neste momento.';
      const fallbackAssistant = {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: `call_fallback_${Date.now()}`,
            type: 'function',
            function: {
              name: 'send_message',
              arguments: JSON.stringify({ content: fallbackContent })
            }
          }
        ],
        refusal: null,
        annotations: []
      };
      messages.push(fallbackAssistant);
      const fallbackTool = {
        role: 'tool',
        tool_call_id: fallbackAssistant.tool_calls[0].id,
        content: `Mensagem enviada ao usuário: "${fallbackContent}"`
      };
      messages.push(fallbackTool);
      console.log('[ProcessMessage] 🆘 Fallback final: Mensagem de erro amigável enviada ao usuário.');
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

  // Coletar todas as respostas das ferramentas primeiro
  const toolResponses = [];
  
  for (const toolCall of response.message.tool_calls) {
    const toolName = toolCall.function.name;
    let toolResultContent = '';
    let actualToolName = toolName;

    console.log(`[ToolCall] 🔧 Processando tool_call: ${toolCall.id} - ${toolName}`);

    try {
      const args = JSON.parse(toolCall.function.arguments);

      // Normalizar nomes de ferramentas com erros de digitação
      if (toolName === 'ssend_message') {
        actualToolName = 'send_message';
        console.log(`[ToolCall] ⚠️ Corrigindo nome da ferramenta de '${toolName}' para '${actualToolName}'`);
      }

      switch (actualToolName) {
        case 'image_generation_agent':
          const image = await generateImage({ ...args });
          toolResultContent = image.error ? `Erro ao gerar imagem: ${image.error}` : `Image generated and sent: "${args.prompt}"`;
          if (!image.error) await sendImage(from, image, args.prompt);
          break;

        case 'send_message':
          await sendMessage(from, args.content);
          toolResultContent = `Mensagem enviada ao usuário: "${args.content}"`;
          break;

        case 'image_analysis_agent':
          const analysis = await analyzeImage({ ...args });
          toolResultContent = analysis.error ? `Erro ao analisar imagem: ${analysis.error}` : `Imagem analisada com sucesso`;
          break;

        case 'reminder_agent':
          // Aqui você precisará implementar a lógica para reminders
          toolResultContent = `Funcionalidade de lembrete processada: ${args.query}`;
          break;

        case 'lottery_check_agent':
          const lotteryResult = await lotteryCheck(args.query);
          toolResultContent = `Resultado da loteria verificado: ${args.query}`;
          break;

        case 'audio_generation_agent':
          const audio = await generateAudio(args.query);
          if (audio && !audio.error) {
            await sendPtt(from, audio);
            toolResultContent = `Áudio gerado e enviado: "${args.query}"`;
          } else {
            toolResultContent = `Erro ao gerar áudio: ${audio?.error || 'Erro desconhecido'}`;
          }
          break;

        case 'information_retrieval_agent':
          const searchResult = await webSearch(args.query);
          toolResultContent = `Busca realizada: ${searchResult}`;
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

    // Coletar resposta da ferramenta
    const toolResponse = {
      role: 'tool',
      tool_call_id: toolCall.id,
      // NÃO incluir 'name' para evitar problemas com sanitizeMessages
      content: toolResultContent,
    };
    
    // CRÍTICO: Garantir que já temos o tool_call_id correto para evitar problemas no sanitizeMessages
    if (!toolResponse.tool_call_id) {
      console.error(`[ToolCall] ⚠️ ERRO: tool_call_id ausente para ${toolCall.id}`);
      toolResponse.tool_call_id = toolCall.id;
    }
    
    toolResponses.push(toolResponse);
    console.log(`[ToolCall] ✅ Resposta coletada para ${toolCall.id}: ${toolName} (original) -> ${actualToolName} (executado)`);
  }

  // Adicionar todas as respostas das ferramentas ao array de mensagens
  newMessages.push(...toolResponses);

  // Validação final para debug
  const toolCallIds = response.message.tool_calls.map(tc => tc.id);
  const toolResponseIds = toolResponses.map(tr => tr.tool_call_id);
  
  console.log(`[ToolCall] 📊 Debug - Tool call IDs esperados: ${toolCallIds.join(', ')}`);
  console.log(`[ToolCall] 📊 Debug - Tool response IDs encontrados: ${toolResponseIds.join(', ')}`);
  
  const missingResponses = toolCallIds.filter(id => !toolResponseIds.includes(id));
  if (missingResponses.length > 0) {
    console.error(`[ToolCall] ⚠️ ERRO CRÍTICO: Tool calls sem resposta detectadas: ${missingResponses.join(', ')}`);
    // Isso não deveria acontecer mais, mas vamos adicionar como fallback
    for (const missingId of missingResponses) {
      const fallbackResponse = {
        role: 'tool',
        tool_call_id: missingId,
        content: 'Erro: ferramenta não encontrada ou falhou ao executar.',
      };
      toolResponses.push(fallbackResponse);
      newMessages.push(fallbackResponse);
      console.log(`[ToolCall] 🆘 Fallback: Adicionada resposta de erro para ${missingId}`);
    }
  }

  console.log(`[ToolCall] 🔄 Enviando todos os resultados das ferramentas para a IA...`);
  console.log(`[ToolCall] 📊 Total de mensagens a enviar: ${newMessages.length}`);
  
  // Log detalhado das mensagens para debug
  console.log(`[ToolCall] 📋 Estrutura das mensagens a enviar:`);
  newMessages.forEach((msg, index) => {
    if (msg.role === 'tool') {
      console.log(`  [${index}] ${msg.role}: tool_call_id=${msg.tool_call_id}, name=${msg.name}`);
    } else if (msg.role === 'assistant' && msg.tool_calls) {
      console.log(`  [${index}] ${msg.role}: ${msg.tool_calls.length} tool_calls`);
      msg.tool_calls.forEach((tc, tcIndex) => {
        console.log(`    [${tcIndex}] ${tc.id}: ${tc.function.name}`);
      });
    } else {
      console.log(`  [${index}] ${msg.role}: ${msg.content ? msg.content.substring(0, 50) + '...' : 'sem conteúdo'}`);
    }
  });
  
  // Log JSON completo para debug
  console.log(`[ToolCall] 🔍 JSON das mensagens que serão enviadas:`);
  console.log(JSON.stringify(newMessages, null, 2));
  
  // CRÍTICO: Sanitizar mensagens antes de enviar para evitar tool_calls órfãs
  const sanitizedToolMessages = sanitizeMessagesForChat(newMessages);
  console.log(`[ToolCall] 🧹 Mensagens sanitizadas para tool call: ${newMessages.length} -> ${sanitizedToolMessages.length}`);
  
  // Modificar o toolsParam para undefined para permitir resposta livre (sem tool_choice="required")
  const newResponse = await chatAi(sanitizedToolMessages, undefined);
  const normalizedNewResponse = normalizeAiResponse(newResponse);
  newMessages.push(normalizedNewResponse.message);

  if (normalizedNewResponse.message.tool_calls && normalizedNewResponse.message.tool_calls.length > 0) {
    console.log(`[ToolCall] 🔁 Ferramentas adicionais detectadas, mas ignorando para evitar loop infinito`);
    console.log(`[ToolCall] ⚠️ A IA quer executar mais ferramentas, mas vamos parar aqui para evitar recursão infinita`);
    // Não executar recursivamente - apenas retornar as mensagens atuais
  }

  console.log(`[ToolCall] ✅ Execução de ferramentas e ciclo de IA concluídos. Tempo total: ${Date.now() - toolStartTime}ms`);
  return newMessages;
}