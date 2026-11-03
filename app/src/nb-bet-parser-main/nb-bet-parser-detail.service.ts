import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'playwright';
import { ClientProxy } from '@nestjs/microservices';
import { MatchDetails } from './match.interface.js';
import { JSDOM } from 'jsdom';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { MatchesService } from '../matches/matches.service.js';
import { StateService } from '../state/state.service.js';
import type { ServerStateMatchInfo } from '../state/state.types.js';

//Экстракты
import { extractPredictedScore } from './helpers/extract-predicted-score.js';
import { extractWinProbabilities } from './helpers/extract-win-probabilities.js';
import { extractPredictions } from './helpers/extract-predictions.js';
import { extractAdditionalInfo } from './helpers/extract-additional-info.js';
import { extractMatchOverview } from './helpers/extract-match-overview.js';
import { extractPrematchFacts } from './helpers/extract-prematch-facts.js';
import { extractMotivation } from './helpers/extract-motivation.js';
import { extractPredictionsTab } from './helpers/extract-predictions-tab.js';
import { extractTeamStats } from './helpers/extract-team-stats.js';
import { extractLeagueTable } from './helpers/extract-league-table.js';
import { extractTeamTrends } from './helpers/extract-team-trends.js';
import { extractTeamSeries } from './helpers/extract-team-series.js';
import { MatchEntity } from '../matches/match.entity.js';
import { extractFinalScore } from './helpers/extract-final-score.js';
import { extractMatchResolution } from './helpers/extract-match-resolution.js';


chromium.use(StealthPlugin());


@Injectable()
export class NbBetParserDetailService {


  private readonly logger = new Logger(NbBetParserDetailService.name);

  private detail_match: MatchDetails;

  /** Защита от наложения запусков cron-задачи проверки ставки. */
  private pendingBetRunning = false;

  constructor(
    @Inject('MATCHES_SERVICE') private readonly client: ClientProxy,
    private readonly matchesService: MatchesService,
    private readonly stateService: StateService,
  ) { }


  /**
   * Проверяет счёт всех матчей из очереди `findSelectedWithPredictionFinished()`.
   *
   * @returns количество матчей, у которых счёт/статус был перепроверен
   */
  async parseMatchesScore(): Promise<number> {
    const matchesToCheck = await this.matchesService.findSelectedWithPredictionFinished();

    // Парсим счета последовательно: каждый матч открывает свой браузер
    for (const match of matchesToCheck) {
      await this.parseMatchScore(match);
    }

    this.logger.log(`Проверено матчей: ${matchesToCheck.length}`);
    return matchesToCheck.length;
  }

  /**
   * Раз в 2 минуты берём **один** матч, у которого ставка сформирована и
   * финальный счёт уже получен, но результат ставки (`betStatus`) ещё не
   * выяснен, и заново парсим его счёт.
   *
   * `parseMatchScore` обновляет `finalScore` и эмитит событие
   * `match.score_parsed`, по которому {@link MatchesPipelineController}
   * запускает `analyzeOneScore` — тот записывает `betStatus` и публикует
   * `match_bet_checked` в Redis/SSE.
   *
   * Запуск защищён флагом `pendingBetRunning`: тик пропускается, если
   * предыдущая проверка ещё держит браузер.
   */
  @Cron('0 */2 * * * *', { name: 'pending-bet-check' })
  async checkPendingBet(): Promise<void> {
    if (this.pendingBetRunning) {
      this.logger.debug('Проверка ставки уже выполняется — тик пропущен');
      return;
    }

    this.pendingBetRunning = true;

    try {
      const match = await this.matchesService.findOneWithPendingBet();

      if (!match) {
        this.logger.debug('Нет матчей с невыясненным результатом ставки');
        return;
      }

      this.logger.log(
        `Проверяю ставку матча #${match.id} (${match.homeTeam} — ${match.awayTeam}), ` +
          `счёт ${match.finalScore ?? '—'}, ставка «${match.mainBet ?? '—'}»`,
      );

      await this.parseMatchScore(match);
    } catch (err) {
      this.logger.error(
        `Ошибка периодической проверки ставки: ${(err as Error).message}`,
      );
    } finally {
      this.pendingBetRunning = false;
    }
  }

