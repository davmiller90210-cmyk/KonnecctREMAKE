import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMattermostUserCredential1775400000000
  implements MigrationInterface
{
  name = 'AddMattermostUserCredential1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."mattermostUserCredential" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "mattermostUserId" character varying(64) NOT NULL, "encryptedToken" text NOT NULL, "tokenDescription" character varying(128) NOT NULL DEFAULT 'Konnecct CRM', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_mattermostUserCredential" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_MATTERMOST_CREDENTIAL_USER" ON "core"."mattermostUserCredential" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."mattermostUserCredential" ADD CONSTRAINT "FK_mattermostUserCredential_user" FOREIGN KEY ("userId") REFERENCES "core"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."mattermostUserCredential" DROP CONSTRAINT "FK_mattermostUserCredential_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_MATTERMOST_CREDENTIAL_USER"`,
    );
    await queryRunner.query(`DROP TABLE "core"."mattermostUserCredential"`);
  }
}
