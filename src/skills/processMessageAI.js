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

    // Mover análises para background - não bloqueiam a resposta
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🚀 Movendo análises para background... - ${new Date().toISOString()}`);
    
    // Usar perfil existente por enquanto, atualizar em background
    let currentSentiment = userProfile?.sentiment?.average || 'neutral';
    let inferredStyle = userProfile?.interaction_style || { formality: 'neutral', humor: 'moderate', tone: 'friendly', verbosity: 'balanced' };
    
    // Executar análises em background (não bloqueia)
    setImmediate(async () => {
      try {
        console.log(`[Background] 🧠 Executando análises de sentimento e estilo...`);
        const [bgSentiment, bgStyle] = await Promise.all([
          analyzeSentiment(userContent),
          inferInteractionStyle(userContent)
        ]);
        
        // Atualizar perfil com novas análises
        const updatedProfile = {
          ...userProfile,
          sentiment: {
            average: bgSentiment,
            trend: 'stable'
          },
          interaction_style: bgStyle
        };
        
        await updateUserProfile(userId, updatedProfile);
        console.log(`[Background] ✅ Análises e perfil atualizados em background`);
      } catch (error) {
        console.error(`[Background] ❌ Erro nas análises:`, error);
      }
    });
    
    console.log(`[ProcessMessage] ✅ Análises delegadas para background (+${Date.now() - stepTime}ms)`);
    console.log(`[ProcessMessage] ✅ Perfil do usuário atualizado (+${Date.now() - stepTime}ms)`);

    // --- STM Management: Simplified for Performance ---
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🧩 Gerenciando memória de curto prazo (STM)... - ${new Date().toISOString()}`);
    let currentSTM = [...messages]; // Create a copy to work with

    // Simplified STM management - just truncate if too large (much faster than reranking)
    if (currentSTM.length > MAX_STM_MESSAGES) {
      console.log(`[ProcessMessage] ✂️ Truncando STM (otimizado)... - ${new Date().toISOString()}`);
      messages = currentSTM.slice(-MAX_STM_MESSAGES);
      
      // Move complex reranking to background processing if needed
      if (currentSTM.length > MAX_STM_MESSAGES * 2) {
        setImmediate(async () => {
          console.log(`[Background] 🔄 Executando reranking complexo em background...`);
          // Complex reranking logic can be moved here for future optimization
        });
      }
    }
    console.log(`[ProcessMessage] ✅ Gerenciamento STM concluído (+${Date.now() - stepTime}ms)`);

    // Construir prompt dinâmico otimizado (menos tokens, mesma personalização)
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🛠️ Construindo prompt dinâmico... - ${new Date().toISOString()}`);
    const dynamicPrompt = {
      role: 'system',
      content: `Assistente IA com ferramentas: imagens, lembretes, loterias, web.

CRÍTICO: Use SEMPRE 'send_message' para responder. Nunca responda diretamente.

