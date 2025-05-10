import { getAllReminders, deleteReminder } from '../repository/reminderRepository.js';
import sendMessage from '../whatsapp/sendMessage.js';
import parseScheduledTime from '../utils/parseScheduledTime.js';
/**
 * Inicia o agendador de lembretes, buscando os lembretes pendentes no banco e agendando
 * sua execução utilizando setTimeout. Caso o horário do lembrete já tenha passado, ele é
 * disparado imediatamente.
 */
export async function startReminderScheduler() {
  try {
    const reminders = await getAllReminders();
    console.log(`Agendando ${reminders.length} lembrete(s) pendente(s)...`);
    reminders.forEach(reminder => scheduleReminder(reminder));
  } catch (err) {
    console.error(`Erro ao iniciar o agendador de lembretes: ${err.message}`);
  }
}

export function scheduleReminder(reminder) {
  const scheduledTime = parseScheduledTime(reminder.scheduledTime);
  const delay = scheduledTime - Date.now();
  const timeoutDelay = delay > 0 ? delay : 0;

  setTimeout(async () => {
    try {
      await sendMessage(reminder.userId, `Lembrete: ${reminder.message}`);
      console.log(`Lembrete disparado para o usuário ${reminder.userId}: ${reminder.message}`);
      await deleteReminder(reminder._id);
    } catch (err) {
      console.error(`Erro ao disparar o lembrete ${reminder._id}: ${err.message}`);
    }
  }, timeoutDelay);
}