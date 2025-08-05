#!/usr/bin/env node

/**
 * Script alternativo para configuração do Google Calendar
 * Este script explica métodos alternativos caso o compartilhamento não funcione
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Guia Alternativo - Google Calendar\n');

function getServiceAccountEmail() {
  const credentialsPath = path.join(__dirname, 'google-credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }
  
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    return credentials.client_email;
  } catch (error) {
    return null;
  }
}

function main() {
  const serviceAccountEmail = getServiceAccountEmail();
  
  if (!serviceAccountEmail) {
    console.log('❌ Arquivo google-credentials.json não encontrado');
    console.log('📝 Execute primeiro: node setupCalendarEmail.js');
    return;
  }

  console.log('📋 MÉTODO ALTERNATIVO: Criação Manual de Calendário Compartilhado\n');
  
  console.log('Se você não conseguir encontrar a opção "Compartilhar com pessoas específicas",');
  console.log('siga este método alternativo:\n');
  
  console.log('🔗 OPÇÃO 1: Usar um link de convite');
  console.log('1. Acesse https://calendar.google.com');
  console.log('2. Clique no botão "+" ao lado de "Outros calendários"');
  console.log('3. Selecione "Criar novo calendário"');
  console.log('4. Nome: "Assistente Virtual"');
  console.log('5. Descrição: "Eventos criados pelo assistente"');
  console.log('6. Clique em "Criar calendário"');
  console.log('7. Nas configurações deste novo calendário, adicione:');
  console.log(`   ${serviceAccountEmail}`);
  console.log('8. Dê permissão de "Fazer alterações nos eventos"\n');
  
  console.log('🔗 OPÇÃO 2: Convidar via Gmail');
  console.log('1. Abra o Gmail');
  console.log('2. Compose um novo email para:');
  console.log(`   ${serviceAccountEmail}`);
  console.log('3. Assunto: "Acesso ao calendário"');
  console.log('4. Corpo: "Convite para acessar meu calendário"');
  console.log('5. Clique no ícone do Google Calendar na barra lateral');
  console.log('6. Crie um evento de teste e adicione o email como convidado\n');
  
  console.log('🔗 OPÇÃO 3: Apenas usar os arquivos iCal');
  console.log('Mesmo sem compartilhamento, a funcionalidade funcionará:');
  console.log('- ✅ Eventos serão criados');
  console.log('- ✅ Você receberá convites por email');
  console.log('- ✅ Arquivos .ics serão gerados para importar');
  console.log('- ⚠️  Eventos não aparecerão automaticamente no seu calendário principal\n');
  
  console.log('📧 CONFIGURAÇÃO ATUAL:');
  console.log(`Service Account: ${serviceAccountEmail}`);
  
  // Verificar email configurado no .env
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const emailMatch = envContent.match(/GOOGLE_CALENDAR_OWNER_EMAIL=(.+)/);
    if (emailMatch) {
      console.log(`Email principal: ${emailMatch[1]}`);
    }
  }
  
  console.log('\n🧪 TESTE:');
  console.log('Execute: node testCalendarFeature.js');
  console.log('Ou envie uma mensagem para o bot: "agendar reunião para amanhã às 15h"');
}

main();
