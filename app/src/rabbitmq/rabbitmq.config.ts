import { RmqOptions, Transport } from '@nestjs/microservices';

export const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://guest:guest@rabbitmq:5672';

export const rabbitMQConfig: RmqOptions = {
  transport: Transport.RMQ,
  options: {
    urls: [RABBITMQ_URI],
    queue: 'matches_queue',
    queueOptions: {
      durable: true,
    },
    noAck: false,
  },
};