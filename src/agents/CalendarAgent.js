import GoogleCalendarService from '../services/GoogleCalendarService.js';
import ICalService from '../services/ICalService.js';
import sendMessage from '../whatsapp/sendMessage.js';
import sendFile from '../whatsapp/sendFile.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Agente especializado em gerenciamento de eventos do Google Calendar
 */
class CalendarAgent {
  /**
   * Processa uma solicitação de agendamento
   * @param {string} userId - ID do usuário
   * @param {string} query - Consulta do usuário sobre agendamento
   * @returns {Object} Resultado do processamento
   */
  async processCalendarRequest(userId, query) {
    try {
      logger.info('CalendarAgent', `Processando solicitação de calendário para usuário ${userId}: ${query}`);

      // Analisar a intenção da consulta
      const intent = this.analyzeIntent(query);
      
      switch (intent.action) {
        case 'create':
          return await this.createEvent(userId, intent);
        case 'list':
          return await this.listEvents(userId, intent);
        case 'delete':
          return await this.deleteEvent(userId, intent);
        default:
          return {
            success: false,
            message: 'Não consegui entender sua solicitação. Você pode pedir para criar um evento, listar eventos ou deletar um evento.'
          };
      }
    } catch (error) {
      logger.error('CalendarAgent', 'Erro ao processar solicitação', error);
      return {
        success: false,
        message: 'Ocorreu um erro ao processar sua solicitação de calendário.'
      };
    }
  }

  /**
   * Analisa a intenção da consulta do usuário
   * @param {string} query - Consulta do usuário
   * @returns {Object} Intenção analisada
   */
  analyzeIntent(query) {
    const lowerQuery = query.toLowerCase();
    
    // Palavras-chave para criar evento
    const createKeywords = [
      'agendar', 'criar evento', 'marcar reunião', 'marcar compromisso',
      'criar compromisso', 'agendar reunião', 'novo evento', 'nova reunião'
    ];
    
    // Palavras-chave para listar eventos
    const listKeywords = [
      'listar eventos', 'meus eventos', 'agenda', 'compromissos',
      'próximos eventos', 'eventos hoje', 'eventos da semana'
    ];
    
    // Palavras-chave para deletar evento
    const deleteKeywords = [
      'deletar evento', 'cancelar evento', 'remover evento',
      'cancelar reunião', 'cancelar compromisso'
    ];

    // Determinar ação
    let action = 'unknown';
    
    if (createKeywords.some(keyword => lowerQuery.includes(keyword))) {
      action = 'create';
    } else if (listKeywords.some(keyword => lowerQuery.includes(keyword))) {
      action = 'list';
    } else if (deleteKeywords.some(keyword => lowerQuery.includes(keyword))) {
      action = 'delete';
    }

    // Extrair informações básicas do evento (para criação)
    const eventInfo = this.extractEventInfo(query);

    return {
      action,
      query,
      eventInfo
    };
  }

  /**
   * Extrai informações do evento da consulta
   * @param {string} query - Consulta do usuário
   * @returns {Object} Informações extraídas
   */
  extractEventInfo(query) {
    const info = {
      title: null,
      description: null,
      datetime: null,
      location: null,
      duration: 60 // minutos, padrão
    };

    // Extrair título básico
    const titlePatterns = [
      /agendar (.+?) para/i,
      /criar evento (.+?) para/i,
      /marcar (.+?) para/i,
      /reunião (.+?) para/i,
      /compromisso (.+?) para/i
    ];

    for (const pattern of titlePatterns) {
      const match = query.match(pattern);
      if (match) {
        info.title = match[1].trim();
        break;
      }
    }

    // Se não encontrou título específico, extrair da consulta
    if (!info.title) {
      if (query.toLowerCase().includes('reunião')) {
        info.title = 'Reunião';
      } else if (query.toLowerCase().includes('compromisso')) {
        info.title = 'Compromisso';
      } else {
        info.title = 'Evento';
      }
    }

    // Extrair data e hora
    const dateTimeResult = this.parseDateTime(query);
    
    if (dateTimeResult.success) {
      info.datetime = {
        startDateTime: dateTimeResult.startDateTime,
        endDateTime: dateTimeResult.endDateTime,
        timeZone: dateTimeResult.timeZone
      };
    }

    return info;
  }

