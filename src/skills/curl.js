import { logError } from '../utils/logger.js';

/**
 * Faz uma requisição HTTP flexível (GET, POST, etc) para uma URL, podendo enviar headers e corpo customizados.
 * Use para acessar APIs públicas ou endpoints que retornam dados estruturados, como JSON.
 * @param {Object} params
 * @param {string} params.url - URL do endpoint a ser acessado.
 * @param {string} [params.method='GET'] - Método HTTP.
 * @param {Object} [params.headers={}] - Headers HTTP opcionais.
 * @param {string|Object|null} [params.body=null] - Corpo da requisição (para POST, PUT, PATCH). Pode ser JSON ou texto.
 * @param {number} [params.timeout=15000] - Tempo máximo de espera pela requisição (em milissegundos).
 * @returns {Promise<Object>} - status, headers e dados da resposta.
 */
export default async function curl({ url, method = 'GET', headers = {}, body = null, timeout = 15000 }) {
  if (!url) throw new Error('URL é obrigatória');
  const options = {
    method,
    headers: { ...headers },
    // timeout não é suportado nativamente pelo fetch do node, será tratado abaixo
  };
  if (!options.headers['User-Agent']) {
    options.headers['User-Agent'] = 'Mozilla/5.0 (compatible; curl-skill/1.0)';
  }
  if (body && method !== 'GET') {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
  }
  let controller;
  let timer;
  try {
    // Timeout manual para fetch
    controller = new AbortController();
    options.signal = controller.signal;
    timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, options);
    clearTimeout(timer);
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (jsonErr) {
        logError(jsonErr, `curl - Failed to parse JSON response from ${url}`);
        data = '[erro ao processar JSON: ' + (jsonErr.message || 'desconhecido') + ']';
      }
    } else if (contentType.includes('text/plain')) {
      try {
        data = await response.text();
      } catch (txtErr) {
        logError(txtErr, `curl - Failed to parse text response from ${url}`);
        data = '[erro ao processar texto: ' + (txtErr.message || 'desconhecido') + ']';
      }
    } else {
      data = '[conteúdo não retornado: tipo não suportado para LLM]';
    }
    return { url, status: response.status, headers: Object.fromEntries(response.headers.entries()), data };
  } catch (err) {
    if (timer) clearTimeout(timer);
    logError(err, `curl - Failed to make HTTP request to ${url}`);
    return { url, error: err.message || 'Erro desconhecido', code: err.code || undefined, stack: err.stack || undefined };
  }
}
