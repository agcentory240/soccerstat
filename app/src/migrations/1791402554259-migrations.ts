import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class Migrations1791402554259 implements MigrationInterface {

  name = 'AddAiScoreToMatches1728000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Добавляем aiScore
    await queryRunner.addColumn(
      'matches',
      new TableColumn({
        name: 'aiScore',
        type: 'smallint',
        isNullable: true,
        comment: 'Оценка матча от ИИ для отбора (0-10)',
      }),
    );

    // 2. Добавляем aiReason
    await queryRunner.addColumn(
      'matches',
      new TableColumn({
        name: 'aiReason',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Причина оценки от ИИ',
      }),
    );

    // 3. Добавляем aiMarket
    await queryRunner.addColumn(
      'matches',
      new TableColumn({
        name: 'aiMarket',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Рекомендуемый рынок от ИИ',
      }),
    );

    // 4. Индекс для быстрой сортировки по score
    await queryRunner.createIndex(
      'matches',
      new TableIndex({
        name: 'IDX_matches_aiScore',
        columnNames: ['aiScore'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('matches', 'IDX_matches_aiScore');
    await queryRunner.dropColumn('matches', 'aiMarket');
    await queryRunner.dropColumn('matches', 'aiReason');
    await queryRunner.dropColumn('matches', 'aiScore');
  }
}