  /**
   * Faz parsing de data e hora da consulta
   * @param {string} query - Consulta do usuário
   * @returns {Object} Data de início e fim
   */
  parseDateTime(query) {
    // Trabalhar sempre com horário de Brasília (GMT-3)
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const lowerQuery = query.toLowerCase();
    
    // Padrões de data
    let targetDate = new Date(brasiliaTime);
    
    // Identificar dia
    if (lowerQuery.includes('hoje')) {
      // Manter data atual
    } else if (lowerQuery.includes('amanhã')) {
      targetDate.setDate(brasiliaTime.getDate() + 1);
    } else if (lowerQuery.includes('depois de amanhã')) {
      targetDate.setDate(brasiliaTime.getDate() + 2);
    } else if (lowerQuery.includes('próxima semana')) {
      targetDate.setDate(brasiliaTime.getDate() + 7);
    } else if (lowerQuery.includes('segunda')) {
      targetDate = this.getNextWeekday(1); // Segunda = 1
    } else if (lowerQuery.includes('terça')) {
      targetDate = this.getNextWeekday(2);
    } else if (lowerQuery.includes('quarta')) {
      targetDate = this.getNextWeekday(3);
    } else if (lowerQuery.includes('quinta')) {
      targetDate = this.getNextWeekday(4);
    } else if (lowerQuery.includes('sexta')) {
      targetDate = this.getNextWeekday(5);
    } else if (lowerQuery.includes('sábado')) {
      targetDate = this.getNextWeekday(6);
    } else if (lowerQuery.includes('domingo')) {
      targetDate = this.getNextWeekday(0);
    }

    // Extrair hora
    const timePatterns = [
      /às (\d{1,2}):?(\d{0,2})\s*h?/i,  // "às 15h", "às 15:30"
      /(\d{1,2}):(\d{2})/,              // "15:30"
      /(\d{1,2})\s*h\s*(\d{0,2})/i,     // "15h30", "15h"
      /(\d{1,2})\s*horas?/i             // "15 horas"
    ];

    let hour = null;
    let minute = 0;

    for (const pattern of timePatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        hour = parseInt(match[1]);
        minute = match[2] ? parseInt(match[2]) : 0;
        break;
      }
    }

    // Se não encontrou hora específica, usar padrão baseado no período
    if (hour === null) {
      if (lowerQuery.includes('manhã')) {
        hour = 9;
      } else if (lowerQuery.includes('tarde')) {
        hour = 14;
      } else if (lowerQuery.includes('noite')) {
        hour = 19;
      } else {
        // Se não especificou, criar para daqui 1 hora
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        targetDate = nextHour;
        hour = nextHour.getHours();
        minute = 0;
      }
    }

    // Definir hora na data alvo (mantendo timezone de Brasília)
    if (hour !== null) {
      targetDate.setHours(hour, minute, 0, 0);
    }

    // Se a hora já passou hoje, mover para amanhã (a menos que especificado "hoje")
    if (!lowerQuery.includes('hoje') && targetDate <= brasiliaTime) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Criar datas finais garantindo GMT-3
    const startDateTime = new Date(targetDate);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hora de duração

