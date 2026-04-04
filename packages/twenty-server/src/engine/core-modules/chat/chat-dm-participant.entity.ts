import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';

import { ChatDmThreadEntity } from './chat-dm-thread.entity';

@Entity({ name: 'chatDmParticipant', schema: 'core' })
@Unique('IDX_CHAT_DM_PARTICIPANT_UNIQUE', ['threadId', 'userWorkspaceId'])
export class ChatDmParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  threadId: string;

  @ManyToOne(() => ChatDmThreadEntity, (thread) => thread.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'threadId' })
  thread: Relation<ChatDmThreadEntity>;

  @Column({ type: 'uuid' })
  userWorkspaceId: string;

  @ManyToOne(() => UserWorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userWorkspaceId' })
  userWorkspace: Relation<UserWorkspaceEntity>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
