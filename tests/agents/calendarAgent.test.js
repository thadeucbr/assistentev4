import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../src/services/GoogleCalendarService.js', () => ({
  default: {
    createEvent: jest.fn(),
    listEvents: jest.fn(),
  },
}));
jest.unstable_mockModule('../../src/services/ICalService.js', () => ({
  default: {
    generateICalFile: jest.fn(),
  },
}));
jest.unstable_mockModule('../../src/whatsapp/sendMessage.js', () => ({
  default: jest.fn(),
}));
jest.unstable_mockModule('../../src/whatsapp/sendFile.js', () => ({
  default: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Dynamically import modules after mocks are set up
const { default: CalendarAgent } = await import('../../src/agents/CalendarAgent.js');
const { default: GoogleCalendarService } = await import('../../src/services/GoogleCalendarService.js');
const { default: ICalService } = await import('../../src/services/ICalService.js');
const { default: sendMessage } = await import('../../src/whatsapp/sendMessage.js');
const { default: sendFile } = await import('../../src/whatsapp/sendFile.js');

describe('CalendarAgent', () => {
  const userId = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeIntent', () => {
    it('should detect a "create" intent', () => {
      const intent = CalendarAgent.analyzeIntent('agendar uma reunião para amanhã às 10h');
      expect(intent.action).toBe('create');
    });

    it('should detect a "list" intent', () => {
      const intent = CalendarAgent.analyzeIntent('quais são os meus próximos eventos?');
      expect(intent.action).toBe('list');
    });

    it('should detect a "delete" intent', () => {
      // Using a query that directly contains the keyword
      const intent = CalendarAgent.analyzeIntent('por favor, cancelar evento de amanhã');
      expect(intent.action).toBe('delete');
    });
  });

  describe('parseDateTime', () => {
    const mockDate = new Date('2024-08-27T10:00:00.000Z'); // A fixed Tuesday
    const OriginalDate = global.Date;

    beforeEach(() => {
      // Store and restore original Date object to avoid recursion
      global.Date = jest.fn((...args) => {
        if (args.length) {
          return new OriginalDate(...args);
        }
        return new OriginalDate('2024-08-27T10:00:00.000Z');
      });
      Object.assign(global.Date, OriginalDate);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should parse "amanhã às 15h"', () => {
        const query = 'reunião amanhã às 15h';
        const result = CalendarAgent.parseDateTime(query);
        const expectedDate = new Date('2024-08-28T15:00:00.000');
        expect(result.success).toBe(true);
        // Comparing ISO strings to avoid timezone issues in tests
        expect(new Date(result.startDateTime).toISOString().slice(0, 16)).toBe(expectedDate.toISOString().slice(0, 16));
    });

    it('should parse "próxima segunda às 9:30"', () => {
        const query = 'compromisso próxima segunda às 9:30';
        const result = CalendarAgent.parseDateTime(query);
        // Next Monday from Tuesday Aug 27 is Sep 2
        const expectedDate = new Date('2024-09-02T09:30:00.000');
        expect(result.success).toBe(true);
        expect(new Date(result.startDateTime).toISOString().slice(0, 16)).toBe(expectedDate.toISOString().slice(0, 16));
    });
  });

  describe('createEvent', () => {
    it('should create an event and send confirmation', async () => {
      const intent = {
        action: 'create',
        query: 'agendar reunião para amanhã às 14h',
        eventInfo: {
          title: 'Reunião',
          datetime: {
            startDateTime: new Date('2024-08-28T14:00:00'),
            endDateTime: new Date('2024-08-28T15:00:00'),
          },
          duration: 60
        },
      };

      GoogleCalendarService.createEvent.mockResolvedValue({ success: true, event: {} });
      ICalService.generateICalFile.mockResolvedValue({ success: true, filePath: '/tmp/test.ics', fileName: 'test.ics' });
      // Mock the internal call to sendICalFile which calls sendFile
      const sendICalFileSpy = jest.spyOn(CalendarAgent, 'sendICalFile').mockResolvedValue(true);

      const result = await CalendarAgent.createEvent(userId, intent);

      expect(GoogleCalendarService.createEvent).toHaveBeenCalled();
      expect(ICalService.generateICalFile).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(userId, expect.stringContaining('Evento criado com sucesso!'));
      expect(sendICalFileSpy).toHaveBeenCalledWith(userId, '/tmp/test.ics', 'test.ics');
      expect(result.success).toBe(true);

      sendICalFileSpy.mockRestore();
    });
  });

  describe('listEvents', () => {
    it('should list events when events are found', async () => {
      const mockEvents = [
        { summary: 'Event 1', start: { dateTime: '2024-08-28T10:00:00Z' } },
        { summary: 'Event 2', start: { dateTime: '2024-08-29T14:00:00Z' } },
      ];
      GoogleCalendarService.listEvents.mockResolvedValue({ success: true, events: mockEvents });

      const result = await CalendarAgent.listEvents(userId, {});

      expect(GoogleCalendarService.listEvents).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(userId, expect.stringContaining('*Próximos eventos na agenda:*'));
      expect(sendMessage).toHaveBeenCalledWith(userId, expect.stringContaining('Event 1'));
      expect(result.success).toBe(true);
      expect(result.events).toBe(2);
    });

    it('should send a message when no events are found', async () => {
      GoogleCalendarService.listEvents.mockResolvedValue({ success: true, events: [] });

      const result = await CalendarAgent.listEvents(userId, {});

      expect(sendMessage).toHaveBeenCalledWith(userId, '📅 Não há eventos próximos na agenda.');
      expect(result.success).toBe(true);
      expect(result.events).toBe(0);
    });
  });
});
