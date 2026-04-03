import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  PHI_ACCESS_LIST = 'PHI_ACCESS_LIST',
  PHI_ACCESS_DETAIL = 'PHI_ACCESS_DETAIL',
  PHI_CREATED = 'PHI_CREATED',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOCKED = 'USER_LOCKED',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: AuditAction;

  @Column()
  resource: string;

  @Column({ nullable: true })
  resourceId: string | null;

  @Column()
  userId: string;

  @Column()
  userEmail: string;

  @Column()
  userRole: string;

  @Column()
  ip: string;

  @Column({ nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
