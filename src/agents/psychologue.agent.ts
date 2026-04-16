import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { LLMService } from '../services/llm.service';
import { PineconeService } from '../services/pinecone.service';
import {
  PSYCHOLOGUE_PROMPT,
  URGENCY_KEYWORDS,
  URGENCY_RESPONSE,
} from '../config/prompts';
import { logger } from '../utils/logger';

@Injectable()
export class PsychologueAgent extends BaseAgent {
  constructor(llmService: LLMService, pineconeService: PineconeService) {
    super(llmService, pineconeService);
    logger.info('Psychologue Agent initialized');
  }

  protected getSystemPrompt(): string {
    return PSYCHOLOGUE_PROMPT;
  }

  protected detectUrgency(query: string): boolean {
    const lowercaseQuery = query.toLowerCase();
    const hasUrgencyKeyword = URGENCY_KEYWORDS.some((keyword) =>
      lowercaseQuery.includes(keyword)
    );

    if (hasUrgencyKeyword) {
      logger.warn(
        `Urgency keyword detected in psychology query: ${query.substring(0, 100)}...`
      );
    }

    return hasUrgencyKeyword;
  }

  protected getUrgencyResponse(): string {
    return URGENCY_RESPONSE;
  }

  protected getNamespace(): string {
    return 'psychologue';
  }
}

