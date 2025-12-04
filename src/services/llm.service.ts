import { Injectable } from '@nestjs/common';
import MistralClient from '@mistralai/mistralai';
import { getConfig } from '../config/env';
import { logger } from '../utils/logger';

@Injectable()
export class LLMService {
  private client: MistralClient;

  constructor() {
    const config = getConfig();
    this.client = new MistralClient(config.MISTRAL_API_KEY);
    logger.info('Mistral AI client initialized');
  }

  /**
   * Generate embeddings for RAG
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      logger.debug(`Generating embedding for text: ${text.substring(0, 50)}...`);

      const response = await this.client.embeddings({
        model: 'mistral-embed',
        input: [text],
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Stream chat completion with Mistral Large
   */
  async *streamChatCompletion(
    systemPrompt: string,
    userMessage: string,
    context?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (context) {
        messages.push({
          role: 'system',
          content: `Contexte médical pertinent :\n${context}`,
        });
      }

      messages.push({ role: 'user', content: userMessage });

      logger.debug('Starting streaming chat completion');

      const stream = await this.client.chatStream({
        model: 'mistral-large-latest',
        messages,
        temperature: 0.7,
        maxTokens: 1000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      logger.debug('Streaming chat completion finished');
    } catch (error) {
      logger.error('Error in streaming chat completion:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Non-streaming chat completion (for quick responses)
   */
  async chatCompletion(
    systemPrompt: string,
    userMessage: string,
    context?: string
  ): Promise<string> {
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (context) {
        messages.push({
          role: 'system',
          content: `Contexte médical pertinent :\n${context}`,
        });
      }

      messages.push({ role: 'user', content: userMessage });

      const response = await this.client.chat({
        model: 'mistral-large-latest',
        messages,
        temperature: 0.7,
        maxTokens: 1000,
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error('Error in chat completion:', error);
      throw new Error('Failed to generate response');
    }
  }
}
