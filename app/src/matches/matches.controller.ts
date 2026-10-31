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
  @Get('prognozed')
  async findPrognozed(@Query('min') min: string = "0") {
    return this.matchesService.findPrognozedScored(Number(min));
  }

  @Post('analyze')
  async analyze() {
    const result = await this.analyzer.analyzeUnprocessed();
    return { updated: result.sent, selected: result.selected };
  }

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
    const result = await this.analyzer.analyzeOneDeep(id, true);
    return result ?? { error: 'Analysis failed or insufficient data' };
  }  

}