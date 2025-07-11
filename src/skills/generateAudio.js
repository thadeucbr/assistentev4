import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';

const execPromise = util.promisify(exec);

const PIPER_PATH = path.join(process.cwd(), 'piper', 'piper.exe');
const MODEL_PATH = path.join(process.cwd(), 'piper', 'pt_BR-cadu-medium.onnx');
// const MODEL_CONFIG_PATH = path.join(process.cwd(), 'piper', 'pt_BR-cadu-medium.onnx.json'); // Not directly used in command but good to note
const TEMP_AUDIO_DIR = path.join(process.cwd(), 'temp_audio');
const SEND_FILE_ENDPOINT = 'http://192.168.1.239:8088/sendFile'; // Changed from sendAudio

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

export default async function generateAndSendAudio(textToSpeak, recipientId, quotedMsgId) {
  await ensureTempDirExists();
  const outputFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;
  const outputFilePath = path.join(TEMP_AUDIO_DIR, outputFileName);
  const absoluteOutputFilePath = path.resolve(outputFilePath); // Ensure absolute path for piper

  // It's safer to pass text via stdin to avoid command line length limits and special character issues.
  const command = `echo "${textToSpeak.replace(/"/g, '\\\\"')}" | "${PIPER_PATH}" --model "${MODEL_PATH}" --output_file "${absoluteOutputFilePath}"`;

  try {
    console.log(`Executing Piper command: ${command}`);
    const { stdout, stderr } = await execPromise(command, { shell: true }); // Using shell true for pipe
    if (stderr) {
      console.error(`Piper stderr: ${stderr}`);
      // Depending on piper's behavior, stderr might not always mean failure.
    }
    console.log(`Piper stdout: ${stdout}`);
    console.log(`Audio generated: ${absoluteOutputFilePath}`);

    // Check if file was created
    try {
      await fs.access(absoluteOutputFilePath);
    } catch (fileError) {
      console.error(`Failed to access generated audio file: ${absoluteOutputFilePath}`, fileError);
      return { success: false, error: 'Failed to generate audio file locally.' };
    }

    // Read the file and encode it to base64
    const audioFileBuffer = await fs.readFile(absoluteOutputFilePath);
    const audioFileBase64 = audioFileBuffer.toString('base64');
    
    const payload = {
        to: recipientId, 
        file: `data:audio/wav;base64,${audioFileBase64}`,
        filename: 'audio.wav',
        ptt: false, // Explicitly set ptt to false
      };

    if (quotedMsgId && quotedMsgId.trim() !== '') { 
      payload.quotedMsgId = quotedMsgId; // No longer nested under args
    }

    console.log(`Sending audio to endpoint: ${SEND_FILE_ENDPOINT} with recipient:`, recipientId);
    console.log('Payload being sent:', JSON.stringify(payload, null, 2)); // Log the new payload structure
    const fetchResponse = await fetch(SEND_FILE_ENDPOINT, { // Changed to SEND_FILE_ENDPOINT
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'api_key': process.env.WHATSAPP_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.text(); // Try to get text for more detailed error
      console.error('Error response data (fetch):', errorData);
      console.error('Error response status (fetch):', fetchResponse.status);
      throw new Error(`HTTP error! status: ${fetchResponse.status}, body: ${errorData}`);
    }

    const responseData = await fetchResponse.json();
    console.log('Audio sent successfully:', responseData);
    return { success: true, message: 'Audio generated and sent successfully.' };

  } catch (error) {
    console.error('Error in generateAndSendAudio:', error.message);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    return { success: false, error: error.message };
  } finally {
    // Clean up the temporary audio file
    try {
      await fs.access(absoluteOutputFilePath); // Check if file exists before trying to delete
      await fs.unlink(absoluteOutputFilePath);
      console.log(`Temporary audio file deleted: ${absoluteOutputFilePath}`);
    } catch (cleanupError) {
      // If the file wasn't created due to an earlier error, this will fail.
      // Or if deletion fails for some other reason.
      if (cleanupError.code !== 'ENOENT') { // ENOENT means file not found, which is fine if generation failed
          console.error(`Error cleaning up temporary audio file ${absoluteOutputFilePath}:`, cleanupError.message);
      }
    }
  }
}
