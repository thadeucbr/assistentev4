import updateUserProfileSummary from '../../skills/updateUserProfileSummary.js';
import logger from '../../utils/logger.js';

/**
 * Gerenciador de tarefas executadas em background
 */
class BackgroundTaskManager {
  
  /**
   * Executa todas as atualizações assíncronas em background
   */
  static async executeBackgroundTasks(userId, messages) {
    logger.debug('BackgroundTaskManager', 'Iniciando atualizações assíncronas em background');
    
    // Lista de tarefas para executar em background
    const backgroundTasks = [
      this._updateUserProfileSummary(userId, messages),
      this._processLongTermMemory(userId, messages),
      this._updateUserMetrics(userId, messages)
    ];

    // Executar todas as tarefas sem aguardar (fire-and-forget)
    backgroundTasks.forEach(task => {
      task.catch(error => {
        logger.error('BackgroundTaskManager', `Erro em tarefa de background: ${error.message}`);
      });
    });

    logger.timing('BackgroundTaskManager', 'Tarefas de background iniciadas');
  }

  /**
   * Atualiza o resumo do perfil do usuário
   * @private
   */
  static async _updateUserProfileSummary(userId, messages) {
    try {
      await updateUserProfileSummary(userId, messages);
      logger.debug('BackgroundTaskManager', 'Resumo do perfil atualizado com sucesso');
    } catch (error) {
      logger.error('BackgroundTaskManager', `Erro ao atualizar resumo do perfil: ${error.message}`);
    }
  }

  /**
   * Processa memória de longo prazo (LTM)
   * @private
   */
  static async _processLongTermMemory(userId, messages) {
    try {
      // Limitar o texto para LTM a um tamanho razoável (aprox. 6000 tokens = 24000 chars)
      const conversationText = messages.map((m) => m.content).join('\n');
      const limitedText = conversationText.length > 24000 
        ? conversationText.substring(conversationText.length - 24000) 
        : conversationText;
      
      // TODO: Implementar processamento de LTM aqui se necessário
      logger.debug('BackgroundTaskManager', `LTM processada: ${limitedText.length} caracteres`);
    } catch (error) {
      logger.error('BackgroundTaskManager', `Erro ao processar LTM: ${error.message}`);
    }
  }

  /**
   * Atualiza métricas do usuário
   * @private
   */
  static async _updateUserMetrics(userId, messages) {
    try {
      // Calcular métricas básicas
      const totalMessages = messages.length;
      const userMessages = messages.filter(m => m.role === 'user').length;
      const assistantMessages = messages.filter(m => m.role === 'assistant').length;
      
      logger.debug('BackgroundTaskManager', `Métricas atualizadas para usuário ${userId}:`, {
        totalMessages,
        userMessages,
        assistantMessages
      });
      
      // TODO: Salvar métricas em banco de dados se necessário
    } catch (error) {
      logger.error('BackgroundTaskManager', `Erro ao atualizar métricas: ${error.message}`);
    }
  }

  /**
   * Executa limpeza de recursos temporários
   */
  static async cleanupTemporaryResources() {
    try {
      // TODO: Implementar limpeza de arquivos temporários, cache, etc.
      logger.debug('BackgroundTaskManager', 'Limpeza de recursos temporários executada');
    } catch (error) {
      logger.error('BackgroundTaskManager', `Erro na limpeza de recursos: ${error.message}`);
    }
  }
}

export default BackgroundTaskManager;
