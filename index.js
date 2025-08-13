import 'dotenv/config';
import express, { json } from 'express';
import processMessage from './src/core/messageProcessor.js';
import { startReminderScheduler } from './src/skills/reminder.js';
import logger from './src/utils/logger.js';

const PORT = process.env.EXPRESS_PORT || 3000;
const BLACK_LIST = JSON.parse(process.env.WHATSAPP_BLACK_LIST || '[]');
const app = express();
app.use(json());

// Inicia o agendador de lembretes ao iniciar o servidor
startReminderScheduler();
import fs from 'fs'
app.post('/webhook', (req, res) => {
  try {
    if (BLACK_LIST.includes(req.body.data.from)) {
      logger.warn('Webhook', `Usuário na blacklist tentou enviar mensagem: ${req.body.data.from}`);
      return res.status(403).send('Forbidden');
    }
    
    // Log da chegada do webhook
    logger.interaction('Webhook', 'message-received', {
      from: req.body.data.from,
      messageType: req.body.data.messageType || 'text'
    });
    fs.writeFileSync('webhook.log', JSON.stringify(req.body), { flag: 'a' });
    processMessage(req.body);
    res.send('OK');
  } catch (err) {
    logger.critical('Webhook', `Erro no processamento do webhook: ${err.message}`, {
      stack: err.stack,
      requestBody: JSON.stringify(req.body).substring(0, 500)
    });
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  logger.systemStatus('ExpressServer', 'online', { port: PORT });
  console.log(`🚀 [SYSTEM] Servidor iniciado na porta ${PORT}`);
});
