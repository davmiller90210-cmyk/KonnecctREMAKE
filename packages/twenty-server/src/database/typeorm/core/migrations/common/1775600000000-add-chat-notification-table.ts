import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddChatNotificationTable1775600000000
  implements MigrationInterface
{
  name = 'AddChatNotificationTable1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."chatNotification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "recipientUserWorkspaceId" uuid NOT NULL, "actorUserWorkspaceId" uuid, "kind" character varying NOT NULL, "conversationKind" character varying NOT NULL, "conversationId" uuid NOT NULL, "messageId" uuid NOT NULL, "bodyPreview" character varying(512) NOT NULL, "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatNotification" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_NOTIFICATION_RECIPIENT_CREATED" ON "core"."chatNotification" ("workspaceId", "recipientUserWorkspaceId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatNotification" ADD CONSTRAINT "FK_chatNotification_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatNotification" DROP CONSTRAINT "FK_chatNotification_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_NOTIFICATION_RECIPIENT_CREATED"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatNotification"`);
  }
}
