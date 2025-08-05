import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import GoogleCalendarOAuthService from './GoogleCalendarOAuthService.js';

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.auth = null;
    this.useOAuth = false;
  }

  /**
   * Inicializa a autenticação com Google Calendar
   * Prioriza OAuth2 sobre Service Account
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return this.calendar;
      }

      logger.info('Inicializando Google Calendar Service...');

      const authType = process.env.GOOGLE_CALENDAR_AUTH_TYPE || 'service_account';
      
      if (authType === 'oauth2') {
        await this.initializeOAuth2();
      } else {
        await this.initializeServiceAccount();
      }

      this.calendar = google.calendar({ 
        version: 'v3', 
        auth: this.auth 
      });

      this.isInitialized = true;
      logger.info(`Google Calendar Service inicializado com sucesso (${authType})`);
      
      return this.calendar;
    } catch (error) {
      logger.error('Erro ao inicializar Google Calendar Service:', error);
      throw error;
    }
  }

  async initializeServiceAccount() {
    const credentialsPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account-key.json';
    
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Arquivo de credenciais Service Account não encontrado: ${credentialsPath}`);
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  async initializeOAuth2() {
    const credentialsPath = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || './google-oauth-credentials.json';
    const tokenPath = process.env.GOOGLE_TOKEN_PATH || './google-token.json';
    
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Arquivo de credenciais OAuth2 não encontrado: ${credentialsPath}. Execute: node setupGoogleOAuthDesktop.js`);
    }

    if (!fs.existsSync(tokenPath)) {
      throw new Error(`Token OAuth2 não encontrado: ${tokenPath}. Execute: node setupGoogleOAuthDesktop.js`);
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

    // Suporte para credenciais web e desktop
    const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed || credentials.desktop || {};
    
    if (!client_id || !client_secret) {
      throw new Error('Credenciais OAuth2 inválidas. Verifique o arquivo de credenciais.');
    }

    // Para credenciais desktop, não usar redirect URI
    const redirectUri = credentials.web ? redirect_uris[0] : undefined;
    
    this.auth = new google.auth.OAuth2(client_id, client_secret, redirectUri);
    this.auth.setCredentials(token);
  }

  /**
   * Cria um evento no Google Calendar
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.summary - Título do evento
   * @param {string} eventData.description - Descrição do evento
   * @param {Date} eventData.startDateTime - Data/hora de início
   * @param {Date} eventData.endDateTime - Data/hora de fim
   * @param {string} eventData.location - Local do evento (opcional)
   * @param {Array} eventData.attendees - Lista de emails dos participantes (opcional)
   * @returns {Object} Resultado da criação do evento
   */
  async createEvent(eventData) {
    try {
      // Se estiver usando OAuth2, delegar para o serviço OAuth2
      if (this.useOAuth) {
        return await GoogleCalendarOAuthService.createEvent(eventData);
      }

      if (!this.calendar) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Falha ao inicializar serviço do Google Calendar');
        }
      }

      const { summary, description, startDateTime, endDateTime, location, attendees } = eventData;

      // Configurar evento
      const event = {
        summary,
        description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
      };

      // Adicionar local se fornecido
      if (location) {
        event.location = location;
      }

      // Preparar lista de participantes
      let eventAttendees = [];
      
      // Adicionar email principal como participante obrigatório (do .env)
      const ownerEmail = process.env.GOOGLE_CALENDAR_OWNER_EMAIL;
      if (ownerEmail && ownerEmail !== 'seu_email@gmail.com') {
        eventAttendees.push({ 
          email: ownerEmail,
          responseStatus: 'accepted',
          displayName: 'Organizador Principal'
        });
      }

      // Adicionar outros participantes se fornecidos
      if (attendees && attendees.length > 0) {
        const additionalAttendees = attendees.map(email => ({ 
          email,
          responseStatus: 'needsAction'
        }));
        eventAttendees.push(...additionalAttendees);
      }

      // Adicionar participantes ao evento se houver algum
      if (eventAttendees.length > 0) {
        event.attendees = eventAttendees;
        // Enviar convites automaticamente
        event.sendNotifications = true;
      }

      // Criar evento no calendário
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      logger.info('GoogleCalendarService', `Evento criado com sucesso: ${response.data.id}`);
      
      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        event: response.data
      };
    } catch (error) {
      logger.error('GoogleCalendarService', 'Falha ao criar evento', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Lista eventos do calendário
   * @param {Object} options - Opções de busca
   * @param {Date} options.timeMin - Data mínima
   * @param {Date} options.timeMax - Data máxima
   * @param {number} options.maxResults - Número máximo de resultados
   * @returns {Array} Lista de eventos
   */
  async listEvents(options = {}) {
    try {
      // Se estiver usando OAuth2, delegar para o serviço OAuth2
      if (this.useOAuth) {
        return await GoogleCalendarOAuthService.listEvents(options);
      }

      if (!this.calendar) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Falha ao inicializar serviço do Google Calendar');
        }
      }

      const {
        timeMin = new Date(),
        timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        maxResults = 10
      } = options;

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return {
        success: true,
        events: response.data.items || []
      };
    } catch (error) {
      logger.error('GoogleCalendarService', 'Falha ao listar eventos', error);
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  }

  /**
   * Deleta um evento do calendário
   * @param {string} eventId - ID do evento
   * @returns {Object} Resultado da operação
   */
  async deleteEvent(eventId) {
    try {
      if (!this.calendar) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Falha ao inicializar serviço do Google Calendar');
        }
      }

      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      logger.info('GoogleCalendarService', `Evento deletado com sucesso: ${eventId}`);
      
      return {
        success: true,
        message: 'Evento deletado com sucesso'
      };
    } catch (error) {
      logger.error('GoogleCalendarService', 'Falha ao deletar evento', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new GoogleCalendarService();
