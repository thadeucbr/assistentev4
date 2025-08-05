import { google } from 'googleapis';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';

class GoogleCalendarOAuthService {
  constructor() {
    this.calendar = null;
    this.oauth2Client = null;
    this.tokenPath = './google-token.json';
  }

  /**
   * Inicializa a autenticação OAuth2 com Google Calendar
   */
  async initialize() {
    try {
      // Configurações OAuth2 - você precisa criar estas credenciais no Google Console
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback';

      if (!clientId || !clientSecret) {
        logger.error('GoogleCalendarOAuth', 'Credenciais OAuth2 não configuradas. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET');
        return false;
      }

      // Criar cliente OAuth2
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

      // Tentar carregar token existente
      if (await this.loadSavedToken()) {
        // Inicializar API do Calendar
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        logger.info('GoogleCalendarOAuth', 'Serviço OAuth2 inicializado com sucesso');
        return true;
      } else {
        logger.warn('GoogleCalendarOAuth', 'Token não encontrado. Execute getAuthUrl() para obter URL de autorização');
        return false;
      }
    } catch (error) {
      logger.error('GoogleCalendarOAuth', 'Falha ao inicializar:', error);
      return false;
    }
  }

  /**
   * Carrega token salvo do arquivo
   */
  async loadSavedToken() {
    try {
      if (!existsSync(this.tokenPath)) {
        return false;
      }

      const tokenData = JSON.parse(await readFile(this.tokenPath, 'utf8'));
      this.oauth2Client.setCredentials(tokenData);
      
      // Verificar se o token precisa ser renovado
      if (tokenData.expiry_date && Date.now() >= tokenData.expiry_date) {
        logger.info('GoogleCalendarOAuth', 'Token expirado, tentando renovar...');
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          await this.saveToken(credentials);
          this.oauth2Client.setCredentials(credentials);
        } catch (refreshError) {
          logger.error('GoogleCalendarOAuth', 'Falha ao renovar token:', refreshError);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('GoogleCalendarOAuth', 'Erro ao carregar token:', error);
      return false;
    }
  }

  /**
   * Gera URL de autorização para o usuário
   */
  getAuthUrl() {
    if (!this.oauth2Client) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback';

      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    const scopes = ['https://www.googleapis.com/auth/calendar'];
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Força a mostrar a tela de consentimento para obter refresh_token
    });

    return authUrl;
  }

  /**
   * Troca código de autorização por token
   */
  async exchangeCodeForToken(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      await this.saveToken(tokens);
      this.oauth2Client.setCredentials(tokens);
      
      // Inicializar API do Calendar
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      logger.info('GoogleCalendarOAuth', 'Token obtido e salvo com sucesso');
      return true;
    } catch (error) {
      logger.error('GoogleCalendarOAuth', 'Erro ao trocar código por token:', error);
      return false;
    }
  }

  /**
   * Salva token no arquivo
   */
  async saveToken(tokens) {
    await writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
  }

  /**
   * Cria um evento no Google Calendar do usuário
   */
  async createEvent(eventData) {
    try {
      if (!this.calendar) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Falha ao inicializar serviço OAuth2 do Google Calendar');
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

      logger.info('GoogleCalendarOAuth', `Evento criado com sucesso: ${response.data.id}`);
      
      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        event: response.data
      };
    } catch (error) {
      logger.error('GoogleCalendarOAuth', 'Falha ao criar evento:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Lista eventos do calendário do usuário
   */
  async listEvents(options = {}) {
    try {
      if (!this.calendar) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Falha ao inicializar serviço OAuth2 do Google Calendar');
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
      logger.error('GoogleCalendarOAuth', 'Falha ao listar eventos:', error);
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  }
}

export default new GoogleCalendarOAuthService();
