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
  const skip = new Set(); // Índices de mensagens a pular
  
  console.log(`[Sanitize] 🧹 Iniciando sanitização de ${messages.length} mensagens...`);
  
  // Primeiro passo: identificar todas as mensagens assistant órfãs e suas tool responses
  for (let i = 0; i < messages.length; i++) {
    if (skip.has(i)) continue;
    
    const message = messages[i];
    
    // Se for uma mensagem assistant com tool_calls, verificar se todas as tool responses estão presentes
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      const foundToolCallIds = new Set();
      const toolResponseIndices = [];
      
      // Buscar por todas as tool responses correspondentes em TODA a conversa (não apenas consecutivas)
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        if (nextMsg.role === 'tool' && toolCallIds.includes(nextMsg.tool_call_id)) {
          foundToolCallIds.add(nextMsg.tool_call_id);
          toolResponseIndices.push(j);
        }
      }
      
      // Se não encontrou todas as tool responses, marcar para remoção
      if (foundToolCallIds.size !== toolCallIds.length) {
        const missingIds = toolCallIds.filter(id => !foundToolCallIds.has(id));
        console.log(`[Sanitize] ⚠️ Removendo mensagem assistant órfã (índice ${i}) com tool_calls incompletas:`);
        console.log(`[Sanitize]    - Tool calls esperados: [${toolCallIds.join(', ')}]`);
        console.log(`[Sanitize]    - Tool calls encontrados: [${Array.from(foundToolCallIds).join(', ')}]`);
        console.log(`[Sanitize]    - Tool calls órfãos: [${missingIds.join(', ')}]`);
        
        // Marcar a mensagem assistant para remoção
        skip.add(i);
        
        // Marcar as tool responses encontradas para remoção também (para manter consistência)
        toolResponseIndices.forEach(idx => skip.add(idx));
      }
    }
    
    // Remover mensagens assistant vazias (sem content e sem tool_calls)
    if (message.role === 'assistant' && !message.content && (!message.tool_calls || message.tool_calls.length === 0)) {
      console.log(`[Sanitize] 🗑️ Removendo mensagem assistant vazia (índice ${i})`);
      skip.add(i);
    }
    
    // Remover mensagens tool órfãs (tool responses sem assistant correspondente)
    if (message.role === 'tool' && message.tool_call_id) {
      let foundCorrespondingAssistant = false;
      for (let k = 0; k < i; k++) {
        const prevMsg = messages[k];
        if (prevMsg.role === 'assistant' && prevMsg.tool_calls) {
          const toolCallIds = prevMsg.tool_calls.map(tc => tc.id);
          if (toolCallIds.includes(message.tool_call_id)) {
            foundCorrespondingAssistant = true;
            break;
          }
        }
      }
      
      if (!foundCorrespondingAssistant) {
        console.log(`[Sanitize] 🗑️ Removendo mensagem tool órfã (índice ${i}) com tool_call_id: ${message.tool_call_id}`);
        skip.add(i);
      }
    }
  }
  
  // Segundo passo: construir array limpo pulando as mensagens marcadas
  for (let i = 0; i < messages.length; i++) {
    if (!skip.has(i)) {
      cleanMessages.push(messages[i]);
    }
  }
  
  console.log(`[Sanitize] 🧹 Mensagens sanitizadas: ${messages.length} -> ${cleanMessages.length}`);
  if (skip.size > 0) {
    console.log(`[Sanitize] 🗑️ Índices removidos: [${Array.from(skip).sort((a, b) => a - b).join(', ')}]`);
  }
  
  return cleanMessages;
}

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um assistente de IA amigável e conciso. Sua principal forma de comunicação com o usuário é através da função 'send_message'.

**REGRAS CRÍTICAS PARA COMUNICAÇÃO:**
1. **SEMPRE USE 'send_message':** Para qualquer texto que você queira enviar ao usuário, você DEVE OBRIGATORIAMENTE usar a função 'send_message'. NUNCA responda diretamente com texto no campo 'content' da sua resposta principal.

