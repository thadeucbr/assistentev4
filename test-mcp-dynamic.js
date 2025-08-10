#!/usr/bin/env node

/**
 * Script de teste para verificar a integração MCP dinâmica
 */

import MCPToolExecutor from './src/core/tools/MCPToolExecutor.js';
import logger from './src/utils/logger.js';

async function testMCPDynamicIntegration() {
  try {
    logger.info('TestMCP', '🧪 === TESTE DE INTEGRAÇÃO MCP DINÂMICA ===');
    
    // Testar instanciação do MCPToolExecutor
    const mcpExecutor = new MCPToolExecutor();
    logger.info('TestMCP', '✅ MCPToolExecutor instanciado com sucesso');
    
    // Testar obtenção de ferramentas disponíveis
    logger.info('TestMCP', '🔍 Testando getAvailableTools()...');
    const availableTools = await mcpExecutor.getAvailableTools();
    logger.info('TestMCP', `✅ ${availableTools.length} ferramentas disponíveis obtidas`);
    
    // Listar ferramentas encontradas
    availableTools.forEach((tool, index) => {
      logger.info('TestMCP', `  ${index + 1}. ${tool.name} - ${tool.description}`);
    });
    
    // Testar conversão para formato OpenAI
    logger.info('TestMCP', '🔄 Testando getToolsForOpenAI()...');
    const openAITools = await mcpExecutor.getToolsForOpenAI();
    logger.info('TestMCP', `✅ ${openAITools.length} ferramentas convertidas para formato OpenAI`);
    
    // Mostrar primeira ferramenta no formato OpenAI
    if (openAITools.length > 0) {
      logger.info('TestMCP', `📋 Exemplo de ferramenta OpenAI:`, {
        name: openAITools[0].function.name,
        description: openAITools[0].function.description,
        parameters: Object.keys(openAITools[0].function.parameters.properties || {}).length + ' parâmetros'
      });
    }
    
    logger.milestone('TestMCP', '🎉 TESTE DE INTEGRAÇÃO MCP DINÂMICA CONCLUÍDO COM SUCESSO!');
    
  } catch (error) {
    logger.error('TestMCP', `❌ ERRO NO TESTE MCP: ${error.message}`, error.stack);
    process.exit(1);
  }
}

// Executar o teste
testMCPDynamicIntegration();
