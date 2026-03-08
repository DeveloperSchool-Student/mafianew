import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);

  // Render free-tier keep-alive: self-ping every 14 minutes
  // Render спить через 15 хв без запитів, цей пінг тримає сервер живим
  if (process.env.RENDER_EXTERNAL_URL) {
    const url = process.env.RENDER_EXTERNAL_URL;
    setInterval(
      async () => {
        try {
          await fetch(`${url}/`);
          console.log(`[keep-alive] pinged ${url}`);
        } catch (e) {
          console.error('[keep-alive] ping failed:', e);
        }
      },
      14 * 60 * 1000,
    ); // 14 minutes
  }
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
});
