import axios from 'axios';
import { logError } from '../utils/logger.js';

const WHATSAPP_URL = process.env.WHATSAPP_URL;
const WHATSAPP_SECRET = process.env.WHATSAPP_SECRET;

export default async function simulateTyping(to, on) {
  try {
    const response = await axios.post(`${WHATSAPP_URL}/simulateTyping`, {
      args: {
        to: to,
        on: on
      }
    }, {
      headers: {
        'api_key': WHATSAPP_SECRET
      }
    });
    // console.log(`Simulate typing for ${to} ${on ? 'on' : 'off'}:`, response.data);
    return response.data;
  } catch (error) {
    logError(error, `simulateTyping - Failed to simulate typing for ${to}`);
    console.error(`Error simulating typing for ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}