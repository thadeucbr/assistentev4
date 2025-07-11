import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
import { addReminder, getReminders } from '../repository/reminderRepository.js';
import { scheduleReminder } from '../skills/reminder.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em gerenciar lembretes. Sua função é, dada uma solicitação do usuário, criar ou listar lembretes usando as ferramentas disponíveis. Você deve analisar a solicitação do usuário e determinar a ação (criar ou listar) e os parâmetros necessários (mensagem e horário agendado para criação).

Você tem acesso às seguintes ferramentas:
- 'create_reminder': Para criar um novo lembrete.
- 'list_reminders': Para listar os lembretes existentes.

Após executar a ação, você deve retornar o resultado para o usuário.`
};

export async function execute(userQuery, from) {
  let messages = [SYSTEM_PROMPT, { role: 'user', content: userQuery }];
  let response = await chatAi(messages, tools);

  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      const args = toolCall.function.arguments;

      if (toolCall.function.name === 'create_reminder') {
        const newReminder = await addReminder(from, args.message, args.scheduledTime);
        scheduleReminder(newReminder);
        return `Lembrete criado: ${JSON.stringify(newReminder)}`;
      } else if (toolCall.function.name === 'list_reminders') {
        const reminders = await getReminders(from);
        return `Seus lembretes: ${JSON.stringify(reminders)}`;
      }
    }
  }
  return `Não foi possível gerenciar o lembrete com a sua solicitação. Por favor, tente novamente com um prompt mais claro.`;
}
