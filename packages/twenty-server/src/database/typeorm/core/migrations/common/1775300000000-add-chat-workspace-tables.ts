import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddChatWorkspaceTables1775300000000 implements MigrationInterface {
  name = 'AddChatWorkspaceTables1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."chatCategory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying NOT NULL, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatCategory" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatCategory" ADD CONSTRAINT "FK_chatCategory_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatChannel" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "categoryId" uuid, "name" character varying NOT NULL, "slug" character varying NOT NULL, "visibility" character varying NOT NULL, "isDefaultGeneral" boolean NOT NULL DEFAULT false, "agoraGroupId" character varying, "position" integer NOT NULL DEFAULT '0', "createdByUserId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatChannel" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_CHAT_CHANNEL_WORKSPACE_SLUG" ON "core"."chatChannel" ("workspaceId", "slug")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannel" ADD CONSTRAINT "FK_chatChannel_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannel" ADD CONSTRAINT "FK_chatChannel_category" FOREIGN KEY ("categoryId") REFERENCES "core"."chatCategory"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatChannelMember" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channelId" uuid NOT NULL, "userWorkspaceId" uuid NOT NULL, "canRead" boolean NOT NULL DEFAULT true, "canPost" boolean NOT NULL DEFAULT true, "canManage" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatChannelMember" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannelMember" ADD CONSTRAINT "IDX_CHAT_CHANNEL_MEMBER_UNIQUE" UNIQUE ("channelId", "userWorkspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CHAT_CHANNEL_MEMBER_USER_WORKSPACE" ON "core"."chatChannelMember" ("userWorkspaceId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannelMember" ADD CONSTRAINT "FK_chatChannelMember_channel" FOREIGN KEY ("channelId") REFERENCES "core"."chatChannel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannelMember" ADD CONSTRAINT "FK_chatChannelMember_userWorkspace" FOREIGN KEY ("userWorkspaceId") REFERENCES "core"."userWorkspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatDmThread" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "kind" character varying NOT NULL, "directPairKey" character varying, "title" character varying, "agoraGroupId" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatDmThread" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmThread" ADD CONSTRAINT "FK_chatDmThread_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."chatDmParticipant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "threadId" uuid NOT NULL, "userWorkspaceId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_chatDmParticipant" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmParticipant" ADD CONSTRAINT "IDX_CHAT_DM_PARTICIPANT_UNIQUE" UNIQUE ("threadId", "userWorkspaceId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmParticipant" ADD CONSTRAINT "FK_chatDmParticipant_thread" FOREIGN KEY ("threadId") REFERENCES "core"."chatDmThread"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmParticipant" ADD CONSTRAINT "FK_chatDmParticipant_userWorkspace" FOREIGN KEY ("userWorkspaceId") REFERENCES "core"."userWorkspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_CHAT_DM_THREAD_WORKSPACE_DIRECT_PAIR" ON "core"."chatDmThread" ("workspaceId", "directPairKey") WHERE "directPairKey" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_DM_THREAD_WORKSPACE_DIRECT_PAIR"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmParticipant" DROP CONSTRAINT "FK_chatDmParticipant_userWorkspace"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmParticipant" DROP CONSTRAINT "FK_chatDmParticipant_thread"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatDmParticipant" DROP CONSTRAINT "IDX_CHAT_DM_PARTICIPANT_UNIQUE"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatDmParticipant"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatDmThread" DROP CONSTRAINT "FK_chatDmThread_workspace"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatDmThread"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatChannelMember" DROP CONSTRAINT "FK_chatChannelMember_userWorkspace"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannelMember" DROP CONSTRAINT "FK_chatChannelMember_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_CHANNEL_MEMBER_USER_WORKSPACE"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannelMember" DROP CONSTRAINT "IDX_CHAT_CHANNEL_MEMBER_UNIQUE"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatChannelMember"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatChannel" DROP CONSTRAINT "FK_chatChannel_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."chatChannel" DROP CONSTRAINT "FK_chatChannel_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_CHAT_CHANNEL_WORKSPACE_SLUG"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatChannel"`);

    await queryRunner.query(
      `ALTER TABLE "core"."chatCategory" DROP CONSTRAINT "FK_chatCategory_workspace"`,
    );
    await queryRunner.query(`DROP TABLE "core"."chatCategory"`);
  }
}
