import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required'),
  PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),
  PINECONE_ENVIRONMENT: z.string().default('us-east-1-aws'),
  PINECONE_INDEX_NAME: z.string().default('corevia-medecin-generaliste'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

export function validateEnv(): EnvConfig {
  try {
    config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export function getConfig(): EnvConfig {
  if (!config) {
    config = validateEnv();
  }
  return config;
}
