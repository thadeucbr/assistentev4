import 'dotenv/config';
import express, { json } from 'express';
import processMessage from './src/skills/processMessageAI.js';
import { startReminderScheduler } from './src/skills/reminder.js';

const PORT = process.env.EXPRESS_PORT || 3000;
const BLACK_LIST = JSON.parse(process.env.WHATSAPP_BLACK_LIST || '[]');
const app = express();
app.use(json());

// Inicia o agendador de lembretes ao iniciar o servidor
startReminderScheduler();

app.post('/webhook', (req, res) => {
  // Se desejar, habilite o log para debug:
  // if (process.env.EXPRESS_DEBUG === 'true') console.log(req.body);
  if (BLACK_LIST.includes(req.body.data.from)) {
    return res.status(403).send('Forbidden');
  }
  processMessage(req.body);
  res.send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
