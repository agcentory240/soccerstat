import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NbBetParserMainModule } from './nb-bet-parser-main/nb-bet-parser-main.module.js';
import { MatchEntity } from './matches/match.entity.js';
import { AiModule } from './ai/ai.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module.js';
import { StateModule } from './state/state.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RabbitmqModule,
    StateModule,
    AiModule.register({
      // Можно переопределить здесь, или оставить — тогда возьмётся из env
      // baseUrl: 'https://api.deepseek.com',
      // defaultModel: 'deepseek-flash',
    }),    
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: 5432,
      username: process.env.DB_USER || 'myuser',
      password: process.env.DB_PASSWORD || 'mypassword',
      database: process.env.DB_NAME || 'mydb',
      entities: [MatchEntity],
    }),    
    NbBetParserMainModule,
    MatchesModule,
    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}