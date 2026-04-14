import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddSendbirdChannelUrls1775400000000 implements MigrationInterface {
  name = 'AddSendbirdChannelUrls1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannel" ADD "sendbirdChannelUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmThread" ADD "sendbirdChannelUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmThread" DROP COLUMN "sendbirdChannelUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannel" DROP COLUMN "sendbirdChannelUrl"`,
    );
  }
}
