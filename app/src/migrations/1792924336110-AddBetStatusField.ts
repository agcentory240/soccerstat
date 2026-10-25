import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddBetStatusField1792924336110 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('matches');

        if (!table?.findColumnByName('betStatus')) {
            await queryRunner.addColumn(
                'matches',
                new TableColumn({
                name: 'betStatus',
                type: 'boolean',
                default: false,
                comment: 'Сыграла ставка или нет',
                }),
            );
        }

        if (!table?.findColumnByName('matchArchive')) {
            await queryRunner.addColumn(
                'matches',
                new TableColumn({
                name: 'matchArchive',
                type: 'boolean',
                default: false,
                comment: 'Матч проанализирован и проверен',
                }),
            );
        }        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('matches', 'betStatus');
        await queryRunner.dropColumn('matches', 'matchArchive');
    }

}
