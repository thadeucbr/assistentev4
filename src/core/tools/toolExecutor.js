import { normalizeAiResponse } from '../../utils/aiResponseUtils.js';
import { sanitizeMessagesForChat } from '../processors/messageSanitizer.js';
import chatAi from '../../config/ai/chat.ai.js';
import logger from '../../utils/logger.js';

// Importar ferramentas
import generateImage from '../../skills/generateImage.js';
import analyzeImage from '../../skills/analyzeImage.js';
import lotteryCheck from '../../skills/lotteryCheck.js';
import generateAudio from '../../skills/generateAudio.js';
import webSearch from '../../skills/webSearch.js';
import calendar from '../../skills/calendar.js';

// Importar funções do WhatsApp
import sendMessage from '../../whatsapp/sendMessage.js';
import sendImage from '../../whatsapp/sendImage.js';
import sendPtt from '../../whatsapp/sendPtt.js';

/**
 * Executor centralizado de ferramentas (tools)
 */
export default class ToolExecutor {
  /**
   * Executa ferramentas baseadas na resposta da IA
   * @param {Array} messages - Array de mensagens
   * @param {Object} response - Resposta da IA
   * @param {Array} tools - Ferramentas disponíveis
   * @param {string} from - Número do remetente
   * @param {string} id - ID da mensagem
   * @param {string} userContent - Conteúdo da mensagem do usuário
   * @param {Object} messageData - Dados da mensagem
   * @param {string} imageAnalysisResult - Resultado da análise de imagem
   * @returns {Promise<Array>} - Array de mensagens atualizado
   */
  static async executeTools(messages, response, tools, from, id, userContent, messageData = null, imageAnalysisResult = '') {
    const toolStartTime = Date.now();
    logger.debug('ToolExecutor', 'Iniciando execução de ferramentas...');
    let newMessages = [...messages];

    // Converter function_call legado para tool_calls
    if (response.message.function_call) {
      logger.debug('ToolExecutor', 'Convertendo function_call legado para tool_calls...');
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
      logger.warn('ToolExecutor', 'Nenhuma ferramenta para executar.');
      return messages;
    }

    logger.info('ToolExecutor', `Executando ${response.message.tool_calls.length} ferramenta(s) sequencialmente...`);
    logger.info('ToolExecutor', `Tool calls detectadas: ${response.message.tool_calls.map(tc => `${tc.id}:${tc.function.name}`).join(', ')}`);

    // Coletar todas as respostas das ferramentas primeiro
    const toolResponses = [];
    const executedToolCallIds = new Set(); // Controle para evitar execução duplicada
    
    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name;
      let toolResultContent = '';
      let actualToolName = toolName;

      logger.info('ToolExecutor', `Processando tool_call: ${toolCall.id} - ${toolName}`);

      // Verificar se já executamos esta tool_call
      if (executedToolCallIds.has(toolCall.id)) {
        logger.warn('ToolExecutor', `Tool call ${toolCall.id} já foi executada, pulando para evitar duplicatas`);
        continue;
      }
      
      executedToolCallIds.add(toolCall.id);

      try {
        const args = JSON.parse(toolCall.function.arguments);

        // Normalizar nomes de ferramentas com erros de digitação
        if (toolName === 'ssend_message') {
          actualToolName = 'send_message';
          logger.warn('ToolExecutor', `Corrigindo nome da ferramenta de '${toolName}' para '${actualToolName}'`);
        }

        toolResultContent = await this._executeSpecificTool(actualToolName, args, from, id, messageData, imageAnalysisResult);

      } catch (error) {
        logger.error('ToolExecutor', `Erro ao executar ou analisar argumentos para a ferramenta ${toolName}:`, error);
        toolResultContent = `Erro interno ao processar a ferramenta ${toolName}.`;
      }

      // Coletar resposta da ferramenta
      const toolResponse = {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResultContent,
      };
      
      // CRÍTICO: Garantir que já temos o tool_call_id correto
      if (!toolResponse.tool_call_id) {
        logger.error('ToolExecutor', `ERRO: tool_call_id ausente para ${toolCall.id}`);
        toolResponse.tool_call_id = toolCall.id;
      }
      
      toolResponses.push(toolResponse);
      logger.debug('ToolExecutor', `Resposta coletada para ${toolCall.id}: ${toolName} (original) -> ${actualToolName} (executado)`);
    }

