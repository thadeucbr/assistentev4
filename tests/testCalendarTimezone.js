const { CalendarAgent } = require('./src/agents/CalendarAgent');
const logger = require('./src/utils/logger');

async function testCalendarTimezone() {
  try {
    console.log('\n🕒 Testando correção de timezone no CalendarAgent...\n');
    
    const calendarAgent = new CalendarAgent();
    
    // Mock do contexto de WhatsApp para simular a conversa
    const mockWhatsAppContext = {
      sendText: async (message) => {
        console.log(`📱 WhatsApp: ${message}`);
        return { success: true };
      },
      sendFile: async (filePath, filename, caption) => {
        console.log(`📎 WhatsApp Arquivo: ${filename}`);
        console.log(`📝 Caption: ${caption}`);
        return { success: true };
      }
    };

    // Teste 1: Criar evento para "amanhã às 19h"
    console.log('📅 Teste 1: "Criar uma reunião amanhã às 19h sobre planejamento"');
    const result1 = await calendarAgent.processCalendarRequest(
      'Criar uma reunião amanhã às 19h sobre planejamento',
      mockWhatsAppContext
    );
    console.log('✅ Resultado:', result1);
    console.log();

    // Teste 2: Criar evento para "sexta-feira às 14h"
    console.log('📅 Teste 2: "Agendar consulta sexta-feira às 14h"');
    const result2 = await calendarAgent.processCalendarRequest(
      'Agendar consulta sexta-feira às 14h',
      mockWhatsAppContext
    );
    console.log('✅ Resultado:', result2);
    console.log();

    // Teste 3: Testar parseamento de data/hora
    console.log('🕒 Teste 3: Testando parseDateTime diretamente');
    const testDates = [
      'amanhã às 19h',
      'sexta-feira às 14h',
      'segunda às 9h',
      'hoje às 16h30'
    ];

    for (const dateStr of testDates) {
      try {
        const parsed = calendarAgent.parseDateTime(dateStr);
        console.log(`"${dateStr}" -> ${parsed.toLocaleString('pt-BR', { 
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'full',
          timeStyle: 'short'
        })}`);
      } catch (error) {
        console.log(`❌ Erro ao parsear "${dateStr}":`, error.message);
      }
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
testCalendarTimezone().then(() => {
  console.log('\n✅ Teste de timezone concluído!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
