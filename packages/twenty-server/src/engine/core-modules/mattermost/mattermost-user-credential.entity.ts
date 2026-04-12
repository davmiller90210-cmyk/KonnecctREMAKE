import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from 'src/engine/core-modules/user/user.entity';

@Entity({ name: 'mattermostUserCredential', schema: 'core' })
@Index('IDX_MATTERMOST_CREDENTIAL_USER', ['userId'], { unique: true })
export class MattermostUserCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<UserEntity>;

  /** Mattermost user id from /api/v4/users/email/{email} */
  @Column({ type: 'varchar', length: 64 })
  mattermostUserId: string;

  /** AES payload via SecretEncryptionService (personal access token). */
  @Column({ type: 'text' })
  encryptedToken: string;

  @Column({ type: 'varchar', length: 128, default: 'Konnecct CRM' })
  tokenDescription: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
