import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddNativeChatMessageTables1775500000000
  implements MigrationInterface
{
  name = 'AddNativeChatMessageTables1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."chatMessage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "conversationKind" character varying NOT NULL, "conversationId" uuid NOT NULL, "senderUserWorkspaceId" uuid, "kind" character varying NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatMessage" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_MESSAGE_WORKSPACE_CONVERSATION_CREATED_AT" ON "core"."chatMessage" ("workspaceId", "conversationKind", "conversationId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessage" ADD CONSTRAINT "FK_chatMessage_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatMessageRead" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "conversationKind" character varying NOT NULL, "conversationId" uuid NOT NULL, "userWorkspaceId" uuid NOT NULL, "lastReadAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatMessageRead" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageRead" ADD CONSTRAINT "IDX_CHAT_MESSAGE_READ_UNIQUE" UNIQUE ("conversationKind", "conversationId", "userWorkspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_MESSAGE_READ_USER_WORKSPACE" ON "core"."chatMessageRead" ("userWorkspaceId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageRead" ADD CONSTRAINT "FK_chatMessageRead_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatRecordLink" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "conversationKind" character varying NOT NULL, "conversationId" uuid NOT NULL, "linkedObjectNameSingular" character varying NOT NULL, "linkedRecordId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatRecordLink" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_RECORD_LINK_WORKSPACE_RECORD" ON "core"."chatRecordLink" ("workspaceId", "linkedObjectNameSingular", "linkedRecordId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_RECORD_LINK_WORKSPACE_CONVERSATION" ON "core"."chatRecordLink" ("workspaceId", "conversationKind", "conversationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatRecordLink" ADD CONSTRAINT "FK_chatRecordLink_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatRecordLink" DROP CONSTRAINT "FK_chatRecordLink_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_RECORD_LINK_WORKSPACE_CONVERSATION"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_RECORD_LINK_WORKSPACE_RECORD"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatRecordLink"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageRead" DROP CONSTRAINT "FK_chatMessageRead_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_MESSAGE_READ_USER_WORKSPACE"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageRead" DROP CONSTRAINT "IDX_CHAT_MESSAGE_READ_UNIQUE"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatMessageRead"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatMessage" DROP CONSTRAINT "FK_chatMessage_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_MESSAGE_WORKSPACE_CONVERSATION_CREATED_AT"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatMessage"`);
  }
}
