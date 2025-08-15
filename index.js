import 'dotenv/config';
import express, { json } from 'express';
import processMessage from './src/core/messageProcessor.js';
import { startReminderScheduler } from './src/skills/reminder.js';
import logger from './src/utils/logger.js';
import fs from 'fs/promises';

const PORT = process.env.EXPRESS_PORT || 3000;
const BLACK_LIST = JSON.parse(process.env.WHATSAPP_BLACK_LIST || '[]');
const app = express();
app.use(json());

// Inicia o agendador de lembretes ao iniciar o servidor
startReminderScheduler();

app.post('/webhook', async (req, res) => {
  try {
    if (BLACK_LIST.includes(req.body?.data?.from)) {
      logger.warn('Webhook', `User on blacklist attempted to send a message: ${req.body.data.from}`);
      return res.status(403).send('Forbidden');
    }
    
    // Log da chegada do webhook
    logger.interaction('Webhook', 'message-received', {
      from: req.body?.data?.from,
      messageType: req.body?.data?.messageType || 'text'
    });

    // Asynchronous file writing
    try {
      await fs.appendFile('webhook.log', JSON.stringify(req.body) + '\\n');
    } catch (logError) {
      logger.error('Webhook', `Failed to write to webhook.log: ${logError.message}`);
      // Continue processing even if logging fails
    }

    // Process message asynchronously without waiting for it to complete
    processMessage(req.body).catch(err => {
      logger.critical('Webhook', `Error in background message processing: ${err.message}`, {
        stack: err.stack,
        requestBody: JSON.stringify(req.body).substring(0, 500)
      });
    });

    res.status(200).send('OK');
  } catch (err) {
    logger.critical('Webhook', `Critical error in webhook handler: ${err.message}`, {
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
