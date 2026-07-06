import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // Preservar rawBody para validação HMAC do webhook Meta
    rawBody: true,
  });

  // Segurança HTTP
  app.use(helmet());

  // CORS restrito
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3001').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefixo global
  app.setGlobalPrefix('api/v1');

  // Swagger (desabilitar em produção)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BeautyFlow API')
      .setDescription('API REST para agendamento inteligente com IA via WhatsApp')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger disponível em /api/docs');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`BeautyFlow API rodando na porta ${port}`);
  logger.log(`Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
