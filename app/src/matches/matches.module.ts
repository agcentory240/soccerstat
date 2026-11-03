import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchEntity } from './match.entity.js';
import { MatchesService } from './matches.service.js';
import { MatchesController } from './matches.controller.js';
import { AiModule } from '../ai/ai.module.js';
import { MatchesAnalyzerService } from './matches-analyzer.service.js';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module.js';
import { StateModule } from '../state/state.module.js';
import { PostProcessorService } from '../analysis/post-processor.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchEntity]),
    AiModule.register(),
    RabbitmqModule,
    StateModule,
  ],
  providers: [MatchesService,MatchesAnalyzerService, PostProcessorService],
  controllers: [MatchesController],
  exports: [MatchesService,MatchesAnalyzerService],
})
export class MatchesModule {}