    // Adicionar todas as respostas das ferramentas ao array de mensagens
    newMessages.push(...toolResponses);

    // Validação final para debug
    const toolCallIds = response.message.tool_calls.map(tc => tc.id);
    const toolResponseIds = toolResponses.map(tr => tr.tool_call_id);
    
    const missingResponses = toolCallIds.filter(id => !toolResponseIds.includes(id));
    if (missingResponses.length > 0) {
      logger.error('ToolExecutor', `ERRO CRÍTICO: Tool calls sem resposta detectadas: ${missingResponses.join(', ')}`);
      // Fallback para tool calls sem resposta
      for (const missingId of missingResponses) {
        const fallbackResponse = {
          role: 'tool',
          tool_call_id: missingId,
          content: 'Erro: ferramenta não encontrada ou falhou ao executar.',
        };
        toolResponses.push(fallbackResponse);
        newMessages.push(fallbackResponse);
        logger.critical('ToolExecutor', `Fallback: Adicionada resposta de erro para ${missingId}`);
      }
    }

    // Verificar se executamos qualquer ferramenta que não seja send_message - se sim, parar aqui
    const executedNonSendMessageTools = response.message.tool_calls.filter(tc => 
      tc.function.name !== 'send_message'
    );
    
    const alreadyExecutedSendMessage = toolResponses.some(tr => 
      tr.content && tr.content.includes('Mensagem enviada ao usuário:')
    );
    
    // Se executamos ferramentas que não são send_message OU já executamos send_message, parar aqui
    if (executedNonSendMessageTools.length > 0 || alreadyExecutedSendMessage) {
      const executedToolNames = executedNonSendMessageTools.map(tc => tc.function.name).join(', ');
      logger.info('ToolExecutor', `Ferramentas executadas (${executedToolNames || 'send_message'}) - parando aqui para evitar duplicatas e loops`);
      logger.timing('ToolExecutor', `Execução de ferramentas concluída. Tempo total: ${Date.now() - toolStartTime}ms`);
      return newMessages;
    }
    
    // Continuar o ciclo de IA se necessário
    const sanitizedToolMessages = sanitizeMessagesForChat(newMessages);
    const newResponse = await chatAi(sanitizedToolMessages, undefined);
    const normalizedNewResponse = normalizeAiResponse(newResponse);
    newMessages.push(normalizedNewResponse.message);

