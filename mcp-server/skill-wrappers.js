// Wrappers seguros para as skills que tratam dependências ausentes
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock para funções do WhatsApp que não são necessárias no MCP
const mockWhatsAppFunction = () => Promise.resolve({ success: true, message: 'Função WhatsApp não disponível no contexto MCP' });

// Wrapper seguro para send_message (função essencial do WhatsApp)
export async function safeSendMessage(args) {
  try {
    // Importar a função real de envio de mensagem do WhatsApp
    const { default: sendMessage } = await import('../src/whatsapp/sendMessage.js');
    
    // Garantir que temos um destinatário válido
    const recipient = args.to || args.from || process.env.DEFAULT_WHATSAPP_RECIPIENT || '5511971704940@c.us';
    
    // Executar a função real com os parâmetros corretos
    const result = await sendMessage(recipient, args.content, args.quotedMsgId);
    
    return {
      type: 'message',
      content: args.content,
      success: true,
      result: result,
      note: 'Mensagem enviada via MCP'
    };
  } catch (error) {
    console.error('Erro ao enviar mensagem via MCP:', error);
    return {
      type: 'message',
      content: args.content,
      success: false,
      error: error.message,
      note: 'Erro no envio via MCP'
    };
  }
}

// Wrapper seguro para envio de áudio PTT
export async function safeSendPtt(args) {
  try {
    // Importar a função real de envio de áudio do WhatsApp
    const { default: sendPtt } = await import('../src/whatsapp/sendPtt.js');
    
    // Executar a função real com os parâmetros corretos
    const result = await sendPtt(args.to || args.from, args.audioBuffer, args.quotedMsgId);
    
    return {
      type: 'audio',
      success: true,
      result: result,
      note: 'Áudio PTT enviado via MCP'
    };
  } catch (error) {
    console.error('Erro ao enviar PTT via MCP:', error);
    return {
      type: 'audio',
      success: false,
      error: error.message,
      note: 'Erro no envio de PTT via MCP'
    };
  }
}

// Wrapper seguro para geração de imagem
export async function safeGenerateImage(args) {
  try {
    const { default: generateImage } = await import('../src/skills/generateImage.js');
    
    // IMPORTANTE: Remover o argumento 'model' se vier do MCP para garantir
    // que o IMAGE_PROVIDER do .env sempre tenha prioridade
    const { model, ...cleanArgs } = args;
    
    if (model) {
      console.log(`🚫 Argumento 'model: ${model}' ignorado - usando IMAGE_PROVIDER do .env`);
    }
    
    // Garantir que userId seja passado corretamente para a skill
    const imageArgs = {
      ...cleanArgs,
      userId: cleanArgs.from || cleanArgs.recipient || process.env.DEFAULT_WHATSAPP_RECIPIENT
    };
    
    console.log(`🎨 Iniciando geração de imagem com IMAGE_PROVIDER: ${process.env.IMAGE_PROVIDER || 'stable-diffusion'}`);
    
    const result = await generateImage(imageArgs);

    // Se a skill retornar uma string simples, adaptar para o formato esperado pelo MCP
    if (typeof result === 'string') {
      return {
        success: true,
        message: result,
        result: {
          sent: true,
          description: result,
          prompt: imageArgs.prompt,
          provider: process.env.IMAGE_PROVIDER || 'stable-diffusion',
          generationDetails: null,
          completed: true
        },
        sent: true,
        completed: true,
        note: '✅ Imagem gerada e enviada via WhatsApp através do MCP - Tarefa completada'
      };
    }
    // Se for objeto, manter compatibilidade antiga
    return {
      success: result.success,
      message: result.sent ? 
        `✅ ${result.description}` : 
        `❌ ${result.error || result.description || 'Falha na geração'}`,
      result: {
        sent: result.sent || false,
        description: result.description,
        prompt: result.prompt,
        provider: result.provider,
        generationDetails: result.generationDetails || null,
        completed: result.completed || result.action_completed || false
      },
      sent: result.sent || false,
      completed: result.completed || result.action_completed || false,
      note: result.note || (result.sent ? 
        '✅ Imagem gerada e enviada via WhatsApp através do MCP - Tarefa completada' : 
        'Falha na geração ou envio da imagem')
    };
  } catch (error) {
    console.error('Erro na geração de imagem via MCP:', error);
    return {
      success: false,
      error: 'Geração de imagem falhou no MCP',
      message: `❌ Erro: ${error.message}`,
      result: {
        sent: false,
        description: 'Falha completa na geração de imagem',
        prompt: args.prompt,
        provider: 'unknown'
      },
      sent: false,
      note: 'Funcionalidade requer configuração completa do Stable Diffusion ou outros provedores'
    };
  }
}


