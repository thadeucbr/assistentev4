import LtmService from '../services/LtmService.js';
import { normalizeAiResponse } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js';

// Core modules
import { sanitizeMessagesForChat } from './processors/messageSanitizer.js';
import STMManager from './memory/stmManager.js';
import ImageProcessor from './processors/imageProcessor.js';
import DynamicPromptBuilder from './prompt/dynamicPromptBuilder.js';
import MCPToolExecutor from './tools/MCPToolExecutor.js';
import MessageAuthHandler from './processors/messageAuthHandler.js';
import AIAnalysisHandler from './processors/aiAnalysisHandler.js';

// Personality system
import PersonalityOrchestrator from './personality/PersonalityOrchestrator.js';

// Repository imports
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { getUserProfile } from '../repository/userProfileRepository.js';

// Skills imports
import updateUserProfileSummary from '../skills/updateUserProfileSummary.js';

// WhatsApp imports
import simulateTyping from '../whatsapp/simulateTyping.js';

// Config imports
import chatAi from '../config/ai/chat.ai.js';

// Environment config
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

/**
 * Processador principal de mensagens - Refatorado com Sistema de Personalidade Evolutiva
 * Núcleo central da aplicação que coordena todo o fluxo de processamento
 */
class MessageProcessor {
  // Variáveis de classe para o sistema de personalidade
  static personalityOrchestrator = null;
  static personalityInitialized = false;

