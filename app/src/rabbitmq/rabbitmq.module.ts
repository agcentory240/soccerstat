import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RABBITMQ_URI } from './rabbitmq.config.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MATCHES_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URI],
          queue: 'matches_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RabbitmqModule {}