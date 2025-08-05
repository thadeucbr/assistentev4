import LtmService from '../services/LtmService.js';
import sendImage from '../whatsapp/sendImage.js';
import { embeddingModel, chatModel } from '../lib/langchain.js'; // Importar embeddingModel e chatModel
import { normalizeAiResponse } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js'; // Importar o novo sistema de logging

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
import calendar from './calendar.js';
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
        logger.debug('Sanitize', `Mensagem assistant com tool_calls incompletas será removida: esperado ${toolCallIds.length}, encontrado ${toolResponsesMap.size}`);
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
        logger.debug('Sanitize', `Removendo mensagem assistant órfã com tool_calls: ${toolCallIds.join(', ')}`, message);
      }
    } else if (message.role === 'assistant') {
      // Para mensagens assistant sem tool_calls, verificar se têm conteúdo válido
      if (message.content && message.content.trim().length > 0) {
        cleanMessages.push(message);
      } else {
        logger.debug('Sanitize', 'Removendo mensagem assistant vazia ou sem conteúdo', message);
      }
    } else if (message.role === 'tool') {
      // Só incluir tool messages que correspondem a tool_calls válidos
      if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
        cleanMessages.push(message);
      } else {
        logger.debug('Sanitize', `Removendo mensagem tool órfã: tool_call_id=${message.tool_call_id}`, message);
      }
    } else {
      // Para outras mensagens (user, system, assistant sem tool_calls), sempre incluir
      cleanMessages.push(message);
    }
  }
  
  logger.debug('Sanitize', `Mensagens sanitizadas: ${messages.length} -> ${cleanMessages.length}`);
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
  // Gerar ID único para esta mensagem
  const messageId = logger.generateMessageId();
  
  const startTime = Date.now();
  logger.start('ProcessMessage', 'Iniciando processamento da mensagem');
  
  const { data } = message;
  const isGroup = groups.includes(data?.chatId);
  if (
    (isGroup &&
      (data?.mentionedJidList?.includes(process.env.WHATSAPP_NUMBER) ||
        data?.quotedMsgObj?.author === process.env.WHATSAPP_NUMBER)) ||
    !isGroup
  ) {
    let stepTime = Date.now();
    logger.milestone('ProcessMessage', 'Mensagem autorizada para processamento');
    
    // Feedback imediato: simular digitação no início para mostrar que o bot está "vivo"
    simulateTyping(data.from, true); // Não aguardar - executar em background
    
    const userContent = (data.body || (data.type === 'image' ? 'Analyze this image' : ''))
      .replace(process.env.WHATSAPP_NUMBER, '')
      .trim();
    const userId = data.from.replace('@c.us', '');
    
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Carregando contexto do usuário...');
    let { messages } = await getUserContext(userId); // This 'messages' is our STM
    logger.timing('ProcessMessage', 'Contexto carregado');
    
    // CRÍTICO: Sanitizar contexto histórico para remover mensagens órfãs corrompidas
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Sanitizando contexto histórico...');
    messages = sanitizeMessagesForChat(messages);
    logger.timing('ProcessMessage', 'Contexto histórico sanitizado');
    
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Carregando perfil do usuário...');
    const userProfile = await getUserProfile(userId);
    logger.timing('ProcessMessage', 'Perfil carregado');
    
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Buscando contexto relevante na LTM...');
    const ltmContext = await LtmService.getRelevantContext(userId, userContent);
    logger.timing('ProcessMessage', 'Contexto LTM obtido');

    // --- STM Management: Reranking and Summarization ---
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Gerenciando memória de curto prazo (STM)...');
    let currentSTM = [...messages]; // Create a copy to work with

    const hotMessages = currentSTM.slice(-SUMMARIZE_THRESHOLD);
    const warmMessages = currentSTM.slice(0, currentSTM.length - SUMMARIZE_THRESHOLD);

    if (warmMessages.length > 0 && currentSTM.length >= MAX_STM_MESSAGES) {
      logger.info('ProcessMessage', 'Aplicando reranking e sumarização da STM...');
      
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
        logger.debug('ProcessMessage', 'Sumarizando mensagens antigas para LTM...');
        const summaryContent = messagesToSummarize.map(m => m.content).join('\n');
        const summaryResponse = await chatModel.invoke([
          { role: 'system', content: 'Resuma o seguinte trecho de conversa de forma concisa, focando nos fatos e informações importantes.' },
          { role: 'user', content: summaryContent }
        ]);
        LtmService.summarizeAndStore(userId, summaryResponse.content)
            .catch(err => logger.error('ProcessMessage', `Erro ao sumarizar para LTM em background: ${err}`));
      }

      messages = [...hotMessages, ...keptWarmMessages.map(m => ({ role: m.role, content: m.content }))];
      
      await stmTypingPromise;

    } else if (currentSTM.length > MAX_STM_MESSAGES) {
      logger.debug('ProcessMessage', 'Truncando STM por janela deslizante...');
      messages = currentSTM.slice(-MAX_STM_MESSAGES);
    }
    logger.timing('ProcessMessage', 'Gerenciamento STM concluído');

    // Constrói o prompt dinâmico
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Construindo prompt dinâmico...');
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
    logger.timing('ProcessMessage', 'Prompt dinâmico construído');

    // --- Sequential AI Analysis ---
    stepTime = Date.now();
    logger.info('ProcessMessage', 'Iniciando análises de IA sequencialmente...');
    simulateTyping(data.from, true);

    logger.debug('ProcessMessage', 'Analisando sentimento...');
    const currentSentiment = await analyzeSentiment(userContent);
    
    logger.debug('ProcessMessage', 'Inferindo estilo de interação...');
    const inferredStyle = await inferInteractionStyle(userContent);

    const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
    
    // CRÍTICO: Sanitizar mensagens antes de enviar para evitar tool_calls órfãs
    const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
    logger.debug('ProcessMessage', 'Gerando resposta principal...');
    let response = await chatAi(sanitizedChatMessages);

    logger.timing('ProcessMessage', 'Análises de IA concluídas');

    // Update user profile with the latest sentiment and style (quick, synchronous update)
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Atualizando perfil do usuário (sentimento/estilo)...');
    const updatedProfile = {
      ...userProfile,
      sentiment: { average: currentSentiment, trend: 'stable' },
      interaction_style: inferredStyle
    };
    await updateUserProfile(userId, updatedProfile);
    logger.timing('ProcessMessage', 'Perfil (sentimento/estilo) atualizado');

    // --- Process AI Response ---
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Normalizando resposta da IA...');
    response = normalizeAiResponse(response);
    logger.timing('ProcessMessage', 'Resposta normalizada');

    messages.push({ role: 'user', content: userContent });
    messages.push(response.message);

    // Forçar ciclo até receber uma resposta send_message ou atingir limite de tentativas
    let toolCycleCount = 0;
    const MAX_TOOL_CYCLES = 3;
    let lastResponse = response.message;
    while (toolCycleCount < MAX_TOOL_CYCLES) {
      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        stepTime = Date.now();
        logger.debug('ProcessMessage', 'Executando ferramentas...');
        messages = await toolCall(messages, { message: lastResponse }, tools, data.from, data.id, userContent);
        logger.timing('ProcessMessage', 'Ferramentas executadas');
        // Buscar a última mensagem assistant gerada
        const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
        if (lastAssistantMsg) {
          lastResponse = lastAssistantMsg;
        } else {
          break;
        }
        // Se a última resposta assistant contém send_message, encerra ciclo
        if (lastResponse.tool_calls && lastResponse.tool_calls.some(tc => tc.function.name === 'send_message')) {
          logger.debug('ProcessMessage', 'Send_message detectado na última resposta - encerrando ciclo de ferramentas');
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
          logger.debug('ProcessMessage', `Fallback: Adicionada resposta de erro para tool_call_id=${toolCall.id}`);
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
      logger.warn('ProcessMessage', 'Fallback final: Solicitando à LLM uma mensagem amigável de erro.');
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
      logger.info('ProcessMessage', 'Fallback final: Mensagem de erro amigável enviada ao usuário.');
    }
    
    // --- Final Asynchronous Updates ---
    stepTime = Date.now();
    logger.debug('ProcessMessage', 'Atualizando contexto e iniciando atualizações em background...');
    
    await updateUserContext(userId, { messages });

    LtmService.summarizeAndStore(userId, messages.map((m) => m.content).join('\n'))
        .catch(err => logger.error('ProcessMessage', `Erro ao armazenar na LTM em background: ${err}`));

    updateUserProfileSummary(userId, messages)
      .catch(err => logger.error('ProcessMessage', `Erro ao atualizar resumo do perfil em background: ${err}`));
      
    logger.timing('ProcessMessage', 'Atualizações síncronas concluídas e assíncronas iniciadas');
    
    logger.end('ProcessMessage', `Processamento da mensagem concluído - TEMPO TOTAL: ${Date.now() - startTime}ms`);
  }
}

