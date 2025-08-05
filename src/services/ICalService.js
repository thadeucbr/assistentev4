import ical from 'ical-generator';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

class ICalService {
  constructor() {
    this.outputDir = './temp_calendar';
  }

  /**
   * Garante que o diretório de saída existe
   */
  async ensureOutputDir() {
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }
  }

  /**
   * Gera um arquivo iCal (.ics) para um evento
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.summary - Título do evento
   * @param {string} eventData.description - Descrição do evento
   * @param {Date} eventData.startDateTime - Data/hora de início
   * @param {Date} eventData.endDateTime - Data/hora de fim
   * @param {string} eventData.location - Local do evento (opcional)
   * @param {string} eventData.organizer - Email do organizador (opcional)
   * @returns {Object} Resultado da geração do arquivo
   */
  async generateICalFile(eventData) {
    try {
      await this.ensureOutputDir();

      const { summary, description, startDateTime, endDateTime, location, organizer } = eventData;

      // Criar calendário
      const calendar = ical({
        name: 'Evento Agendado',
        description: 'Evento criado pelo assistente virtual',
        timezone: 'America/Sao_Paulo'
      });

      // Adicionar evento
      const event = calendar.createEvent({
        start: startDateTime,
        end: endDateTime,
        summary: summary,
        description: description,
        location: location || '',
        organizer: organizer || 'assistente@virtual.com'
      });

      // Gerar nome do arquivo único
      const timestamp = Date.now();
      const fileName = `evento_${timestamp}.ics`;
      const filePath = path.join(this.outputDir, fileName);

      // Salvar arquivo
      await writeFile(filePath, calendar.toString());

      logger.info('ICalService', `Arquivo iCal gerado: ${fileName}`);

      return {
        success: true,
        fileName,
        filePath,
        content: calendar.toString()
      };
    } catch (error) {
      logger.error('ICalService', 'Falha ao gerar arquivo iCal', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gera um arquivo iCal com múltiplos eventos
   * @param {Array} events - Array de eventos
   * @param {string} calendarName - Nome do calendário
   * @returns {Object} Resultado da geração do arquivo
   */
  async generateICalFileMultiple(events, calendarName = 'Eventos Agendados') {
    try {
      await this.ensureOutputDir();

      // Criar calendário
      const calendar = ical({
        name: calendarName,
        description: 'Eventos criados pelo assistente virtual',
        timezone: 'America/Sao_Paulo'
      });

      // Adicionar cada evento
      events.forEach(eventData => {
        const { summary, description, startDateTime, endDateTime, location, organizer } = eventData;
        
        calendar.createEvent({
          start: startDateTime,
          end: endDateTime,
          summary: summary,
          description: description,
          location: location || '',
          organizer: organizer || 'assistente@virtual.com'
        });
      });

      // Gerar nome do arquivo único
      const timestamp = Date.now();
      const fileName = `eventos_${timestamp}.ics`;
      const filePath = path.join(this.outputDir, fileName);

      // Salvar arquivo
      await writeFile(filePath, calendar.toString());

      logger.info('ICalService', `Arquivo iCal com ${events.length} eventos gerado: ${fileName}`);

      return {
        success: true,
        fileName,
        filePath,
        content: calendar.toString(),
        eventCount: events.length
      };
    } catch (error) {
      logger.error('ICalService', 'Falha ao gerar arquivo iCal múltiplo', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new ICalService();