  /**
   * Парсим детальный счет
   * @param match 
   */
  async parseMatchScore(match: MatchEntity): Promise<any> {

      //Запустим браузер
      const browser: Browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      try {
        const page: Page = await browser.newPage();
        await page.goto(match.url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

      await page.waitForTimeout(3000);
      let html = await page.content();
      let dom = new JSDOM(html);

      // 1. Сначала проверяем перенос/отмену: у таких матчей на странице
      //    обычно стоит счёт `0:0`, который нельзя считать финальным.
      const resolution = extractMatchResolution(dom.window.document);
      if (resolution) {
        await this.matchesService.updateFields(match.id, { status: resolution });
        this.logger.warn(
          `[${match.id}] Матч ${resolution === 'postponed' ? 'перенесён' : 'отменён'} — счёт не проверяется`,
        );
        return;
      }

      // 2. Счёт найден — матч завершён, фиксируем счёт и статус.
      const score = extractFinalScore(dom.window.document);
      if (score) {
        const finalScore = `${score.total} ${score.byPeriods}`;
        await this.matchesService.updateFields(match.id, {
          finalScore: finalScore,
          status: 'finished',
        });

        // Событие `match_parsed`: в RabbitMQ (запуск глубокого анализа) и Redis/SSE
        this.client.emit('match.score_parsed', { matchId: match.id, score: finalScore });

        const matchInfo: ServerStateMatchInfo = {
          id: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          url: match.url,
        };
        await this.stateService.finalScoreParsed( matchInfo,finalScore );

      } else {
        this.logger.warn(`[${match.id} ${match.homeTeam} - ${match.awayTeam} ${match.url}]  Cчёт завершенного матча не найден`);
      }

      } finally {
        await browser.close();
      }

  }

  /**
   * Парсит детальную информацию матча по URL.
   * Проходит по всем страницам, публикует событие после каждой.
   */
  async parseMatch(match: any): Promise<any> {

    this.detail_match = {
      match: match,
      description: "",
      info: "",
      reason: match.reason
    }

    //Запустим браузер
    const browser: Browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page: Page = await browser.newPage();
      await page.goto(match.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);
      let html = await page.content();

      const debugDir = join(process.cwd(), 'debug');
      // mkdirSync(debugDir, { recursive: true });
      // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // writeFileSync(join(debugDir, `nb-bet-detail-${timestamp}.html`), html, 'utf-8');

      let dom = new JSDOM(html);
      // console.log(JSON.stringify(dom));

      //Разбираем по частям

      //предпоалгаемый счет
      const score = extractPredictedScore(dom.window.document);
      if (score) {
        this.detail_match.info += `\n\n## Предполагаемый счет ## \n(Прогноз на счет матча составлен на основе анализа формы команд и статистики прошлых матчей)\n.**${score.home}:${score.away}**`;
      } else {
        this.logger.warn(`[${match.id}] Предполагаемый счёт не найден`);
      }

      //предпоалгаемый счет
      const probabilities = extractWinProbabilities(dom.window.document);
      if (probabilities) {
        this.detail_match.info += `\n\n## Вероятность выигрыша ## \nВероятности выигрыша по букмекеру: П1=**${probabilities.home}%**, X=**${probabilities.draw}%**, П2=**${probabilities.away}%**`;
      } else {
        this.logger.warn(`[${match.id}] Вероятности выигрыша не найдены`);
      }

      //Прогнозы
      const predictions = extractPredictions(dom.window.document);
      if (predictions) {
        if (predictions.math) {
          this.detail_match.info += `\n\n## Математический прогноз\n${predictions.math.text}`;
          if (predictions.math.odd) {
            this.detail_match.info += `\n\nКоэффициент: **${predictions.math.odd}**`;
          }
        }
        if (predictions.users) {
          this.detail_match.info += `\n\n## Прогноз пользователей\n${predictions.users.text}`;
          if (predictions.users.odd) {
            this.detail_match.info += `\n\nКоэффициент: **${predictions.users.odd}**`;
          }
        }
      } else {
        this.logger.warn(`[${match.id}] Прогнозы не найдены`);
      }

      //Блок дополнительной информации
      const additionalInfo = extractAdditionalInfo(dom.window.document);
      if (additionalInfo) {
        this.detail_match.info += `\n\n## Доп. информация\n`;
        for (const item of additionalInfo.items) {
          this.detail_match.info += `\n- **${item.label}:** ${item.value}`;
        }
      } else {
        this.logger.warn(`[${match.id}] Доп. информация не найдена`);
      }

      //Краткое описание
      const overview = extractMatchOverview(dom.window.document);
      if (overview) {
        this.detail_match.description = overview.text;
        this.detail_match.info += `\n\n## Краткое описание\n${overview.text}`;
      } else {
        this.logger.warn(`[${match.id}] Краткое описание не найдено`);
      }
      // === Предматчевые факты: Основные ===
      await this.clickMoreFacts(page);
      // 1. Факты (Мотивация)
      const facts = extractPrematchFacts(dom.window.document, 'Мотивация');
      if (facts) {
        this.detail_match.info += `\n\n## Предматчевые факты (${facts.tab})\n`;
        for (const fact of facts.facts) {
          this.detail_match.info += `\n- ${fact.text}`;
          if (fact.event) {
            this.detail_match.info += ` _(${fact.event.label}: ${fact.event.odd})_`;
          }
        }
      }


      // === Предматчевые факты: Мотивация ===
      await this.clickPrematchTab(page, 'Мотивация');

      await page.waitForTimeout(300);  // ← дать DOM обновиться

      html = await page.content();     // ← ПОСЛЕ кликов
      dom = new JSDOM(html);

      // 2. Мотивация команд
      const motivation = extractMotivation(dom.window.document);
      if (motivation) {
        this.detail_match.info += `\n\n## Мотивация команд\n`;
        for (const team of motivation.teams) {
          this.detail_match.info += `\n### ${team.teamName}${team.score ? ` (${team.score})` : ''}\n`;
          for (const block of team.blocks) {
            this.detail_match.info += `\n**${block.title}** — ${block.description}\n`;
            this.detail_match.info += `\n| Исход | Кэф |\n|---|---|\n`;
            for (const odd of block.odds) {
              this.detail_match.info += `| ${odd.label} | ${odd.odd} |\n`;
            }
          }
        }
      }


      // === Прогнозы (вкладка) ===
      await this.clickTab(page, 'Прогнозы');
      await page.waitForTimeout(400);  // ждём переключения
      html = await page.content();
      dom = new JSDOM(html);

      // mkdirSync(debugDir, { recursive: true });
      // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // writeFileSync(join(debugDir, `nb-bet-results-${timestamp}.html`), html, 'utf-8');

      const predictionsTab = extractPredictionsTab(dom.window.document);
      if (predictionsTab) {
        if (predictionsTab.system.length > 0) {
          this.detail_match.info += `\n\n## Прогнозы системы\n`;
          for (const p of predictionsTab.system) {
            const label = p.type === 'math' ? '🤖 Математический' : '⭐ Популярный';
            this.detail_match.info += `\n- **${label}:** ${p.text}`;
            if (p.odd) this.detail_match.info += ` — коэф. **${p.odd}**`;
          }
        }

        if (predictionsTab.users.length > 0) {
          this.detail_match.info += `\n\n## Прогнозы пользователей\n`;
          for (const u of predictionsTab.users) {
            this.detail_match.info += `\n### ${u.author}`;
            if (u.rank) this.detail_match.info += ` · ${u.rank}`;
            if (u.profit) this.detail_match.info += ` · ${u.profit}`;
            if (u.addedAt) this.detail_match.info += ` · ${u.addedAt}`;
            this.detail_match.info += `\n**${u.text}**`;
            if (u.odd) this.detail_match.info += ` — коэф. ${u.odd}`;
            this.detail_match.info += `\n`;
          }
        }
      } else {
        this.logger.warn(`[${match.id}] Прогнозы не найдены`);
      }

      // === Сводная (вкладка) ===
      await this.clickTab(page, 'Сводная');
      await page.waitForTimeout(400);  // ждём переключения
      await this.clickPrematchTab(page, 'Мотивация');
      await page.waitForTimeout(400);  // ждём переключения
      html = await page.content();
      dom = new JSDOM(html);

      mkdirSync(debugDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      writeFileSync(join(debugDir, `nb-bet-results-${timestamp}.html`), html, 'utf-8');

      let teamStats = extractTeamStats(dom.window.document);
      if (teamStats) {
        if (teamStats.main.length > 0) {
          this.detail_match.info += `\n\n## Сводная статистика\n`;
          this.detail_match.info += `\n| Показатель | Хозяева | Гости |\n|---|---|---|\n`;
          for (const row of teamStats.main) {
            this.detail_match.info += `| ${row.label} | ${row.home} | ${row.away} |\n`;
          }
        }

        if (teamStats.small.length > 0) {
          this.detail_match.info += `\n\n### Смоллмаркеты\n`;
          this.detail_match.info += `\n| Показатель | Хозяева | Гости |\n|---|---|---|\n`;
          for (const row of teamStats.small) {
            this.detail_match.info += `| ${row.label} | ${row.home} | ${row.away} |\n`;
          }
        }
      } else {
        this.logger.warn(`[${match.id}] Сводная статистика не найдена`);
      }

      // === Сводная между собой (вкладка) ===
      await this.clickPrematchTab(page, 'Между собой');
      await page.waitForTimeout(1000);  // ждём переключения
      html = await page.content();
      dom = new JSDOM(html);
      teamStats = extractTeamStats(dom.window.document);
      if (teamStats) {
        if (teamStats.main.length > 0) {
          this.detail_match.info += `\n\n## Сводная статистика (между собой)\n`;
          this.detail_match.info += `\n| Показатель | Хозяева | Гости |\n|---|---|---|\n`;
          for (const row of teamStats.main) {
            this.detail_match.info += `| ${row.label} | ${row.home} | ${row.away} |\n`;
          }
        }

        if (teamStats.small.length > 0) {
          this.detail_match.info += `\n\n### Смоллмаркеты (между собой)\n`;
          this.detail_match.info += `\n| Показатель | Хозяева | Гости |\n|---|---|---|\n`;
          for (const row of teamStats.small) {
            this.detail_match.info += `| ${row.label} | ${row.home} | ${row.away} |\n`;
          }
        }
      } else {
        this.logger.warn(`[${match.id}] Сводная статистика между собой не найдена`);
      }

      // === Таблица матчей (вкладка) ===
      await this.clickTab(page, 'Таблица');
      await page.waitForTimeout(1000);  // ждём переключения
      html = await page.content();
      dom = new JSDOM(html);

      const table = extractLeagueTable(
        dom.window.document,
        match.homeTeam,  // для пометки team1
        match.awayTeam,  // для пометки team2
      );

      if (table && table.rows.length > 0) {
        this.detail_match.info += `\n\n## Таблица турнира\n`;
        this.detail_match.info += `\n| # | Команда | И | В | Н | П | Голы | О |\n|---|---|---|---|---|---|---|---|\n`;

        for (const row of table.rows) {
          // Помечаем команды матча
          let marker = '';
          if (row.isHome) marker = ' 🏠';
          if (row.isAway) marker = ' ✈️';

          this.detail_match.info += `| ${row.position} | ${row.teamName}${marker} | ${row.played} | ${row.wins} | ${row.draws} | ${row.losses} | ${row.goals} | ${row.points} |\n`;
        }
      } else {
        this.logger.warn(`[${match.id}] Таблица не найдена`);
      }

      // === Тренды команд ===
      await this.clickTab(page, 'Тренды'); // или как называется вкладка
      await page.waitForTimeout(500);
      html = await page.content();
      dom = new JSDOM(html);

      const trends = extractTeamTrends(dom.window.document);
      if (trends) {
        this.detail_match.info += `\n\n## Тренды команд\n`;
        this.detail_match.info += `\n| Тренд | Хозяева | Гости |\n|---|---|---|\n`;
        for (const trend of trends.trends) {
          const home = trend.home ? `${trend.home.score}${trend.home.odd ? ` (${trend.home.odd})` : ''}` : '—';
          const away = trend.away ? `${trend.away.score}${trend.away.odd ? ` (${trend.away.odd})` : ''}` : '—';
          this.detail_match.info += `| ${trend.name} | ${home} | ${away} |\n`;
        }
      } else {
        this.logger.warn(`[${match.id}] Тренды команд не найдены`);
      }      


      // === Серии (вкладка "Серии") ===
      // Перед этим надо кликнуть вкладку "Серии" внутри блока "Тренды"
      await this.clickTab(page, 'Серии');
      await page.waitForTimeout(500);
      html = await page.content();
      dom = new JSDOM(html);

      const series = extractTeamSeries(dom.window.document);
      if (series) {
        this.detail_match.info += `\n\n## Серии команд\n`;
        this.detail_match.info += `\n| Серия | Хозяева | Гости |\n|---|---|---|\n`;
        for (const row of series.series) {
          const home = row.home
            ? `${row.home.count}${row.home.odd ? ` (${row.home.odd})` : ''}`
            : '—';
          const away = row.away
            ? `${row.away.count}${row.away.odd ? ` (${row.away.odd})` : ''}`
            : '—';
          this.detail_match.info += `| ${row.name} | ${home} | ${away} |\n`;
        }
      } else {
        this.logger.warn(`[${match.id}] Серии команд не найдены`);
      }      

    } finally {
      await browser.close();
    }

    await this.matchesService.updateFields(match.id, {
      info: this.detail_match.info,
    });

    const matchInfo: ServerStateMatchInfo = {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      url: match.url,
    };

    // Событие `match_parsed`: в RabbitMQ (запуск глубокого анализа) и Redis/SSE
    this.client.emit('match.parsed', { matchId: match.id, match: matchInfo });
    await this.stateService.detailParsed(matchInfo);

    return this.detail_match;
  }

  private async clickPrematchTab(page: Page, tabName: string): Promise<void> {
    try {
      const tab = page
        .locator('div', { hasText: new RegExp(`^${tabName}$`) })
        .first();

      if (await tab.isVisible({ timeout: 2000 })) {
        await tab.click();
        await page.waitForTimeout(1000);
        this.logger.log(`Clicked tab: ${tabName}`);
      }
    } catch {
      // вкладки может не быть — это ок
    }
  }

  private async clickMoreFacts(page: Page): Promise<void> {
    try {
      const btn = page
        .locator('button', { hasText: 'Больше фактов' })
        .first();

      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(200);
        this.logger.log('Clicked "Больше фактов"');
      }
    } catch {
      // кнопки может не быть — это ок
    }
  }


  private async clickTab(page: Page, tabName: string): Promise<void> {
    try {
      const tab = page
        .locator('div', { hasText: new RegExp(`^${tabName}$`) })
        .first();

      if (await tab.isVisible({ timeout: 2000 })) {
        await tab.click();
        this.logger.log(`Clicked tab: ${tabName}`);
      }
    } catch {
      // вкладки может не быть
    }
  }
}