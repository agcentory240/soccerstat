import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Добавляет явный статус матча и время последнего появления в выдаче парсера.
 *
 * До этой миграции завершённость матча определялась косвенно
 * (`score IS NOT NULL AND liveTime IS NULL`), что давало ложные результаты
 * для матчей, «залипших» в статусе live (минута не сбрасывалась, если матч
 * исчезал из выдачи сразу после финального свистка).
 *
 * Миграция также выполняет бэкфилл статуса для уже сохранённых матчей:
 * - live-матч, начавшийся более 3 часов назад, считается завершённым,
 *   а залипшая live-минута очищается;
 * - остальные матчи с `liveTime` — `live`;
 * - матчи со счётом, но без `liveTime` — `finished`;
 * - матчи без счёта — `scheduled`.
 */
export class AddMatchStatus1791500000000 implements MigrationInterface {

  name = 'AddMatchStatus1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('matches');

    // 1. status — явный статус матча
    if (!table?.findColumnByName('status')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'status',
          type: 'varchar',
          length: '16',
          isNullable: false,
          default: "'scheduled'",
          comment: 'Статус матча: scheduled | live | finished',
        }),
      );
    }

    // 2. lastParsedAt — когда матч последний раз встречался в выдаче
    if (!table?.findColumnByName('lastParsedAt')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'lastParsedAt',
          type: 'timestamp',
          isNullable: true,
          comment: 'Когда матч последний раз встречался в выдаче парсера',
        }),
      );
    }

    // 3. Индекс по статусу (для быстрой фильтрации)
    if (!table?.indices.some((i) => i.name === 'IDX_matches_status')) {
      await queryRunner.createIndex(
        'matches',
        new TableIndex({
          name: 'IDX_matches_status',
          columnNames: ['status'],
        }),
      );
    }

    // 4. Бэкфилл статуса по косвенным признакам.
    //    Начавшийся более 3 часов назад live-матч считаем завершённым —
    //    футбольный матч с перерывом и добавленным временем столько не идёт.
    await queryRunner.query(`
      UPDATE "matches"
      SET
        "liveTime" = CASE
          WHEN "liveTime" IS NOT NULL
            AND "score" IS NOT NULL
            AND "dateTime" + INTERVAL '3 hours' < NOW()
          THEN NULL
          ELSE "liveTime"
        END,
        "status" = CASE
          WHEN "liveTime" IS NOT NULL
            AND "score" IS NOT NULL
            AND "dateTime" + INTERVAL '3 hours' < NOW()
          THEN 'finished'
          WHEN "liveTime" IS NOT NULL THEN 'live'
          WHEN "score" IS NOT NULL THEN 'finished'
          ELSE 'scheduled'
        END,
        "lastParsedAt" = COALESCE("lastParsedAt", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('matches', 'IDX_matches_status');
    await queryRunner.dropColumn('matches', 'lastParsedAt');
    await queryRunner.dropColumn('matches', 'status');
  }
}
