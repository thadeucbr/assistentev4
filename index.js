import 'dotenv/config';
import express, { json } from 'express';
import processMessage from './src/core/messageProcessor.js';
import { startReminderScheduler } from './src/skills/reminder.js';
import { logError } from './src/utils/logger.js';

const PORT = process.env.EXPRESS_PORT || 3000;
const BLACK_LIST = JSON.parse(process.env.WHATSAPP_BLACK_LIST || '[]');
const app = express();
app.use(json());

// Inicia o agendador de lembretes ao iniciar o servidor
startReminderScheduler();

app.post('/webhook', (req, res) => {
  try {
    if (BLACK_LIST.includes(req.body.data.from)) {
      return res.status(403).send('Forbidden');
    }
    processMessage(req.body);
    res.send('OK');
  } catch (err) {
    logError(err, 'Webhook processing failed');
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
