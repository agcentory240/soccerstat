import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789000000000 implements MigrationInterface {
    name = 'InitialSchema1789000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "matches" ("id" SERIAL NOT NULL, "country" character varying NOT NULL, "league" character varying NOT NULL, "url" character varying NOT NULL, "dateTime" TIMESTAMP NOT NULL, "homeTeam" character varying NOT NULL, "awayTeam" character varying NOT NULL, "score" character varying, "liveTime" character varying, "marked" boolean NOT NULL DEFAULT false, "ready" boolean NOT NULL DEFAULT false, "selected" boolean NOT NULL DEFAULT false, "info" character varying, "reason" character varying, "oddsHome" numeric(10,2), "oddsDraw" numeric(10,2), "oddsAway" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_80947812910fe1cebde9620673" ON "matches"  ("url") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_80947812910fe1cebde9620673"`);
        await queryRunner.query(`DROP TABLE "matches"`);
    }

}
