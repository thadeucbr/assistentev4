import sendFile from './src/whatsapp/sendFile.js';
import fs from 'fs';

// Mock básico do logger
global.logger = {
  info: (component, message, ...args) => console.log(`[INFO] ${component}: ${message}`, ...args),
  debug: (component, message, ...args) => console.log(`[DEBUG] ${component}: ${message}`, ...args),
  error: (component, message, ...args) => console.log(`[ERROR] ${component}: ${message}`, ...args),
  warn: (component, message, ...args) => console.log(`[WARN] ${component}: ${message}`, ...args)
};

// Mock das variáveis de ambiente
process.env.WHATSAPP_URL = 'http://localhost:3000';
process.env.WHATSAPP_SECRET = 'test-secret';

// Mock do fetch
global.fetch = async (url, options) => {
  console.log(`🌐 Mock fetch chamado:`);
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${options.method}`);
  console.log(`   Headers:`, options.headers);
  
  // Simular sucesso
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: 'File sent successfully' })
  };
};

async function testSendFile() {
  console.log('🧪 Testando função sendFile\n');

  // Criar arquivo de teste temporário (.ics)
  const testFilePath = '/tmp/test-evento.ics';
  const testIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Assistente Virtual//NONSGML Event//EN
BEGIN:VEVENT
UID:test-event-${Date.now()}
DTSTART:20250806T150000Z
DTEND:20250806T160000Z
SUMMARY:Reunião de Teste
DESCRIPTION:Evento de teste criado pelo assistente
ORGANIZER:MAILTO:test@example.com
END:VEVENT
END:VCALENDAR`;

  fs.writeFileSync(testFilePath, testIcsContent);
  console.log(`📁 Arquivo de teste criado: ${testFilePath}`);

  // Teste 1: Envio básico de arquivo .ics
  console.log('\n1. Testando envio de arquivo .ics:');
  try {
    const result1 = await sendFile(
      '5511999999999@c.us',
      testFilePath,
      'evento-teste.ics',
      '📅 Arquivo de evento de teste',
      false,
      'text/calendar'
    );
    console.log(`   Resultado: ${result1 ? '✅ Sucesso' : '❌ Falha'}`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // Teste 2: Envio com detecção automática de MIME type
  console.log('\n2. Testando detecção automática de MIME type:');
  try {
    const result2 = await sendFile(
      '5511999999999@c.us',
      testFilePath,
      'evento-auto.ics',
      '📅 Arquivo com MIME automático'
    );
    console.log(`   Resultado: ${result2 ? '✅ Sucesso' : '❌ Falha'}`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // Teste 3: Arquivo inexistente
  console.log('\n3. Testando arquivo inexistente:');
  try {
    const result3 = await sendFile(
      '5511999999999@c.us',
      '/tmp/arquivo-inexistente.ics',
      'inexistente.ics',
      'Este arquivo não existe'
    );
    console.log(`   Resultado: ${result3 ? '✅ Sucesso' : '❌ Falha (esperado)'}`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // Criar arquivo PDF de teste
  const testPdfPath = '/tmp/test-document.pdf';
  const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n175\n%%EOF';
  fs.writeFileSync(testPdfPath, pdfContent);

  // Teste 4: Envio de PDF
  console.log('\n4. Testando envio de arquivo PDF:');
  try {
    const result4 = await sendFile(
      '5511999999999@c.us',
      testPdfPath,
      'documento-teste.pdf',
      '📄 Documento PDF de teste'
    );
    console.log(`   Resultado: ${result4 ? '✅ Sucesso' : '❌ Falha'}`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // Criar arquivo de texto de teste
  const testTxtPath = '/tmp/test-document.txt';
  fs.writeFileSync(testTxtPath, 'Este é um arquivo de texto de teste.');

  // Teste 5: Envio de arquivo de texto
  console.log('\n5. Testando envio de arquivo de texto:');
  try {
    const result5 = await sendFile(
      '5511999999999@c.us',
      testTxtPath,
      'documento.txt',
      '📝 Arquivo de texto'
    );
    console.log(`   Resultado: ${result5 ? '✅ Sucesso' : '❌ Falha'}`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // Limpeza dos arquivos de teste
  try {
    fs.unlinkSync(testFilePath);
    fs.unlinkSync(testPdfPath);
    fs.unlinkSync(testTxtPath);
    console.log('\n🧹 Arquivos de teste removidos');
  } catch (error) {
    console.log(`\n⚠️ Erro ao remover arquivos de teste: ${error.message}`);
  }

  console.log('\n✅ Testes da função sendFile concluídos!');
  console.log('\n📋 Funcionalidades implementadas:');
  console.log('• ✅ Envio de arquivos de qualquer tipo via WhatsApp');
  console.log('• ✅ Detecção automática de MIME type baseada na extensão');
  console.log('• ✅ Suporte a legendas personalizadas');
  console.log('• ✅ Verificação de existência do arquivo');
  console.log('• ✅ Verificação de tamanho (limite 64MB)');
  console.log('• ✅ Conversão automática para base64');
  console.log('• ✅ Tratamento de erros robusto');
  console.log('• ✅ Função reutilizável para outros componentes');
}

testSendFile().catch(console.error);
