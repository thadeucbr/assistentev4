#!/usr/bin/env node

/**
 * Script para configurar o email principal do Google Calendar
 * Este script ajuda a configurar automaticamente o email que receberá convites
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Configurador do Google Calendar - Email Principal\n');

function updateEnvFile(email) {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado. Criando um novo...');
    // Copiar do exemplo
    const examplePath = path.join(__dirname, '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log('✅ Arquivo .env criado a partir do .env.example');
    } else {
      console.log('❌ Arquivo .env.example também não encontrado.');
      return false;
    }
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Verificar se a variável já existe
  const ownerEmailRegex = /^GOOGLE_CALENDAR_OWNER_EMAIL=.*$/m;
  
  if (ownerEmailRegex.test(envContent)) {
    // Atualizar variável existente
    envContent = envContent.replace(ownerEmailRegex, `GOOGLE_CALENDAR_OWNER_EMAIL=${email}`);
    console.log('🔄 Variável GOOGLE_CALENDAR_OWNER_EMAIL atualizada');
  } else {
    // Adicionar nova variável
    if (envContent.includes('GOOGLE_CREDENTIALS_PATH=')) {
      // Adicionar após a linha de credenciais
      envContent = envContent.replace(
        /^(GOOGLE_CREDENTIALS_PATH=.*$)/m,
        `$1\nGOOGLE_CALENDAR_OWNER_EMAIL=${email}`
      );
    } else {
      // Adicionar no final
      envContent += `\n\n# Google Calendar Configuration\nGOOGLE_CREDENTIALS_PATH=./google-credentials.json\nGOOGLE_CALENDAR_OWNER_EMAIL=${email}\n`;
    }
    console.log('➕ Variável GOOGLE_CALENDAR_OWNER_EMAIL adicionada');
  }
  
  fs.writeFileSync(envPath, envContent);
  return true;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function checkServiceAccountFile() {
  const credentialsPath = path.join(__dirname, 'google-credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    console.log('⚠️  Arquivo google-credentials.json não encontrado.');
    console.log('📝 Para configurar a Service Account:');
    console.log('   1. Copie google-credentials.example.json para google-credentials.json');
    console.log('   2. Substitua os valores placeholder pelas credenciais reais do Google Cloud Console');
    return false;
  }
  
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    if (credentials.client_email) {
      console.log(`✅ Service Account encontrada: ${credentials.client_email}`);
      return credentials.client_email;
    }
  } catch (error) {
    console.log('❌ Erro ao ler arquivo de credenciais:', error.message);
  }
  
  return false;
}

async function main() {
  // Verificar se há argumentos da linha de comando
  const args = process.argv.slice(2);
  let email = args[0];
  
  if (!email) {
    // Modo interativo
    console.log('📧 Digite seu email principal (que receberá os convites dos eventos):');
    
    // Simular input (em produção, usaria readline)
    email = 'exemplo@gmail.com'; // Placeholder para exemplo
    console.log('💡 Para usar este script interativamente, execute: node setupCalendarEmail.js seu_email@gmail.com\n');
  }
  
  // Validar email se fornecido
  if (email !== 'exemplo@gmail.com' && !validateEmail(email)) {
    console.log('❌ Email inválido fornecido:', email);
    console.log('📧 Formato correto: usuario@dominio.com');
    process.exit(1);
  }
  
  // Verificar Service Account
  const serviceAccountEmail = checkServiceAccountFile();
  
  if (email !== 'exemplo@gmail.com') {
    // Atualizar arquivo .env
    if (updateEnvFile(email)) {
      console.log(`✅ Email principal configurado: ${email}`);
      
      if (serviceAccountEmail) {
        console.log('\n📋 Próximos passos:');
        console.log('1. Acesse https://calendar.google.com');
        console.log('2. No lado esquerdo, encontre "Meus calendários"');
        console.log('3. Clique nos 3 pontos (⋮) ao lado do SEU CALENDÁRIO PRINCIPAL (não de outros calendários)');
        console.log('4. Selecione "Configurações e compartilhamento"');
        console.log('5. Role a página para baixo até encontrar a seção "Compartilhar com pessoas específicas"');
        console.log('   (Esta seção fica depois de "Permissões de acesso" e antes de "Integrar agenda")');
        console.log(`6. Clique em "Adicionar pessoas" e adicione: ${serviceAccountEmail}`);
        console.log('7. Selecione as permissões como "Fazer alterações nos eventos"');
        console.log('8. Clique em "Enviar"');
        console.log('\n💡 DICA: Se não encontrar "Compartilhar com pessoas específicas",');
        console.log('   certifique-se de estar nas configurações do seu calendário PRINCIPAL,');
        console.log('   não de calendários importados ou secundários.');
        console.log('\n🎉 Depois disso, você receberá convites automáticos de todos os eventos criados!');
      }
    }
  } else {
    console.log('📝 Uso: node setupCalendarEmail.js seu_email@gmail.com');
    console.log('📝 Exemplo: node setupCalendarEmail.js joao@gmail.com');
  }
}

main().catch(console.error);
