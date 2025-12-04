import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv, getConfig } from './config/env';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    // Validate environment variables
    logger.info('🔍 Validating environment variables...');
    validateEnv();
    const config = getConfig();

    // Create NestJS application
    logger.info('🚀 Starting Corevia IA Service...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Enable CORS
    app.enableCors({
      origin: '*',
      credentials: true,
    });

    // Start server
    const port = parseInt(config.PORT, 10);
    await app.listen(port);

    logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🏥 Corevia IA Service - READY                      ║
║                                                           ║
║  WebSocket: ws://localhost:${port}                         ║
║  Environment: ${config.NODE_ENV}                                  ║
║  Log Level: ${config.LOG_LEVEL}                                    ║
║                                                           ║
║  Agents disponibles:                                      ║
║    - medecin_generaliste                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    logger.info('✅ Server is listening for WebSocket connections');
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap();
