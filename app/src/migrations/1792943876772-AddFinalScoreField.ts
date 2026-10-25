import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddFinalScoreField1792943876772 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('matches');

        if (!table?.findColumnByName('finalScore')) {
            await queryRunner.addColumn(
                'matches',
                new TableColumn({
                name: 'finalScore',
                type: 'varchar',
                length: '20',
                isNullable: true,
                comment: 'Финальный счет матча',
                }),
            );
        }        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('matches', 'finalScore');
    }

}
