/**
 * Gerencia autorização de mensagens baseado em grupos e menções
 */
export default class MessageAuthHandler {
  /**
   * Verifica se a mensagem está autorizada para processamento
   * @param {Object} data - Dados da mensagem
   * @param {Array} groups - Lista de grupos autorizados
   * @returns {boolean} - True se autorizada
   */
  static isMessageAuthorized(data, groups) {
    const isGroup = groups.includes(data?.chatId);
    
    if (isGroup) {
      // Para grupos: verificar menções ou respostas ao bot
      return data?.mentionedJidList?.includes(process.env.WHATSAPP_NUMBER) ||
             data?.quotedMsgObj?.author === process.env.WHATSAPP_NUMBER;
    } else {
      // Para conversas privadas: sempre autorizado
      return true;
    }
  }

  /**
   * Extrai o ID do usuário limpo da mensagem
   * @param {string} from - Número do remetente
   * @returns {string} - ID do usuário limpo
   */
  static extractUserId(from) {
    return from.replace('@c.us', '');
  }
}
