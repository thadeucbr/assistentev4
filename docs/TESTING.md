# Guia de Testes do Projeto

Este documento detalha a estratégia de testes automatizados do projeto, as ferramentas utilizadas e como executar e adicionar novos testes.

## Visão Geral

A suíte de testes foi reescrita do zero para garantir a qualidade e a estabilidade das funcionalidades principais do sistema. Os testes antigos e obsoletos foram removidos, e uma nova estrutura baseada em **Jest** foi implementada.

O objetivo principal é cobrir as funcionalidades críticas do sistema, permitindo o desenvolvimento contínuo e a detecção rápida de regressões.

## Ferramentas

- **Framework de Testes:** [Jest](https://jestjs.io/)
- **Ambiente de Execução:** Node.js (com suporte a módulos ES)

## Como Executar os Testes

Para executar a suíte de testes completa, utilize o seguinte comando na raiz do projeto:

```bash
npm test
```

Este comando irá descobrir e executar todos os arquivos de teste localizados no diretório `tests/` e apresentar um resumo dos resultados.

## Estrutura dos Testes

Todos os testes estão localizados no diretório `tests/`. A estrutura busca espelhar a organização do código-fonte em `src/`, facilitando a localização dos testes para um determinado componente.

### Módulos Testados

Abaixo está um detalhamento dos testes implementados e o que eles cobrem.

#### 1. `tests/utils.test.js`

- **Componente Alvo:** `src/utils/parseScheduledTime.js`
- **Descrição:** Este conjunto de testes valida o utilitário de parsing de data e hora. Ele cobre uma vasta gama de formatos de entrada, incluindo:
  - Strings de data e hora no formato ISO 8601.
  - Formatos de tempo relativo em linguagem natural (ex: "agora + 5 minutos").
  - Formatos de duração ISO 8601 (ex: "PT3M").
  - Timestamps numéricos.
  - Objetos `Date` nativos.
  - Tratamento de entradas inválidas.

#### 2. `tests/ltmService.test.js`

- **Componente Alvo:** `src/services/LtmService.js`
- **Descrição:** Testa o serviço de Memória de Longo Prazo (LTM).
- **Estratégia de Mock:** O `InMemoryVectorStore` é mockado usando `jest.unstable_mockModule` para isolar o serviço de seu armazenamento vetorial subjacente. Isso permite testar a lógica do serviço (formatação de contexto, passagem de argumentos) sem depender de uma instância real do banco de dados vetorial.

#### 3. `tests/dynamicPromptBuilder.test.js`

- **Componente Alvo:** `src/core/prompt/dynamicPromptBuilder.js`
- **Descrição:** Valida a lógica de construção de prompts dinâmicos. Como este é um componente de lógica pura, os testes verificam se a saída do prompt é montada corretamente com base em diferentes combinações de entradas:
  - Perfil do usuário (resumo, preferências, fatos).
  - Contexto da LTM.
  - Análise de sentimento.
  - Estilo de interação (formal vs. informal).
  - Tipo de situação (tarefa complexa, pedido criativo).

#### 4. `tests/calendarAgent.test.js`

- **Componente Alvo:** `src/agents/CalendarAgent.js`
- **Descrição:** Cobre o agente de calendário, que é um componente complexo com múltiplas dependências.
- **Estratégia de Mock:**
  - **Serviços Externos:** `GoogleCalendarService` e `ICalService` são completamente mockados para simular chamadas de API e geração de arquivos.
  - **Funções de Saída:** As funções `sendMessage` e `sendFile` são mockadas para verificar se o agente tenta enviar as mensagens e arquivos corretos para o usuário.
  - **Dependências Internas:** O `logger` é mockado para evitar a escrita de logs durante os testes.
  - **Date/Time:** O objeto `Date` global é mockado para garantir que os testes que dependem do tempo (ex: "amanhã") sejam determinísticos e reproduzíveis.
- **Cobertura:**
  - Análise de intenção (`analyzeIntent`).
  - Parsing de data e hora (`parseDateTime`).
  - Fluxo de criação de eventos (`createEvent`).
  - Fluxo de listagem de eventos (`listEvents`).
