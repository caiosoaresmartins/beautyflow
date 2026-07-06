import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // necessário para validação HMAC do webhook Meta
    logger: ['error', 'warn', 'log'],
  });

  // ── Segurança ──────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // compatível com Swagger UI
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3001'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origem ${origin} não permitida.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Versão & prefixo ─────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validação global ─────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // remove campos não declarados no DTO
      forbidNonWhitelisted: true,
      transform: true,          // converte strings para tipos TypeScript
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger (desabilitado em produção) ─────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BeautyFlow API')
      .setDescription('API REST do sistema de agendamento inteligente BeautyFlow')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    new Logger('Bootstrap').log('Swagger disponível em /api/docs');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`BeautyFlow rodando na porta ${port} [${process.env.NODE_ENV ?? 'development'}]`);
}

bootstrap();
