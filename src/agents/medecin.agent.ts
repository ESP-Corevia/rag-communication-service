import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { LLMService } from '../services/llm.service';
import { PineconeService } from '../services/pinecone.service';
import {
  MEDECIN_GENERALISTE_PROMPT,
  URGENCY_KEYWORDS,
  URGENCY_RESPONSE,
} from '../config/prompts';
import { logger } from '../utils/logger';

@Injectable()
export class MedecinGeneralisteAgent extends BaseAgent {
  constructor(llmService: LLMService, pineconeService: PineconeService) {
    super(llmService, pineconeService);
    logger.info('Médecin Généraliste Agent initialized');
  }

  protected getSystemPrompt(): string {
    return MEDECIN_GENERALISTE_PROMPT;
  }

  protected detectUrgency(query: string): boolean {
    const lowercaseQuery = query.toLowerCase();

    // Check for urgency keywords
    const hasUrgencyKeyword = URGENCY_KEYWORDS.some((keyword) =>
      lowercaseQuery.includes(keyword)
    );

    if (hasUrgencyKeyword) {
      logger.warn(`Urgency keyword detected in query: ${query.substring(0, 100)}...`);
    }

    return hasUrgencyKeyword;
  }

  protected getUrgencyResponse(): string {
    return URGENCY_RESPONSE;
  }

  /**
   * Additional medical-specific validation
   */
  private validateMedicalQuery(query: string): boolean {
    // Check if query is too short or nonsensical
    if (query.trim().length < 3) {
      return false;
    }

    // Add more validation rules as needed
    return true;
  }

  /**
   * Override processQuery to add medical-specific logic
   */
  async *processQuery(query: string, userId: string): AsyncGenerator<string, void, unknown> {
    // Validate query
    if (!this.validateMedicalQuery(query)) {
      yield 'Je n\'ai pas bien compris votre question. Pouvez-vous reformuler en décrivant vos symptômes ou votre préoccupation médicale ?';
      return;
    }

    // Call parent implementation
    yield* super.processQuery(query, userId);
  }
}
