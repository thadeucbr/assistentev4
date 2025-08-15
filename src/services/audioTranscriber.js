import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

/**
 * Transcreve um arquivo de áudio usando a API Whisper da OpenAI.
 * @param {string} filePath Caminho do arquivo de áudio.
 * @returns {Promise<string>} Texto transcrito.
 */
export async function transcribeAudio(filePath) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não definida nas variáveis de ambiente.');
  }
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('model', 'whisper-1');

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        maxBodyLength: Infinity,
      }
    );
    return response.data.text;
  } catch (error) {
    console.error('Erro ao transcrever áudio:', error.response?.data || error.message);
    throw error;
  }
}


