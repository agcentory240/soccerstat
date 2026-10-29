import { Controller, Get, Param } from '@nestjs/common';
import { NbBetParserMainService } from './nb-bet-parser-main.service.js';
import { NbBetParserDetailService } from './nb-bet-parser-detail.service.js';
import { Match } from './match.interface.js';
import { MatchesService } from '../matches/matches.service.js';

@Controller('parser')
export class NbBetParserMainController {

    constructor(
        private readonly parserService: NbBetParserMainService,
        private readonly matchesService: MatchesService,
        private readonly parserDetailService: NbBetParserDetailService,
        
    ) {}

    @Get('matches')
    async parseMain(): Promise<Match[]> {
        return this.parserService.parseMatches();
    }


    @Get('matches/:id')
    async parseDetail(@Param('id') id: string): Promise<any> {
        const match = await this.matchesService.findOne(Number(id));
        if (match) {
            return this.parserDetailService.parseMatch(match);
        } else {
            return new Promise((reject)=>{reject("No match found")})
        }
        
    }

    @Get('checkbets')
    async checkBets(): Promise<{ ok: boolean; checked: number }> {
        const checked = await this.parserDetailService.parseMatchesScore();
        // Возвращаем тело ответа: без него клиент получает пустой 200
        // и падает на `res.json()` с «Unexpected end of JSON input».
        return { ok: true, checked };
    }

    @Get('checkbet/:id')
    async checkBet(@Param('id') id: string): Promise<any> {
        const match = await this.matchesService.findOne(Number(id));
        if (match) {
            return this.parserDetailService.parseMatchScore(match);
        } else {
            return new Promise((reject)=>{reject("No match found")})
        }        
    }
}
