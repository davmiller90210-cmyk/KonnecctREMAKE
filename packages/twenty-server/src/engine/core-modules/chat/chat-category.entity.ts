import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { ChatChannelEntity } from './chat-channel.entity';

@Entity({ name: 'chatCategory', schema: 'core' })
export class ChatCategoryEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ChatChannelEntity, (channel) => channel.category)
  channels: Relation<ChatChannelEntity[]>;
}
