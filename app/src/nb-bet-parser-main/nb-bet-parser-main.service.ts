import { Inject, Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright-extra';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Match } from './match.interface.js';
import { parseMatchesFromDocument } from './helpers/parse-matches.helper.js';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'playwright';
import { JSDOM } from 'jsdom';
import { MatchesService } from '../matches/matches.service.js';
import { ClientProxy } from '@nestjs/microservices';
import { StateService } from '../state/state.service.js';

chromium.use(StealthPlugin());

@Injectable()
export class NbBetParserMainService {
  private readonly logger = new Logger(NbBetParserMainService.name);


  constructor(
    private readonly matchesService: MatchesService,
    @Inject('MATCHES_SERVICE') private readonly client: ClientProxy,
    private readonly stateService: StateService,
  ) {}

  async parseMatches(): Promise<Match[]> {
    await this.stateService.parsingStart();

    const browser: Browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page: Page = await browser.newPage();
      await page.goto('https://nb-bet.com/Results', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await this.dismissCookieBanner(page);
      await page.waitForTimeout(3000);

      // Сохраняем HTML для отладки (можно убрать позже)
      const html = await page.content();
      const debugDir = join(process.cwd(), 'debug');
      mkdirSync(debugDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      writeFileSync(join(debugDir, `nb-bet-results-${timestamp}.html`), html, 'utf-8');

      const dom = new JSDOM(html);
      const matches: any = parseMatchesFromDocument(dom.window.document);
      // console.log(JSON.stringify(matches[Object.keys(matches)[0]], null, 2));
      await this.matchesService.saveMany(matches);
      // Матчи, пропавшие из выдачи с «живой» минутой, помечаем завершёнными
      await this.matchesService.finishStaleLiveMatches();
      this.client.emit('matches.parsed', { count: matches.length });
      await this.stateService.parsingDone(matches.length);
      return matches;

    } catch (err) {
      await this.stateService.fail(
        'parsing',
        `Ошибка парсинга: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await browser.close();
    }
  }


  private async dismissCookieBanner(page: Page) {
    const selectors = [
      'button:has-text("Принять")',
      'button:has-text("Согласен")',
      'button:has-text("ОК")',
      '[class*="cookie"] button',
      '[id*="accept"]',
    ];

    for (const selector of selectors) {
      try {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          this.logger.log(`Cookie banner dismissed: ${selector}`);
          await page.waitForTimeout(500);
          return;
        }
      } catch {
        // ignore
      }
    }
  }

  // @Cron('0 */15 * * * *') // каждые 15 минут
  // async analyzeUnprocessed() {
  //   try {
  //     await this.parseMatches();
  //   } catch (err: any) {
  //     this.logger.error(`Cron parse failed: ${err.message}`);
  //   }
  // }
}