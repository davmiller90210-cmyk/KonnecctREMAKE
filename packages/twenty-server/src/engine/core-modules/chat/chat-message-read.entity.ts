import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { type ChatMessageConversationKind } from './chat-message.entity';

@Entity({ name: 'chatMessageRead', schema: 'core' })
@Unique('IDX_CHAT_MESSAGE_READ_UNIQUE', [
  'conversationKind',
  'conversationId',
  'userWorkspaceId',
])
@Index('IDX_CHAT_MESSAGE_READ_USER_WORKSPACE', ['userWorkspaceId'])
export class ChatMessageReadEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  conversationKind: ChatMessageConversationKind;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  userWorkspaceId: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
