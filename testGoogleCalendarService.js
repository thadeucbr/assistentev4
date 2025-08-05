#!/usr/bin/env node

/**
 * Teste rápido do GoogleCalendarService
 */

import googleCalendarService from './src/services/GoogleCalendarService.js';

console.log('🧪 Teste GoogleCalendarService\n');

async function testService() {
  try {
    console.log('🔄 Inicializando GoogleCalendarService...');
    
    await googleCalendarService.initialize();
    console.log('✅ GoogleCalendarService inicializado com sucesso!');
    
    // Testar listagem de calendários
    console.log('\n📅 Testando listagem de calendários...');
    const calendars = await googleCalendarService.listCalendars();
    console.log(`✅ ${calendars.length} calendários encontrados`);
    
    // Mostrar calendário principal
    const primary = calendars.find(cal => cal.primary);
    if (primary) {
      console.log(`📌 Calendário principal: ${primary.summary}`);
    }
    
    console.log('\n🎉 Serviço funcionando perfeitamente!');
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('\n🔧 Possíveis soluções:');
    console.error('1. Verificar se todos os arquivos OAuth2 estão presentes');
    console.error('2. Verificar se o .env está configurado corretamente');
    console.error('3. Executar: node setupGoogleOAuthDesktop.js');
  }
}

testService();
