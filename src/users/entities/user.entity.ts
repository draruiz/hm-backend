import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  DISABLED = 'disabled',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Authentication ─────────────────────────────────────────────

  /**
   * HMAC-SHA256 of the normalized (lowercased, trimmed) email.
   * Used for unique-constraint lookups without exposing plaintext.
   */
  @Column({ unique: true })
  @Index()
  emailHash: string;

  /** AES-256-GCM encrypted email – decrypted only when needed */
  @Column('text')
  email: string;

  /** bcrypt-hashed password – excluded from default SELECTs for defense-in-depth */
  @Column({ type: 'text', select: false })
  password: string;

  // ── Encrypted PII (HIPAA PHI / PII) ───────────────────────────

  /** AES-256-GCM encrypted first name */
  @Column('text')
  firstName: string;

  /** AES-256-GCM encrypted last name */
  @Column('text')
  lastName: string;

  /** AES-256-GCM encrypted phone (optional) */
  @Column('text', { nullable: true })
  phone: string | null;

  /** AES-256-GCM encrypted date of birth (optional, ISO-8601) */
  @Column('text', { nullable: true })
  dateOfBirth: string | null;

  // ── Role & Status ─────────────────────────────────────────────

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', default: UserStatus.ACTIVE })
  status: UserStatus;

  // ── Brute-force / Account-lockout ─────────────────────────────

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  // ── Password policy ───────────────────────────────────────────

  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  // ── HIPAA Consent ─────────────────────────────────────────────

  @Column('boolean')
  hipaaConsent: boolean;

  @Column('timestamptz')
  consentedAt: Date;

  @Column()
  consentIp: string;

  @Column({ type: 'varchar', nullable: true })
  tosVersion: string | null;

  // ── Timestamps & Soft-delete ──────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
