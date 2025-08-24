import MCPToolExecutor from '../tools/MCPToolExecutor.js';
import simulateTyping from '../../whatsapp/simulateTyping.js';
import logger from '../../utils/logger.js';

/**
 * Handler dedicado ao tratamento de erros e recuperação
 */
class ErrorHandler {
  
  /**
   * Trata erro na geração da resposta principal da IA
   */
  static async handleAIResponseError(error, data) {
    logger.critical('ErrorHandler', `Erro ao gerar resposta principal: ${error.message}`);
    
    try {
      const mcpExecutor = new MCPToolExecutor();
      await mcpExecutor.executeTools([{
        name: 'send_message',
        arguments: {
          content: `❌ Desculpe, ocorreu um erro temporário ao processar sua mensagem. Tente novamente em alguns segundos.\n\nDetalhes: ${error.message.includes('Rate limit') ? 'Limite de uso da IA atingido temporariamente.' : 'Erro interno do sistema.'}`
        }
      }]);
      logger.milestone('ErrorHandler', 'Mensagem de erro enviada ao usuário');
      return true; // Erro tratado com sucesso
    } catch (fallbackError) {
      logger.critical('ErrorHandler', `Falha ao enviar mensagem de erro: ${fallbackError.message}`);
      throw error; // Re-propagar erro original se não conseguiu tratar
    }
  }

  /**
   * Trata erro crítico no processamento geral
   */
  static async handleCriticalError(error, message) {
    logger.critical('ErrorHandler', `Erro crítico no processamento: ${error.message}`, {
      stack: error.stack
    });
    
    try {
      const { data } = message;
      await simulateTyping(data.from, false);
      
      // Tentar usar MCP para enviar mensagem de erro
      const fallbackMcpExecutor = new MCPToolExecutor();
      await fallbackMcpExecutor.executeTools([{
        name: 'send_message',
        arguments: {
          content: `❌ Ocorreu um erro interno. Por favor, tente novamente em alguns minutos.\n\n${error.message.includes('Rate limit') ? '🕐 Sistema temporariamente sobrecarregado.' : '⚠️ Erro no processamento da mensagem.'}`
        }
      }]);
      
      logger.milestone('ErrorHandler', 'Mensagem de erro enviada ao usuário via MCP');
    } catch (fallbackError) {
      logger.critical('ErrorHandler', `Erro no fallback: ${fallbackError.message}`);
      logger.critical('ErrorHandler', 'CRÍTICO: Não foi possível notificar o usuário sobre o erro');
    }
    
    // Não re-propagar - deixar aplicação continuar executando
    logger.milestone('ErrorHandler', 'Erro tratado - aplicação continuará executando');
  }

  /**
   * Verifica se um erro é relacionado a rate limit
   */
  static isRateLimitError(error) {
    return error.message.includes('Rate limit') || 
           error.message.includes('rate_limit_exceeded') ||
           error.message.includes('Too Many Requests');
  }

  /**
   * Verifica se um erro é recuperável
   */
  static isRecoverableError(error) {
    const recoverablePatterns = [
      'Rate limit',
      'timed out',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'network',
      'temporarily unavailable'
    ];
    
    return recoverablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Gera mensagem de erro amigável baseada no tipo de erro
   */
  static generateUserFriendlyErrorMessage(error) {
    if (this.isRateLimitError(error)) {
      return '🕐 Sistema temporariamente sobrecarregado. Tente novamente em alguns minutos.';
    }
    
    if (this.isRecoverableError(error)) {
      return '⚠️ Problema temporário de conexão. Tente novamente em alguns segundos.';
    }
    
    return '❌ Ocorreu um erro interno. Nossa equipe foi notificada.';
  }
}

export default ErrorHandler;
