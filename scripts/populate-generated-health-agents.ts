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
