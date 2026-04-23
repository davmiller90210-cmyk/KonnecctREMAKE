import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddChatMessageCrmMention1775900000000
  implements MigrationInterface
{
  name = 'AddChatMessageCrmMention1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."chatMessageCrmMention" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "messageId" uuid NOT NULL, "objectNameSingular" character varying NOT NULL, "linkedRecordId" uuid NOT NULL, "snapshotPayload" text NOT NULL, "actorUserWorkspaceId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatMessageCrmMention" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_MESSAGE_CRM_MENTION_MESSAGE" ON "core"."chatMessageCrmMention" ("messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_MESSAGE_CRM_MENTION_WORKSPACE_RECORD" ON "core"."chatMessageCrmMention" ("workspaceId", "objectNameSingular", "linkedRecordId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageCrmMention" ADD CONSTRAINT "FK_chatMessageCrmMention_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageCrmMention" ADD CONSTRAINT "FK_chatMessageCrmMention_message" FOREIGN KEY ("messageId") REFERENCES "core"."chatMessage"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    const qualified = `"core"."chatMessageCrmMention"`;
    await queryRunner.query(
      `ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE ${qualified} FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "chatMessageCrmMention_rls_select" ON ${qualified}
      FOR SELECT USING (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
      )
    `);
    await queryRunner.query(`
      CREATE POLICY "chatMessageCrmMention_rls_insert" ON ${qualified}
      FOR INSERT WITH CHECK (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
      )
    `);
    await queryRunner.query(`
      CREATE POLICY "chatMessageCrmMention_rls_update" ON ${qualified}
      FOR UPDATE USING (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
      )
      WITH CHECK (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
      )
    `);
    await queryRunner.query(`
      CREATE POLICY "chatMessageCrmMention_rls_delete" ON ${qualified}
      FOR DELETE USING (
        "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const qualified = `"core"."chatMessageCrmMention"`;
    await queryRunner.query(
      `DROP POLICY IF EXISTS "chatMessageCrmMention_rls_delete" ON ${qualified}`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "chatMessageCrmMention_rls_update" ON ${qualified}`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "chatMessageCrmMention_rls_insert" ON ${qualified}`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "chatMessageCrmMention_rls_select" ON ${qualified}`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageCrmMention" DROP CONSTRAINT "FK_chatMessageCrmMention_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageCrmMention" DROP CONSTRAINT "FK_chatMessageCrmMention_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_MESSAGE_CRM_MENTION_WORKSPACE_RECORD"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_MESSAGE_CRM_MENTION_MESSAGE"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatMessageCrmMention"`);
  }
}
