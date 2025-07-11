import chatAi from '../config/ai/chat.ai.js';
import tools from '../config/ai/tools.ai.js';

const BROWSE_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'browse',
      description: 'Extracts the content from a given URL. DO NOT use this tool with search engine result pages (e.g., Google, Bing, DuckDuckGo) or any URL that is not a direct content page.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to browse.' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: `Performs a web search to find information or URLs. Use this when you need to find a website or information you don't know.`,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' }
        },
        required: ['query']
      }
    }
  }
];
import browse from '../skills/browse.js';
import webSearch from '../skills/webSearch.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em navegação e busca na web. Sua função é, dada uma consulta do usuário, primeiro tentar navegar diretamente para uma URL fornecida. Se a navegação falhar, especialmente devido a erros de resolução de nome (net::ERR_NAME_NOT_RESOLVED), você DEVE realizar uma busca na web (web_search) com a consulta original do usuário para encontrar informações relevantes. Após a busca, você DEVE analisar cuidadosamente os resultados da busca e, para cada resultado, verificar se a URL é relevante e NÃO é de um motor de busca (como Bing, Google, etc.). Priorize URLs que pareçam ser sites oficiais, páginas de notícias ou artigos diretamente relacionados ao tópico. Se encontrar uma URL relevante, você DEVE usar a ferramenta 'browse' para extrair as informações daquela página específica. Seu objetivo final é retornar a informação mais relevante para a consulta do usuário, seja por navegação direta ou por busca e posterior navegação. Se, após todas as tentativas, você não conseguir encontrar informações relevantes, você deve informar o usuário sobre a falha e sugerir alternativas.`
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
    response = await chatAi(messages, BROWSE_AGENT_TOOLS);
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
          } else if (toolResult.error) {
            console.warn(`BrowseAgent: Browse failed for ${args.url} with error: ${toolResult.error}. Trying next URL if available.`);
            messages.push({ name: toolCall.function.name, role: 'tool', content: `Browse failed for ${args.url}: ${toolResult.error}` });
            continue; // Try next tool call or break if no more browse calls
          }
        } else if (toolCall.function.name === 'web_search') {
          toolResult = await webSearch({ query: args.query });
          console.log(`BrowseAgent: Web search tool result:`, toolResult);
          if (toolResult.results && toolResult.results.length > 0) {
            // Try to browse the top relevant results
            for (const result of toolResult.results.slice(0, 3)) { // Limit to top 3 results
              if (result.link && !result.link.includes('bing.com') && !result.link.includes('google.com') && !result.link.includes('duckduckgo.com')) {
                console.log(`BrowseAgent: Attempting to browse search result: ${result.link}`);
                const browseAttempt = await browse({ url: result.link });
                console.log(`BrowseAgent: Browse attempt result:`, browseAttempt);
                if (!browseAttempt.error) {
                  toolResult.body = browseAttempt.body; // Use the successful browse result
                  toolResult.url = browseAttempt.url;
                  break; // Stop after first successful browse
                } else {
                  console.warn(`BrowseAgent: Failed to browse search result ${result.link}: ${browseAttempt.error}`);
                }
              }
            }
          }
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
