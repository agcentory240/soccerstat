import { Module } from '@nestjs/common';
import { NbBetParserMainService } from './nb-bet-parser-main.service.js';
import { NbBetParserMainController } from './nb-bet-parser-main.controller.js';
import { MatchesModule } from '../matches/matches.module.js';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module.js';
import { NbBetParserDetailService } from './nb-bet-parser-detail.service.js';
import { StateModule } from '../state/state.module.js';

@Module({
  imports: [MatchesModule,RabbitmqModule,StateModule],
  controllers: [NbBetParserMainController],
  providers: [NbBetParserMainService,NbBetParserDetailService],
})
export class NbBetParserMainModule {}