  /**
   * Inicializa o sistema de personalidade (lazy loading)
   * @private
   */
  static async _ensurePersonalityInitialized() {
    if (!this.personalityOrchestrator) {
      this.personalityOrchestrator = new PersonalityOrchestrator();
    }
    
    if (!this.personalityInitialized) {
      await this.personalityOrchestrator.initialize();
      this.personalityInitialized = true;
      logger.info('MessageProcessor', '🎭 Sistema de personalidade inicializado');
    }
  }
  /**
   * Processa mensagem recebida
   * @param {Object} message - Mensagem recebida
   */
  static async processMessage(message) {
    // Gerar ID único para esta mensagem
    const messageId = logger.generateMessageId();
    
    const startTime = Date.now();
    logger.start('MessageProcessor', 'Processamento de mensagem iniciado');
    
    try {
      const { data } = message;
      
      // Log da interação inicial
      logger.interaction('MessageProcessor', 'webhook-received', {
        from: data.from,
        messageType: data.messageType || 'text',
        hasImage: !!data.image
      });
      
      // Verificar autorização da mensagem
      if (!MessageAuthHandler.isMessageAuthorized(data, groups)) {
        logger.debug('MessageProcessor', 'Mensagem não autorizada - ignorando');
        return;
      }

      logger.milestone('MessageProcessor', 'Mensagem autorizada para processamento');
    
      // Inicializar sistema de personalidade
      await this._ensurePersonalityInitialized();
    
      // Feedback imediato: simular digitação no início
      simulateTyping(data.from, true); // Não aguardar - executar em background
    
      // Processar imagens automaticamente se detectadas
      logger.step('MessageProcessor', 'Processando imagens detectadas');
      const { userContent, imageAnalysisResult } = await ImageProcessor.processImage(data);
      const userId = MessageAuthHandler.extractUserId(data.from);
    
      // Carregar dados do usuário
      logger.step('MessageProcessor', 'Carregando contexto e perfil do usuário');
      
      const [
        { messages: rawMessages }, 
        userProfile, 
        ltmContext
      ] = await Promise.all([
        getUserContext(userId),
        getUserProfile(userId),
        LtmService.getRelevantContext(userId, userContent)
      ]);
    
      logger.timing('MessageProcessor', 'Dados do usuário carregados', {
        messagesCount: rawMessages.length,
        hasUserProfile: !!userProfile,
        ltmContextSize: ltmContext?.length || 0
      });
    
      // Sanitizar contexto histórico
      logger.step('MessageProcessor', 'Sanitizando contexto histórico');
      let messages = sanitizeMessagesForChat(rawMessages);
      logger.timing('MessageProcessor', 'Contexto histórico sanitizado', {
        originalCount: rawMessages.length,
        sanitizedCount: messages.length
      });
    
      // Gerenciar STM (Short Term Memory)
      logger.step('MessageProcessor', '🧠 Iniciando gerenciamento STM');
      try {
        messages = await STMManager.manageSTM(messages, userContent, userId, data.from);
        logger.timing('MessageProcessor', '🧠 Gerenciamento STM concluído', {
          finalMessageCount: messages.length
        });
      } catch (error) {
        logger.critical('MessageProcessor', `Erro no gerenciamento STM: ${error.message}`, {
          stack: error.stack
        });
        throw error;
      }

      // Construir prompt dinâmico
      logger.step('MessageProcessor', '🏗️ Construindo prompt dinâmico');
      let dynamicPrompt;
      try {
        dynamicPrompt = DynamicPromptBuilder.buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult);
        logger.timing('MessageProcessor', '🏗️ Prompt dinâmico construído');
      } catch (error) {
        logger.critical('MessageProcessor', `Erro na construção do prompt: ${error.message}`);
        throw error;
      }

            // Executar análises de IA
      simulateTyping(data.from, true);
      logger.step('MessageProcessor', '🤖 Iniciando análises de IA');
      let currentSentiment, inferredStyle;
      try {
        const aiAnalysis = await AIAnalysisHandler.performAIAnalysis(userContent, userId, userProfile);
        currentSentiment = aiAnalysis.currentSentiment;
        inferredStyle = aiAnalysis.inferredStyle;
        logger.timing('MessageProcessor', '🤖 Análises de IA concluídas', {
          sentiment: currentSentiment,
          style: inferredStyle
        });
      } catch (error) {
        logger.error('MessageProcessor', `Erro nas análises de IA: ${error.message}`);
        // Valores padrão em caso de erro
        currentSentiment = 'neutro';
        inferredStyle = 'neutral';
      }

      // 🎭 PROCESSAMENTO DA PERSONALIDADE EVOLUTIVA
      logger.step('MessageProcessor', '🎭 Processando evolução da personalidade');
      logger.debug('MessageProcessor', '🎭 ENTRADA PERSONALIDADE:', {
        userId,
        contentLength: userContent?.length || 0,
        currentSentiment,
        messageType: data.messageType || 'text',
        hasImage: !!data.image,
        conversationLength: messages.length
      });
      
      try {
        const personalityResult = await this.personalityOrchestrator.processPersonalityInteraction(
          userId, 
          userContent, 
          currentSentiment, 
          {
            messageType: data.messageType || 'text',
            hasImage: !!data.image,
            inferredStyle,
            conversationLength: messages.length
          }
        );
        
        logger.debug('MessageProcessor', '🎭 RESULTADO PERSONALIDADE:', {
          mood: personalityResult.mood,
          formationLevel: personalityResult.personality_formation,
          evolutionApplied: personalityResult.evolution_applied
        });
        
        logger.timing('MessageProcessor', '🎭 Personalidade evolutiva processada');
      } catch (error) {
        logger.error('MessageProcessor', `Erro no processamento da personalidade: ${error.message}`);
        // Continuar o fluxo mesmo com erro na personalidade
      }

      // 🏗️ CONSTRUIR PROMPT EVOLUTIVO (substituindo o prompt dinâmico básico)
      logger.step('MessageProcessor', '🏗️ Construindo prompt evolutivo');
      let personalityMetadata;
      try {
        const situationType = this._determineSituationType(messages, userContent);
        logger.debug('MessageProcessor', '🏗️ ENTRADA BUILD PROMPT:', {
          userId,
          hasProfile: !!userProfile,
          ltmContextLength: ltmContext?.length || 0,
          hasImageAnalysis: !!imageAnalysisResult,
          situationType
        });
        
        const promptResult = await this.personalityOrchestrator.buildPersonalityPrompt(
          userId, 
          userProfile, 
          ltmContext, 
          imageAnalysisResult,
          situationType
        );
        dynamicPrompt = promptResult.prompt;
        personalityMetadata = promptResult.personalityMetadata;
        
        logger.debug('MessageProcessor', '🏗️ PROMPT RESULT:', {
          promptLength: dynamicPrompt?.content?.length || 0,
          mood: personalityMetadata.mood,
          formationLevel: personalityMetadata.formation_level,
          adaptiveBehaviors: personalityMetadata.adaptive_behaviors?.length || 0
        });
        
        logger.timing('MessageProcessor', '🏗️ Prompt evolutivo construído', {
          mood: personalityMetadata.mood,
          formationLevel: personalityMetadata.formation_level,
          familiarityLevel: personalityMetadata.familiarity_level
        });
      } catch (error) {
        logger.error('MessageProcessor', `Erro na construção do prompt evolutivo: ${error.message}`);
        // Fallback para prompt básico
        dynamicPrompt = DynamicPromptBuilder.buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult);
        personalityMetadata = { mood: 'neutral', formation_level: 0, familiarity_level: 0 };
      }