async function toolCall(messages, response, tools, from, id, userContent) {
  const toolStartTime = Date.now();
  logger.debug('ToolCall', 'Iniciando execução de ferramentas...');
  let newMessages = [...messages];

  if (response.message.function_call) {
    logger.debug('ToolCall', 'Convertendo function_call legado para tool_calls...');
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
    logger.warn('ToolCall', 'Nenhuma ferramenta para executar.');
    return messages;
  }

  logger.debug('ToolCall', `Executando ${response.message.tool_calls.length} ferramenta(s) sequencialmente...`);

  // Coletar todas as respostas das ferramentas primeiro
  const toolResponses = [];
  
  for (const toolCall of response.message.tool_calls) {
    const toolName = toolCall.function.name;
    let toolResultContent = '';
    let actualToolName = toolName;

    logger.debug('ToolCall', `Processando tool_call: ${toolCall.id} - ${toolName}`);

    try {
      const args = JSON.parse(toolCall.function.arguments);

      // Normalizar nomes de ferramentas com erros de digitação
      if (toolName === 'ssend_message') {
        actualToolName = 'send_message';
        logger.warn('ToolCall', `Corrigindo nome da ferramenta de '${toolName}' para '${actualToolName}'`);
      }

      switch (actualToolName) {
        case 'image_generation_agent':
          const image = await generateImage({ ...args });
          toolResultContent = image.error ? `Erro ao gerar imagem: ${image.error}` : `Image generated and sent: "${args.prompt}"`;
          if (!image.error) await sendImage(from, image, args.prompt);
          break;

        case 'send_message':
          await sendMessage(from, args.content, id);
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
            await sendPtt(from, audio.audioBuffer);
            toolResultContent = `Áudio gerado e enviado: "${args.query}"`;
          } else {
            toolResultContent = `Erro ao gerar áudio: ${audio?.error || 'Erro desconhecido'}`;
          }
          break;

        case 'information_retrieval_agent':
          const searchResult = await webSearch(args.query);
          if (searchResult.error) {
            toolResultContent = `Erro na busca web: ${searchResult.error}`;
            if (searchResult.hybridError && searchResult.fallbackError) {
              toolResultContent += `\nDetalhes - Híbrida: ${searchResult.hybridError}, Fallback: ${searchResult.fallbackError}`;
            }
          } else if (searchResult.success) {
            const methodLabels = {
              'simplified-playwright': '(Busca Avançada com Playwright)',
              'fallback-direct': '(Busca Direta)',
              'fallback-after-failure': '(Busca Robusta após falha)',
              'last-resort-fallback': '(Último Recurso)',
              'hybrid': '(Busca Híbrida)'
            };
            
            const methodInfo = methodLabels[searchResult.method] || `(${searchResult.method})`;
            if (searchResult.usedEngine) {
              methodInfo = methodInfo.replace(')', ` via ${searchResult.usedEngine})`);
            }
            
            toolResultContent = `Busca web concluída com sucesso para "${args.query}" ${methodInfo}.

RESULTADO ENCONTRADO:
${searchResult.result}

FONTES CONSULTADAS:
${searchResult.sources && searchResult.sources.length > 0 ? 
  searchResult.sources.map((url, index) => `${index + 1}. ${url}`).join('\n') : 
  'Nenhuma fonte específica listada'}

Esta informação foi obtida através de busca web automatizada${searchResult.method.includes('playwright') ? ' com navegação inteligente' : ''}.`;
          } else {
            toolResultContent = `Busca realizada para "${args.query}", mas formato de resposta inesperado: ${JSON.stringify(searchResult)}`;
          }
          break;

        case 'calendar_agent':
          const calendarResult = await calendar({ userId: from, query: args.query });
          if (calendarResult.success) {
            toolResultContent = `Solicitação de calendário processada com sucesso: ${calendarResult.message}`;
          } else {
            toolResultContent = `Erro ao processar solicitação de calendário: ${calendarResult.message || calendarResult.error}`;
          }
          break;

        default:
          logger.warn('ToolCall', `Ferramenta desconhecida encontrada: ${toolName}`);
          toolResultContent = `Ferramenta desconhecida: ${toolName}`;
          break;
      }
    } catch (error) {
      logger.error('ToolCall', `Erro ao executar ou analisar argumentos para a ferramenta ${toolName}:`, error);
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
      logger.error('ToolCall', `ERRO: tool_call_id ausente para ${toolCall.id}`);
      toolResponse.tool_call_id = toolCall.id;
    }
    
    toolResponses.push(toolResponse);
    logger.debug('ToolCall', `Resposta coletada para ${toolCall.id}: ${toolName} (original) -> ${actualToolName} (executado)`);
  }

  // Adicionar todas as respostas das ferramentas ao array de mensagens
  newMessages.push(...toolResponses);

  // Validação final para debug
  const toolCallIds = response.message.tool_calls.map(tc => tc.id);
  const toolResponseIds = toolResponses.map(tr => tr.tool_call_id);
  
  logger.debug('ToolCall', `Debug - Tool call IDs esperados: ${toolCallIds.join(', ')}`);
  logger.debug('ToolCall', `Debug - Tool response IDs encontrados: ${toolResponseIds.join(', ')}`);
  
  const missingResponses = toolCallIds.filter(id => !toolResponseIds.includes(id));
  if (missingResponses.length > 0) {
    logger.error('ToolCall', `ERRO CRÍTICO: Tool calls sem resposta detectadas: ${missingResponses.join(', ')}`);
    // Isso não deveria acontecer mais, mas vamos adicionar como fallback
    for (const missingId of missingResponses) {
      const fallbackResponse = {
        role: 'tool',
        tool_call_id: missingId,
        content: 'Erro: ferramenta não encontrada ou falhou ao executar.',
      };
      toolResponses.push(fallbackResponse);
      newMessages.push(fallbackResponse);
      logger.critical('ToolCall', `Fallback: Adicionada resposta de erro para ${missingId}`);
    }
  }

  logger.debug('ToolCall', 'Enviando todos os resultados das ferramentas para a IA...');
  logger.debug('ToolCall', `Total de mensagens a enviar: ${newMessages.length}`);
  
  // Log detalhado das mensagens para debug
  logger.debug('ToolCall', 'Estrutura das mensagens a enviar:');
  newMessages.forEach((msg, index) => {
    if (msg.role === 'tool') {
      logger.debug('ToolCall', `  [${index}] ${msg.role}: tool_call_id=${msg.tool_call_id}, name=${msg.name}`);
    } else if (msg.role === 'assistant' && msg.tool_calls) {
      logger.debug('ToolCall', `  [${index}] ${msg.role}: ${msg.tool_calls.length} tool_calls`);
      msg.tool_calls.forEach((tc, tcIndex) => {
        logger.debug('ToolCall', `    [${tcIndex}] ${tc.id}: ${tc.function.name}`);
      });
    } else {
      logger.debug('ToolCall', `  [${index}] ${msg.role}: ${msg.content ? msg.content.substring(0, 50) + '...' : 'sem conteúdo'}`);
    }
  });
  
  // Log JSON completo para debug
  logger.debug('ToolCall', 'JSON das mensagens que serão enviadas:', newMessages);
  
  // CRÍTICO: Sanitizar mensagens antes de enviar para evitar tool_calls órfãs
  const sanitizedToolMessages = sanitizeMessagesForChat(newMessages);
  logger.debug('ToolCall', `Mensagens sanitizadas para tool call: ${newMessages.length} -> ${sanitizedToolMessages.length}`);
  
  // Verificar se já executamos send_message - se sim, não chamar a IA novamente
  const alreadyExecutedSendMessage = toolResponses.some(tr => 
    tr.content && tr.content.includes('Mensagem enviada ao usuário:')
  );
  
  if (alreadyExecutedSendMessage) {
    logger.info('ToolCall', 'Send_message já executado - parando aqui para evitar duplicatas');
    logger.timing('ToolCall', `Execução de ferramentas concluída. Tempo total: ${Date.now() - toolStartTime}ms`);
    return newMessages;
  }
  
  // Modificar o toolsParam para undefined para permitir resposta livre (sem tool_choice="required")
  const newResponse = await chatAi(sanitizedToolMessages, undefined);
  const normalizedNewResponse = normalizeAiResponse(newResponse);
  newMessages.push(normalizedNewResponse.message);

  if (normalizedNewResponse.message.tool_calls && normalizedNewResponse.message.tool_calls.length > 0) {
    // Verificar se contém send_message - se sim, executar; caso contrário, ignorar para evitar loop
    const hasSendMessage = normalizedNewResponse.message.tool_calls.some(tc => tc.function.name === 'send_message');
    if (hasSendMessage) {
      logger.debug('ToolCall', 'Executando send_message da resposta da IA...');
      // Executar apenas as ferramentas send_message
      for (const toolCall of normalizedNewResponse.message.tool_calls) {
        if (toolCall.function.name === 'send_message') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            await sendMessage(from, args.content, id);
            const toolResponse = {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Mensagem enviada ao usuário: "${args.content}"`
            };
            newMessages.push(toolResponse);
            logger.info('ToolCall', `Send_message executado: ${args.content}`);
          } catch (error) {
            logger.error('ToolCall', 'Erro ao executar send_message:', error);
            const toolResponse = {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'Erro ao enviar mensagem.'
            };
            newMessages.push(toolResponse);
          }
        } else {
          // Para outras ferramentas, adicionar resposta de que foi ignorada
          const toolResponse = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Ferramenta ignorada para evitar loop infinito.'
          };
          newMessages.push(toolResponse);
        }
      }
    } else {
      logger.debug('ToolCall', 'Ferramentas adicionais detectadas, mas ignorando para evitar loop infinito');
      logger.warn('ToolCall', 'A IA quer executar mais ferramentas, mas vamos parar aqui para evitar recursão infinita');
      // Adicionar respostas tool para evitar tool_calls órfãs
      for (const toolCall of normalizedNewResponse.message.tool_calls) {
        const toolResponse = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: 'Ferramenta ignorada para evitar loop infinito.'
        };
        newMessages.push(toolResponse);
      }
    }
  }

  logger.timing('ToolCall', `Execução de ferramentas e ciclo de IA concluídos. Tempo total: ${Date.now() - toolStartTime}ms`);
  return newMessages;
}