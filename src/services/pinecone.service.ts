import { Injectable } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { getConfig } from '../config/env';
import { logger } from '../utils/logger';
import { RAGContext, PineconeMatch } from '../types';

@Injectable()
export class PineconeService {
  private pinecone: Pinecone;
  private indexName: string;

  constructor() {
    const config = getConfig();
    this.indexName = config.PINECONE_INDEX_NAME;

    this.pinecone = new Pinecone({
      apiKey: config.PINECONE_API_KEY,
    });

    logger.info(`Pinecone client initialized with index: ${this.indexName}`);
  }

  /**
   * Search for relevant context in Pinecone with namespace support
   */
  async searchContext(
    embedding: number[],
    namespace: string,
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<RAGContext[]> {
    try {
      logger.debug(`Searching Pinecone namespace '${namespace}' with topK=${topK}, minScore=${minScore}`);

      const index = this.pinecone.Index(this.indexName);

      const queryResponse = await index.namespace(namespace).query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });

      const matches = queryResponse.matches || [];

      // Filter by minimum score and transform to RAGContext
      const contexts: RAGContext[] = matches
        .filter((match: any) => match.score >= minScore)
        .map((match: any) => ({
          content: match.metadata?.text || match.metadata?.content || '',
          score: match.score,
          metadata: match.metadata,
        }));

      logger.info(`Found ${contexts.length} relevant contexts in namespace '${namespace}' (score >= ${minScore})`);

      return contexts;
    } catch (error) {
      logger.error('Error searching Pinecone:', error);
      throw new Error('Failed to search knowledge base');
    }
  }

  /**
   * Upsert vectors to Pinecone with namespace support
   */
  async upsertVectors(
    vectors: Array<{
      id: string;
      values: number[];
      metadata: Record<string, any>;
    }>,
    namespace: string
  ): Promise<void> {
    try {
      logger.debug(`Upserting ${vectors.length} vectors to Pinecone namespace '${namespace}'`);

      const index = this.pinecone.Index(this.indexName);

      await index.namespace(namespace).upsert(vectors);

      logger.info(`Successfully upserted ${vectors.length} vectors to namespace '${namespace}'`);
    } catch (error) {
      logger.error('Error upserting vectors:', error);
      throw new Error('Failed to upsert vectors');
    }
  }

  /**
   * Delete all vectors in namespace (use with caution)
   */
  async deleteAllVectors(namespace: string): Promise<void> {
    try {
      logger.warn(`Deleting all vectors in namespace: ${namespace}`);

      const index = this.pinecone.Index(this.indexName);

      await index.namespace(namespace).deleteAll();

      logger.info(`All vectors deleted successfully from namespace '${namespace}'`);
    } catch (error) {
      logger.error('Error deleting vectors:', error);
      throw new Error('Failed to delete vectors');
    }
  }
}
