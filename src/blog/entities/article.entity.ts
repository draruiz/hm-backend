import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 300, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  excerpt: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'varchar', default: ArticleStatus.DRAFT })
  status: ArticleStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // ── Authorship tracking ───────────────────────────────────────

  /** User ID of the creator */
  @Column({ type: 'uuid' })
  createdBy: string;

  /** User ID of the last modifier */
  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  // ── Timestamps & Soft-delete ──────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
