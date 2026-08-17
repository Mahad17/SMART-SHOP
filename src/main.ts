import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { join } from 'path';

const server = express();

export const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  // Trust Render's reverse proxy so req.protocol reports 'https' correctly
  // (needed to build correct absolute URLs for uploaded images).
  expressInstance.set('trust proxy', 1);

  // 1. Helmet: Essential HTTP Security Headers (XSS, Clickjacking, MIME Sniffing protection)
  // crossOriginResourcePolicy relaxed so product images under /uploads can be
  // loaded cross-origin by the admin portal and mobile app (CORS is also open below).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // 2. Body Payload Size Limit (Prevents payload-based DoS attacks)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // 2b. Serve locally-uploaded product images.
  // NOTE: this folder lives on local disk — on serverless hosts (e.g. Vercel)
  // or Render deploys without a persistent disk, uploaded files do NOT survive
  // redeploys/restarts. Fine for the current Render deployment's uptime, but
  // worth moving to real object storage (S3/Cloudinary) before relying on it long-term.
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

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