import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction } from '../common/audit/audit-log.entity.js';
import { AuditService } from '../common/audit/audit.service.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto.js';
import { ContactSubmission } from './entities/contact-submission.entity.js';

export interface RequestMeta {
  ip: string;
  userAgent?: string;
  user?: { id: string; email: string; role: string };
}

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(ContactSubmission)
    private readonly submissionRepo: Repository<ContactSubmission>,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async createSubmission(
    dto: CreateContactSubmissionDto,
    meta: RequestMeta,
  ): Promise<{ id: string; createdAt: Date }> {
    if (!dto.hipaaConsent) {
      throw new BadRequestException(
        'You must consent to the processing of your personal health information.',
      );
    }

    const entity = this.submissionRepo.create({
      name: this.encryption.encrypt(dto.name),
      email: this.encryption.encrypt(dto.email),
      phone: this.encryption.encryptIfPresent(dto.phone),
      preferredDate: this.encryption.encryptIfPresent(dto.preferredDate),
      time: this.encryption.encryptIfPresent(dto.time),
      comment: this.encryption.encryptIfPresent(dto.comment),
      hipaaConsent: true,
      consentedAt: new Date(),
      consentIp: meta.ip,
    });

    const saved = await this.submissionRepo.save(entity);

    await this.audit.log({
      action: AuditAction.PHI_CREATED,
      resource: 'contact_submission',
      resourceId: saved.id,
      userId: 'anonymous',
      userEmail: 'anonymous',
      userRole: 'public',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: saved.id, createdAt: saved.createdAt };
  }

  async findAllSubmissions(meta: RequestMeta): Promise<Record<string, any>[]> {
    await this.audit.log({
      action: AuditAction.PHI_ACCESS_LIST,
      resource: 'contact_submission',
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const submissions = await this.submissionRepo.find({
      order: { createdAt: 'DESC' },
    });

    return submissions.map((s) => this.decryptSubmission(s));
  }

  async findOneSubmission(
    id: string,
    meta: RequestMeta,
  ): Promise<Record<string, any>> {
    const submission = await this.submissionRepo.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    await this.audit.log({
      action: AuditAction.PHI_ACCESS_DETAIL,
      resource: 'contact_submission',
      resourceId: id,
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.decryptSubmission(submission);
  }

  private decryptSubmission(s: ContactSubmission): Record<string, any> {
    return {
      id: s.id,
      name: this.encryption.decrypt(s.name),
      email: this.encryption.decrypt(s.email),
      phone: this.encryption.decryptIfPresent(s.phone),
      preferredDate: this.encryption.decryptIfPresent(s.preferredDate),
      time: this.encryption.decryptIfPresent(s.time),
      comment: this.encryption.decryptIfPresent(s.comment),
      hipaaConsent: s.hipaaConsent,
      consentedAt: s.consentedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
