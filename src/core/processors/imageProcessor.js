import analyzeImage from '../../skills/analyzeImage.js';
import logger from '../../utils/logger.js';

/**
 * Processa imagens automaticamente quando detectadas
 */
export default class ImageProcessor {
  /**
   * Processa imagem automaticamente se detectada na mensagem
   * @param {Object} data - Dados da mensagem
   * @returns {Promise<Object>} - { userContent, imageAnalysisResult }
   */
  static async processImage(data) {
    let userContent = '';
    let imageAnalysisResult = '';
    
    if (data.type === 'image') {
      logger.info('ImageProcessor', 'Imagem detectada - iniciando análise automática');
      
      try {
        // Analisar a imagem automaticamente
        const analysisPrompt = 'Analyze the attached image and provide a concise description of content, composition, possible genre, notable details, and any safety or quality concerns.';
        logger.debug('ImageProcessor', `Iniciando análise de imagem com prompt: ${analysisPrompt}`);
        
        const imageAnalysis = await analyzeImage({ id: data.id, prompt: analysisPrompt });
        
        if (imageAnalysis && !imageAnalysis.error) {
          imageAnalysisResult = typeof imageAnalysis === 'string' ? imageAnalysis : imageAnalysis.content || 'Análise realizada com sucesso';
          logger.info('ImageProcessor', 'Análise de imagem concluída com sucesso');
          
          // Construir o conteúdo da mensagem com a análise
          userContent = data.body ? 
            `${data.body}\n\n[Análise automática da imagem: ${imageAnalysisResult}]` : 
            `Usuário enviou uma imagem.\n\n[Análise automática: ${imageAnalysisResult}]`;
        } else {
          logger.error('ImageProcessor', 'Erro na análise de imagem:', imageAnalysis?.error || 'Erro desconhecido');
          userContent = data.body || 'Usuário enviou uma imagem, mas ocorreu um erro na análise automática.';
        }
      } catch (error) {
        logger.error('ImageProcessor', 'Exceção durante análise automática de imagem:', error);
        userContent = data.body || 'Usuário enviou uma imagem, mas ocorreu um erro na análise automática.';
      }
    } else {
      userContent = data.body || '';
    }

    // Incluir informação do usuário em grupos
    userContent = this.addUserInfo(data, userContent);

    // Processar mensagem quotada se existir
    userContent = this.processQuotedMessage(data, userContent);
    
    // Limpar o número do WhatsApp da mensagem
    userContent = userContent.replace(process.env.WHATSAPP_NUMBER, '').trim();

    return { userContent, imageAnalysisResult };
  }

  /**
   * Processa mensagem quotada e inclui no contexto
   * @param {Object} data - Dados da mensagem
   * @param {string} userContent - Conteúdo atual da mensagem
   * @returns {string} - Conteúdo com contexto da quote incluído
   */
  static processQuotedMessage(data, userContent) {
    // Verificar se existe uma mensagem quotada
    const quotedMsg = data.quotedMsg || data.quotedMsgObj;
    
    if (quotedMsg && quotedMsg.body) {
      logger.debug('ImageProcessor', 'Mensagem quotada detectada - incluindo contexto');
      
      // Determinar quem enviou a mensagem quotada
      let quotedAuthor = 'Alguém';
      
      // Se a mensagem quotada foi enviada pelo bot
      if (quotedMsg.author === process.env.WHATSAPP_NUMBER || 
          quotedMsg.from === process.env.WHATSAPP_NUMBER ||
          quotedMsg.fromMe) {
        quotedAuthor = 'Assistente';
      } else {
        // Tentar identificar o autor da mensagem quotada
        if (quotedMsg.sender?.name) {
          quotedAuthor = quotedMsg.sender.name;
        } else if (quotedMsg.author) {
          // Extrair nome do ID se possível
          quotedAuthor = quotedMsg.author.replace('@c.us', '');
        }
      }
      
      // Construir o contexto da quote
      const quotedContext = `[Respondendo a ${quotedAuthor}: "${quotedMsg.body}"]`;
      
      // Incluir o contexto no início da mensagem
      userContent = `${quotedContext}\n\n${userContent}`;
      
      logger.timing('ImageProcessor', 'Contexto da quote incluído', {
        quotedAuthor,
        quotedLength: quotedMsg.body.length,
        hasUserContent: !!userContent.replace(quotedContext, '').trim()
      });
    }
    
    return userContent;
  }

  /**
   * Adiciona informações do usuário para contextualizar mensagens de grupo
   * @param {Object} data - Dados da mensagem
   * @param {string} userContent - Conteúdo atual da mensagem
   * @returns {string} - Conteúdo com informação do usuário incluída
   */
  static addUserInfo(data, userContent) {
    // Verificar se é mensagem de grupo (from termina com @g.us)
    const isGroup = data.from && data.from.includes('@g.us');
    
    if (!isGroup) {
      return userContent; // Em conversas privadas não precisa identificar
    }
    
    // Extrair nome do usuário
    let userName = 'Alguém';
    
    if (data.notifyName) {
      userName = data.notifyName;
    } else if (data.author) {
      // Fallback: usar o número limpo se não tiver notifyName
      userName = data.author.replace('@c.us', '');
    }
    
    // Extrair ID do usuário (remover @g.us se for grupo)
    let userId = data.from || '';
    if (userId.includes('@g.us')) {
      userId = userId.replace('@g.us', '');
    }
    
    return `[${userName}] (${userId}): ${userContent}`;
  }
}
