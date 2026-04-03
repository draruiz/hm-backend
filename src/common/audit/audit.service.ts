import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity.js';

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  userId: string;
  userEmail: string;
  userRole: string;
  ip: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    const record = this.auditRepo.create({
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      userId: entry.userId,
      userEmail: entry.userEmail,
      userRole: entry.userRole,
      ip: entry.ip,
      userAgent: entry.userAgent ?? null,
    });
    await this.auditRepo.save(record);
  }
}
