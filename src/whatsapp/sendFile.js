import fs from 'fs';
import logger from '../utils/logger.js';

/**
 * Envia um arquivo via WhatsApp
 * @param {string} userId - ID do usuário
 * @param {string} filePath - Caminho do arquivo
 * @param {string} fileName - Nome do arquivo (opcional)
 * @param {string} caption - Legenda do arquivo (opcional)
 * @param {boolean} withoutPreview - Se deve enviar sem preview (opcional, padrão: false)
 * @param {string} mimeType - Tipo MIME do arquivo (opcional, será detectado automaticamente)
 * @returns {Promise<boolean>} Resultado do envio
 */
async function sendFile(userId, filePath, fileName = null, caption = null, withoutPreview = false, mimeType = null) {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      logger.error('sendFile', `Arquivo não encontrado: ${filePath}`);
      return false;
    }

    // Obter informações do arquivo
    const fileStats = fs.statSync(filePath);
    const actualFileName = fileName || filePath.split('/').pop();
    
    // Detectar MIME type baseado na extensão se não fornecido
    let detectedMimeType = mimeType;
    if (!detectedMimeType) {
      const extension = actualFileName.split('.').pop().toLowerCase();
      const mimeTypes = {
        // Documentos
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'rtf': 'application/rtf',
        'odt': 'application/vnd.oasis.opendocument.text',
        
        // Imagens
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        
        // Áudio
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'aac': 'audio/aac',
        'm4a': 'audio/mp4',
        
        // Vídeo
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'webm': 'video/webm',
        
        // Calendário
        'ics': 'text/calendar',
        'ical': 'text/calendar',
        
        // Compactados
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        
        // Outros
        'json': 'application/json',
        'xml': 'application/xml',
        'csv': 'text/csv'
      };
      
      detectedMimeType = mimeTypes[extension] || 'application/octet-stream';
    }

    // Verificar tamanho do arquivo (limite do WhatsApp é ~64MB)
    const maxSize = 64 * 1024 * 1024; // 64MB
    if (fileStats.size > maxSize) {
      logger.error('sendFile', `Arquivo muito grande: ${fileStats.size} bytes (máximo: ${maxSize} bytes)`);
      return false;
    }

    // Ler arquivo e converter para base64
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    const dataUrl = `data:${detectedMimeType};base64,${base64Content}`;

    // Preparar corpo da requisição
    const requestBody = {
      args: {
        to: userId,
        file: dataUrl,
        filename: actualFileName,
        withoutPreview: withoutPreview
      }
    };

    // Adicionar legenda se fornecida
    if (caption) {
      requestBody.args.caption = caption;
    }

    // Enviar via WhatsApp API
    const sendFileUrl = `${process.env.WHATSAPP_URL}/sendFile`;
    
    const response = await fetch(sendFileUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': process.env.WHATSAPP_SECRET
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const result = await response.json();
      logger.info('sendFile', `Arquivo enviado com sucesso para ${userId}: ${actualFileName} (${fileStats.size} bytes)`);
      return true;
    } else {
      const errorText = await response.text();
      logger.error('sendFile', `Erro ao enviar arquivo: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    logger.error('sendFile', 'Erro ao enviar arquivo', error);
    return false;
  }
}

export default sendFile;