Ferramentas web: 1) 'web_search' para URLs, 2) 'browse' na URL escolhida.`
    };

    // === PERSONALIZAÇÃO COMPACTA ===
    if (userProfile) {
      let profile = `\n\nPerfil:`;
      
      if (userProfile.summary) {
        profile += ` ${userProfile.summary}.`;
      }
      
      if (currentSentiment && currentSentiment !== 'neutral') {
        profile += ` Humor: ${currentSentiment}.`;
      }
      
      if (userProfile.preferences) {
        const p = userProfile.preferences;
        profile += ` Tom: ${p.tone || 'neutro'}, Formato: ${p.response_format || 'equilibrado'}.`;
      }
      
      if (userProfile.linguistic_markers) {
        const m = userProfile.linguistic_markers;
        profile += ` Estilo: ${m.formality_score > 0.6 ? 'formal' : 'casual'}${m.uses_emojis ? ', usa emojis' : ''}.`;
      }
      
      if (userProfile.key_facts?.length > 0) {
        profile += ` Fatos: ${userProfile.key_facts.slice(0, 3).map(f => f.fact).join(', ')}.`;
      }
      
      dynamicPrompt.content += profile;
    }

    // LTM context compacto
    if (ltmContext && ltmContext.trim().length > 0) {
      // Limitar LTM para evitar prompts muito longos
      const shortLtm = ltmContext.length > 500 ? ltmContext.substring(0, 500) + '...' : ltmContext;
      dynamicPrompt.content += `\n\nContexto: ${shortLtm}`;
    }

    messages.push({ role: 'user', content: userContent });
    console.log(`[ProcessMessage] ✅ Prompt dinâmico construído (+${Date.now() - stepTime}ms) - Tokens: ~${JSON.stringify(dynamicPrompt).length / 4}`);

    stepTime = Date.now();
    console.log(`[ProcessMessage] 🤖 Enviando mensagem para IA... - ${new Date().toISOString()}`);
    
    // Otimização agressiva: usar apenas 6 mensagens mais recentes para OpenAI (mais rápido)
    const contextLimit = Math.min(messages.length, 6);
    const chatMessages = [dynamicPrompt, ...messages.slice(-contextLimit)];
    
    console.log(`[ProcessMessage] 📊 Contexto otimizado: ${chatMessages.length} mensagens, ~${JSON.stringify(chatMessages).length / 4} tokens`);
    
    // Simular digitação durante a chamada da IA
    const aiPromise = chatAi(chatMessages);
    const longTypingPromise = simulateTyping(data.from, true);
    
    let [response] = await Promise.all([aiPromise, longTypingPromise]);
    console.log(`[ProcessMessage] ✅ Resposta da IA recebida (+${Date.now() - stepTime}ms)`);

    // Normalizar a resposta para garantir estrutura consistente
    stepTime = Date.now();
    console.log(`[ProcessMessage] 🔧 Normalizando resposta da IA... - ${new Date().toISOString()}`);
    response = normalizeAiResponse(response);
    console.log(`[ProcessMessage] ✅ Resposta normalizada (+${Date.now() - stepTime}ms)`);

    messages.push(response.message);
    if ((response.message.tool_calls && response.message.tool_calls.length > 0) || response.message.function_call) {
      stepTime = Date.now();
      console.log(`[ProcessMessage] 🛠️ Executando ferramentas... - ${new Date().toISOString()}`);
      messages = await toolCall(messages, response, tools, data.from, data.id, userContent);
      console.log(`[ProcessMessage] ✅ Ferramentas executadas (+${Date.now() - stepTime}ms)`);
    }
    
    console.log(`[ProcessMessage] ✅ Resposta entregue ao usuário - TEMPO ATÉ RESPOSTA: ${Date.now() - startTime}ms - ${new Date().toISOString()}`);
    
    // === BACKGROUND PROCESSING - Não bloqueia a resposta ao usuário ===
    setImmediate(async () => {
      console.log(`[Background] 🚀 Iniciando processamento em background...`);
      const backgroundStartTime = Date.now();
      
      try {
        // Executar operações em paralelo para reduzir tempo total
        await Promise.all([
          // Atualizar contexto (rápido)
          (async () => {
            console.log(`[Background] 💾 Atualizando contexto do usuário...`);
            await updateUserContext(userId, { messages });
          })(),
          
          // Armazenar na LTM (médio)
          (async () => {
            console.log(`[Background] 📚 Armazenando conversa na LTM...`);
            LtmService.summarizeAndStore(userId, messages.map((m) => m.content).join('\n'));
          })()
        ]);
        
        console.log(`[Background] ✅ Operações rápidas concluídas (+${Date.now() - backgroundStartTime}ms)`);
        
        // Executar operação mais lenta separadamente e com timeout
        console.log(`[Background] 📊 Atualizando resumo do perfil do usuário (com timeout)...`);
        const profileUpdatePromise = updateUserProfileSummary(userId, messages);
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 15000)); // 15s timeout
        
        const profileResult = await Promise.race([profileUpdatePromise, timeoutPromise]);
        
        if (profileResult === 'timeout') {
          console.warn(`[Background] ⚠️ Timeout na atualização do perfil (>15s) - pulando para não afetar próximas mensagens`);
        } else {
          console.log(`[Background] ✅ Perfil atualizado com sucesso`);
        }
        
        console.log(`[Background] ✅ Processamento em background concluído - TEMPO: ${Date.now() - backgroundStartTime}ms`);
      } catch (error) {
        console.error(`[Background] ❌ Erro no processamento em background:`, error);
      }
    });
    
    console.log(`[ProcessMessage] ✅ Processamento da mensagem concluído - TEMPO TOTAL PERCEBIDO: ${Date.now() - startTime}ms - ${new Date().toISOString()}`);
  }
}

async function toolCall(messages, response, tools, from, id, userContent) {
  const toolStartTime = Date.now();
  console.log(`[ToolCall] 🔧 Iniciando execução de ferramentas - ${new Date().toISOString()}`);
  const newMessages = messages;
  let directCommunicationOccurred = false; // Flag to track if a direct communication tool was used
  
  if (response.message.function_call) {
    console.log(`[ToolCall] 🔄 Convertendo function_call para tool_calls... - ${new Date().toISOString()}`);
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
    console.log(`[ToolCall] 📋 Executando ${response.message.tool_calls.length} ferramenta(s) - ${new Date().toISOString()}`);
    
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;
      let stepTime = Date.now();
      
      if (toolCall.function.name === 'generate_image') {
        console.log(`[ToolCall] 🎨 Gerando imagem... - ${new Date().toISOString()}`);
        const image = await generateImage({ ...args });
        if (image.error) {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Erro ao gerar imagem: ${image.error}` });
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Image generated and sent: "${args.prompt}"` });
          await sendImage(from, image, args.prompt);
        }
        console.log(`[ToolCall] ✅ Imagem processada (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'send_message') {
        console.log(`[ToolCall] 💬 Enviando mensagem... - ${new Date().toISOString()}`);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Mensagem enviada ao usuário: "${args.content}"` });
        await sendMessage(from, args.content);
        directCommunicationOccurred = true; // Set flag
        console.log(`[ToolCall] ✅ Mensagem enviada (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'analyze_image') {
        console.log(`[ToolCall] 🔍 Analisando imagem... - ${new Date().toISOString()}`);
        const analysis = await analyzeImage({ id, prompt: args.prompt });
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: analysis });
        console.log(`[ToolCall] ✅ Imagem analisada (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'reminder') {
        console.log(`[ToolCall] ⏰ Processando lembrete... - ${new Date().toISOString()}`);
        if (args.action === 'create') {
          const newReminder = await addReminder(from, args.message, args.scheduledTime);
          scheduleReminder(newReminder);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Lembrete criado: ${JSON.stringify(newReminder)}` });
        } else if (args.action === 'list') {
          const reminders = await getReminders(from);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Seus lembretes: ${JSON.stringify(reminders)}` });
        }
        console.log(`[ToolCall] ✅ Lembrete processado (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'lottery_check') {
        console.log(`[ToolCall] 🎲 Verificando loteria... - ${new Date().toISOString()}`);
        const result = await lotteryCheck(args.modalidade, args.sorteio);
        newMessages.push({ name: toolCall.function.name, role: 'tool', content: JSON.stringify(result) });
        console.log(`[ToolCall] ✅ Loteria verificada (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'browse') {
        console.log(`[ToolCall] 🌐 Navegando na web... - ${new Date().toISOString()}`);
        const result = await browse({ url: args.url });
        if (result.error && result.error.includes('net::ERR_NAME_NOT_RESOLVED')) {
          console.warn(`[ToolCall] ⚠️ Browse falhou para ${args.url}, tentando busca web como fallback`);
          const webSearchResult = await webSearch({ query: userContent });
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Browse failed. Attempted web search with query "${userContent}": ${JSON.stringify(webSearchResult)}` });
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: JSON.stringify(result) });
        }
        console.log(`[ToolCall] ✅ Navegação web concluída (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'web_search') {
        console.log(`[ToolCall] 🔍 Buscando na web... - ${new Date().toISOString()}`);
        const result = await webSearch({ query: args.query });
        newMessages.push({ name: 'web_search', role: 'tool', content: JSON.stringify(result) });
        console.log(`[ToolCall] ✅ Busca web concluída (+${Date.now() - stepTime}ms)`);
      } else if (toolCall.function.name === 'generate_audio') {
        console.log(`[ToolCall] 🔊 Gerando áudio... - ${new Date().toISOString()}`);
        const audioResult = await generateAudio(args.textToSpeak);
        if (audioResult.success) {
          await sendPtt(from, audioResult.audioBuffer, id);
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Áudio gerado e enviado: "${args.textToSpeak}"` });
          directCommunicationOccurred = true; // Set flag
        } else {
          newMessages.push({ name: toolCall.function.name, role: 'tool', content: `Erro ao gerar áudio: ${audioResult.error}` });
        }
        console.log(`[ToolCall] ✅ Áudio processado (+${Date.now() - stepTime}ms)`);
      }
    }

    // If a direct communication tool was used, we are done with this turn.
    if (directCommunicationOccurred) {
      console.log(`[ToolCall] ✅ Comunicação direta executada, finalizando - TEMPO TOTAL TOOLS: ${Date.now() - toolStartTime}ms - ${new Date().toISOString()}`);
      return newMessages;
    }

    let stepTime = Date.now();
    console.log(`[ToolCall] 🔄 Enviando resposta das ferramentas para IA... - ${new Date().toISOString()}`);
    const newResponse = await chatAi(newMessages);
    console.log(`[ToolCall] ✅ Nova resposta da IA recebida (+${Date.now() - stepTime}ms)`);

    // Normalizar a resposta para garantir estrutura consistente
    stepTime = Date.now();
    console.log(`[ToolCall] 🔧 Normalizando nova resposta da IA... - ${new Date().toISOString()}`);
    const normalizedNewResponse = normalizeAiResponse(newResponse);
    console.log(`[ToolCall] ✅ Nova resposta normalizada (+${Date.now() - stepTime}ms)`);

    newMessages.push(normalizedNewResponse.message);
    if ((normalizedNewResponse.message.tool_calls && normalizedNewResponse.message.tool_calls.length > 0) || normalizedNewResponse.message.function_call) {
      console.log(`[ToolCall] 🔁 Ferramentas adicionais detectadas, executando recursivamente... - ${new Date().toISOString()}`);
      return toolCall(newMessages, normalizedNewResponse, tools, from, id);
    }

    // Fallback for when the model forgets to use the send_message tool
    // if (normalizedNewResponse.message.content && normalizedNewResponse.message.content.trim().length > 0) {
    //   await sendMessage(from, normalizedNewResponse.message.content);
    // }

    console.log(`[ToolCall] ✅ Execução de ferramentas concluída - TEMPO TOTAL TOOLS: ${Date.now() - toolStartTime}ms - ${new Date().toISOString()}`);
    return newMessages;
  }
  console.log(`[ToolCall] ⚠️ Nenhuma ferramenta para executar - ${new Date().toISOString()}`);
  return messages;
}
