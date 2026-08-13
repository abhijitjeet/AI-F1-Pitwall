import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Allow Angular frontend (localhost:4200) to connect
    app.enableCors({
        origin: 'http://localhost:4200',
        methods: 'GET,POST,OPTIONS',
    });

    await app.listen(3000);
    console.log('🏎️ F1 Pit Wall Backend running on http://localhost:3000');
}

bootstrap();