import { logError } from '../utils/logger.js';


const SEND_PTT_ENDPOINT = `${process.env.WHATSAPP_URL}/sendFile`;

export default async function sendPtt(recipientId, audioBuffer, quotedMsgId) {
  try {
    console.log('sendPtt: Iniciando envio de PTT para:', recipientId);
    console.log('sendPtt: Tamanho do buffer de áudio:', audioBuffer.length, 'bytes');
    
    const audioDataUri = `data:audio/ogg;base64,${audioBuffer.toString('base64')}`;

    const payload = {
      args: {
        to: recipientId,
        file: audioDataUri,
        filename: "audio.ogg",
        quotedMsgId: quotedMsgId || undefined,
        waitForId: false,
        ptt: true
      },
    };

    console.log('sendPtt: Payload preparado, enviando para:', SEND_PTT_ENDPOINT);

    const fetchResponse = await fetch(SEND_PTT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'api_key': process.env.WHATSAPP_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.text();
      throw new Error(`Erro HTTP ao enviar áudio: ${fetchResponse.status} - ${errorData}`);
    }

    const responseData = await fetchResponse.json();
    if (responseData.success === false) {
      throw new Error(`A API OpenWA retornou um erro: ${responseData.error?.message || JSON.stringify(responseData.error)}`);
    }

    console.log('Mensagem de voz enviada com sucesso!');
    return { success: true, message: 'Áudio enviado com sucesso.' };
  } catch (error) {
    logError(error, `sendPtt - Failed to send PTT to ${recipientId}`);
    console.error('Ocorreu um erro no processo de envio de áudio:', error.message);
    return { success: false, error: error.message };
  }
}