2. **UMA MENSAGEM POR RESPOSTA:** Para conversas NORMAIS (saudações, perguntas simples, conversas casuais), use APENAS UMA função 'send_message' por resposta. Seja conciso e direto.

3. **MÚLTIPLAS MENSAGENS APENAS QUANDO SOLICITADO:** 
   - SOMENTE faça múltiplas chamadas de 'send_message' quando o usuário EXPLICITAMENTE solicitar (ex: "envie 5 piadas", "faça 3 sugestões", "divida em 2 mensagens").
   - Para saudações simples como "Olá", "Oi", "Como está?", responda com UMA ÚNICA mensagem amigável.

4. **NÃO RESPONDA DIRETAMENTE:** Se você tiver uma resposta para o usuário, mas não usar 'send_message', sua resposta NÃO SERÁ ENTREGUE. Isso é um erro crítico.

5. **EXECUÇÃO SEQUENCIAL:** Quando o usuário pedir múltiplas ações DIFERENTES (ex: "gere uma imagem, depois envie uma mensagem"), execute UMA ferramenta por vez.

**EXEMPLOS DE USO CORRETO:**
- Usuário: "Olá" → Resposta: UMA mensagem de saudação
- Usuário: "Como você está?" → Resposta: UMA mensagem sobre como está
- Usuário: "Me conte 3 piadas" → Resposta: TRÊS mensagens com piadas
- Usuário: "Explique algo" → Resposta: UMA mensagem explicativa (mesmo que longa)

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

    // --- Sequential AI Analysis ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🚀 Iniciando análises de IA sequencialmente... - ${new Date().toISOString()}`);
    simulateTyping(data.from, true);

    console.log(`[ProcessMessage] 📊 Analisando sentimento... - ${new Date().toISOString()}`);
    const currentSentiment = await analyzeSentiment(userContent);
    
    console.log(`[ProcessMessage] 🎨 Inferindo estilo de interação... - ${new Date().toISOString()}`);
    const inferredStyle = await inferInteractionStyle(userContent);

    const chatMessages = [SYSTEM_PROMPT, dynamicPrompt, ...messages, { role: 'user', content: userContent }];
    
    // ANTI-SPAM: Adicionar prompt específico para prevenir múltiplas mensagens desnecessárias
    const antiSpamPrompt = {
      role: 'system',
      content: `CRÍTICO ANTI-SPAM: Esta é sua PRIMEIRA resposta para "${userContent}". 

REGRA ABSOLUTA: Para saudações simples como "Olá", "Oi", "Como está?" → Responda com APENAS UMA função 'send_message' contendo uma resposta amigável e completa.

EXEMPLO CORRETO para "Oi":
- ✅ UMA chamada: send_message("Oi! Tudo bem? Como posso ajudar você hoje? 😊")

EXEMPLO INCORRETO (SPAM):
- ❌ MÚLTIPLAS chamadas: send_message("Oi!") + send_message("Como está?") + send_message("Posso ajudar?")

MÚLTIPLAS MENSAGENS SÃO PERMITIDAS APENAS se o usuário EXPLICITAMENTE solicitar (ex: "envie 3 piadas", "faça 2 sugestões").

Seja natural, amigável e conciso em UMA ÚNICA mensagem.`
    };
    
    chatMessages.push(antiSpamPrompt);
    
    // CRÍTICO: Sanitizar mensagens antes de enviar para evitar tool_calls órfãs
    const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
    console.log(`[ProcessMessage] 💬 Gerando resposta principal... - ${new Date().toISOString()}`);
    let response = await chatAi(sanitizedChatMessages);

    console.log(`[ProcessMessage] ✅ Análises de IA concluídas (+${Date.now() - stepTime}ms)`);

    // --- Process AI Response ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] � Normalizando resposta da IA... - ${new Date().toISOString()}`);
    response = normalizeAiResponse(response);
    
    // VERIFICAÇÃO CRÍTICA ANTI-SPAM: Bloquear múltiplas send_message na primeira resposta
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      const sendMessageCalls = response.message.tool_calls.filter(tc => tc.function.name === 'send_message');
      if (sendMessageCalls.length > 1) {
        const userRequestedMultiple = isMultipleMessagesRequested(userContent);
        
        if (!userRequestedMultiple) {
          console.log(`[ProcessMessage] 🚨 BLOQUEANDO SPAM NA PRIMEIRA RESPOSTA: ${sendMessageCalls.length} send_message calls para "${userContent}"`);
          console.log(`[ProcessMessage] 🛡️ Mantendo apenas a primeira mensagem para evitar spam.`);
          
          // Manter apenas a primeira send_message call
          const keptToolCalls = [sendMessageCalls[0]];
          const otherToolCalls = response.message.tool_calls.filter(tc => tc.function.name !== 'send_message');
          
          response.message.tool_calls = [...keptToolCalls, ...otherToolCalls];
        } else {
          console.log(`[ProcessMessage] ✅ Múltiplas mensagens autorizadas pelo usuário: "${userContent}"`);
        }
      }
    }
    
    console.log(`[ProcessMessage] ✅ Resposta normalizada e verificada (+${Date.now() - stepTime}ms)`);

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

