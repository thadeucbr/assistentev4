#!/usr/bin/env node

/**
 * Script para extrair e exibir logs de debug da personalidade
 * Uso: node src/scripts/personalityDebugger.js [messageId]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extractPersonalityLogs(messageId = null) {
  const logsDir = path.join(__dirname, '../../logs');
  
  console.log('🔍 Extraindo logs de personalidade...\n');
  
  try {
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('_debug.log'));
    
    let allLogs = [];
    
    for (const file of logFiles) {
      const filePath = path.join(logsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          
          // Filtrar logs de personalidade
          if (logEntry.component && logEntry.component.startsWith('PERSONALITY-')) {
            // Se messageId foi especificado, filtrar apenas esse
            if (messageId && logEntry.messageId !== messageId) {
              continue;
            }
            
            allLogs.push({
              timestamp: logEntry.timestamp,
              messageId: logEntry.messageId,
              component: logEntry.component,
              message: logEntry.message,
              data: logEntry.activeTools || {}
            });
          }
        } catch (e) {
          // Ignorar linhas que não são JSON válido
        }
      }
    }
    
    // Ordenar por timestamp
    allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (allLogs.length === 0) {
      console.log('❌ Nenhum log de personalidade encontrado.');
      if (messageId) {
        console.log(`   Procurando por messageId: ${messageId}`);
      }
      return;
    }
    
    console.log(`✅ Encontrados ${allLogs.length} logs de personalidade:\n`);
    
    let currentMessageId = null;
    
    for (const log of allLogs) {
      // Separador visual entre mensagens diferentes
      if (currentMessageId !== log.messageId) {
        if (currentMessageId !== null) {
          console.log('\n' + '='.repeat(80) + '\n');
        }
        currentMessageId = log.messageId;
        console.log(`📱 MESSAGE ID: ${log.messageId}`);
        console.log(`⏰ TIMESTAMP: ${new Date(log.timestamp).toLocaleString()}`);
        console.log('-'.repeat(40));
      }
      
      const time = new Date(log.timestamp).toLocaleTimeString();
      const component = log.component.replace('PERSONALITY-', '');
      
      console.log(`[${time}] ${component}: ${log.message}`);
      
      // Exibir dados extras se houver
      if (log.data && Object.keys(log.data).length > 0) {
        console.log(`   📊 Dados:`, JSON.stringify(log.data, null, 2));
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Erro ao ler logs:', error.message);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const messageId = process.argv[2] || null;
  
  console.log('🧠 DEBUGGER DE PERSONALIDADE\n');
  
  if (messageId) {
    console.log(`🎯 Filtrando por messageId: ${messageId}\n`);
  } else {
    console.log('📋 Mostrando todos os logs de personalidade\n');
    console.log('💡 Dica: Use "node personalityDebugger.js <messageId>" para filtrar por mensagem específica\n');
  }
  
  extractPersonalityLogs(messageId);
}

export default extractPersonalityLogs;
