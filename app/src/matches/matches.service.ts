import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
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
          'status',
          'lastParsedAt',
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

  /**
   * Матчи, по которым сделан прогноз и которые допущены к ставке.
   *
   * Условия:
   * - `selected` — матч отобран для глубокого анализа;
   * - `deepAnalyzed` — глубокий анализ выполнен;
   * - `mainBet IS NOT NULL` и `deepAnalysis IS NOT NULL` — прогноз содержит
   *   конкретную ставку и полный JSON-ответ (отсекает ветку «недостаточно данных»);
   * - `finalDecision = 'СТАВИТЬ'` — вердикт модели допускает ставку.
   *
   * Статус матча не важен: попадают и завершённые, и live, и предстоящие.
   */
  async findPrognozedScored(): Promise<MatchEntity[]> {
    return this.repo.find({
      where: {
        selected: true,
        deepAnalyzed: true,
        finalDecision: 'СТАВИТЬ',
        mainBet: Not(IsNull()),
        deepAnalysis: Not(IsNull()),
      },
      order: { aiScore: 'DESC', dateTime: 'ASC' },
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
      | 'finalScore'
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

  /**
   * Помечает «залипшие» live-матчи завершёнными.
   *
   * Матч мог исчезнуть из выдачи nb-bet сразу после финального свистка —
   * тогда в БД остаётся последняя live-минута. Признак «залипания» —
   * матч давно не встречался в выдаче (`lastParsedAt`). Для старых записей
   * без `lastParsedAt` используется отсечка по времени начала матча.
   *
   * @param maxAgeHours - сколько часов отсутствия в выдаче считать нормой
   * @returns количество обновлённых записей
   */
  async finishStaleLiveMatches(maxAgeHours = 3): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(MatchEntity)
      .set({ status: 'finished', liveTime: null })
      .where('status = :status', { status: 'live' })
      .andWhere(
        `(
          ("lastParsedAt" IS NOT NULL
            AND "lastParsedAt" < NOW() - make_interval(hours => :maxAgeHours))
          OR ("lastParsedAt" IS NULL
            AND "dateTime" + make_interval(hours => :maxAgeHours) < NOW())
        )`,
        { maxAgeHours },
      )
      .execute();

    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(`Marked ${affected} stale live matches as finished`);
    }
    return affected;
  }

  /**
   * Матчи, для которых есть полноценный прогноз и которые уже завершились.
   *
   * Условия:
   * - `selected` — матч отобран для глубокого анализа;
   * - `deepAnalyzed` — глубокий анализ выполнен;
   * - `mainBet IS NOT NULL` и `deepAnalysis IS NOT NULL` — прогноз содержит
   *   конкретную ставку и полный JSON-ответ (отсекает ветку «недостаточно данных»,
   *   где `deepAnalyzed = true`, но `finalDecision = 'ПРОПУСТИТЬ'`);
   * - `status = 'finished'` — матч завершён.
   */
  async findSelectedWithPredictionFinished(): Promise<MatchEntity[]> {
    return this.repo.find({
      where: {
        selected: true,
        deepAnalyzed: true,
        status: 'finished',
        mainBet: Not(IsNull()),
        deepAnalysis: Not(IsNull()),
      },
      order: { aiScore: 'DESC', dateTime: 'ASC' },
    });

  }

  /**
   * Один матч, по которому ещё не выяснен результат ставки.
   *
   * Условия:
   * - `mainBet IS NOT NULL` — ставка сформирована глубоким анализом;
   * - `finalScore IS NOT NULL` — финальный счёт уже получен парсером;
   * - `betStatus IS NULL` — проверка «сыграла / не сыграла» ещё не выполнялась
   *   (`false` означает «проверено и не сыграла», поэтому не попадает).
   *
   * Используется периодической задачей (раз в 2 минуты), которая заново
   * парсит счёт такого матча и тем самым запускает проверку ставки.
   */
  async findOneWithPendingBet(): Promise<MatchEntity | null> {
    return this.repo.findOne({
      where: {
        mainBet: Not(IsNull()),
        finalScore: Not(IsNull()),
        betStatus: IsNull(),
      },
      order: { dateTime: 'ASC' },
    });
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
      status: m.status,
      lastParsedAt: new Date(),
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
      status: e.status,
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