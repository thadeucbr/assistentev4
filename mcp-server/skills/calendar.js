import CalendarAgent from '../agents/CalendarAgent.js';
import logger from '../utils/logger.js';

/**
 * Skill para gerenciamento de calendário
 * @param {Object} params - Parâmetros da skill
 * @param {string} params.userId - ID do usuário
 * @param {string} params.query - Consulta do usuário sobre calendário
 * @returns {Object} Resultado do processamento
 */
export default async function calendarSkill({ userId, query }) {
  try {
    logger.info('CalendarSkill', `Processando solicitação de calendário: ${query}`);

    // Validar parâmetros obrigatórios
    if (!userId) {
      throw new Error('ID do usuário é obrigatório');
    }

    if (!query) {
      throw new Error('Consulta é obrigatória');
    }

    // Processar solicitação usando o agente especializado
    const result = await CalendarAgent.processCalendarRequest(userId, query);

    logger.info('CalendarSkill', 'Solicitação processada com sucesso');

    return {
      success: result.success,
      message: result.message,
      data: {
        calendarEvent: result.calendarEvent,
        icalFile: result.icalFile,
        events: result.events
      }
    };
  } catch (error) {
    logger.error('CalendarSkill', 'Erro ao processar solicitação', error);
    
    return {
      success: false,
      message: 'Ocorreu um erro ao processar sua solicitação de calendário. Tente novamente.',
      error: error.message
    };
  }
}
