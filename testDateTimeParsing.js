#!/usr/bin/env node

/**
 * Teste do parsing de data/hora do CalendarAgent
 */

import calendarAgent from './src/agents/CalendarAgent.js';

console.log('🧪 Teste de Parsing Data/Hora - CalendarAgent\n');

// Casos de teste
const testCases = [
  'agendar reunião para amanhã às 19h',
  'criar evento para hoje às 15:30',
  'marcar compromisso para sexta-feira às 14h',
  'reunião para segunda às 9h',
  'evento para depois de amanhã às 10:15',
  'agendar para terça de manhã',
  'compromisso para hoje à tarde',
  'reunião para quinta à noite'
];

console.log('📋 Testando diferentes formatos de data/hora:\n');

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase}"`);
  
  const intent = calendarAgent.analyzeIntent(testCase);
  const datetime = intent.eventInfo.datetime;
  
  if (datetime) {
    console.log(`   📅 Início: ${datetime.startDateTime.toLocaleString('pt-BR')}`);
    console.log(`   📅 Fim: ${datetime.endDateTime.toLocaleString('pt-BR')}`);
    console.log(`   📝 Título: ${intent.eventInfo.title}`);
  } else {
    console.log('   ❌ Não conseguiu extrair data/hora');
  }
  console.log('');
});

console.log('🎯 Teste específico: "agendar reunião para amanhã às 19h"');
const specificTest = calendarAgent.analyzeIntent('agendar reunião para amanhã às 19h');
const specificDateTime = specificTest.eventInfo.datetime;

if (specificDateTime) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  
  const isCorrectDate = specificDateTime.startDateTime.getDate() === tomorrow.getDate();
  const isCorrectHour = specificDateTime.startDateTime.getHours() === 19;
  
  console.log(`✅ Data correta (amanhã): ${isCorrectDate}`);
  console.log(`✅ Hora correta (19h): ${isCorrectHour}`);
  console.log(`📅 Data calculada: ${specificDateTime.startDateTime.toLocaleString('pt-BR')}`);
  console.log(`📅 Data esperada: ${tomorrow.toLocaleString('pt-BR')}`);
  
  if (isCorrectDate && isCorrectHour) {
    console.log('\n🎉 Parsing funcionando corretamente!');
  } else {
    console.log('\n❌ Ainda há problemas no parsing');
  }
} else {
  console.log('❌ Falhou ao extrair data/hora do teste específico');
}
