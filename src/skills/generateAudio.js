import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configura o ffmpeg (usado apenas pela geração local)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const execPromise = util.promisify(exec);

// --- Constantes de Configuração ---
const PIPER_PATH = path.join(process.cwd(), 'piper', 'piper.exe');
const MODEL_PATH = path.join(process.cwd(), 'piper', 'pt_BR-cadu-medium.onnx');
const TEMP_AUDIO_DIR = path.join(process.cwd(), 'temp_audio');


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
 * Gera áudio usando o provedor local (Piper + FFMPEG).
 * Retorna um Buffer com o áudio em formato OGG.
 * @param {string} textToSpeak O texto a ser falado.
 */
async function generateAudioLocally(text) {
  const baseFileName = `local_audio_${Date.now()}`;
  const wavFilePath = path.resolve(path.join(TEMP_AUDIO_DIR, `${baseFileName}.wav`));
  const oggFilePath = path.resolve(path.join(TEMP_AUDIO_DIR, `${baseFileName}.ogg`));

  try {
    // Etapa 1: Gerar .wav com Piper
    const piperCommand = `echo "${text}" | "${PIPER_PATH}" --model "${MODEL_PATH}" --output_file "${wavFilePath}"`;
    console.log('Gerando áudio localmente com Piper...');
    console.log(`Piper Command: ${piperCommand}`);
    try {
      const { stdout, stderr } = await execPromise(piperCommand, { shell: true });
      console.log(`Piper stdout: ${stdout}`);
      if (stderr) console.error(`Piper stderr: ${stderr}`);
    } catch (execError) {
      console.error(`Error executing Piper command: ${execError.message}`);
      throw execError;
    }

    // Etapa 2: Converter .wav para .ogg com ffmpeg
    console.log('Convertendo para .ogg...');
    console.log(`FFmpeg input: ${wavFilePath}, output: ${oggFilePath}`);
    await new Promise((resolve, reject) => {
      ffmpeg(wavFilePath)
        .audioCodec('libopus')
        .audioBitrate('32k')
        .outputOptions('-vbr', 'on')
        .output(oggFilePath)
        .on('end', () => {
          console.log('FFmpeg conversion finished.');
          resolve();
        })
        .on('error', (err) => {
          console.error(`FFmpeg error: ${err.message}`);
          reject(err);
        })
        .run();
    });

    // Etapa 3: Ler o arquivo final e retornar o buffer
    const oggBuffer = await fs.readFile(oggFilePath);
    return oggBuffer;

  } finally {
    // Etapa 4: Limpeza
    fs.unlink(wavFilePath).catch(() => {});
    fs.unlink(oggFilePath).catch(() => {});
  }
}

/**
 * Gera áudio usando a API da OpenAI.
 * Retorna um Buffer com o áudio já em formato Opus.
 * @param {string} textToSpeak O texto a ser falado.
 */
async function generateAudioWithOpenAI(text) {
  console.log('Gerando áudio com a API da OpenAI...');
  const apiKey = process.env.OPENAI_API_KEY;
  const voice = process.env.OPENAI_TTS_VOICE || 'onyx';
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1';

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      input: text,
      voice: voice,
      response_format: 'opus', // Pedimos o formato correto diretamente!
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha na API da OpenAI: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  // A resposta da API é o próprio áudio binário
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return audioBuffer;
}


/**
 * Função principal que gera e envia o áudio, escolhendo o provedor
 * com base na variável de ambiente TTS_PROVIDER.
 */
export default async function generateAudio(text) {
  await ensureTempDirExists();

  try {
    console.log(`Iniciando geração de áudio para: "${text}"`);
    
    let audioBuffer;
    const provider = process.env.TTS_PROVIDER || 'local';

    // Roteador: escolhe qual função de geração de áudio usar
    switch (provider) {
      case 'openai':
        audioBuffer = await generateAudioWithOpenAI(text);
        break;
      case 'local':
      default:
        audioBuffer = await generateAudioLocally(text);
        break;
    }

    console.log(`Áudio gerado com sucesso usando o provedor: ${provider}.`);
    return { success: true, audioBuffer };

  } catch (error) {
    console.error('Ocorreu um erro geral no processo de geração de áudio:', error.message);
    return { success: false, error: error.message };
  }
}