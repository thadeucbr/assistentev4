import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';
import browse from '../skills/browse.js';
import webSearch from '../skills/webSearch.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em navegação e busca na web. Sua função é, dada uma consulta do usuário, primeiro tentar navegar diretamente para uma URL fornecida. Se a navegação falhar, especialmente devido a erros de resolução de nome (net::ERR_NAME_NOT_RESOLVED), você deve realizar uma busca na web (web_search) com a consulta original do usuário para encontrar informações relevantes. Após a busca, você deve analisar os resultados e, se apropriado, tentar navegar para uma das URLs encontradas para extrair o conteúdo. Seu objetivo final é retornar a informação mais relevante para a consulta do usuário, seja por navegação direta ou por busca e posterior navegação.

Você tem acesso às seguintes ferramentas:
- 'browse': Para navegar e extrair conteúdo de uma URL específica.
- 'web_search': Para realizar buscas na web e obter uma lista de resultados.

Sempre que usar uma ferramenta, você deve adicionar o resultado ao histórico de mensagens para que o modelo possa processá-lo. Ao final, você deve retornar um resumo conciso da informação encontrada ou uma mensagem indicando que a informação não pôde ser encontrada.`
};

export async function execute(userQuery) {
  console.log(`BrowseAgent: Starting execution for query: ${userQuery}`);
  let messages = [SYSTEM_PROMPT, { role: 'user', content: userQuery }];
  let response;
  let maxIterations = 5; // Prevent infinite loops
  let iterationCount = 0;

  while (iterationCount < maxIterations) {
    iterationCount++;
    console.log(`BrowseAgent: Iteration ${iterationCount}. Sending messages to chatAi:`, messages);
    response = await chatAi(messages, tools);
    console.log(`BrowseAgent: Received response from chatAi:`, response.message);

    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      console.log(`BrowseAgent: Tool calls identified:`, response.message.tool_calls);
      for (const toolCall of response.message.tool_calls) {
        const args = toolCall.function.arguments;
        let toolResult;
        console.log(`BrowseAgent: Executing tool: ${toolCall.function.name} with args:`, args);

        if (toolCall.function.name === 'browse') {
          toolResult = await browse({ url: args.url });
          console.log(`BrowseAgent: Browse tool result:`, toolResult);
          if (toolResult.error && toolResult.error.includes('net::ERR_NAME_NOT_RESOLVED')) {
            console.warn(`BrowseAgent: Browse failed with name resolution error. Attempting web search as fallback.`);
            messages.push({ name: toolCall.function.name, role: 'tool', content: `Browse failed with name resolution error. Attempting web search.` });
            // Fallback to web search
            const webSearchResult = await webSearch({ query: userQuery });
            console.log(`BrowseAgent: Web search fallback result:`, webSearchResult);
            messages.push({ name: 'web_search', role: 'tool', content: JSON.stringify(webSearchResult) });
            // Continue the loop to re-prompt the AI with the new search results
            continue; 
          }
        } else if (toolCall.function.name === 'web_search') {
          toolResult = await webSearch({ query: args.query });
          console.log(`BrowseAgent: Web search tool result:`, toolResult);
        } else {
          toolResult = { error: `Unknown tool: ${toolCall.function.name}` };
          console.error(`BrowseAgent: Unknown tool encountered: ${toolCall.function.name}`);
        }
        messages.push({ name: toolCall.function.name, role: 'tool', content: JSON.stringify(toolResult) });
      }
    } else {
      console.log(`BrowseAgent: No more tool calls. Breaking loop.`);
      // If no tool calls, the agent has a final response
      break;
    }
  }

  console.log(`BrowseAgent: Final response:`, response.message.content);
  return response.message.content; // Return the final content from the agent
}
