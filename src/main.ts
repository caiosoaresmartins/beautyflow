import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // ── Graceful shutdown ──────────────────────────────────────
  app.enableShutdownHooks();

  // ── Segurança: Helmet (headers HTTP) ──────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],  // Swagger UI requer
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,  // Swagger UI requer
    }),
  );

  // ── CORS ──────────────────────────────────────────────────
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim());
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Sem origin (Postman, server-to-server) ou dev: permite
      if (!origin || !isProduction) return callback(null, true);
      // Produção: valida contra lista explícita
      if (allowedOrigins?.includes(origin)) return callback(null, true);
      logger.warn(`CORS bloqueado: origin="${origin}"`);
      callback(new Error(`Origin "${origin}" não permitida pelo CORS`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,  // preflight cache 24h
  });

  // ── Prefixo global + versionamento ────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── ValidationPipe global ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,               // remove campos não declarados no DTO
      forbidNonWhitelisted: true,    // 400 se vier campo extra
      transform: true,               // transforma payload no tipo do DTO
      transformOptions: {
        enableImplicitConversion: true,  // @Type() implícito para primitivos
      },
      disableErrorMessages: isProduction,  // não expõe detalhes em prod
    }),
  );

  // ── Swagger (desabilitado em produção se desejado) ─────────
  if (!isProduction || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('BeautyFlow API')
      .setDescription(
        'Sistema de Agendamento Inteligente para o mercado de beleza.\n\n'
        + '**Autenticação:** Bearer JWT — obtenha o token via `POST /api/v1/auth/login`.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addServer(`http://localhost:${process.env.PORT || 3000}`, 'Local')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
    logger.log(`Swagger disponível em /api/docs`);
  }

  // ── Start ──────────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`BeautyFlow API iniciada | env=${process.env.NODE_ENV ?? 'development'} | porta=${port}`);
  logger.log(`CORS: ${
    isProduction
      ? `restrito a [${allowedOrigins?.join(', ') ?? 'NENHUM — configure ALLOWED_ORIGINS!'}]`
      : 'aberto (desenvolvimento)'
  }`);
}

bootstrap();
