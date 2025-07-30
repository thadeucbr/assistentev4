#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '../../logs');

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function colorize(level, text) {
  switch (level.toUpperCase()) {
    case 'ERROR':
      return colors.red + text + colors.reset;
    case 'WARN':
      return colors.yellow + text + colors.reset;
    case 'INFO':
      return colors.blue + text + colors.reset;
    case 'DEBUG':
      return colors.gray + text + colors.reset;
    default:
      return text;
  }
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return colors.cyan + date.toLocaleString('pt-BR') + colors.reset;
}

function formatElapsedTime(elapsedTime) {
  return colors.magenta + elapsedTime + colors.reset;
}

function formatMessageId(messageId) {
  return colors.green + messageId + colors.reset;
}

function formatComponent(component) {
  return colors.cyan + component + colors.reset;
}

function parseLogFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    return lines.map(line => {
      if (!line.trim()) return null;
      
      try {
        return JSON.parse(line);
      } catch (error) {
        return { raw: line, parseError: true };
      }
    }).filter(Boolean);
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error.message);
    return [];
  }
}

function displayLogEntry(entry) {
  if (entry.parseError) {
    console.log(colors.red + 'PARSE ERROR:' + colors.reset, entry.raw);
    return;
  }

  const timestamp = formatTimestamp(entry.timestamp);
  const messageId = formatMessageId(entry.messageId);
  const elapsedTime = formatElapsedTime(entry.elapsedTime);
  const level = colorize(entry.level, entry.level.padEnd(5));
  const component = formatComponent(entry.component.padEnd(15));
  const message = entry.message;

  console.log(`${timestamp} [${messageId}] ${level} ${component} ${message} ${elapsedTime}`);
  
  if (entry.data && Object.keys(entry.data).length > 0) {
    console.log(colors.gray + '    Data:', JSON.stringify(entry.data, null, 2) + colors.reset);
  }
}

function listLogFiles() {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log('Diretório de logs não encontrado:', LOGS_DIR);
    return [];
  }

  const files = fs.readdirSync(LOGS_DIR)
    .filter(file => file.endsWith('.log'))
    .map(file => ({
      name: file,
      path: path.join(LOGS_DIR, file),
      mtime: fs.statSync(path.join(LOGS_DIR, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime); // Mais recentes primeiro

  return files;
}

function showHelp() {
  console.log(`
${colors.green}Sistema de Visualização de Logs${colors.reset}

Uso: node logViewer.js [opções]

Opções:
  --help, -h              Mostra esta ajuda
  --list, -l              Lista todos os arquivos de log
  --tail, -t              Mostra os últimos logs (equivale a --last 1)
  --last <n>              Mostra os últimos n arquivos de log
  --message-id <id>       Mostra todos os logs de um messageId específico
  --level <nivel>         Filtra por nível (error, warn, info, debug)
  --component <nome>      Filtra por componente
  --since <minutos>       Mostra logs dos últimos n minutos
  --follow, -f            Monitora novos logs em tempo real (ctrl+c para sair)

Exemplos:
  node logViewer.js --tail
  node logViewer.js --last 3
  node logViewer.js --message-id a1b2c3d4
  node logViewer.js --level error
  node logViewer.js --component ProcessMessage
  node logViewer.js --since 10
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const files = listLogFiles();
  
  if (files.length === 0) {
    console.log('Nenhum arquivo de log encontrado.');
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    console.log(`${colors.green}Arquivos de log disponíveis:${colors.reset}\n`);
    files.forEach((file, index) => {
      const size = fs.statSync(file.path).size;
      console.log(`${index + 1}. ${file.name} (${(size/1024).toFixed(1)}KB) - ${file.mtime.toLocaleString('pt-BR')}`);
    });
    return;
  }

  // Processar argumentos
  let filesToShow = 1; // padrão: último arquivo
  let messageIdFilter = null;
  let levelFilter = null;
  let componentFilter = null;
  let sinceMinutes = null;
  let follow = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tail':
      case '-t':
        filesToShow = 1;
        break;
      case '--last':
        filesToShow = parseInt(args[i + 1]) || 1;
        i++;
        break;
      case '--message-id':
        messageIdFilter = args[i + 1];
        i++;
        break;
      case '--level':
        levelFilter = args[i + 1];
        i++;
        break;
      case '--component':
        componentFilter = args[i + 1];
        i++;
        break;
      case '--since':
        sinceMinutes = parseInt(args[i + 1]) || 10;
        i++;
        break;
      case '--follow':
      case '-f':
        follow = true;
        break;
    }
  }

  // Se tem filtro de messageId, buscar em todos os arquivos
  if (messageIdFilter) {
    console.log(`${colors.green}Buscando logs para messageId: ${messageIdFilter}${colors.reset}\n`);
    
    let found = false;
    files.forEach(file => {
      const entries = parseLogFile(file.path);
      const filteredEntries = entries.filter(entry => 
        entry.messageId === messageIdFilter
      );
      
      if (filteredEntries.length > 0) {
        console.log(`${colors.yellow}=== ${file.name} ===${colors.reset}`);
        filteredEntries.forEach(displayLogEntry);
        console.log();
        found = true;
      }
    });
    
    if (!found) {
      console.log(`Nenhum log encontrado para messageId: ${messageIdFilter}`);
    }
    return;
  }

  // Filtro por tempo
  if (sinceMinutes) {
    const cutoffTime = new Date(Date.now() - sinceMinutes * 60 * 1000);
    console.log(`${colors.green}Mostrando logs dos últimos ${sinceMinutes} minutos${colors.reset}\n`);
    
    files.forEach(file => {
      if (file.mtime < cutoffTime) return;
      
      const entries = parseLogFile(file.path);
      const filteredEntries = entries.filter(entry => {
        const entryTime = new Date(entry.timestamp);
        return entryTime >= cutoffTime;
      });
      
      if (filteredEntries.length > 0) {
        console.log(`${colors.yellow}=== ${file.name} ===${colors.reset}`);
        filteredEntries.forEach(entry => {
          let show = true;
          if (levelFilter && entry.level.toLowerCase() !== levelFilter.toLowerCase()) show = false;
          if (componentFilter && !entry.component.toLowerCase().includes(componentFilter.toLowerCase())) show = false;
          
          if (show) displayLogEntry(entry);
        });
        console.log();
      }
    });
    return;
  }

  // Mostrar últimos N arquivos
  const filesToProcess = files.slice(0, filesToShow);
  
  filesToProcess.forEach(file => {
    console.log(`${colors.yellow}=== ${file.name} ===${colors.reset}`);
    const entries = parseLogFile(file.path);
    
    entries.forEach(entry => {
      let show = true;
      if (levelFilter && entry.level.toLowerCase() !== levelFilter.toLowerCase()) show = false;
      if (componentFilter && !entry.component.toLowerCase().includes(componentFilter.toLowerCase())) show = false;
      
      if (show) displayLogEntry(entry);
    });
    console.log();
  });

  if (follow) {
    console.log(`${colors.green}Monitorando novos logs... (Ctrl+C para sair)${colors.reset}\n`);
    // Implementação simplificada de follow
    // Em uma implementação real, você usaria fs.watchFile ou chokidar
    setInterval(() => {
      const newFiles = listLogFiles();
      if (newFiles.length > files.length) {
        const latestFile = newFiles[0];
        console.log(`${colors.yellow}=== NOVO: ${latestFile.name} ===${colors.reset}`);
        const entries = parseLogFile(latestFile.path);
        entries.forEach(displayLogEntry);
        console.log();
      }
    }, 1000);
  }
}

main();
