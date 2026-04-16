import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { LLMService } from '../services/llm.service';
import { PineconeService } from '../services/pinecone.service';
import {
  DERMATOLOGUE_PROMPT,
  URGENCY_KEYWORDS,
  URGENCY_RESPONSE,
} from '../config/prompts';
import { logger } from '../utils/logger';

@Injectable()
export class DermatologueAgent extends BaseAgent {
  constructor(llmService: LLMService, pineconeService: PineconeService) {
    super(llmService, pineconeService);
    logger.info('Dermatologue Agent initialized');
  }

  protected getSystemPrompt(): string {
    return DERMATOLOGUE_PROMPT;
  }

  protected detectUrgency(query: string): boolean {
    const lowercaseQuery = query.toLowerCase();
    const hasUrgencyKeyword = URGENCY_KEYWORDS.some((keyword) =>
      lowercaseQuery.includes(keyword)
    );

    if (hasUrgencyKeyword) {
      logger.warn(
        `Urgency keyword detected in dermatology query: ${query.substring(0, 100)}...`
      );
    }

    return hasUrgencyKeyword;
  }

  protected getUrgencyResponse(): string {
    return URGENCY_RESPONSE;
  }

  protected getNamespace(): string {
    return 'dermatologue';
  }
}

