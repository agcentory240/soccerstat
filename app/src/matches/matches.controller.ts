import { Controller, Get, Logger, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { MatchesService } from './matches.service.js';
import { MatchesAnalyzerService } from './matches-analyzer.service.js';
import { MatchEntity } from './match.entity.js';

@Controller('matches')
export class MatchesController {
  
  private readonly logger = new Logger(MatchesController.name);

  constructor(
    private readonly matchesService: MatchesService,
    private readonly analyzer: MatchesAnalyzerService,
  ) {}

  @Get()
  async findAll() {
    return this.matchesService.findScored();
  }

  @Get('by-date')
  async findByDate(@Query('date') date: string) {
    return this.matchesService.findByDate(date);
  }

 @Post('analyze')
  async analyze() {
    const count = await this.analyzer.analyzeUnprocessed();
    return { updated: count };
  }
    

  // @EventPattern('matches.parsed')
  // async handleMatchesParsed(
  //   @Payload() data: { count: number },
  //   @Ctx() context: any,
  // ) {
  //   this.logger.log(`Получено событие: спарсено ${data.count} матчей`);

  //   // Здесь можно запустить анализ, отправить уведомление и т.д.
  //   const count = await this.analyzer.analyzeUnprocessed();
    
  //   // Подтверждаем обработку (если noAck: false)
  //   const channel = context.getChannelRef();
  //   const originalMsg = context.getMessage();
  //   channel.ack(originalMsg);
  // }

  @Get(':id/')
  async getDetails(@Param('id') id: string): Promise<MatchEntity> {
    const match = await this.matchesService.findOne(Number(id));
    if (!match) {
      throw new NotFoundException(`Match ${id} not found`);
    }

    return match;
  }  

  @Get(':id/deep')
  async deepAnalyze(@Param('id', ParseIntPipe) id: number) {
    const result = await this.analyzer.analyzeOneDeep(id);
    return result ?? { error: 'Analysis failed or insufficient data' };
  }  

}