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
const { pathToFileURL } = require('url') as {
  pathToFileURL(path: string): { href: string };
};

interface KnowledgeDocument {
  id: string;
  text: string;
  category: string;
}

const EMBEDDING_RETRY_ATTEMPTS = 3;
const EMBEDDING_RETRY_BASE_DELAY_MS = 200;
const EMBEDDING_THROTTLE_DELAY_MS = 300;

interface GeneratedKnowledgeModule {
  knowledgeByNamespace?: Record<string, KnowledgeDocument[]>;
  default?: {
    knowledgeByNamespace?: Record<string, KnowledgeDocument[]>;
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveGeneratedKnowledgeModulePath(): Promise<string> {
  const scriptTsPath = resolve(process.cwd(), 'scripts/generated-health-knowledge.ts');
  const scriptJsPath = resolve(process.cwd(), 'scripts/generated-health-knowledge.js');
  const distJsPath = resolve(process.cwd(), 'dist/scripts/generated-health-knowledge.js');

  if (await fileExists(scriptJsPath)) {
    return scriptJsPath;
  }

  if (await fileExists(distJsPath)) {
    return distJsPath;
  }

  if (await fileExists(scriptTsPath)) {
    return scriptTsPath;
  }

  throw new Error(
    "Generated health knowledge file not found. Run 'npm run generate-health-knowledge' before 'npm run populate-generated-health'."
  );
}

async function importGeneratedModule(modulePath: string): Promise<GeneratedKnowledgeModule> {
  if (modulePath.endsWith('.js')) {
    const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (
      modulePath: string
    ) => Promise<GeneratedKnowledgeModule>;

    try {
      return await dynamicImport(pathToFileURL(modulePath).href);
    } catch (importError) {
      try {
        return require(modulePath) as GeneratedKnowledgeModule;
      } catch (requireError) {
        throw new Error(
          `Unable to load generated health knowledge module from ${modulePath}: ${String(importError)} / ${String(requireError)}`
        );
      }
    }
  }

  const compiledCandidates = [
    modulePath.replace(/\.ts$/u, '.js'),
    resolve(process.cwd(), 'dist/scripts/generated-health-knowledge.js'),
  ];

  for (const compiledCandidate of compiledCandidates) {
    if (await fileExists(compiledCandidate)) {
      return importGeneratedModule(compiledCandidate);
    }
  }

  try {
    // ts-node local workflow fallback when the generated corpus exists only as TypeScript.
    return require(modulePath) as GeneratedKnowledgeModule;
  } catch (error) {
    throw new Error(
      `Unable to load generated TypeScript corpus from ${modulePath}. Run this script via ts-node or generate a compiled .js file first. Cause: ${String(error)}`
    );
  }
}

function extractKnowledgeByNamespace(
  generatedModule: GeneratedKnowledgeModule,
  modulePath: string
): Record<string, KnowledgeDocument[]> {
  const knowledgeByNamespace =
    generatedModule.knowledgeByNamespace ?? generatedModule.default?.knowledgeByNamespace;

  if (!knowledgeByNamespace) {
    throw new Error(`Unable to load knowledgeByNamespace from ${modulePath}`);
  }

  return knowledgeByNamespace;
}

async function loadGeneratedKnowledgeByNamespace(): Promise<Record<string, KnowledgeDocument[]>> {
  const generatedModulePath = await resolveGeneratedKnowledgeModulePath();
  const generatedModule = await importGeneratedModule(generatedModulePath);
  return extractKnowledgeByNamespace(generatedModule, generatedModulePath);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function sleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function generateEmbeddingWithRetry(
  llmService: LLMService,
  doc: KnowledgeDocument
): Promise<number[] | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= EMBEDDING_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await llmService.generateEmbedding(doc.text);
    } catch (error) {
      lastError = error;

      if (attempt >= EMBEDDING_RETRY_ATTEMPTS) {
        break;
      }

      const retryDelayMs = EMBEDDING_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      logger.warn(
        `  Embedding attempt ${attempt}/${EMBEDDING_RETRY_ATTEMPTS} failed for ${doc.id} (${doc.category}). Retrying in ${retryDelayMs}ms: ${getErrorMessage(error)}`
      );
      await sleep(retryDelayMs);
    }
  }

  logger.error(
    `  Failed to generate embedding for ${doc.id} (${doc.category}) after ${EMBEDDING_RETRY_ATTEMPTS} attempts: ${getErrorMessage(lastError)}`
  );
  return null;
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

    const embedding = await generateEmbeddingWithRetry(llmService, doc);

    if (!embedding) {
      await sleep(EMBEDDING_THROTTLE_DELAY_MS);
      continue;
    }

    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: {
        text: doc.text,
        category: doc.category,
        createdAt: new Date().toISOString(),
      },
    });

    await sleep(EMBEDDING_THROTTLE_DELAY_MS);
  }

  if (vectors.length === 0) {
    logger.warn(`Skipping namespace '${namespace}' because no embeddings were generated successfully`);
    return;
  }

  logger.info(`📤 Upserting ${vectors.length} vectors to namespace '${namespace}'...`);
  await pineconeService.upsertVectors(vectors, namespace);
  logger.info(`✅ Namespace '${namespace}' populated with ${vectors.length} generated documents`);
}

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting generated health knowledge population...\n');

    validateEnv();
    const knowledgeByNamespace = await loadGeneratedKnowledgeByNamespace();

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
