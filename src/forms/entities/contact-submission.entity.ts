import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('contact_submissions')
export class ContactSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** AES-256-GCM encrypted name */
  @Column('text')
  name: string;

  /** AES-256-GCM encrypted email */
  @Column('text')
  email: string;

  /** AES-256-GCM encrypted phone (nullable) */
  @Column('text', { nullable: true })
  phone: string | null;

  /** AES-256-GCM encrypted preferred date (nullable) */
  @Column('text', { nullable: true })
  preferredDate: string | null;

  /** AES-256-GCM encrypted time (nullable) */
  @Column('text', { nullable: true })
  time: string | null;

  /** AES-256-GCM encrypted comment (nullable) */
  @Column('text', { nullable: true })
  comment: string | null;

  /** HIPAA: user explicitly consented to data collection */
  @Column('boolean')
  hipaaConsent: boolean;

  /** Timestamp when the user gave consent */
  @Column('timestamptz')
  consentedAt: Date;

  /** IP address from which consent was given */
  @Column()
  consentIp: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
