#!/usr/bin/env node

/**
 * Script para configurar OAuth2 usando credenciais Desktop
 * Resolve problemas de redirect URI
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Configurador OAuth2 - Credenciais Desktop\n');

async function createDesktopCredentials() {
  console.log('📝 CRIANDO CREDENCIAIS DESKTOP NO GOOGLE CLOUD:');
  console.log('\n1. Acesse: https://console.cloud.google.com/');
  console.log('2. Vá em "APIs & Services" > "Credentials"');
  console.log('3. Clique em "Create Credentials" > "OAuth 2.0 Client IDs"');
  console.log('4. ⚠️  IMPORTANTE: Selecione "Desktop application" (não Web application)');
  console.log('5. Nome: "Assistente Calendar Desktop"');
  console.log('6. Clique em "Create"');
  console.log('7. Baixe o JSON');
  console.log('8. Salve como "google-oauth-desktop-credentials.json"');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\n✅ Pressione ENTER após criar e salvar as credenciais desktop...', () => {
      rl.close();
      resolve();
    });
  });
}

async function setupDesktopOAuth() {
  const SCOPES = ['https://www.googleapis.com/auth/calendar'];
  const TOKEN_PATH = path.join(__dirname, 'google-token.json');
  const CREDENTIALS_PATH = path.join(__dirname, 'google-oauth-desktop-credentials.json');

  // Verificar se existem credenciais desktop
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log('❌ Credenciais desktop não encontradas');
    await createDesktopCredentials();
    
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.log('❌ Ainda não foi possível encontrar as credenciais desktop');
      console.log('💡 Certifique-se de salvar o arquivo como "google-oauth-desktop-credentials.json"');
      return false;
    }
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_id, client_secret } = credentials.installed || credentials.desktop;
    
    // Para credenciais desktop, usar o redirect URI out-of-band
    const oAuth2Client = new google.auth.OAuth2(
      client_id, 
      client_secret, 
      'urn:ietf:wg:oauth:2.0:oob'
    );
    
    // Gerar URL de autorização
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n✅ Credenciais desktop carregadas com sucesso!');
    console.log('\n🔗 AUTORIZAÇÃO:');
    console.log('\n1. Abra este link no seu navegador:');
    console.log(`\n${authUrl}\n`);
    console.log('2. Faça login na sua conta Google');
    console.log('3. Autorize o acesso ao Google Calendar');
    console.log('4. Copie o código que aparece na tela');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('\n📋 Cole o código de autorização aqui: ', async (code) => {
        rl.close();
        
        try {
          console.log('🔄 Obtendo token de acesso...');
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);

          // Salvar token
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
          console.log('✅ Token salvo com sucesso!');

          // Testar acesso
          const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
          const res = await calendar.calendarList.list();
          
          console.log('\n🎉 Configuração OAuth2 concluída com sucesso!');
          console.log(`📅 Calendários encontrados: ${res.data.items.length}`);
          
          // Atualizar .env
          updateEnvFile();
          
          console.log('\n📋 Próximos passos:');
          console.log('1. Execute: node testCalendarFeature.js');
          console.log('2. Ou teste via WhatsApp: "agendar reunião para amanhã às 15h"');
          
          resolve(true);
        } catch (error) {
          console.error('❌ Erro:', error.message);
          resolve(false);
        }
      });
    });
  } catch (error) {
    console.error('❌ Erro ao processar credenciais:', error.message);
    return false;
  }
}

function updateEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  Arquivo .env não encontrado');
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  
  const oauthConfig = `
# Google Calendar OAuth2 Configuration (Desktop)
GOOGLE_CALENDAR_AUTH_TYPE=oauth2
GOOGLE_OAUTH_CREDENTIALS_PATH=./google-oauth-desktop-credentials.json
GOOGLE_TOKEN_PATH=./google-token.json`;

  if (envContent.includes('GOOGLE_CALENDAR_AUTH_TYPE=')) {
    envContent = envContent.replace(
      /GOOGLE_CALENDAR_AUTH_TYPE=.*/,
      'GOOGLE_CALENDAR_AUTH_TYPE=oauth2'
    );
    envContent = envContent.replace(
      /GOOGLE_OAUTH_CREDENTIALS_PATH=.*/,
      'GOOGLE_OAUTH_CREDENTIALS_PATH=./google-oauth-desktop-credentials.json'
    );
  } else {
    envContent += oauthConfig;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Arquivo .env atualizado');
}

setupDesktopOAuth();
