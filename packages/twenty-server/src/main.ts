import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import fs from 'fs';

import bytes from 'bytes';
import { useContainer } from 'class-validator';
import session from 'express-session';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';

import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';

import { setPgDateTypeParser } from 'src/database/pg/set-pg-date-type-parser';
import { LoggerService } from 'src/engine/core-modules/logger/logger.service';
import { getSessionStorageOptions } from 'src/engine/core-modules/session-storage/session-storage.module-factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UnhandledExceptionFilter } from 'src/filters/unhandled-exception.filter';

import { AppModule } from './app.module';
import './instrument';

import { chatProxyInstance } from './engine/middlewares/chat-proxy.middleware';
import { settings } from './engine/constants/settings';
import { generateFrontConfig } from './utils/generate-front-config';

// Trigger
const bootstrap = async () => {
  setPgDateTypeParser();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: process.env.LOGGER_IS_BUFFER_ENABLED === 'true',
    rawBody: true,
    snapshot: process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT,
    ...(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH
      ? {
          httpsOptions: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
          },
        }
      : {}),
  });
  const logger = app.get(LoggerService);
  const twentyConfigService = app.get(TwentyConfigService);

  app.use(session(getSessionStorageOptions(twentyConfigService)));

  // Apply class-validator container so that we can use injection in validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Use our logger
  app.useLogger(logger);

  app.useGlobalFilters(new UnhandledExceptionFilter());

  // THE V20 EMERGENCY FIX: Register proxy globally using the verified v3 pathFilter
  // This version prevents the CRM from crashing (no more 502) and preserves the path (no more 404).
  // @ts-ignore - Internal proxy logic (ChatProxyMiddleware) handles the '/chat' filtering
  app.use(chatProxyInstance);

  app.useBodyParser('json', { limit: settings.storage.maxFileSize });
  app.useBodyParser('urlencoded', {
    limit: settings.storage.maxFileSize,
    extended: true,
  });

  // Graphql file upload
  app.use(
    '/graphql',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize)!,
      maxFiles: 10,
    }),
  );

  app.use(
    '/metadata',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize)!,
      maxFiles: 10,
    }),
  );

  // Inject the server url in the frontend page
  generateFrontConfig();

  // THE V22 NUCLEAR FIX: Bind the HTTP 'upgrade' event to the proxy with robust pathing
  const server = app.getHttpServer();
  server.on('upgrade', (req: any, socket: any, head: any) => {
    // V22: Capture all variations of chat websocket traffic (SockJS, DDP)
    if (req.url && req.url.includes('/chat')) {
      // @ts-ignore - Manual WebSocket upgrade binding for the One-App Gateway
      chatProxyInstance.upgrade(req, socket, head);
    }
  });

  const port = twentyConfigService.get('NODE_PORT') || 3000;
  await app.listen(port, '0.0.0.0');
};

bootstrap();
