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
    
    // Limpar o número do WhatsApp da mensagem
    userContent = userContent.replace(process.env.WHATSAPP_NUMBER, '').trim();

    return { userContent, imageAnalysisResult };
  }
}