// Função para detectar se o usuário solicitou explicitamente múltiplas mensagens
function isMultipleMessagesRequested(userContent) {
  const content = userContent.toLowerCase().trim();
  
  // BLOQUEIO: Saudações simples NUNCA devem ser consideradas solicitações múltiplas
  const simpleGreetings = [
    /^(oi|olá|ola|hello|hi|hey|bom dia|boa tarde|boa noite|e aí|eai|iae)\.?!?$/,
    /^(como (você )?está\??)\.?!?$/,
    /^(tudo (bem|bom)\??)\.?!?$/,
    /^(beleza\??)\.?!?$/,
  ];
  
  // Se for uma saudação simples, NUNCA permitir múltiplas mensagens
  if (simpleGreetings.some(pattern => pattern.test(content))) {
    console.log(`[MultipleMessages] 🚫 SAUDAÇÃO SIMPLES DETECTADA: "${userContent}" - BLOQUEANDO múltiplas mensagens`);
    return false;
  }
  
  // Padrões que indicam solicitação explícita de múltiplas mensagens
  const explicitPatterns = [
    // Números específicos - deve ser muito explícito
    /\b(\d+)\s*(mensagens?|piadas?|historias?|histórias?|exemplos?|sugestões?|dicas?|frases?)\b/,
    /envie?\s*(\d+)\s*(mensagens?|piadas?|historias?|histórias?|exemplos?|sugestões?|dicas?)/,
    /mande?\s*(\d+)\s*(mensagens?|piadas?|historias?|histórias?|exemplos?|sugestões?|dicas?)/,
    /faça?\s*(\d+)\s*(mensagens?|piadas?|historias?|histórias?|exemplos?|sugestões?|dicas?)/,
    /crie?\s*(\d+)\s*(mensagens?|piadas?|historias?|histórias?|exemplos?|sugestões?|dicas?)/,
    
    // Palavras que indicam múltiplas - deve incluir o tipo de conteúdo
    /\b(várias|varias|multiplas|múltiplas|algumas|muitas)\s*(mensagens?|piadas?|historias?|histórias?|exemplos?|sugestões?|dicas?)\b/,
    
    // Padrões específicos comuns
    /em\s*(\d+)\s*mensagens?\s*(separadas?|diferentes?)?/,
    /divida?\s*(em|por)\s*(\d+)\s*(mensagens?|partes?)/,
    /separe?\s*(em|por)\s*(\d+)\s*(mensagens?|partes?)/,
    /quebr[ae]\s*(em|por)\s*(\d+)\s*(mensagens?|partes?)/,
    
    // Solicitações sequenciais explícitas mais específicas
    /primeiro.*depois.*depois/,
    /uma.*outra.*outra/,
    /\buma\s*de\s*cada\s*vez\b/,
    
    // Comandos explícitos para múltiplas respostas
    /me\s*(conte|envie|mande)\s*(\d+)/,
    /quero\s*(\d+)/,
    /preciso\s*de\s*(\d+)/,
  ];
  
  // Verificar se algum padrão foi encontrado
  const hasExplicitRequest = explicitPatterns.some(pattern => pattern.test(content));
  
  if (hasExplicitRequest) {
    console.log(`[MultipleMessages] ✅ Detectada solicitação explícita de múltiplas mensagens em: "${userContent}"`);
    return true;
  }
  
  console.log(`[MultipleMessages] ❌ Não detectada solicitação explícita de múltiplas mensagens em: "${userContent}"`);
  return false;
}

