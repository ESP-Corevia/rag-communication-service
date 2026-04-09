declare const process: {
  cwd(): string;
  exit(code: number): never;
};
declare const require: (id: string) => unknown;

import { validateEnv } from '../src/config/env';
import { LLMService } from '../src/services/llm.service';
import { PineconeService } from '../src/services/pinecone.service';
import { logger } from '../src/utils/logger';

const { access } = require('fs/promises') as {
  access(path: string): Promise<void>;
};
const { resolve } = require('path') as {
  resolve(...paths: string[]): string;
};

interface KnowledgeDocument {
  id: string;
  text: string;
  category: string;
}

async function loadGeneratedKnowledgeByNamespace(): Promise<Record<string, KnowledgeDocument[]>> {
  const generatedFilePath = resolve(process.cwd(), 'scripts/generated-health-knowledge.ts');

  try {
    await access(generatedFilePath);
  } catch {
    throw new Error(
      "Generated health knowledge file not found. Run 'npm run generate-health-knowledge' before 'npm run populate-generated-health'."
    );
  }

  const generatedModule = require(generatedFilePath) as {
    knowledgeByNamespace?: Record<string, KnowledgeDocument[]>;
  };

  if (!generatedModule.knowledgeByNamespace) {
    throw new Error(`Unable to load knowledgeByNamespace from ${generatedFilePath}`);
  }

  return generatedModule.knowledgeByNamespace;
}

async function populateNamespace(
  llmService: LLMService,
  pineconeService: PineconeService,
  knowledge: KnowledgeDocument[],
  namespace: string
): Promise<void> {
  logger.info(`\n📚 Processing ${knowledge.length} generated documents for namespace '${namespace}'...`);

  const vectors = [];

  for (let index = 0; index < knowledge.length; index += 1) {
    const doc = knowledge[index];
    logger.info(`  Generating embedding ${index + 1}/${knowledge.length} for: ${doc.id}`);

    const embedding = await llmService.generateEmbedding(doc.text);

    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: {
        text: doc.text,
        category: doc.category,
        createdAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  logger.info(`📤 Upserting ${vectors.length} vectors to namespace '${namespace}'...`);
  await pineconeService.upsertVectors(vectors, namespace);
  logger.info(`✅ Namespace '${namespace}' populated with ${vectors.length} generated documents`);
}

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting generated health knowledge population...\n');

    const knowledgeByNamespace = await loadGeneratedKnowledgeByNamespace();
    validateEnv();

    const llmService = new LLMService();
    const pineconeService = new PineconeService();

    for (const [namespace, knowledge] of Object.entries(knowledgeByNamespace)) {
      if (knowledge.length === 0) {
        logger.warn(`Skipping namespace '${namespace}' because no generated documents were found`);
        continue;
      }

      await populateNamespace(llmService, pineconeService, knowledge, namespace);
    }

    logger.info('\n✅ GENERATED HEALTH AGENTS POPULATED SUCCESSFULLY!');
    Object.entries(knowledgeByNamespace).forEach(([namespace, knowledge]) => {
      logger.info(`  - ${namespace}: ${knowledge.length} docs`);
    });
  } catch (error) {
    logger.error('❌ Error populating generated health agents:', error);
    process.exit(1);
  }
}

main();