// Wrapper seguro para geração de áudio
export async function safeGenerateAudio(args) {
  try {
    const { default: generateAudio } = await import('../src/skills/generateAudio.js');
    const result = await generateAudio(args.text, args.voice);
    
    // Se especificado, enviar o áudio automaticamente
    if (args.sendAudio && args.to && result && result.audioBuffer) {
      try {
        const { default: sendPtt } = await import('../src/whatsapp/sendPtt.js');
        const sendResult = await sendPtt(args.to, result.audioBuffer, args.quotedMsgId);
        
        return {
          success: true,
          message: 'Áudio gerado e enviado com sucesso',
          audioGenerated: result,
          audioSent: sendResult,
          text: args.text,
          note: 'Áudio gerado e enviado via MCP'
        };
      } catch (sendError) {
        console.error('Erro ao enviar áudio via MCP:', sendError);
        return {
          success: false,
          error: 'Áudio gerado mas falhou no envio',
          audioGenerated: result,
          sendError: sendError.message,
          text: args.text,
          note: 'Áudio gerado com sucesso, mas falha no envio'
        };
      }
    }
    
    return {
      success: true,
      message: 'Geração de áudio executada com sucesso',
      result: result,
      text: args.text,
      note: 'Áudio gerado via MCP'
    };
  } catch (error) {
    console.error('Erro na geração de áudio via MCP:', error);
    return {
      success: false,
      error: 'Geração de áudio falhou no MCP',
      message: error.message,
      text: args.text,
      note: 'Funcionalidade requer configuração completa do Piper TTS'
    };
  }
}

// Wrapper seguro para calendário
export async function safeCalendarManagement(args) {
  try {
    const { default: calendarSkill } = await import('../src/skills/calendar.js');
    const result = await calendarSkill(args.userId, args.query);

    return {
      success: true,
      message: 'Operação de calendário executada com sucesso',
      result: result,
      userId: args.userId,
      query: args.query,
      note: 'Calendário processado via MCP'
    };
  } catch (error) {
    console.error('Erro no gerenciamento de calendário via MCP:', error);
    return {
      success: false,
      error: 'Gerenciamento de calendário falhou no MCP',
      message: error.message
    };
  }
}

// Wrapper seguro para verificação de loteria
export async function safeLotteryCheck(args) {
  try {
    const { default: lotteryCheck } = await import('../src/skills/lotteryCheck.js');
    const result = await lotteryCheck(args.query);
    
    return {
      success: true,
      message: 'Verificação de loteria executada com sucesso',
      result: result,
      query: args.query,
      note: 'Loteria verificada via MCP'
    };
  } catch (error) {
    console.error('Erro na verificação de loteria via MCP:', error);
    return {
      success: false,
      error: 'Verificação de loteria falhou no MCP',
      message: error.message,
      query: args.query,
      note: 'Funcionalidade requer conectividade com APIs de loteria'
    };
  }
}

// Wrapper seguro para lembretes
export async function safeReminderManagement(args) {
  try {
    const { reminderSkill } = await import('../src/skills/reminder.js');
    const result = await reminderSkill(args.userId, args.query);
    
    return {
      success: true,
      message: 'Operação de lembrete executada com sucesso',
      result: result,
      userId: args.userId,
      query: args.query,
      note: 'Lembrete processado via MCP'
    };
  } catch (error) {
    console.error('Erro no gerenciamento de lembretes via MCP:', error);
    return {
      success: false,
      error: 'Gerenciamento de lembretes falhou no MCP',
      message: error.message
    };
  }
}
