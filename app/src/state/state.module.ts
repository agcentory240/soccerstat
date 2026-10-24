import { Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { StateController } from './state.controller.js';
import { StateService } from './state.service.js';

@Module({
  controllers: [StateController],
  providers: [RedisService, StateService],
  exports: [RedisService, StateService],
})
export class StateModule {}
