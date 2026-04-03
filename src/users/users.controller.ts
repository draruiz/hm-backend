import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuditAction } from '../common/audit/audit-log.entity.js';
import { AuditService } from '../common/audit/audit.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LoginUserDto } from './dto/login-user.dto.js';
import { RegisterUserDto } from './dto/register-user.dto.js';
import type { RequestMeta } from './users.service.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  // ── Public: Register ──────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterUserDto, @Req() req: Request) {
    const meta: RequestMeta = {
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
    };

    const result = await this.usersService.register(dto, meta);

    return {
      message: 'Account created successfully.',
      id: result.id,
      createdAt: result.createdAt,
    };
  }

  // ── Public: Login ─────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginUserDto, @Req() req: Request) {
    const meta: RequestMeta = {
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
    };

    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
      meta,
    );

    const payload = { sub: user.id, email: dto.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    await this.audit.log({
      action: AuditAction.USER_LOGIN,
      resource: 'user',
      resourceId: user.id,
      userId: user.id,
      userEmail: dto.email,
      userRole: user.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { accessToken };
  }

  // ── Authenticated: Profile ────────────────────────────────────

  @Get('me')
  async getProfile(@Req() req: Request) {
    const authUser = req.user as { id: string; email: string; role: string };
    const user = await this.usersService.findById(authUser.id);

    await this.audit.log({
      action: AuditAction.PHI_ACCESS_DETAIL,
      resource: 'user',
      resourceId: user.id,
      userId: authUser.id,
      userEmail: authUser.email,
      userRole: authUser.role,
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
    });

    return this.usersService.decryptProfile(user);
  }
}
