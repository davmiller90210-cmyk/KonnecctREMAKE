import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'chatMessageReaction', schema: 'core' })
@Unique('IDX_CHAT_MSG_REACTION_UNIQUE', [
  'workspaceId',
  'messageId',
  'userWorkspaceId',
  'emoji',
])
@Index('IDX_CHAT_MSG_REACTION_MESSAGE', ['messageId'])
export class ChatMessageReactionEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @Column({ type: 'varchar', length: 128 })
  emoji: string;

  @Column({ type: 'uuid' })
  userWorkspaceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
