export default function parseScheduledTime(scheduledTime) {
  // Verifica se scheduledTime é uma string; se não, tenta converter
  if (typeof scheduledTime !== 'string') {
    // Se for um número (timestamp) ou objeto Date, converte para ISO string
    if (typeof scheduledTime === 'number') {
      scheduledTime = new Date(scheduledTime).toISOString();
    } else if (scheduledTime instanceof Date) {
      scheduledTime = scheduledTime.toISOString();
    } else {
      throw new Error('O parâmetro scheduledTime deve ser uma string no formato ISO 8601 ou "now + <duração>"');
    }
  }

  if (scheduledTime.startsWith('now +')) {
    const durationPart = scheduledTime.replace('now +', '').trim();
    let msToAdd = 0;
    
    // Tenta analisar formato ISO 8601 para durações, ex: "PT3M", "PT1H30M", "PT45S"
    const isoRegex = /^P(T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/;
    const isoMatch = durationPart.match(isoRegex);
    if (isoMatch) {
      const hours = parseInt(isoMatch[2] || '0', 10);
      const minutes = parseInt(isoMatch[3] || '0', 10);
      const seconds = parseInt(isoMatch[4] || '0', 10);
      msToAdd = (hours * 3600 + minutes * 60 + seconds) * 1000;
    } else {
      // Fallback: tenta analisar formato em linguagem natural, ex: "3 minutes", "5 minutes", "10 seconds"
      const nlRegex = /^(\d+)\s*(second|seconds|minute|minutes|hour|hours)$/i;
      const nlMatch = durationPart.match(nlRegex);
      if (nlMatch) {
        const value = parseInt(nlMatch[1], 10);
        const unit = nlMatch[2].toLowerCase();
        if (unit.startsWith('second')) {
          msToAdd = value * 1000;
        } else if (unit.startsWith('minute')) {
          msToAdd = value * 60 * 1000;
        } else if (unit.startsWith('hour')) {
          msToAdd = value * 3600 * 1000;
        }
      } else {
        throw new Error('Formato de duração não reconhecido: ' + durationPart);
      }
    }
    return new Date(Date.now() + msToAdd);
  } else {
    // Assume que é uma string de data em formato ISO 8601
    return new Date(scheduledTime);
  }
}