#!/usr/bin/env node

/**
 * Script OAuth2 para Docker - Versão Manual (sem servidor local)
 * Resolve problemas de callback em containers
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, 'google-token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'google-oauth-credentials.json');

console.log('🔧 Configurador OAuth2 - Google Calendar (Docker - Versão Manual)\n');

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log('❌ Arquivo google-oauth-credentials.json não encontrado.');
    return null;
  }

  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.log('❌ Erro ao ler credenciais OAuth2:', error.message);
    return null;
  }
}

function createOAuth2Client(credentials) {
  const { client_id, client_secret } = credentials.web || credentials.installed;
  // Usar urn:ietf:wg:oauth:2.0:oob para aplicações desktop/manual
  return new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
}

function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('🔗 AUTORIZAÇÃO MANUAL (Método Docker):');
  console.log('\n1. Abra este link no seu navegador:');
  console.log(`\n${authUrl}\n`);
  console.log('2. Faça login na sua conta Google');
  console.log('3. Autorize o acesso ao Google Calendar');
  console.log('4. COPIE O CÓDIGO que aparece na tela');
  console.log('   (será exibido diretamente após autorizar)');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('\n📋 Cole o código de autorização aqui: ', (code) => {
      rl.close();
      
      console.log('🔄 Obtendo token de acesso...');
      
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('❌ Erro ao obter token:', err.message);
          reject(err);
          return;
        }

        oAuth2Client.setCredentials(token);

        // Salvar token para uso futuro
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
        console.log('\n✅ Token salvo em:', TOKEN_PATH);
        
        resolve(oAuth2Client);
      });
    });
  });
}

async function testCalendarAccess(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  try {
    const res = await calendar.calendarList.list();
    console.log('\n✅ Acesso ao Google Calendar configurado com sucesso!');
    console.log(`📅 Calendários encontrados: ${res.data.items.length}`);
    
    // Mostrar calendário principal
    const primaryCalendar = res.data.items.find(cal => cal.primary);
    if (primaryCalendar) {
      console.log(`📌 Calendário principal: ${primaryCalendar.summary}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao testar acesso:', error.message);
    return false;
  }
}

function updateEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  Arquivo .env não encontrado');
    return false;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Adicionar/atualizar configuração OAuth2
  const oauthConfig = `
# Google Calendar OAuth2 Configuration
GOOGLE_CALENDAR_AUTH_TYPE=oauth2
GOOGLE_OAUTH_CREDENTIALS_PATH=./google-oauth-credentials.json
GOOGLE_TOKEN_PATH=./google-token.json`;

  if (envContent.includes('GOOGLE_CALENDAR_AUTH_TYPE=')) {
    // Atualizar existente
    envContent = envContent.replace(
      /GOOGLE_CALENDAR_AUTH_TYPE=.*/,
      'GOOGLE_CALENDAR_AUTH_TYPE=oauth2'
    );
  } else {
    // Adicionar novo
    envContent += oauthConfig;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Arquivo .env atualizado com configurações OAuth2');
  return true;
}

async function main() {
  const credentials = loadCredentials();
  if (!credentials) {
    return;
  }

  console.log('✅ Credenciais OAuth2 carregadas');

  const oAuth2Client = createOAuth2Client(credentials);

  // Verificar se já temos um token válido
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
      
      console.log('🔍 Verificando token existente...');
      const isValid = await testCalendarAccess(oAuth2Client);
      
      if (isValid) {
        console.log('\n🎉 OAuth2 já está configurado e funcionando!');
        updateEnvFile();
        console.log('\n🚀 Pronto para usar! Execute: node testCalendarFeature.js');
        return;
      } else {
        console.log('⚠️  Token existente inválido, gerando novo...');
        fs.unlinkSync(TOKEN_PATH);
      }
    } catch (error) {
      console.log('⚠️  Token existente corrompido, gerando novo...');
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }
    }
  }

  try {
    console.log('🔄 Iniciando processo de autorização OAuth2...');
    const authorizedClient = await getAccessToken(oAuth2Client);
    
    const success = await testCalendarAccess(authorizedClient);
    if (success) {
      updateEnvFile();
      console.log('\n🎉 Configuração OAuth2 concluída com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('1. Execute: node testCalendarFeature.js');
      console.log('2. Ou teste via WhatsApp: "agendar reunião para amanhã às 15h"');
    }
  } catch (error) {
    console.log('\n❌ Erro na configuração:', error.message);
  }
}

main().catch(console.error);