      // Preparar mensagens para chat
      logger.step('MessageProcessor', '💬 Preparando mensagens para chat');
      const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
      const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
      // Obter ferramentas disponíveis do MCP dinamicamente
      logger.step('MessageProcessor', '🔧 Obtendo ferramentas do MCP dinamicamente');
      const mcpExecutor = new MCPToolExecutor();
      const dynamicTools = await mcpExecutor.getToolsForOpenAI();
      logger.milestone('MessageProcessor', `${dynamicTools.length} ferramentas obtidas do MCP dinamicamente`);
    
      // Gerar resposta principal da IA com ferramentas dinâmicas
      logger.step('MessageProcessor', '🎯 Gerando resposta principal da IA com ferramentas dinâmicas');
      let response;
      try {
        const aiStartTime = Date.now();
        response = await chatAi(sanitizedChatMessages, dynamicTools);
        const aiEndTime = Date.now();
        
        response = normalizeAiResponse(response);
        
        // Log detalhado da resposta da IA
        logger.aiResponse('MessageProcessor', 'OpenAI', response, {
          requestTime: aiEndTime - aiStartTime,
          messageLength: sanitizedChatMessages.length,
          toolsAvailable: dynamicTools.length
        });
        
        logger.timing('MessageProcessor', '🎯 Resposta principal gerada', {
          aiTime: `${aiEndTime - aiStartTime}ms`,
          hasContent: !!response.message?.content,
          toolCallsCount: response.message?.tool_calls?.length || 0
        });
      } catch (error) {
        logger.critical('MessageProcessor', `Erro ao gerar resposta principal: ${error.message}`);
        
        // Try to send an error message to the user instead of crashing
        try {
          const mcpExecutor = new MCPToolExecutor();
          await mcpExecutor.executeTools([{
            name: 'send_message',
            arguments: {
              content: `❌ Desculpe, ocorreu um erro temporário ao processar sua mensagem. Tente novamente em alguns segundos.\n\nDetalhes: ${error.message.includes('Rate limit') ? 'Limite de uso da IA atingido temporariamente.' : 'Erro interno do sistema.'}`
            }
          }]);
          logger.milestone('MessageProcessor', 'Mensagem de erro enviada ao usuário');
          return; // Exit gracefully
        } catch (fallbackError) {
          logger.critical('MessageProcessor', `Falha ao enviar mensagem de erro: ${fallbackError.message}`);
        }
        
        throw error; // Only throw if we couldn't send error message to user
      }

      // Atualizar mensagens com interação atual
      logger.step('MessageProcessor', '📝 Atualizando mensagens com interação atual');
      messages.push({ role: 'user', content: userContent });
      messages.push(response.message);

      // Executar ciclo de ferramentas
      logger.step('MessageProcessor', '🔧 Iniciando ciclo de ferramentas');
      logger.debug('MessageProcessor', `Response tem tool_calls: ${response.message.tool_calls?.length || 0}`);
      await this._executeToolCycle(messages, response, dynamicTools, data, userContent, imageAnalysisResult, mcpExecutor);
      logger.timing('MessageProcessor', '🔧 Ciclo de ferramentas concluído');

      // Atualizações finais
      logger.step('MessageProcessor', '💾 Realizando atualizações finais');
    
      await updateUserContext(userId, { messages });

      // Atualizações assíncronas em background
      logger.debug('MessageProcessor', 'Iniciando atualizações assíncronas em background');
    
      // Limitar o texto para LTM a um tamanho razoável (aprox. 6000 tokens = 24000 chars)
      const conversationText = messages.map((m) => m.content).join('\n');
      const limitedText = conversationText.length > 24000 
        ? conversationText.substring(conversationText.length - 24000) 
        : conversationText;
      
      updateUserProfileSummary(userId, messages)
        .catch(err => logger.error('MessageProcessor', `Erro ao atualizar resumo do perfil em background: ${err}`));
        
      logger.timing('MessageProcessor', ' Atualizações concluídas');
      
