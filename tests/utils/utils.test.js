import { describe, it, expect, jest } from '@jest/globals';
import parseScheduledTime from '../../src/utils/parseScheduledTime.js';

describe('parseScheduledTime', () => {
  // Teste para strings de data inválidas
  it('should return an invalid date for invalid date strings', () => {
    const result = parseScheduledTime('invalid date');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(true);
  });

  // Teste para strings de data no formato ISO 8601
  it('should correctly parse ISO 8601 date strings', () => {
    const isoString = '2024-01-01T12:00:00.000Z';
    const result = parseScheduledTime(isoString);
    expect(result).toEqual(new Date(isoString));
  });

  // Teste para durações relativas em linguagem natural
  it('should correctly parse relative time strings like "now + 5 minutes"', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const result = parseScheduledTime('now + 5 minutes');
    const expectedTime = new Date(now + 5 * 60 * 1000);

    // Permitir uma pequena tolerância para a execução do código
    expect(result.getTime()).toBeCloseTo(expectedTime.getTime(), -2);

    jest.restoreAllMocks();
  });

  it('should correctly parse relative time in seconds', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const result = parseScheduledTime('now + 30 seconds');
    const expectedTime = new Date(now + 30 * 1000);
    expect(result.getTime()).toBeCloseTo(expectedTime.getTime(), -2);

    jest.restoreAllMocks();
  });

  // Teste para durações no formato ISO 8601
  it('should correctly parse ISO 8601 duration strings like "PT3M"', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const result = parseScheduledTime('now + PT3M');
    const expectedTime = new Date(now + 3 * 60 * 1000);

    expect(result.getTime()).toBeCloseTo(expectedTime.getTime(), -2);

    jest.restoreAllMocks();
  });

  // Teste para timestamps numéricos
  it('should correctly handle numeric timestamps', () => {
    const timestamp = 1672531200000; // 2023-01-01T00:00:00.000Z
    const result = parseScheduledTime(timestamp);
    expect(result).toEqual(new Date(timestamp));
  });

  // Teste para objetos Date
  it('should correctly handle Date objects', () => {
    const date = new Date();
    const result = parseScheduledTime(date);
    expect(result).toEqual(date);
  });

  // Teste para formatos de duração não reconhecidos
  it('should throw an error for unrecognized duration formats', () => {
    expect(() => parseScheduledTime('now + 5 fortnights')).toThrow('Formato de duração não reconhecido: 5 fortnights');
  });
});
