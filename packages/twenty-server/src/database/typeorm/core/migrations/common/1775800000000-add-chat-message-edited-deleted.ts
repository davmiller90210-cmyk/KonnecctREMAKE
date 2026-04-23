import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddChatMessageEditedDeleted1775800000000
  implements MigrationInterface
{
  name = 'AddChatMessageEditedDeleted1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessage" ADD "editedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessage" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessage" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessage" DROP COLUMN "editedAt"`,
    );
  }
}
