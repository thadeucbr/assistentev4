# Assistente Virtual Inteligente

Este projeto implementa um assistente virtual avançado, focado em inteligência conversacional, utilizando arquiteturas de memória sofisticadas e uma persona adaptativa. O desenvolvimento segue as diretrizes e conceitos explorados no documento `GEMINI.md`.

## Funcionalidades Principais

### 1. Memória Conversacional Avançada (LTM/STM)

O assistente agora possui um sistema de memória dual para gerenciar o contexto da conversa de forma eficiente:

- **Memória de Longo Prazo (LTM):** Implementada com um sistema de Geração Aumentada por Recuperação (RAG) utilizando um banco de dados vetorial em memória persistido em arquivo JSON. Isso permite que o assistente armazene e recupere informações relevantes de conversas passadas, garantindo que ele "lembre" de detalhes importantes ao longo do tempo.

- **Memória de Curto Prazo (STM):** Gerenciada de forma inteligente para otimizar o uso da janela de contexto do modelo de linguagem. A STM utiliza uma abordagem híbrida:
    - **Memória Quente (Janela Deslizante):** Mantém as mensagens mais recentes para acesso imediato.
    - **Memória Morna (Reranking Semântico e Sumarização):** Aplica reranking às mensagens mais antigas com base na relevância para a conversa atual e sumariza as informações menos relevantes para descarregamento na LTM, evitando o estouro da janela de contexto.

### 2. Persona Adaptativa e Dinâmica

Para criar interações mais personalizadas e engajadoras, o assistente adapta sua persona com base no usuário:

- **Prompt de Sistema Dinâmico:** O prompt do modelo de linguagem é construído dinamicamente para cada interação, incorporando informações detalhadas do perfil do usuário.

- **Sinais de Entrada Multifatoriais:** A análise de sentimento e o estilo linguístico do usuário são utilizados para enriquecer o perfil, permitindo que o assistente ajuste seu tom, humor e formalidade de comunicação.

- **Perfil do Usuário Persistente:** Um perfil estruturado do usuário é armazenado e evolui com cada interação, registrando preferências, marcadores linguísticos e fatos importantes.

### 3. Agnosticismo do Provedor de IA

O sistema foi projetado para ser flexível em relação ao provedor de IA. A escolha entre modelos como OpenAI e Ollama (para chat e embeddings) é configurável via variáveis de ambiente, permitindo fácil alternância e experimentação.

## Configuração

Para configurar e rodar o projeto, consulte o arquivo `.env.example` para as variáveis de ambiente necessárias e o `GEMINI.md` para detalhes sobre a arquitetura e o desenvolvimento.

## Como Rodar

1. Clone o repositório.
2. Instale as dependências:
   `npm install`
3. Configure as variáveis de ambiente no arquivo `.env` (baseado no `.env.example`).
4. Inicie a aplicação:
   `npm start` ou `npm run dev`
