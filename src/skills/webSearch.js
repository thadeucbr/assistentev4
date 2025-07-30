import hybridWebSearch from '../agents/HybridWebSearchAgent.js';
import fallbackWebSearch from '../agents/FallbackWebSearchAgent.js';
import logger from '../utils/logger.js';

export default async function webSearch(query) {
  logger.info('WebSearch', `Iniciando busca para: "${query}"`);
  
  try {
    // Usar busca híbrida (Playwright + Fallback automático)
    const result = await hybridWebSearch(query);
    
    if (result && !result.error && result.result) {
      logger.info('WebSearch', `Busca concluída com sucesso via ${result.method}`);
      return {
        success: true,
        result: result.result,
        sources: result.sources || [],
        query: result.query,
        method: result.method
      };
    }
    
    // Se ainda assim falhou, tentar fallback direto como último recurso
    logger.warn('WebSearch', 'Busca híbrida falhou, tentando fallback direto...');
    
    const fallbackResult = await fallbackWebSearch(query);
    
    if (fallbackResult && !fallbackResult.error && fallbackResult.result) {
      logger.info('WebSearch', 'Busca fallback final concluída com sucesso');
      return {
        success: true,
        result: fallbackResult.result,
        sources: fallbackResult.sources || [],
        query: fallbackResult.query,
        method: 'last-resort-fallback',
        usedEngine: fallbackResult.usedEngine
      };
    }
    
    // Se tudo falhou
    logger.error('WebSearch', 'Todos os métodos de busca falharam');
    return { 
      error: 'Falha em todos os sistemas de busca web',
      hybridError: result?.error,
      fallbackError: fallbackResult?.error,
      query
    };
    
  } catch (error) {
    logger.error('WebSearch', 'Erro crítico no sistema de busca:', error);
    return { 
      error: 'Falha crítica completa no sistema de busca web', 
      details: error.message,
      query
    };
  }
}