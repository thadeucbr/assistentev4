import 'dotenv/config';
import express, { json } from 'express';
import processMessage from './src/skills/processMessageAI.js';
import { startReminderScheduler } from './src/skills/reminder.js';

const PORT = process.env.EXPRESS_PORT || 3000;
const app = express();
app.use(json());

// Inicia o agendador de lembretes ao iniciar o servidor
startReminderScheduler();

app.post('/webhook', (req, res) => {
  // Se desejar, habilite o log para debug:
  // if (process.env.EXPRESS_DEBUG === 'true') console.log(req.body);
  processMessage(req.body);
  res.send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
