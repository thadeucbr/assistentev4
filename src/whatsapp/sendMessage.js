import axios from 'axios';
import { logError } from '../utils/logger.js';
import sendReply from './sendReply.js';

const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

const sendMessage = async (to, content, quotedMsgId = null) => {
  // Verificar se é um grupo (identificado pelo sufixo @g.us)
  const isGroup = to.includes('@g.us') || groups.includes(to);
  
  // Se for um grupo e temos um quotedMsgId, usar reply ao invés de sendText
  if (isGroup && quotedMsgId) {
    try {
      return await sendReply(to, content, quotedMsgId);
    } catch (error) {
      // Se o reply falhar, usar o método normal como fallback
      console.warn('Reply failed, falling back to normal sendMessage:', error.message);
    }
  }

  // Usar o método normal de sendText
  const url = `${process.env.WHATSAPP_URL}/sendText`;

  const options = {
    headers: {
      'accept': '*/*',
      'api_key': process.env.WHATSAPP_SECRET,
      'Content-Type': 'application/json'
    }
  };

  const data = {
    args: {
      to,
      content
    }
  };

  try {
    const response = await axios.post(url, data, options);
    // console.log(response.data);
    return response.data;
  } catch (error) {
    logError(error, `sendMessage - Failed to send message to ${to}`);
    console.error('Error:', error);
    throw error;
  }
};

export default sendMessage;
