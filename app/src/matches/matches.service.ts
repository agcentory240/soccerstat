import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { MatchEntity } from './match.entity.js';
import type { Match } from '../nb-bet-parser-main/match.interface.js';

@Injectable()
export class MatchesService {

  private minScore:number = 3;

  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(MatchEntity)
    private readonly repo: Repository<MatchEntity>,
  ) { }

  async saveMany(matches: Match[]): Promise<number> {
    if (matches.length === 0) return 0;

    const entities = matches.map((m) => this.toEntity(m));

    await this.repo
      .createQueryBuilder()
      .insert()
      .into(MatchEntity)
      .values(entities)
      .orUpdate(
        [
          'country',
          'league',
          'dateTime',
          'homeTeam',
          'awayTeam',
          'score',
          'liveTime',
          'oddsHome',
          'oddsDraw',
          'oddsAway',
        ],
        ['url'],
      )
      .execute();

    this.logger.log(`Upserted ${entities.length} matches`);
    return entities.length;
  }

  async findAll(): Promise<MatchEntity[]> {
    return this.repo.find({ order: { dateTime: 'ASC' } });
  }


  async findScored(): Promise<MatchEntity[]> {
    return this.repo.find({
      where: { aiScore: MoreThan(this.minScore) },
      order: { dateTime: 'ASC' },
    });
  }


  async findByDate(date: string): Promise<MatchEntity[]> {
    return this.repo
      .createQueryBuilder('m')
      .where('DATE(m."dateTime") = :date', { date })
      .orderBy('m."dateTime"', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<MatchEntity | null> {
    return this.repo
      .createQueryBuilder('m')
      .where('id = :id', { id })
      .getOne();
  }

  async findOneDto(id: number): Promise<Match | null> {
    const entity = await this.findOne(id);
    if (!entity) return null;
    return this.toMatchDto(entity);
  }

  /**
   * Обновляет указанные поля матча по id.
   * Не трогает поля, которых нет в объекте.
   *
   * @param id - ID матча
   * @param fields - Частичный объект с полями для обновления
   * @returns true, если матч найден и обновлён, иначе false
   */
  async updateFields(
    id: number,
    fields: Partial<Pick<MatchEntity,
      | 'info'
      | 'reason'
      | 'selected'
      | 'marked'
      | 'ready'
    >>,
  ): Promise<boolean> {
    if (Object.keys(fields).length === 0) {
      this.logger.warn(`updateFields: no fields to update for id=${id}`);
      return false;
    }

    const result = await this.repo.update({ id }, fields);

    if (!result.affected) {
      this.logger.warn(`updateFields: match id=${id} not found`);
      return false;
    }

    this.logger.log(`Updated match id=${id}: ${Object.keys(fields).join(', ')}`);
    return true;
  }  

  private toEntity(m: Match): Partial<MatchEntity> {
    return {
      country: m.country,
      league: m.league,
      url: m.url,
      dateTime: this.parseDateTime(m.dateTime),
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      score: m.score,
      liveTime: m.liveTime,
      oddsHome: m.odds.home,
      oddsDraw: m.odds.draw,
      oddsAway: m.odds.away,
    };
  }

  private parseDateTime(s: string): Date {
    const match = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!match) return new Date();
    const [, day, month, year, hours, minutes] = match;
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
    ));
  }

  private toMatchDto(e: MatchEntity): Match {
    return {
      country: e.country,
      league: e.league,
      url: e.url,
      dateTime: this.formatDateTime(e.dateTime),
      homeTeam: e.homeTeam,
      awayTeam: e.awayTeam,
      score: e.score,
      liveTime: e.liveTime,
      odds: {
        home: e.oddsHome,
        draw: e.oddsDraw,
        away: e.oddsAway,
      },
      marked: e.marked,
      ready: e.ready,
      info: e.info,
    };
  }

  private formatDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
}