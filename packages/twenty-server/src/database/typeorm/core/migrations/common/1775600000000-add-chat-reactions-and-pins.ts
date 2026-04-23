import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddChatReactionsAndPins1775600000000 implements MigrationInterface {
  name = 'AddChatReactionsAndPins1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."chatMessageReaction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "messageId" uuid NOT NULL, "emoji" character varying(32) NOT NULL, "userWorkspaceId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatMessageReaction" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" ADD CONSTRAINT "IDX_CHAT_MSG_REACTION_UNIQUE" UNIQUE ("workspaceId", "messageId", "userWorkspaceId", "emoji")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_MSG_REACTION_MESSAGE" ON "core"."chatMessageReaction" ("messageId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" ADD CONSTRAINT "FK_chatMessageReaction_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" ADD CONSTRAINT "FK_chatMessageReaction_message" FOREIGN KEY ("messageId") REFERENCES "core"."chatMessage"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatPinnedMessage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "conversationKind" character varying NOT NULL, "conversationId" uuid NOT NULL, "messageId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatPinnedMessage" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatPinnedMessage" ADD CONSTRAINT "IDX_CHAT_PIN_CONV_MSG" UNIQUE ("workspaceId", "conversationKind", "conversationId", "messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_PIN_CONVERSATION" ON "core"."chatPinnedMessage" ("workspaceId", "conversationKind", "conversationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatPinnedMessage" ADD CONSTRAINT "FK_chatPinnedMessage_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatPinnedMessage" ADD CONSTRAINT "FK_chatPinnedMessage_message" FOREIGN KEY ("messageId") REFERENCES "core"."chatMessage"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatPinnedMessage" DROP CONSTRAINT "FK_chatPinnedMessage_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatPinnedMessage" DROP CONSTRAINT "FK_chatPinnedMessage_workspace"`,
    );
    await queryRunner.query(`DROP INDEX "core"."IDX_CHAT_PIN_CONVERSATION"`);
    await queryRunner.query(
      `ALTER TABLE "core"."chatPinnedMessage" DROP CONSTRAINT "IDX_CHAT_PIN_CONV_MSG"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatPinnedMessage"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" DROP CONSTRAINT "FK_chatMessageReaction_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" DROP CONSTRAINT "FK_chatMessageReaction_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_MSG_REACTION_MESSAGE"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" DROP CONSTRAINT "IDX_CHAT_MSG_REACTION_UNIQUE"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatMessageReaction"`);
  }
}
