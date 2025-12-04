import { Injectable } from '@nestjs/common';
import { LLMService } from '../services/llm.service';
import { PineconeService } from '../services/pinecone.service';
import { logger } from '../utils/logger';
import { RAGContext } from '../types';

@Injectable()
export abstract class BaseAgent {
  constructor(
    protected llmService: LLMService,
    protected pineconeService: PineconeService
  ) {}

  /**
   * Abstract method to get system prompt
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Abstract method to detect urgency
   */
  protected abstract detectUrgency(query: string): boolean;

  /**
   * Abstract method to get urgency response
   */
  protected abstract getUrgencyResponse(): string;

  /**
   * Abstract method to get Pinecone namespace for this agent
   */
  protected abstract getNamespace(): string;

  /**
   * Retrieve relevant context from RAG
   */
  protected async retrieveContext(query: string): Promise<string> {
    try {
      // Generate embedding for the query
      const embedding = await this.llmService.generateEmbedding(query);

      // Get the namespace for this agent
      const namespace = this.getNamespace();

      // Search for relevant context in agent's namespace
      const contexts = await this.pineconeService.searchContext(embedding, namespace, 5, 0.7);

      if (contexts.length === 0) {
        logger.info(`No relevant context found in namespace '${namespace}'`);
        return '';
      }

      // Format context for prompt
      const formattedContext = contexts
        .map((ctx, idx) => `[${idx + 1}] (Score: ${ctx.score.toFixed(2)})\n${ctx.content}`)
        .join('\n\n');

      logger.info(`Retrieved ${contexts.length} relevant contexts from namespace '${namespace}'`);
      return formattedContext;
    } catch (error) {
      logger.error('Error retrieving context:', error);
      // Continue without context rather than failing
      return '';
    }
  }

  /**
   * Process user query and stream response
   */
  async *processQuery(query: string, userId: string): AsyncGenerator<string, void, unknown> {
    try {
      logger.info(`Processing query for user ${userId}`);

      // Check for urgency
      if (this.detectUrgency(query)) {
        logger.warn(`URGENCY DETECTED for user ${userId}: ${query.substring(0, 50)}...`);
        yield this.getUrgencyResponse();
        return;
      }

      // Retrieve RAG context
      const context = await this.retrieveContext(query);

      if (!context) {
        logger.info('Proceeding without RAG context');
      }

      // Stream response from LLM
      const systemPrompt = this.getSystemPrompt();
      for await (const chunk of this.llmService.streamChatCompletion(
        systemPrompt,
        query,
        context
      )) {
        yield chunk;
      }
    } catch (error) {
      logger.error(`Error processing query for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Non-streaming version (for quick responses)
   */
  async processQuerySync(query: string, userId: string): Promise<string> {
    try {
      logger.info(`Processing sync query for user ${userId}`);

      // Check for urgency
      if (this.detectUrgency(query)) {
        logger.warn(`URGENCY DETECTED for user ${userId}`);
        return this.getUrgencyResponse();
      }

      // Retrieve RAG context
      const context = await this.retrieveContext(query);

      // Get response from LLM
      const systemPrompt = this.getSystemPrompt();
      return await this.llmService.chatCompletion(systemPrompt, query, context);
    } catch (error) {
      logger.error(`Error processing sync query for user ${userId}:`, error);
      throw error;
    }
  }
}
