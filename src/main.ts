// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express'; // express import karein

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  // Validation enable karein
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // remove unrecognized fields
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

await app.listen(3000, '0.0.0.0');
  console.log(`Backend is running on: http://localhost:3000 and http://192.168.100.38:3000`);
}
bootstrap();