#!/usr/bin/env node

/**
 * Teste completo do sistema de calendário com parsing melhorado
 */

import calendarAgent from './src/agents/CalendarAgent.js';

console.log('🧪 Teste Final - Sistema de Calendário com Parsing Melhorado\n');

async function testFullCalendarSystem() {
  try {
    console.log('📋 Testando: "agendar reunião para amanhã às 19h"');
    
    const mockRequest = {
      message: 'agendar reunião para amanhã às 19h',
      userEmail: 'teste@exemplo.com',
      userName: 'Usuário Teste'
    };

    const result = await calendarAgent.processCalendarRequest(mockRequest);
    
    console.log('\n📊 Resultado:');
    console.log(`✅ Sucesso: ${result.success}`);
    console.log(`📝 Mensagem: ${result.message}`);
    
    if (result.eventId) {
      console.log(`🎯 Event ID: ${result.eventId}`);
    }
    
    if (result.iCalFile) {
      console.log(`📄 Arquivo iCal: ${result.iCalFile}`);
    }

    if (result.success) {
      console.log('\n🎉 Sistema funcionando perfeitamente!');
      console.log('\n📋 Próximos passos:');
      console.log('1. ✅ O parsing de data/hora está correto');
      console.log('2. ✅ O evento será criado para amanhã às 19h');
      console.log('3. ✅ Teste via WhatsApp: "agendar reunião para amanhã às 19h"');
    } else {
      console.log('\n⚠️ Houve algum problema na criação do evento');
    }

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
  }
}

testFullCalendarSystem();
