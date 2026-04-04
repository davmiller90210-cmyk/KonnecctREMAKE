import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';

import { ChatChannelEntity } from './chat-channel.entity';

@Entity({ name: 'chatChannelMember', schema: 'core' })
@Unique('IDX_CHAT_CHANNEL_MEMBER_UNIQUE', ['channelId', 'userWorkspaceId'])
@Index('IDX_CHAT_CHANNEL_MEMBER_USER_WORKSPACE', ['userWorkspaceId'])
export class ChatChannelMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => ChatChannelEntity, (channel) => channel.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'channelId' })
  channel: Relation<ChatChannelEntity>;

  @Column({ type: 'uuid' })
  userWorkspaceId: string;

  @ManyToOne(() => UserWorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userWorkspaceId' })
  userWorkspace: Relation<UserWorkspaceEntity>;

  @Column({ default: true })
  canRead: boolean;

  @Column({ default: true })
  canPost: boolean;

  @Column({ default: false })
  canManage: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
