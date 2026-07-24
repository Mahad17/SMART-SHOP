import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const expressApp = express();

export const bootstrap = async () => {
  // 1. NestJS application ko Express instance se bind karein
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  // 2. CORS setup
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 3. Global Pipes and Parsers
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 4. Local Development vs Vercel Serverless Handling
  if (process.env.VERCEL) {
    await app.init();
  } else {
    await app.listen(3000, '0.0.0.0');
    console.log('Backend is running on http://localhost:3000');
  }
};

bootstrap();

// 5. Vercel Serverless Function Handler Requirement
export default expressApp;