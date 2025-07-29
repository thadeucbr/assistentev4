import { getAllReminders, deleteReminder } from '../repository/reminderRepository.js';
import sendMessage from '../whatsapp/sendMessage.js';
import parseScheduledTime from '../utils/parseScheduledTime.js';
import logError from '../utils/logger.js';
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
    logError(err, 'startReminderScheduler - Failed to start reminder scheduler');
    console.error(`Erro ao iniciar o agendador de lembretes: ${err.message}`);
  }
}

export function scheduleReminder(reminder) {
  try {
    const scheduledTime = parseScheduledTime(reminder.scheduledTime);
    const delay = scheduledTime - Date.now();
    const timeoutDelay = delay > 0 ? delay : 0;

    setTimeout(async () => {
      try {
        await sendMessage(reminder.userId, `Lembrete: ${reminder.message}`);
        console.log(`Lembrete disparado para o usuário ${reminder.userId}: ${reminder.message}`);
        await deleteReminder(reminder._id);
      } catch (err) {
        logError(err, `scheduleReminder - Failed to send reminder ${reminder._id} to user ${reminder.userId}`);
        console.error(`Erro ao disparar o lembrete ${reminder._id}: ${err.message}`);
      }
    }, timeoutDelay);
  } catch (err) {
    logError(err, `scheduleReminder - Failed to schedule reminder ${reminder._id}`);
    console.error(`Erro ao agendar lembrete: ${err.message}`);
  }
}