import smartWebSearch from '../agents/SmartWebSearchAgent.js';
import fallbackWebSearch from '../agents/FallbackWebSearchAgent.js';
import logger from '../utils/logger.js';

export default async function webSearch(query) {
  logger.info('WebSearch', `Iniciando busca inteligente para: "${query}"`);
  
  try {
    // Tentar primeiro com o agente inteligente
    const smartResult = await smartWebSearch(query);
    
    if (smartResult && !smartResult.error && smartResult.result) {
      logger.info('WebSearch', 'Busca inteligente concluída com sucesso');
      return {
        success: true,
        result: smartResult.result,
        sources: smartResult.sources || [],
        query: smartResult.query,
        method: 'smart'
      };
    }
    
    // Se falhou, usar fallback
    logger.warn('WebSearch', 'Busca inteligente falhou, usando fallback...', smartResult?.error);
    
    const fallbackResult = await fallbackWebSearch(query);
    
    if (fallbackResult && !fallbackResult.error && fallbackResult.result) {
      logger.info('WebSearch', 'Busca fallback concluída com sucesso');
      return {
        success: true,
        result: fallbackResult.result,
        sources: fallbackResult.sources || [],
        query: fallbackResult.query,
        method: 'fallback',
        usedEngine: fallbackResult.usedEngine
      };
    }
    
    // Se ambos falharam
    logger.error('WebSearch', 'Ambos os métodos de busca falharam');
    return { 
      error: 'Falha em ambos os sistemas de busca web',
      smartError: smartResult?.error,
      fallbackError: fallbackResult?.error,
      query
    };
    
  } catch (error) {
    logger.error('WebSearch', 'Erro crítico no sistema de busca:', error);
    
    // Último recurso: tentar fallback simples
    try {
      logger.warn('WebSearch', 'Tentando último recurso com fallback...');
      const lastResortResult = await fallbackWebSearch(query);
      
      if (lastResortResult && !lastResortResult.error) {
        return {
          success: true,
          result: lastResortResult.result,
          sources: lastResortResult.sources || [],
          query: lastResortResult.query,
          method: 'last-resort'
        };
      }
    } catch (fallbackError) {
      logger.error('WebSearch', 'Último recurso também falhou:', fallbackError);
    }
    
    return { 
      error: 'Falha crítica completa no sistema de busca web', 
      details: error.message,
      query
    };
  }
}