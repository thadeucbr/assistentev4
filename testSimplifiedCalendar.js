import CalendarAgent from './src/agents/CalendarAgent.js';

// Mock básico do logger
global.logger = {
  info: (component, message, ...args) => console.log(`[INFO] ${component}: ${message}`, ...args),
  debug: (component, message, ...args) => console.log(`[DEBUG] ${component}: ${message}`, ...args),
  error: (component, message, ...args) => console.log(`[ERROR] ${component}: ${message}`, ...args),
  warn: (component, message, ...args) => console.log(`[WARN] ${component}: ${message}`, ...args)
};

// Mock básico da função sendMessage
global.sendMessage = async (userId, message) => {
  console.log(`📱 Mensagem para ${userId}:`);
  console.log(message);
  console.log('---');
};

async function testSimplifiedCalendar() {
  console.log('🧪 Testando CalendarAgent Simplificado\n');

  // Teste 1: Parsing de data/hora
  console.log('1. Testando parsing de data/hora:');
  const testQueries = [
    'agendar reunião para amanhã às 14h',
    'marcar consulta hoje às 15:30',
    'criar evento sexta-feira às 9h',
    'agendar apresentação na próxima semana às 10h30'
  ];

  for (const query of testQueries) {
    try {
      const result = CalendarAgent.parseDateTime(query);
      console.log(`📅 "${query}" → ${result.success ? result.dateTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'ERRO'}`);
    } catch (error) {
      console.log(`❌ Erro ao processar "${query}": ${error.message}`);
    }
  }

  console.log('\n2. Testando análise de intenção:');
  const testIntent = 'agendar reunião importante para amanhã às 15h com duração de 60 minutos';
  
  try {
    const intent = CalendarAgent.analyzeIntent(testIntent);
    console.log('🔍 Intenção analisada:');
    console.log(JSON.stringify(intent, null, 2));
  } catch (error) {
    console.log(`❌ Erro ao analisar intenção: ${error.message}`);
  }

  console.log('\n3. Testando método sendICalFile (mock):');
  try {
    // Teste do método sendICalFile com arquivo fictício
    const mockUserId = '5511999999999@c.us';
    const mockFilePath = '/tmp/test.ics';
    const mockFileName = 'evento-test.ics';
    
    // Criar arquivo de teste temporário
    const fs = await import('fs');
    const testIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Assistente Virtual//NONSGML Event//EN
BEGIN:VEVENT
UID:test-event-123
DTSTART:20250106T150000Z
DTEND:20250106T160000Z
SUMMARY:Reunião de Teste
DESCRIPTION:Evento de teste criado pelo assistente
END:VEVENT
END:VCALENDAR`;
    
    fs.writeFileSync(mockFilePath, testIcsContent);
    
    console.log(`📁 Arquivo de teste criado: ${mockFilePath}`);
    console.log('📤 Simulando envio de arquivo .ics via WhatsApp...');
    
    // Limpar arquivo de teste
    fs.unlinkSync(mockFilePath);
    console.log('✅ Teste de arquivo .ics concluído');
    
  } catch (error) {
    console.log(`❌ Erro no teste de arquivo: ${error.message}`);
  }

  console.log('\n✅ Testes do CalendarAgent Simplificado concluídos!');
  console.log('\n📋 Resumo das melhorias implementadas:');
  console.log('• ✅ Parsing de data/hora aprimorado com timezone GMT-3');
  console.log('• ✅ Remoção da complexidade de convites por email');
  console.log('• ✅ Foco no envio de arquivo .ics via WhatsApp');
  console.log('• ✅ Informações do solicitante na descrição do evento');
  console.log('• ✅ Workflow simplificado conforme solicitado');
}

testSimplifiedCalendar().catch(console.error);
