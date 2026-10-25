import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Переводит `matches.betStatus` в nullable без значения по умолчанию.
 *
 * Семантика поля:
 * - `true`  — ставка сыграла;
 * - `false` — ставка не сыграла;
 * - `NULL`  — проверка ставки ещё не выполнялась.
 *
 * Ранее колонка создавалась с `DEFAULT false`, поэтому `false` нельзя было
 * отличить от «не проверяли». Существующие значения не отражают реальный
 * факт проверки, поэтому все они сбрасываются в `NULL`.
 */
export class MakeBetStatusNullable1792948860000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(
            'matches',
            'betStatus',
            new TableColumn({
                name: 'betStatus',
                type: 'boolean',
                isNullable: true,
                comment: 'Сыграла ставка или нет (NULL — проверка не выполнялась)',
            }),
        );

        // Сброс ранее записанных значений: FALSE не означает «ставка проиграла».
        await queryRunner.query('UPDATE "matches" SET "betStatus" = NULL');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Возвращаем NOT NULL, поэтому NULL нужно предварительно заменить.
        await queryRunner.query(
            'UPDATE "matches" SET "betStatus" = false WHERE "betStatus" IS NULL',
        );

        await queryRunner.changeColumn(
            'matches',
            'betStatus',
            new TableColumn({
                name: 'betStatus',
                type: 'boolean',
                isNullable: false,
                default: false,
                comment: 'Сыграла ставка или нет',
            }),
        );
    }

}
