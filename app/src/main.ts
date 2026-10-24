import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MicroserviceOptions } from '@nestjs/microservices';
import { rabbitMQConfig } from './rabbitmq/rabbitmq.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>(rabbitMQConfig);
  app.enableCors();
  await app.startAllMicroservices(); 
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
