import sendMessage from '../src/whatsapp/sendMessage.js';
import sendReply from '../src/whatsapp/sendReply.js';

// Teste para verificar se a lógica de detecção de grupo funciona
console.log('Testando lógica de grupo...');

// Simular um chat individual
const individualChat = '5511971704940@c.us';
const groupChat = '120363042467691706@g.us';
const messageContent = 'Esta é uma mensagem de teste';
const quotedMsgId = 'false_120363042467691706@g.us_3AC7CE207C28ECAA1B59_5511971704940@c.us';

console.log('Individual chat ID:', individualChat);
console.log('Group chat ID:', groupChat);
console.log('Is group (individual):', individualChat.includes('@g.us'));
console.log('Is group (group):', groupChat.includes('@g.us'));

// Função para testar a lógica sem fazer chamadas reais
function testGroupDetection(to, quotedMsgId) {
  const groups = JSON.parse(process.env.WHATSAPP_GROUPS || '[]');
  const isGroup = to.includes('@g.us') || groups.includes(to);
  
  console.log(`\nTesting with chat: ${to}`);
  console.log(`Is group: ${isGroup}`);
  console.log(`Has quotedMsgId: ${!!quotedMsgId}`);
  console.log(`Should use reply: ${isGroup && quotedMsgId}`);
  
  return isGroup && quotedMsgId;
}

// Testes
testGroupDetection(individualChat, null);
testGroupDetection(individualChat, quotedMsgId);
testGroupDetection(groupChat, null);
testGroupDetection(groupChat, quotedMsgId);

console.log('\nTestes de lógica concluídos!');
