import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Row-level security for native chat tables keyed by transaction-local GUC
 * `app.current_workspace_id` (set via `set_config(..., true)` from Nest).
 *
 * PgBouncer: with **transaction** pooling, ensure the pool reuses connections
 * such that `set_config` and subsequent queries stay on one backend
 * transaction; with **session** pooling, set once per checkout. Statement-only
 * pooling is incompatible unless every statement sets the GUC.
 */
export class CoreChatRowLevelSecurity1775700000000 implements MigrationInterface {
  name = 'CoreChatRowLevelSecurity1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" ALTER COLUMN "emoji" TYPE character varying(128)`,
    );

    const tables = [
      'chatMessage',
      'chatMessageRead',
      'chatRecordLink',
      'chatMessageReaction',
      'chatPinnedMessage',
    ] as const;

    for (const table of tables) {
      const qualified = `"core"."${table}"`;

      await queryRunner.query(
        `ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE ${qualified} FORCE ROW LEVEL SECURITY`,
      );

      await queryRunner.query(`
        CREATE POLICY "${table}_rls_select" ON ${qualified}
        FOR SELECT USING (
          "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        )
      `);

      await queryRunner.query(`
        CREATE POLICY "${table}_rls_insert" ON ${qualified}
        FOR INSERT WITH CHECK (
          "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        )
      `);

      await queryRunner.query(`
        CREATE POLICY "${table}_rls_update" ON ${qualified}
        FOR UPDATE USING (
          "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        )
        WITH CHECK (
          "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        )
      `);

      await queryRunner.query(`
        CREATE POLICY "${table}_rls_delete" ON ${qualified}
        FOR DELETE USING (
          "workspaceId" = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'chatPinnedMessage',
      'chatMessageReaction',
      'chatRecordLink',
      'chatMessageRead',
      'chatMessage',
    ] as const;

    for (const table of tables) {
      const qualified = `"core"."${table}"`;

      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_rls_delete" ON ${qualified}`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_rls_update" ON ${qualified}`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_rls_insert" ON ${qualified}`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_rls_select" ON ${qualified}`,
      );
      await queryRunner.query(
        `ALTER TABLE ${qualified} NO FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE ${qualified} DISABLE ROW LEVEL SECURITY`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "core"."chatMessageReaction" ALTER COLUMN "emoji" TYPE character varying(32)`,
    );
  }
}
