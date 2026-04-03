import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { AuditAction } from '../common/audit/audit-log.entity.js';
import { AuditService } from '../common/audit/audit.service.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { RegisterUserDto } from './dto/register-user.dto.js';
import { User, UserStatus } from './entities/user.entity.js';

export interface RequestMeta {
  ip: string;
  userAgent?: string;
  user?: { id: string; email: string; role: string };
}

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class UsersService {
  private readonly hmacKey: Buffer;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    const hex = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    this.hmacKey = Buffer.from(hex, 'hex');
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /** Deterministic HMAC-SHA256 of a normalised email for DB lookups. */
  hashEmail(email: string): string {
    const normalised = email.trim().toLowerCase();
    return createHmac('sha256', this.hmacKey).update(normalised).digest('hex');
  }

  // ── Registration ────────────────────────────────────────────────

  async register(
    dto: RegisterUserDto,
    meta: RequestMeta,
  ): Promise<{ id: string; createdAt: Date }> {
    if (!dto.hipaaConsent) {
      throw new BadRequestException(
        'You must consent to the processing of your personal health information.',
      );
    }

    const emailHash = this.hashEmail(dto.email);

    const existing = await this.userRepo.findOne({ where: { emailHash } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      emailHash,
      email: this.encryption.encrypt(dto.email.trim().toLowerCase()),
      password: hashedPassword,
      firstName: this.encryption.encrypt(dto.firstName),
      lastName: this.encryption.encrypt(dto.lastName),
      phone: this.encryption.encryptIfPresent(dto.phone),
      dateOfBirth: this.encryption.encryptIfPresent(dto.dateOfBirth),
      hipaaConsent: true,
      consentedAt: new Date(),
      consentIp: meta.ip,
      tosVersion: dto.tosVersion ?? null,
    });

    const saved = await this.userRepo.save(user);

    await this.audit.log({
      action: AuditAction.USER_REGISTERED,
      resource: 'user',
      resourceId: saved.id,
      userId: saved.id,
      userEmail: dto.email,
      userRole: saved.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: saved.id, createdAt: saved.createdAt };
  }

  // ── Credential validation (used by login flow) ─────────────────

  async validateCredentials(
    email: string,
    plainPassword: string,
    meta: RequestMeta,
  ): Promise<User> {
    const emailHash = this.hashEmail(email);

    // Explicitly load the password field (excluded from default SELECTs)
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.emailHash = :emailHash', { emailHash })
      .getOne();

    if (!user) {
      // Constant-time: still hash to avoid timing attacks
      await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check account lockout
    if (user.status === UserStatus.LOCKED && user.lockedUntil) {
      if (user.lockedUntil > new Date()) {
        throw new ForbiddenException(
          'Account is temporarily locked due to too many failed login attempts. Please try again later.',
        );
      }
      // Lockout expired – reset
      user.status = UserStatus.ACTIVE;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException(
        'This account has been disabled. Please contact support.',
      );
    }

    const passwordValid = await bcrypt.compare(plainPassword, user.password);

    if (!passwordValid) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.status = UserStatus.LOCKED;
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);

        await this.audit.log({
          action: AuditAction.USER_LOCKED,
          resource: 'user',
          resourceId: user.id,
          userId: user.id,
          userEmail: email,
          userRole: user.role,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }

      await this.userRepo.save(user);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Successful login – reset counters
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    return user;
  }

  // ── Lookups ─────────────────────────────────────────────────────

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  /** Returns a safe, decrypted profile representation. */
  decryptProfile(user: User): Record<string, unknown> {
    return {
      id: user.id,
      email: this.encryption.decrypt(user.email),
      firstName: this.encryption.decrypt(user.firstName),
      lastName: this.encryption.decrypt(user.lastName),
      phone: this.encryption.decryptIfPresent(user.phone),
      dateOfBirth: this.encryption.decryptIfPresent(user.dateOfBirth),
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