    // Processar novas tool_calls se necessário
    if (normalizedNewResponse.message.tool_calls && normalizedNewResponse.message.tool_calls.length > 0) {
      const hasSendMessage = normalizedNewResponse.message.tool_calls.some(tc => tc.function.name === 'send_message');
      if (hasSendMessage) {
        logger.debug('ToolExecutor', 'Executando send_message da resposta da IA...');
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
              logger.info('ToolExecutor', `Send_message executado: ${args.content}`);
            } catch (error) {
              logger.error('ToolExecutor', 'Erro ao executar send_message:', error);
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
        logger.debug('ToolExecutor', 'Ferramentas adicionais detectadas, mas ignorando para evitar loop infinito');
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

    logger.timing('ToolExecutor', `Execução de ferramentas e ciclo de IA concluídos. Tempo total: ${Date.now() - toolStartTime}ms`);
    return newMessages;
  }

  /**
   * Executa uma ferramenta específica
   * @private
   */
  static async _executeSpecificTool(toolName, args, from, id, messageData, imageAnalysisResult) {
    switch (toolName) {
      case 'image_generation_agent':
        const image = await generateImage({ ...args });
        if (image && typeof image === 'string') {
          await sendImage(from, image, args.prompt);
          return `Image generated and sent: "${args.prompt}"`;
        } else {
          return `Erro ao gerar imagem: ${image === false ? 'Falha na geração' : 'Erro desconhecido'}`;
        }

      case 'send_message':
        await sendMessage(from, args.content, id);
        return `Mensagem enviada ao usuário: "${args.content}"`;

      case 'image_analysis_agent':
        // Verificar se já fizemos análise automática na mesma mensagem
        if (messageData?.type === 'image' && imageAnalysisResult) {
          logger.info('ToolExecutor', 'Evitando análise duplicada - usando resultado da análise automática');
          return `Análise de imagem já foi realizada automaticamente. Resultado: ${imageAnalysisResult}`;
        } else {
          // Se não há imagem na mensagem atual, a ferramenta precisa do ID
          const analysisArgs = { ...args };
          if (messageData?.type === 'image' && messageData.id) {
            analysisArgs.id = messageData.id;
          }
          
          const analysis = await analyzeImage(analysisArgs);
          return analysis.error ? `Erro ao analisar imagem: ${analysis.error}` : `Imagem analisada com sucesso: ${typeof analysis === 'string' ? analysis : analysis.content || 'Análise concluída'}`;
        }

      case 'reminder_agent':
        return `Funcionalidade de lembrete processada: ${args.query}`;

      case 'lottery_check_agent':
        const lotteryResult = await lotteryCheck(args.query);
        return `Resultado da loteria verificado: ${args.query}`;

      case 'audio_generation_agent':
        const audio = await generateAudio(args.query);
        if (audio && !audio.error) {
          await sendPtt(from, audio.audioBuffer);
          return `Áudio gerado e enviado: "${args.query}"`;
        } else {
          return `Erro ao gerar áudio: ${audio?.error || 'Erro desconhecido'}`;
        }

      case 'information_retrieval_agent':
        const searchResult = await webSearch(args.query);
        if (searchResult.error) {
          let errorMsg = `Erro na busca web: ${searchResult.error}`;
          if (searchResult.hybridError && searchResult.fallbackError) {
            errorMsg += `\nDetalhes - Híbrida: ${searchResult.hybridError}, Fallback: ${searchResult.fallbackError}`;
          }
          return errorMsg;
        } else if (searchResult.success) {
          const methodLabels = {
            'simplified-playwright': '(Busca Avançada com Playwright)',
            'fallback-direct': '(Busca Direta)',
            'fallback-after-failure': '(Busca Robusta após falha)',
            'last-resort-fallback': '(Último Recurso)',
            'hybrid': '(Busca Híbrida)'
          };
          
          const methodInfo = methodLabels[searchResult.method] || `(${searchResult.method})`;
          
          return `Busca web concluída com sucesso para "${args.query}" ${methodInfo}.

RESULTADO ENCONTRADO:
${searchResult.result}

FONTES CONSULTADAS:
${searchResult.sources && searchResult.sources.length > 0 ? 
  searchResult.sources.map((url, index) => `${index + 1}. ${url}`).join('\n') : 
  'Nenhuma fonte específica listada'}

Esta informação foi obtida através de busca web automatizada${searchResult.method.includes('playwright') ? ' com navegação inteligente' : ''}.`;
        } else {
          return `Busca realizada para "${args.query}", mas formato de resposta inesperado: ${JSON.stringify(searchResult)}`;
        }

      case 'calendar_agent':
        const calendarResult = await calendar({ userId: from, query: args.query });
        if (calendarResult.success) {
          return `Solicitação de calendário processada com sucesso: ${calendarResult.message}`;
        } else {
          return `Erro ao processar solicitação de calendário: ${calendarResult.message || calendarResult.error}`;
        }

      default:
        logger.warn('ToolExecutor', `Ferramenta desconhecida encontrada: ${toolName}`);
        return `Ferramenta desconhecida: ${toolName}`;
    }
  }
}