    return {
      success: true,
      dateTime: startDateTime,
      startDateTime,
      endDateTime,
      timeZone: 'America/Sao_Paulo'
    };
  }

  /**
   * Obtém a próxima ocorrência de um dia da semana
   * @param {number} weekday - Dia da semana (0=domingo, 1=segunda, etc.)
   * @returns {Date} Próxima data
   */
  getNextWeekday(weekday) {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const currentDay = brasiliaTime.getDay();
    const daysUntilTarget = (weekday - currentDay + 7) % 7;
    const targetDate = new Date(brasiliaTime);
    
    if (daysUntilTarget === 0) {
      // Se é o mesmo dia da semana, ir para a próxima semana
      targetDate.setDate(brasiliaTime.getDate() + 7);
    } else {
      targetDate.setDate(brasiliaTime.getDate() + daysUntilTarget);
    }
    
    return targetDate;
  }

  /**
   * Cria um novo evento
   * @param {string} userId - ID do usuário
   * @param {Object} intent - Intenção analisada
   * @returns {Object} Resultado da criação
   */
  async createEvent(userId, intent) {
    try {
      // Usar o parsing melhorado de data/hora
      const { startDateTime, endDateTime } = intent.eventInfo.datetime;

      // Preparar descrição do evento com informações do solicitante
      let eventDescription = `Evento agendado via assistente: ${intent.eventInfo.title || 'Evento'}`;
      eventDescription += `\n\n📱 Agendado por: ${userId}`;
      eventDescription += `\n🕒 Solicitado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      if (intent.query) {
        eventDescription += `\n📝 Mensagem original: "${intent.query}"`;
      }

      const eventData = {
        summary: intent.eventInfo.title || 'Evento agendado pelo assistente',
        description: eventDescription,
        startDateTime,
        endDateTime,
        location: intent.eventInfo.location,
        attendees: [] // Sem participantes por email - apenas arquivo .ics
      };

        // Criar evento no Google Calendar
        const calendarResult = await GoogleCalendarService.createEvent(eventData);

        // Gerar arquivo iCal para o usuário
        const icalResult = await ICalService.generateICalFile([eventData], 'evento');

        if (calendarResult.success && icalResult.success) {
          // Enviar confirmação simplificada para o usuário
          let message = `✅ *Evento criado com sucesso!*

📅 *Título:* ${eventData.summary}
🕒 *Data/Hora:* ${startDateTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
⏱️ *Duração:* ${intent.eventInfo.duration} minutos

✅ Evento criado no Google Calendar!
📤 Enviando arquivo .ics para você importar em seu calendário...`;

          await sendMessage(userId, message);

          // Enviar arquivo .ics via WhatsApp
          await this.sendICalFile(userId, icalResult.filePath, icalResult.fileName);

          return {
            success: true,
            message: 'Evento criado com sucesso',
            calendarEvent: calendarResult,
            icalFile: icalResult
          };
        } else {
          throw new Error('Falha ao criar evento ou gerar arquivo iCal');
        }
    } catch (error) {
      logger.error('CalendarAgent', 'Erro ao criar evento', error);
      
      const message = '❌ Ocorreu um erro ao criar o evento. Por favor, tente novamente ou verifique as configurações do Google Calendar.';
      await sendMessage(userId, message);
      
      return {
        success: false,
        message: 'Erro ao criar evento'
      };
    }
  }

  /**
   * Lista eventos próximos
   * @param {string} userId - ID do usuário
   * @param {Object} intent - Intenção analisada
   * @returns {Object} Resultado da listagem
   */
  async listEvents(userId, intent) {
    try {
      const result = await GoogleCalendarService.listEvents();

      if (result.success) {
        const events = result.events;
        
        if (events.length === 0) {
          const message = '📅 Não há eventos próximos na agenda.';
          await sendMessage(userId, message);
        } else {
          let message = `📅 *Próximos eventos na agenda:*\n\n`;
          
          events.forEach((event, index) => {
            const start = new Date(event.start.dateTime || event.start.date);
            message += `${index + 1}. *${event.summary || 'Sem título'}*\n`;
            message += `   🕒 ${start.toLocaleString('pt-BR')}\n`;
            if (event.location) {
              message += `   📍 ${event.location}\n`;
            }
            message += '\n';
          });

          await sendMessage(userId, message);
        }

        return {
          success: true,
          events: events.length,
          message: 'Eventos listados com sucesso'
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('CalendarAgent', 'Erro ao listar eventos', error);
      
      const message = '❌ Ocorreu um erro ao buscar os eventos. Verifique as configurações do Google Calendar.';
      await sendMessage(userId, message);
      
      return {
        success: false,
        message: 'Erro ao listar eventos'
      };
    }
  }

  /**
   * Deleta um evento
   * @param {string} userId - ID do usuário  
   * @param {Object} intent - Intenção analisada
   * @returns {Object} Resultado da deleção
   */
  async deleteEvent(userId, intent) {
    try {
      // Implementação básica - em uma versão real, você precisaria
      // de um sistema para identificar qual evento deletar
      const message = '⚠️ Para deletar um evento específico, você precisará fornecer mais detalhes ou usar o link direto do Google Calendar.';
      await sendMessage(userId, message);

      return {
        success: true,
        message: 'Instrução para deleção enviada'
      };
    } catch (error) {
      logger.error('CalendarAgent', 'Erro ao deletar evento', error);
      return {
        success: false,
        message: 'Erro ao deletar evento'
      };
    }
  }

  /**
   * Envia arquivo .ics via WhatsApp
   * @param {string} userId - ID do usuário
   * @param {string} filePath - Caminho do arquivo .ics
   * @param {string} fileName - Nome do arquivo
   */
  async sendICalFile(userId, filePath, fileName) {
    try {
      // Preparar legenda para o arquivo .ics
      const caption = '📅 *Arquivo do Evento (.ics)*\n\nBaixe este arquivo para importar o evento em seu calendário pessoal (Google, Outlook, Apple Calendar, etc.)';
      
      // Usar a função genérica de envio de arquivo
      const success = await sendFile(userId, filePath, fileName, caption, false, 'text/calendar');
      
      if (success) {
        logger.info('CalendarAgent', `Arquivo .ics enviado com sucesso para ${userId}`);
        return true;
      } else {
        logger.error('CalendarAgent', `Falha ao enviar arquivo .ics para ${userId}`);
        await sendMessage(userId, '⚠️ Não foi possível anexar o arquivo do evento. O evento foi criado no calendário principal.');
        return false;
      }
    } catch (error) {
      logger.error('CalendarAgent', 'Erro ao enviar arquivo .ics', error);
      await sendMessage(userId, '⚠️ Não foi possível anexar o arquivo do evento. O evento foi criado no calendário principal.');
      return false;
    }
  }
}

export default new CalendarAgent();
