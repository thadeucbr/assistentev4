import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configura o fluent-ffmpeg para usar o executável que o installer baixou
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const execPromise = util.promisify(exec);

// --- Constantes de Configuração ---
const PIPER_PATH = path.join(process.cwd(), 'piper', 'piper.exe');
const MODEL_PATH = path.join(process.cwd(), 'piper', 'pt_BR-cadu-medium.onnx');
const TEMP_AUDIO_DIR = path.join(process.cwd(), 'temp_audio');
// O endpoint correto para PTT, de acordo com o Swagger
const SEND_PTT_ENDPOINT = 'http://192.168.1.239:8088/sendPtt';

/**
 * Garante que o diretório de áudio temporário exista.
 */
async function ensureTempDirExists() {
  try {
    await fs.access(TEMP_AUDIO_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(TEMP_AUDIO_DIR);
    } else {
      throw error;
    }
  }
}

/**
 * Gera um áudio a partir de um texto, converte para o formato OGG/Opus e envia como
 * uma mensagem de voz (PTT) para a API OpenWA.
 * @param {string} textToSpeak O texto a ser transformado em áudio.
 * @param {string} recipientId O ID do destinatário (ex: 5511999999999@c.us).
 * @param {string|undefined} quotedMsgId O ID da mensagem a ser respondida (opcional).
 */
export default async function generateAndSendAudio(textToSpeak, recipientId, quotedMsgId) {
  await ensureTempDirExists();
  
  const baseFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const wavFilePath = path.resolve(path.join(TEMP_AUDIO_DIR, `${baseFileName}.wav`));
  const oggFilePath = path.resolve(path.join(TEMP_AUDIO_DIR, `${baseFileName}.ogg`));

  const piperCommand = `echo "${textToSpeak.replace(/"/g, '\\"')}" | "${PIPER_PATH}" --model "${MODEL_PATH}" --output_file "${wavFilePath}"`;

  try {
    // ---- ETAPA 1: Gerar o arquivo .wav com o Piper ----
    console.log('Gerando arquivo .wav com Piper...');
    await execPromise(piperCommand, { shell: true });
    console.log(`Arquivo .wav gerado: ${wavFilePath}`);

    // ---- ETAPA 2: Converter .wav para .ogg com ffmpeg ----
    console.log('Convertendo para .ogg (formato do WhatsApp)...');
    await new Promise((resolve, reject) => {
      ffmpeg(wavFilePath)
        .audioCodec('libopus')
        .audioBitrate('32k')
        .outputOptions('-vbr', 'on')
        .output(oggFilePath)
        .on('end', () => {
          console.log('Conversão para .ogg concluída.');
          resolve();
        })
        .on('error', (err) => {
          console.error('Erro na conversão do ffmpeg:', err.message);
          reject(err);
        })
        .run();
    });
    
    // ---- ETAPA 3: Ler o arquivo final e montar o payload ----
    const audioFileBuffer = await fs.readFile(oggFilePath);
    const audioDataUri = `data:audio/ogg;base64,${audioFileBuffer.toString('base64')}`;

    // Monta o payload EXATAMENTE como a documentação do Swagger especifica
    const payload = {
      args: {
        to: recipientId,
        file: audioDataUri,
        quotedMsgId: quotedMsgId || undefined
      }
    };

    console.log(`Enviando para o endpoint: ${SEND_PTT_ENDPOINT}`);
    console.log('Estrutura do payload final:', JSON.stringify(payload, null, 2));

    // ---- ETAPA 4: Enviar a requisição para a API ----
    const fetchResponse = await fetch(SEND_PTT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'api_key': process.env.WHATSAPP_SECRET,
      },
      body: JSON.stringify(payload),
    });

    // Tratamento de erro da requisição
    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.text();
      console.error('Error response data (fetch):', errorData);
      throw new Error(`Erro HTTP! Status: ${fetchResponse.status}, Corpo: ${errorData}`);
    }

    const responseData = await fetchResponse.json();
    console.log('Resposta da API:', responseData);
    
    // Tratamento de erro DENTRO da resposta da API
    if (responseData.success === false) {
      const apiError = responseData.error?.message || JSON.stringify(responseData.error);
      console.error("A API retornou sucesso=false:", apiError);
      throw new Error(`A API retornou um erro: ${apiError}`);
    }

    return { success: true, message: 'Mensagem de voz gerada e enviada com sucesso.' };

  } catch (error) {
    console.error('Ocorreu um erro geral no processo de envio de áudio:', error.message);
    return { success: false, error: error.message };
  } finally {
    // ---- ETAPA 5: Limpeza dos arquivos temporários ----
    try {
      await fs.unlink(wavFilePath);
      console.log(`Arquivo temporário deletado: ${wavFilePath}`);
    } catch (e) { /* ignora erro se o arquivo não existir */ }
    try {
      await fs.unlink(oggFilePath);
      console.log(`Arquivo temporário deletado: ${oggFilePath}`);
    } catch (e) { /* ignora erro se o arquivo não existir */ }
  }
}