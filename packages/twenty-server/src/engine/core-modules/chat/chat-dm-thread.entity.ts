import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { ChatDmParticipantEntity } from './chat-dm-participant.entity';

export type ChatDmKind = 'direct' | 'group';

@Entity({ name: 'chatDmThread', schema: 'core' })
export class ChatDmThreadEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  kind: ChatDmKind;

  @Column({ type: 'varchar', nullable: true })
  directPairKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  agoraGroupId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ChatDmParticipantEntity, (participant) => participant.thread)
  participants: Relation<ChatDmParticipantEntity[]>;
}
