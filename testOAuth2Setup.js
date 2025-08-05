#!/usr/bin/env node

/**
 * Teste rápido da configuração OAuth2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Teste Rápido - Configuração OAuth2\n');

// Verificar arquivos necessários
const credentialsPath = path.join(__dirname, 'google-oauth-desktop-credentials.json');
const tokenPath = path.join(__dirname, 'google-token.json');
const envPath = path.join(__dirname, '.env');

console.log('📁 Verificando arquivos necessários:');

if (fs.existsSync(credentialsPath)) {
  console.log('✅ google-oauth-desktop-credentials.json - OK');
  try {
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    console.log(`   📋 Client ID: ${creds.installed?.client_id?.substring(0, 20)}...`);
  } catch (e) {
    console.log('❌ Erro ao ler credenciais:', e.message);
  }
} else {
  console.log('❌ google-oauth-desktop-credentials.json - Não encontrado');
}

if (fs.existsSync(tokenPath)) {
  console.log('✅ google-token.json - OK');
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log(`   🔑 Token type: ${token.token_type || 'Bearer'}`);
    console.log(`   ⏰ Expires: ${token.expiry_date ? new Date(token.expiry_date).toLocaleString('pt-BR') : 'N/A'}`);
  } catch (e) {
    console.log('❌ Erro ao ler token:', e.message);
  }
} else {
  console.log('❌ google-token.json - Não encontrado');
}

if (fs.existsSync(envPath)) {
  console.log('✅ .env - OK');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const authType = envContent.match(/GOOGLE_CALENDAR_AUTH_TYPE=(.+)/)?.[1];
    const credsPath = envContent.match(/GOOGLE_OAUTH_CREDENTIALS_PATH=(.+)/)?.[1];
    
    console.log(`   🔐 Auth Type: ${authType || 'não configurado'}`);
    console.log(`   📁 Credentials Path: ${credsPath || 'não configurado'}`);
  } catch (e) {
    console.log('❌ Erro ao ler .env:', e.message);
  }
} else {
  console.log('❌ .env - Não encontrado');
}

console.log('\n🔧 Status da Configuração:');

const hasCredentials = fs.existsSync(credentialsPath);
const hasToken = fs.existsSync(tokenPath);
const hasEnv = fs.existsSync(envPath);

if (hasCredentials && hasToken && hasEnv) {
  console.log('🎉 Configuração OAuth2 COMPLETA!');
  console.log('\n📋 Próximos passos:');
  console.log('1. Teste: node testCalendarFeature.js');
  console.log('2. Use via WhatsApp: "agendar reunião para amanhã às 15h"');
} else {
  console.log('⚠️  Configuração INCOMPLETA');
  
  if (!hasCredentials) {
    console.log('❌ Execute: node setupGoogleOAuthDesktop.js');
  }
  if (!hasToken) {
    console.log('❌ Execute: node setupGoogleOAuthDesktop.js');
  }
  if (!hasEnv) {
    console.log('❌ Verifique o arquivo .env');
  }
}

console.log('\n💡 Dica: Se tudo estiver OK mas ainda houver erros, reinicie o Docker:');
console.log('   docker-compose restart');
