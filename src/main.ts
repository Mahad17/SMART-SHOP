import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';

const server = express();

export const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  // 1. Helmet: Essential HTTP Security Headers (XSS, Clickjacking, MIME Sniffing protection)
  app.use(helmet());

  // 2. Body Payload Size Limit (Prevents payload-based DoS attacks)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // 3. CORS Configuration
  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 4. Enhanced Input Validation & Sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Extra DTO fields ko ignore/strip karta hai
      forbidNonWhitelisted: true,   // Unknown fields par error throw karta hai (Data Tampering protection)
      transform: true,              // Automatic type casting (String to Number/Boolean)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();
};

// Bootstrap the server
const PORT = process.env.PORT || 3000;
createNestServer(server).then(() => {
  server.listen(PORT, () => {
    console.log(`Backend security initialized on port ${PORT}`);
  });
});

export default server;