async function toolCall(messages, response, tools, from, id, userContent, recursiveState = null) {
  // Se não há estado recursivo, criar um novo
  if (!recursiveState) {
    recursiveState = {
      startTime: Date.now(),
      depth: 0
    };
  }
  
  const toolStartTime = recursiveState.startTime;
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

  console.log(`[ToolCall] 📋 Executando ${response.message.tool_calls.length} ferramenta(s). Processando UMA por vez para manter sequência natural...`);

  // ESTRATÉGIA: Processar apenas a PRIMEIRA tool_call para manter o fluxo conversacional natural
  // Se há múltiplas tool_calls, processa só a primeira e deixa a IA decidir o próximo passo
  let toolCallsToProcess = response.message.tool_calls.slice(0, 1); // Apenas a primeira
  const totalToolCalls = response.message.tool_calls.length;
  
  // DETECÇÃO ESPECIAL: Se há múltiplas chamadas de send_message, verificar se é spam ou solicitação legítima
  const sendMessageCalls = response.message.tool_calls.filter(tc => tc.function.name === 'send_message');
  if (sendMessageCalls.length > 1) {
    // Analisar se o usuário solicitou explicitamente múltiplas mensagens
    const userRequestedMultipleMessages = isMultipleMessagesRequested(userContent);
    
    if (userRequestedMultipleMessages) {
      console.log(`[ToolCall] ✅ MÚLTIPLAS MENSAGENS LEGÍTIMAS: Usuário solicitou explicitamente ${sendMessageCalls.length} mensagens. Processando todas.`);
      toolCallsToProcess = sendMessageCalls; // Processar todas as send_message calls
    } else {
      // BLOQUEIO RIGOROSO: Para primeira resposta, se não há solicitação explícita, é SEMPRE spam
      const isFirstResponse = recursiveState.depth === 0;
      if (isFirstResponse) {
        console.log(`[ToolCall] 🚨 PRIMEIRA RESPOSTA COM SPAM DETECTADO: ${sendMessageCalls.length} send_message calls para "${userContent}" - isso é SPAM! Processando apenas a primeira.`);
        console.log(`[ToolCall] 🛡️ Sistema anti-spam bloqueou múltiplas mensagens não solicitadas na primeira resposta.`);
      } else {
        console.log(`[ToolCall] 🚨 DETECTADAS ${sendMessageCalls.length} chamadas de send_message - isso é SPAM! Processando apenas a primeira.`);
      }
      toolCallsToProcess = [sendMessageCalls[0]]; // Apenas a primeira send_message
    }
  }
  
  if (totalToolCalls > 1) {
    console.log(`[ToolCall] ⚠️ DETECTADAS ${totalToolCalls} tool_calls. Processando apenas a primeira para manter fluxo sequencial.`);
    console.log(`[ToolCall] 💡 A IA poderá continuar com as demais tool_calls na próxima resposta.`);
  }

  // Coletar todas as respostas das ferramentas primeiro
  const toolResponses = [];
  
  for (const toolCall of toolCallsToProcess) {
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
          toolResultContent = `Busca realizada: ${args.query}`;
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

  // IMPORTANTE: Modificar a mensagem assistant original para conter apenas a tool_call processada
  // Isso evita problemas de tool_calls órfãs para as tool_calls que não foram processadas ainda
  const modifiedAssistantMessage = {
    ...response.message,
    tool_calls: toolCallsToProcess // Apenas as tool_calls que foram realmente processadas
  };
  
  // Substituir a mensagem assistant original pela versão modificada
  newMessages[newMessages.length - toolResponses.length - 1] = modifiedAssistantMessage;

  // Validação final para debug
  const originalToolCallIds = response.message.tool_calls.map(tc => tc.id);
  const processedToolCallIds = toolCallsToProcess.map(tc => tc.id);
  const toolResponseIds = toolResponses.map(tr => tr.tool_call_id);
  
  console.log(`[ToolCall] 📊 Debug - Tool call IDs originais: ${originalToolCallIds.join(', ')}`);
  console.log(`[ToolCall] 📊 Debug - Tool call IDs processados: ${processedToolCallIds.join(', ')}`);
  console.log(`[ToolCall] 📊 Debug - Tool response IDs encontrados: ${toolResponseIds.join(', ')}`);
  
  if (totalToolCalls > 1) {
    const remainingToolCallIds = response.message.tool_calls.slice(1).map(tc => tc.id);
    console.log(`[ToolCall] 📊 Debug - Tool call IDs restantes (para próxima iteração): ${remainingToolCallIds.join(', ')}`);
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
  
  // ORIENTAÇÃO ANTI-SPAM: Adicionar um prompt específico para orientar a IA sobre não fazer spam
  if (recursiveState.depth > 0) {
    const antiSpamPrompt = {
      role: 'system',
      content: `IMPORTANTE: Você acabou de executar uma ferramenta. Se você quiser se comunicar com o usuário agora, use APENAS UMA chamada de 'send_message'. NÃO faça múltiplas chamadas de send_message de uma só vez - isso é considerado spam. Seja conciso e natural em suas respostas.`
    };
    sanitizedToolMessages.splice(-2, 0, antiSpamPrompt); // Inserir antes da última mensagem assistant
  }
  
  // ESTRATÉGIA MELHORADA: Permitir que a IA continue processando tool_calls, mas UMA por vez
  // Isso permite fluxos como: imagem -> mensagem -> imagem -> mensagem
  const newResponse = await chatAi(sanitizedToolMessages, undefined);
  const normalizedNewResponse = normalizeAiResponse(newResponse);
  newMessages.push(normalizedNewResponse.message);

  if (normalizedNewResponse.message.tool_calls && normalizedNewResponse.message.tool_calls.length > 0) {
    console.log(`[ToolCall] 🔁 IA quer executar ${normalizedNewResponse.message.tool_calls.length} ferramenta(s) adicional(is)`);
    
    // VERIFICAÇÃO ANTI-SPAM: Se a IA quer fazer múltiplas send_message calls, isso é spam
    const newSendMessageCalls = normalizedNewResponse.message.tool_calls.filter(tc => tc.function.name === 'send_message');
    if (newSendMessageCalls.length > 1) {
      console.log(`[ToolCall] 🚨 IA TENTANDO FAZER SPAM: ${newSendMessageCalls.length} send_message calls detectadas. PARANDO para evitar spam.`);
      console.log(`[ToolCall] � Sistema bloqueou múltiplas mensagens sequenciais para manter conversa natural.`);
      
      // Não continuar recursão para evitar spam
      console.log(`[ToolCall] ✅ Execução de ferramentas concluída. Tempo total: ${Date.now() - toolStartTime}ms`);
      return newMessages;
    }
    
    // IMPORTANTE: Limitar a profundidade para evitar loops infinitos
    const MAX_RECURSIVE_CALLS = 5; // Máximo de 5 iterações
    
    recursiveState.depth++;
    
    if (recursiveState.depth <= MAX_RECURSIVE_CALLS) {
      console.log(`[ToolCall] 🔄 Continuando execução recursiva (profundidade ${recursiveState.depth}/${MAX_RECURSIVE_CALLS})`);
      // Recursivamente processar mais tool_calls, mas uma por vez
      return await toolCall(newMessages, normalizedNewResponse, tools, from, id, userContent, recursiveState);
    } else {
      console.log(`[ToolCall] ⚠️ Limite de recursão atingido (${MAX_RECURSIVE_CALLS}). Parando para evitar loop infinito.`);
    }
  }

  console.log(`[ToolCall] ✅ Execução de ferramentas e ciclo de IA concluídos. Tempo total: ${Date.now() - toolStartTime}ms`);
  return newMessages;
}