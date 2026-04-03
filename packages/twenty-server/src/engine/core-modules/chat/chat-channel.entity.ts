import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { ChatCategoryEntity } from './chat-category.entity';
import { ChatChannelMemberEntity } from './chat-channel-member.entity';

export type ChatChannelVisibility = 'public' | 'private';

@Entity({ name: 'chatChannel', schema: 'core' })
@Index('IDX_CHAT_CHANNEL_WORKSPACE_SLUG', ['workspaceId', 'slug'], {
  unique: true,
})
export class ChatChannelEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ChatCategoryEntity, (category) => category.channels, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Relation<ChatCategoryEntity>;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ type: 'varchar' })
  visibility: ChatChannelVisibility;

  @Column({ default: false })
  isDefaultGeneral: boolean;

  @Column({ type: 'varchar', nullable: true })
  agoraGroupId: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ChatChannelMemberEntity, (member) => member.channel)
  members: Relation<ChatChannelMemberEntity[]>;
}
