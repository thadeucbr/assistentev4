import logger from '../utils/logger.js';

// Core processors
import UserDataProcessor from './processors/userDataProcessor.js';
import AIResponseProcessor from './processors/aiResponseProcessor.js';

// Orchestrators
import ToolExecutionOrchestrator from './orchestrators/toolExecutionOrchestrator.js';

// Handlers
import ErrorHandler from './handlers/errorHandler.js';
import ContextAnalyzer from './handlers/contextAnalyzer.js';
import BackgroundTaskManager from './handlers/backgroundTaskManager.js';

// External dependencies
import MessageAuthHandler from './processors/messageAuthHandler.js';
import simulateTyping from '../whatsapp/simulateTyping.js';

// Environment config
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

/**
 * Processes incoming messages by orchestrating various services.
 * This class is instantiated for each message to ensure stateless processing.
 */
class MessageProcessor {
  constructor(message) {
    this.message = message;
    this.data = message?.data;
    this.messageId = logger.generateMessageId();
    this.startTime = Date.now();

    // This will be populated by the processing methods
    this.state = {
      userContent: null,
      imageAnalysisResult: null,
      userId: null,
      rawMessages: null,
      userProfile: null,
      ltmContext: null,
      messages: null,
      response: null,
    };
  }

  /**
   * Main orchestrator method to process a message.
   */
  async process() {
    logger.start('MessageProcessor', 'Processing started', { messageId: this.messageId });

    try {
      logger.interaction('MessageProcessor', 'webhook-received', {
        from: this.data?.from,
        messageType: this.data?.messageType || 'text',
        hasImage: !!this.data?.image,
      });

      if (!this._isAuthorized()) {
        logger.debug('MessageProcessor', 'Message not authorized - ignoring', { messageId: this.messageId });
        return;
      }
      logger.milestone('MessageProcessor', 'Message authorized', { messageId: this.messageId });

      this._initialize();
      await this._processUserData();
      await this._performAIAnalysis();
      const dynamicPrompt = this._buildPrompt();
      const { mcpExecutor, dynamicTools, handled } = await this._prepareAndGenerateResponse(dynamicPrompt);
      if (handled) return; // Exit gracefully if error was handled and user was notified

      await this._executeToolCycle(dynamicTools, mcpExecutor);
      await this._finalize();

      logger.end('MessageProcessor', `Processing complete. Total time: ${Date.now() - this.startTime}ms`, { messageId: this.messageId });
    } catch (error) {
      await ErrorHandler.handleCriticalError(error, this.message);
    }
  }

  /**
   * Phase 1: Authorization
   */
  _isAuthorized() {
    return MessageAuthHandler.isMessageAuthorized(this.data, groups);
  }

  /**
   * Phase 2: Initialization
   */
  _initialize() {
    simulateTyping(this.data.from, true);
  }

  /**
   * Phase 3: User Data Processing
   */
  async _processUserData() {
    const { userContent, imageAnalysisResult } = await UserDataProcessor.processMediaData(this.data);
    this.state.userContent = userContent;
    this.state.imageAnalysisResult = imageAnalysisResult;

    const { userId, rawMessages, userProfile, ltmContext } = await UserDataProcessor.loadUserData(this.data, userContent);
    this.state.userId = userId;
    this.state.rawMessages = rawMessages;
    this.state.userProfile = userProfile;
    this.state.ltmContext = ltmContext;

    this.state.messages = await UserDataProcessor.processMessageContext(rawMessages, userContent, userId, this.data.from);
  }

  /**
   * Phase 4: AI Analysis
   */
  async _performAIAnalysis() {
    // Note: returned values are not used later in the original code.
    // If they were, we would store them in this.state.
    await UserDataProcessor.performAIAnalysis(
      this.state.userContent,
      this.state.userId,
      this.state.userProfile
    );
  }

  /**
   * Phase 6: Prompt Construction
   */
  _buildPrompt() {
    // The original try/catch was redundant as it called the same fallback function.
    // The ContextAnalyzer.determineSituationType was also not used.
    return AIResponseProcessor.createFallbackPrompt(
      this.state.userProfile,
      this.state.ltmContext,
      this.state.imageAnalysisResult
    );
  }

  /**
   * Phase 7: AI Response Generation
   */
  async _prepareAndGenerateResponse(dynamicPrompt) {
    // Patch: filter messages to keep context concise
    const lastUserIndex = [...this.state.messages].reverse().findIndex(msg => msg.role === 'user');
    let filteredMessages = this.state.messages;
    if (lastUserIndex !== -1) {
      const idx = this.state.messages.length - 1 - lastUserIndex;
      filteredMessages = this.state.messages.slice(idx);
    }

    const sanitizedChatMessages = AIResponseProcessor.prepareChatMessages(dynamicPrompt, filteredMessages, this.state.userContent);
    const { mcpExecutor, dynamicTools } = await AIResponseProcessor.getAvailableTools();

    try {
      this.state.response = await AIResponseProcessor.generateAIResponse(sanitizedChatMessages, dynamicTools);
    } catch (error) {
      const handled = await ErrorHandler.handleAIResponseError(error, this.data);
      if (handled) {
        return { handled: true }; // Signal that the error was handled
      }
      throw error; // Re-throw if not handled
    }

    return { mcpExecutor, dynamicTools, handled: false };
  }

  /**
   * Phase 8: Tool Execution
   */
  async _executeToolCycle(dynamicTools, mcpExecutor) {
    this.state.messages.push({ role: 'user', content: this.state.userContent });
    this.state.messages.push(this.state.response.message);

    logger.step('MessageProcessor', '🔧 Starting tool cycle', { messageId: this.messageId });
    await ToolExecutionOrchestrator.executeToolCycle(
      this.state.messages,
      this.state.response,
      dynamicTools,
      this.data,
      this.state.userContent,
      this.state.imageAnalysisResult,
      mcpExecutor
    );
    logger.timing('MessageProcessor', '🔧 Tool cycle finished', { messageId: this.messageId });
  }

  /**
   * Phase 9: Finalization
   */
  async _finalize() {
    await UserDataProcessor.saveUserContext(this.state.userId, this.state.messages);
    BackgroundTaskManager.executeBackgroundTasks(this.state.userId, this.state.messages);
  }
}

/**
 * Main entry point for processing a message.
 * Creates a new MessageProcessor instance for each message.
 * @param {Object} message - The message object from the webhook.
 */
export default async function processMessage(message) {
  const processor = new MessageProcessor(message);
  await processor.process();
}
