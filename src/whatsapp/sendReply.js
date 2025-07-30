import axios from 'axios';
import logError from '../utils/logger.js';

const sendReply = async (to, content, quotedMsgId, sendSeen = true) => {
  const url = `${process.env.WHATSAPP_URL}/reply`;

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
      content,
      quotedMsgId,
      sendSeen
    }
  };

  try {
    const response = await axios.post(url, data, options);
    console.log('Reply sent successfully:', response.data);
    return response.data;
  } catch (error) {
    logError(error, `sendReply - Failed to send reply to ${to}`);
    console.error('Error sending reply:', error);
    throw error;
  }
};

export default sendReply;