      logger.end('MessageProcessor', `Processamento da mensagem concluído - TEMPO TOTAL: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      logger.critical('MessageProcessor', `Erro crítico no processamento: ${error.message}`, {
        stack: error.stack
      });
      // Tentar enviar uma mensagem de erro para o usuário
      try {
        const { data } = message;
        await simulateTyping(data.from, false);
        
        // Try to use MCP to send error message
        const fallbackMcpExecutor = new MCPToolExecutor();
        await fallbackMcpExecutor.executeTools([{
          name: 'send_message',
          arguments: {
            content: `❌ Ocorreu um erro interno. Por favor, tente novamente em alguns minutos.\n\n${error.message.includes('Rate limit') ? '🕐 Sistema temporariamente sobrecarregado.' : '⚠️ Erro no processamento da mensagem.'}`
          }
        }]);
        
        logger.milestone('MessageProcessor', 'Mensagem de erro enviada ao usuário via MCP');
      } catch (fallbackError) {
        logger.critical('MessageProcessor', `Erro no fallback: ${fallbackError.message}`);
        logger.critical('MessageProcessor', 'CRÍTICO: Não foi possível notificar o usuário sobre o erro');
      }
      
      // Don't re-throw - let the application continue running
      logger.milestone('MessageProcessor', 'Erro tratado - aplicação continuará executando');
    }
  }

  /**
   * Executa ciclo de ferramentas com limite de tentativas
   * @private
   */
  static async _executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult, mcpExecutor) {
    logger.debug('MessageProcessor', '🎬 === ENTRANDO EM _executeToolCycle ===');
    let toolCycleCount = 0;
    const MAX_TOOL_CYCLES = 3;
    let lastResponse = response.message;
    
    // Rastrear tools executadas para evitar loops
    const executedTools = new Set();
    
    logger.debug('MessageProcessor', `🔧 Iniciando ciclo de ferramentas - Response: ${lastResponse.content ? 'com conteúdo' : 'sem conteúdo'}, Tool calls: ${lastResponse.tool_calls?.length || 0}`);
    
    while (toolCycleCount < MAX_TOOL_CYCLES) {
      logger.debug('MessageProcessor', `🔄 Ciclo ${toolCycleCount + 1}/${MAX_TOOL_CYCLES}`);
      
      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        logger.debug('MessageProcessor', `🛠️ Executando ${lastResponse.tool_calls?.length || 1} ferramenta(s)...`);
        
        // Verificar se tools foram executadas com sucesso (evitar loop infinito apenas para ferramentas bem-sucedidas)
        const toolNames = lastResponse.tool_calls?.map(tc => tc.function.name) || [];
        
        // Verificar se há uma geração de imagem bem-sucedida para O MESMO PROMPT
        const hasSuccessfulImageGeneration = messages.slice(-5).some(msg => 
          msg.role === 'tool' && 
          msg.content && 
          msg.content.includes('"success": true') && 
          msg.content.includes('"sent": true') &&
          (msg.content.includes('image_generation') || msg.content.includes('Imagem gerada e enviada'))
        );
        
        // Se há image_generation sendo solicitada, verificar se é o mesmo prompt já executado
        const hasRecentImageGeneration = toolNames.includes('image_generation');
        
        if (hasRecentImageGeneration) {
          // Obter o prompt atual da solicitação
          const currentImagePrompt = lastResponse.tool_calls
            .filter(tc => tc.function.name === 'image_generation')
            .map(tc => {
              try {
                const args = JSON.parse(tc.function.arguments);
                return args.prompt;
              } catch (e) {
                return null;
              }
            })[0];

          if (currentImagePrompt) {
            // Verificar se há múltiplas tentativas do mesmo prompt neste ciclo (loop imediato)
            const currentCycleImageCalls = lastResponse.tool_calls
              .filter(tc => tc.function.name === 'image_generation')
              .map(tc => {
                try { return JSON.parse(tc.function.arguments).prompt; } 
                catch (e) { return null; }
              })
              .filter(p => p && p === currentImagePrompt);

            const isImmediateLoop = currentCycleImageCalls.length > 1;
            
            // Verificar se o MESMO PROMPT foi solicitado nas últimas 5 mensagens (loop recente)
            const recentMessages = messages.slice(-5);
            const samePromptInRecentCycle = recentMessages.some(msg => 
              msg.role === 'assistant' && 
              msg.tool_calls && 
              msg.tool_calls.some(tc => {
                if (tc.function.name === 'image_generation') {
                  try {
                    const args = JSON.parse(tc.function.arguments);
                    return args.prompt === currentImagePrompt;
                  } catch (e) {
                    return false;
                  }
                }
                return false;
              })
            );

            if (isImmediateLoop || samePromptInRecentCycle) {
              logger.debug('MessageProcessor', `🖼️ LOOP imediato detectado - prompt "${currentImagePrompt.substring(0, 50)}..." executado muito recentemente - pulando duplicação`);
              // Remover apenas as tool_calls duplicadas de image_generation
              lastResponse.tool_calls = lastResponse.tool_calls.filter(tc => 
                !(tc.function.name === 'image_generation' && 
                  JSON.parse(tc.function.arguments).prompt === currentImagePrompt)
              );
              
              // Se não há outras tools para executar, pular este ciclo
              if (lastResponse.tool_calls.length === 0) {
                logger.debug('MessageProcessor', '✅ Loop de image_generation resolvido - finalizando ciclo');
                break;
              }
            } else {
              logger.debug('MessageProcessor', `🖼️ Nova solicitação de imagem detectada, permitindo execução: "${currentImagePrompt.substring(0, 50)}..."`);
            }
          }
        }
        
        // Permitir re-tentativas se:
        // 1. É o primeiro ciclo (toolCycleCount === 0)
        // 2. Há novas ferramentas que nunca foram tentadas
        // 3. Há ferramentas que falharam e podem ser re-tentadas
        const shouldContinueExecution = toolCycleCount === 0 || toolNames.length > 0;
        
        if (!shouldContinueExecution && toolCycleCount > 0) {
          logger.warn('MessageProcessor', '🔄 Nenhuma nova ferramenta para executar - encerrando ciclo');
          break;
        }
        
        const updatedMessages = await mcpExecutor.executeTools(
          messages, 
          { message: lastResponse }, 
          tools, 
          data.from, 
          data.id, 
          userContent, 
          data, 
          imageAnalysisResult
        );
        
        // Não registrar automaticamente as tools como executadas
        // Permitir que a IA decida se precisa re-tentar ou fazer send_message
        
        logger.debug('MessageProcessor', `📨 Mensagens atualizadas: ${updatedMessages.length} total`);
        
        // DEBUG: Verificar estrutura das mensagens após execução das tools
        const lastMessages = updatedMessages.slice(-5);
        logger.debug('MessageProcessor', '🔍 DEBUG - Últimas 5 mensagens após execução das tools:');
        lastMessages.forEach((msg, index) => {
          logger.debug('MessageProcessor', `  ${index}: role=${msg.role}, content="${msg.content?.substring(0, 50) || 'null'}...", tool_calls=${msg.tool_calls?.length || 0}, tool_call_id=${msg.tool_call_id || 'undefined'}`);
        });
        
        // Atualizar referência das mensagens
        messages.length = 0;
        messages.push(...updatedMessages);
        
        // Verificar se alguma das tools executadas foi send_message
        const hasSendMessage = lastResponse.tool_calls?.some(tc => tc.function.name === 'send_message');
        
        logger.debug('MessageProcessor', `🔍 Verificando send_message: hasSendMessage=${hasSendMessage}`);
        
        if (hasSendMessage) {
          logger.debug('MessageProcessor', '✅ Send_message executado - finalizando ciclo');
          executedTools.add('send_message'); // Registrar apenas send_message como executada
          break;
        } else {
          logger.debug('MessageProcessor', '🔄 Tools executadas, fazendo nova chamada à IA para possível send_message');
          
          // Fazer nova chamada à IA para que possa decidir próximos passos
          try {
            logger.debug('MessageProcessor', `📝 Mensagens antes da nova chamada IA: ${messages.length} total`);
            const aiResponse = await chatAi(messages, tools);
            messages.push({
              role: 'assistant',
              content: aiResponse.message.content || '',
              tool_calls: aiResponse.message.tool_calls || []
            });
            
            lastResponse = aiResponse.message;
            logger.debug('MessageProcessor', `🤖 Nova resposta da IA com ${lastResponse.tool_calls?.length || 0} tool calls`);
            logger.debug('MessageProcessor', `🤖 Conteúdo da resposta: "${lastResponse.content?.substring(0, 100)}..."`);
            
            // Não interromper aqui - deixar que as tools sejam executadas no próximo ciclo
          } catch (error) {
            logger.error('MessageProcessor', 'Erro ao fazer nova chamada à IA:', error);
            break;
          }
        }
      } else if (lastResponse.tool_calls && lastResponse.tool_calls.length > 0) {
        // Fallback: garantir que toda tool_call tenha uma mensagem tool
        logger.debug('MessageProcessor', '⚠️ Fallback: Adicionando respostas para tool_calls órfãas');
        this._addFallbackToolResponses(messages, lastResponse);
        break;
      } else {
        // Se não há tool_calls, encerra ciclo
        logger.debug('MessageProcessor', '✅ Sem tool_calls - encerrando ciclo normalmente');
        break;
      }
      toolCycleCount++;
    }

    logger.debug('MessageProcessor', '🔍 Verificando necessidade de fallback final...');
    // Fallback final se não houve resposta send_message
    await this._handleFinalFallback(messages, data);
  }

  /**
   * Adiciona respostas de fallback para tool_calls órfãas
   * @private
   */
  static _addFallbackToolResponses(messages, lastResponse) {
    for (const toolCall of lastResponse.tool_calls) {
      const fallbackResponse = {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'Erro: ferramenta não encontrada ou falhou ao executar.',
      };
      messages.push(fallbackResponse);
      logger.debug('MessageProcessor', `Fallback: Adicionada resposta de erro para tool_call_id=${toolCall.id}`);
    }
  }

  /**
   * Lida com fallback final quando não há send_message
   * @private
   */
  static async _handleFinalFallback(messages, data) {
    const hasSendMessage = messages.some(m => 
      m.role === 'assistant' && 
      m.tool_calls && 
      m.tool_calls.some(tc => tc.function.name === 'send_message')
    );
    
    logger.debug('MessageProcessor', `🔍 Verificação send_message: ${hasSendMessage ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
    
    if (!hasSendMessage) {
      logger.warn('MessageProcessor', '⚠️ Fallback final: Solicitando à LLM uma mensagem amigável de erro.');
      
      const sanitizedFallbackHistory = sanitizeMessagesForChat(
        messages.slice(-STMManager.constants.MAX_STM_MESSAGES)
      );
      
      const fallbackPrompt = [
        {
          role: 'system',
          content: 'Você falhou em obter uma resposta útil usando ferramentas. Gere uma mensagem amigável para o usuário explicando que não foi possível atender ao pedido, sem citar ferramentas ou detalhes técnicos. Seja educado e sugira alternativas se possível.'
        },
        ...sanitizedFallbackHistory
      ];
      
      let fallbackResponse;
      try {
        logger.debug('MessageProcessor', '🤖 Gerando resposta de fallback...');
        fallbackResponse = await chatAi(fallbackPrompt);
      } catch (err) {
        logger.error('MessageProcessor', `❌ Erro ao gerar fallback: ${err.message}`);
        fallbackResponse = { message: { content: 'Desculpe, não consegui atender ao seu pedido neste momento.' } };
      }
      
      const fallbackContent = fallbackResponse?.message?.content || 'Desculpe, não consegui atender ao seu pedido neste momento.';
      
      logger.debug('MessageProcessor', `📨 Criando mensagem de fallback: "${fallbackContent.substring(0, 50)}..."`);
      
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
      logger.info('MessageProcessor', '✅ Fallback final: Mensagem de erro amigável enviada ao usuário.');
    } else {
      logger.debug('MessageProcessor', '✅ Send_message encontrado - não precisa de fallback');
    }
  }

  /**
   * Determina o tipo de situação para personalização contextual
   * @private
   */
  static _determineSituationType(messages, userContent) {
    // Primeira interação
    if (messages.length === 0) {
      return 'first_interaction';
    }

    // Tarefa criativa
    const creativeKeywords = ['criar', 'gerar', 'desenhar', 'imagem', 'arte', 'criativo', 'inventar'];
    if (creativeKeywords.some(keyword => userContent.toLowerCase().includes(keyword))) {
      return 'creative_task';
    }

    // Suporte emocional
    const emotionalKeywords = ['triste', 'feliz', 'ansioso', 'preocupado', 'deprimido', 'estressado', 'ajuda', 'como você se sente'];
    if (emotionalKeywords.some(keyword => userContent.toLowerCase().includes(keyword))) {
      return 'emotional_support';
    }

    // Recuperação de erro
    const errorKeywords = ['erro', 'problema', 'não funciona', 'bug', 'falha', 'ajuda urgente'];
    if (errorKeywords.some(keyword => userContent.toLowerCase().includes(keyword))) {
      return 'error_recovery';
    }

    return null; // Situação normal
  }
}

// Exportar função compatível com a API existente
export default async function processMessage(message) {
  return MessageProcessor.processMessage(message);
}
