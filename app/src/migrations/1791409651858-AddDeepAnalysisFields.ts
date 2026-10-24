import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddDeepAnalysisFields1791409651858 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('matches');

    // 1. deepAnalyzed — флаг прохождения глубокого анализа
    if (!table?.findColumnByName('deepAnalyzed')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'deepAnalyzed',
          type: 'boolean',
          default: false,
          comment: 'Прошёл ли матч глубокий анализ (DeepSeek Pro)',
        }),
      );
    }

    // 2. finalDecision — финальный вердикт
    if (!table?.findColumnByName('finalDecision')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'finalDecision',
          type: 'varchar',
          length: '20',
          isNullable: true,
          comment: 'Финальное решение: СТАВИТЬ | ПРОПУСТИТЬ | НАБЛЮДАТЬ',
        }),
      );
    }

    // 3. mainBet — основная ставка
    if (!table?.findColumnByName('mainBet')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'mainBet',
          type: 'varchar',
          length: '50',
          isNullable: true,
          comment: 'Основная рекомендация (например, ТМ 2.5)',
        }),
      );
    }

    // 4. betCoefficient — коэффициент основной ставки
    if (!table?.findColumnByName('betCoefficient')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'betCoefficient',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
          comment: 'Коэффициент основной ставки',
        }),
      );
    }

    // 5. confidence — уверенность 0-1
    if (!table?.findColumnByName('confidence')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'confidence',
          type: 'decimal',
          precision: 5,
          scale: 4,
          isNullable: true,
          comment: 'Уверенность модели (0.0000-1.0000)',
        }),
      );
    }

    // 6. expectedValue — ожидаемая ценность
    if (!table?.findColumnByName('expectedValue')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'expectedValue',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
          comment: 'Expected Value в %',
        }),
      );
    }

    // 7. stakeRecommendation — рекомендация по размеру ставки
    if (!table?.findColumnByName('stakeRecommendation')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'stakeRecommendation',
          type: 'varchar',
          length: '50',
          isNullable: true,
          comment: 'Рекомендация по размеру ставки',
        }),
      );
    }

    // 8. deepReasoning — текстовое обоснование
    if (!table?.findColumnByName('deepReasoning')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'deepReasoning',
          type: 'text',
          isNullable: true,
          comment: 'Обоснование от DeepSeek Pro',
        }),
      );
    }

    // 9. summary — краткое резюме
    if (!table?.findColumnByName('summary')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'summary',
          type: 'text',
          isNullable: true,
          comment: 'Краткое резюме анализа',
        }),
      );
    }

    // 10. deepAnalysis — полный JSON-ответ
    if (!table?.findColumnByName('deepAnalysis')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'deepAnalysis',
          type: 'jsonb',
          isNullable: true,
          comment: 'Полный JSON-ответ от DeepSeek Pro',
        }),
      );
    }

    // 11. deepAnalyzedAt — время анализа
    if (!table?.findColumnByName('deepAnalyzedAt')) {
      await queryRunner.addColumn(
        'matches',
        new TableColumn({
          name: 'deepAnalyzedAt',
          type: 'timestamp',
          isNullable: true,
          comment: 'Когда был проведён глубокий анализ',
        }),
      );
    }

    // ===== ИНДЕКСЫ =====

    // Индекс по deepAnalyzed (для быстрого поиска необработанных)
    if (!table?.indices.some((i) => i.name === 'IDX_matches_deepAnalyzed')) {
      await queryRunner.createIndex(
        'matches',
        new TableIndex({
          name: 'IDX_matches_deepAnalyzed',
          columnNames: ['deepAnalyzed'],
        }),
      );
    }

    // Индекс по finalDecision (для фильтрации)
    if (!table?.indices.some((i) => i.name === 'IDX_matches_finalDecision')) {
      await queryRunner.createIndex(
        'matches',
        new TableIndex({
          name: 'IDX_matches_finalDecision',
          columnNames: ['finalDecision'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('matches', 'IDX_matches_finalDecision');
    await queryRunner.dropIndex('matches', 'IDX_matches_deepAnalyzed');

    const columns = [
      'deepAnalyzedAt',
      'deepAnalysis',
      'summary',
      'deepReasoning',
      'stakeRecommendation',
      'expectedValue',
      'confidence',
      'betCoefficient',
      'mainBet',
      'finalDecision',
      'deepAnalyzed',
    ];

    for (const col of columns) {
      await queryRunner.dropColumn('matches', col);
    }
  }

}
