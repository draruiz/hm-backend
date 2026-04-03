# NestJS REST API — Copilot Instructions

> **Stack:** Node.js · NestJS · TypeScript · (Prisma / TypeORM) · class-validator · Passport.js · JWT
> **Last updated:** April 2026

---

## 1. General Philosophy

- **Clean Architecture first.** Always separate: transport (HTTP) → business logic → data access. Controllers never touch the database directly.
- **Domain-Driven Modules.** Each module encapsulates a complete business domain (do not group by file type).
- **Fail fast.** Validate at the system boundary (DTOs + global Pipes) before the request reaches a service.
- **Secrets out of code.** All sensitive configuration lives in environment variables validated with `@nestjs/config` + Joi/Zod at startup.
- **HIPAA first.** This is a healthcare application. Every entity, module, and feature **must** be designed with HIPAA compliance in mind from day one. See Section 15 for full HIPAA requirements.

---

## 2. Folder Structure

```
src/
├── core/                        # Cross-cutting infrastructure
│   ├── auth/                    # JWT strategy, guards, @Public decorators
│   ├── database/                # DB module, migrations, health check
│   ├── logger/                  # Logger wrapper (Pino / Winston)
│   └── config/                  # ConfigModule + env validation schema
│
├── common/                      # Utilities with no business dependencies
│   ├── decorators/              # @CurrentUser, @Roles, etc.
│   ├── filters/                 # GlobalHttpExceptionFilter
│   ├── guards/                  # RolesGuard, ThrottlerGuard
│   ├── interceptors/            # LoggingInterceptor, TransformInterceptor, AuditInterceptor
│   ├── pipes/                   # Custom ParseUUIDPipe, etc.
│   └── types/                   # Shared interfaces and types
│
├── modules/                     # Domain modules (feature modules)
│   └── users/
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   └── update-user.dto.ts
│       ├── entities/
│       │   └── user.entity.ts
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── users.repository.ts  # Data access abstraction (optional but recommended)
│       └── users.module.ts
│
├── integrations/                # External service clients (Stripe, S3, SendGrid…)
│
├── app.module.ts
└── main.ts
```

**Naming conventions:**

| Type           | Pattern                    | Example                     |
| -------------- | -------------------------- | --------------------------- |
| Domain folder  | Singular                   | `user/`, `payment/`         |
| Utility folder | Plural                     | `pipes/`, `filters/`        |
| Service        | `[name].service.ts`        | `users.service.ts`          |
| DTO            | `[action]-[entity].dto.ts` | `create-user.dto.ts`        |
| Guard          | `[name].guard.ts`          | `jwt-auth.guard.ts`         |
| Decorator      | `[name].decorator.ts`      | `current-user.decorator.ts` |

---

## 3. Modules and Dependency Injection

```typescript
// ✅ CORRECT — explicit exports, no circular deps
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // Only export what other modules need
})
export class UsersModule {}

// ❌ AVOID — importing entire modules when you only need a service
// Use granular exports instead of re-exporting the whole module
```

- Register global modules (`ConfigModule`, `LoggerModule`) with `isGlobal: true` in `AppModule`.
- Use `forRootAsync` for modules that require async configuration (`TypeOrmModule`, `JwtModule`).

---

## 4. DTOs and Validation

```typescript
// ✅ Always use class-validator + class-transformer
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  displayName?: string;
}
```

**`main.ts` — Mandatory global ValidationPipe:**

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip properties not declared in the DTO
    forbidNonWhitelisted: true, // Throw error if extra props arrive
    transform: true, // Automatically convert payloads to DTO type
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

- Never use `any` or `object` as the type for `@Body()`.
- For partial updates, extend with `PartialType(CreateUserDto)` from `@nestjs/mapped-types`.

---

## 5. Controllers

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @Roles('admin', 'user')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.create(dto, actor);
  }
}
```

- Controllers **only** coordinate: receive the request, call the service, return the response.
- **Never** put business logic or database queries in a controller.
- Use `@SerializeOptions` + `ClassSerializerInterceptor` to exclude sensitive fields (e.g. `password`).

---

## 6. Services

```typescript
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
```

- One service = one domain. Avoid "god" services (UserAuthPaymentService).
- HTTP exceptions (`NotFoundException`, `BadRequestException`, etc.) are valid in services; use them instead of returning `null`.
- For heavy or queue-based operations, delegate to a worker with **BullMQ**.

---

## 7. Repositories (Repository Pattern)

```typescript
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  save(user: Partial<User>): Promise<User> {
    return this.repo.save(user);
  }
}
```

- Abstract the ORM away from the service. If you migrate from TypeORM to Prisma, only the repository changes.
- With **Prisma**: create a `PrismaService` that extends `PrismaClient` and inject it directly into services.

---

## 8. Security

### 8.1 JWT Authentication

```typescript
// core/auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      algorithms: ['HS256'],       // Never leave the algorithm implicit
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;               // Attached to request.user
  }
}

// Short-lived JWT + refresh tokens
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_SECRET'),
    signOptions: { expiresIn: '15m' }, // Short-lived access token
  }),
}),
```

### 8.2 Global Guard with Public Route Exception

```typescript
// Apply JWT to everything by default; use @Public() for exceptions
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// Register globally in AppModule
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
```

### 8.3 RBAC with @Roles Decorator

```typescript
@Roles('admin')
@Delete(':id')
remove(@Param('id', ParseUUIDPipe) id: string) {
  return this.usersService.remove(id);
}
```

### 8.4 Security Headers and Rate Limiting

```typescript
// main.ts
import helmet from 'helmet';
import { ThrottlerModule } from '@nestjs/throttler';

app.use(helmet());
app.enableCors({ origin: process.env.ALLOWED_ORIGINS?.split(',') });

// In AppModule
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
```

### 8.5 Non-Negotiable Security Rules

- **Never** store passwords in plain text → use `bcrypt` with at least 10 rounds.
- **Never** hardcode secrets in code → validate env vars with Joi at startup.
- **Never** expose stack traces in production → handle them in `HttpExceptionFilter`.
- **Always** use `whitelist: true` in ValidationPipe.
- **Always** verify the JWT algorithm explicitly.
- **Always** apply `helmet()` and configure restrictive CORS.

---

## 9. Error Handling

```typescript
// common/filters/http-exception.filter.ts
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}

// Register globally in main.ts
app.useGlobalFilters(new GlobalHttpExceptionFilter());
```

- Never throw raw `Error` from a service; use NestJS HTTP exceptions.
- In production, log the stack trace but **do not** send it in the response.

---

## 10. Interceptors

```typescript
// TransformInterceptor: wraps all responses in { data, statusCode }
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        statusCode: context.switchToHttp().getResponse().statusCode,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// LoggingInterceptor: logs the duration of each request
```

---

## 11. Configuration and Environment Variables

```typescript
// core/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  ALLOWED_ORIGINS: Joi.string().required(),
  ENCRYPTION_KEY: Joi.string().min(32).required(),  // For PHI encryption at rest
});

// AppModule
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: envValidationSchema,
  validationOptions: { abortEarly: true }, // Fail at startup if env is invalid
}),
```

---

## 12. Testing

- **Unit tests** (`*.spec.ts`): test services in isolation with repository mocks.
- **Integration tests** (`*.integration.spec.ts`): test the full module with in-memory DB or Docker container.
- **E2E tests** (`test/*.e2e-spec.ts`): test HTTP endpoints with `supertest`.

```typescript
// Service unit test example
describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: { findById: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(UsersRepository);
  });

  it('throws NotFoundException if user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findOne('uuid')).rejects.toThrow(NotFoundException);
  });
});
```

---

## 13. Additional Code Rules

- **Strict TypeScript:** `strict: true` in `tsconfig.json`. Zero implicit `any`.
- **Async/await** always; avoid callbacks and chained `.then()`.
- **Readonly** on DTO and interface properties that should not mutate.
- **Standard pagination:** use `{ data: T[], total: number, page: number, limit: number }`.
- **API versioning:** use `app.enableVersioning({ type: VersioningType.URI })` from the start.
- **Health checks:** implement `@nestjs/terminus` at `/health` before going to production.
- **No `.env` commits:** always add `.env` to `.gitignore` and provide `.env.example`.

---

## 14. Anti-Patterns to Avoid

| ❌ Anti-pattern                        | ✅ Alternative                            |
| -------------------------------------- | ----------------------------------------- |
| Business logic in controllers          | Move to the service                       |
| DB query in a controller               | Use repository or service                 |
| `console.log` in production            | Use NestJS Logger / Pino                  |
| Hardcoded secrets                      | `ConfigService` + Joi validation          |
| `@Body() body: any`                    | Typed DTO with class-validator            |
| Untyped exceptions (`throw new Error`) | `throw new NotFoundException(...)`        |
| Everything in `AppModule`              | Feature modules per domain                |
| JWT without expiration                 | `expiresIn: '15m'` + refresh token        |
| `whitelist: false` in ValidationPipe   | Always `whitelist: true`                  |
| PHI stored without encryption          | Encrypt all PHI at rest and in transit    |
| No audit trail for data access         | Log every PHI read/write via AuditService |

---

## 15. HIPAA Compliance Requirements

> This is a **healthcare application** handling Protected Health Information (PHI). Every entity, module, and feature **must** comply with the rules below. Non-compliance is a blocking issue in code review.

### 15.1 Protected Health Information (PHI) — What Qualifies

Any data that can identify a patient **and** relates to their health, treatment, or payment is PHI. Common examples in this codebase:

- Patient name, email, phone, date of birth, address
- Medical record numbers, diagnosis, treatment plans
- Appointment history, therapist notes, session recordings
- Insurance/billing information

### 15.2 Encryption

- **At rest:** All PHI columns **must** be encrypted before being persisted (use `EncryptionService` with AES-256-GCM). Mark encrypted columns with a `@Encrypted()` decorator or comment so reviewers can spot them.
- **In transit:** All communication **must** use TLS 1.2+. Never serve the API over plain HTTP in any environment.
- **Keys:** Encryption keys live in environment variables (`ENCRYPTION_KEY`). Rotate keys periodically. Never commit keys to the repository.

```typescript
// Example: encrypting a PHI field before save
@BeforeInsert()
@BeforeUpdate()
encryptFields() {
  if (this.firstName) this.firstName = encryptionService.encrypt(this.firstName);
  if (this.lastName) this.lastName = encryptionService.encrypt(this.lastName);
  if (this.dateOfBirth) this.dateOfBirth = encryptionService.encrypt(this.dateOfBirth);
}
```

### 15.3 Audit Logging

- **Every** create, read, update, and delete operation on PHI **must** produce an audit log entry.
- Audit logs record: `who` (user ID), `what` (action + entity), `when` (timestamp), `where` (IP/endpoint), and `outcome` (success/failure).
- Use the global `AuditInterceptor` or call `AuditService.log()` explicitly in services.
- Audit logs themselves are **append-only** — never update or delete audit records.

```typescript
// common/interceptors/audit.interceptor.ts — applied globally or per-controller
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap(() =>
        this.auditService.log({
          userId: user?.id,
          action: method,
          resource: url,
          ip: request.ip,
          outcome: 'success',
        }),
      ),
      catchError((err) => {
        this.auditService.log({
          userId: user?.id,
          action: method,
          resource: url,
          ip: request.ip,
          outcome: 'failure',
        });
        throw err;
      }),
    );
  }
}
```

### 15.4 Access Controls

- **Minimum necessary rule:** Users must only access the PHI they need. Every endpoint accessing PHI must enforce role-based **and** resource-based access control.
- Use `@Roles()` for role-based checks **and** verify resource ownership in the service (e.g., a patient can only access their own records).
- Admin access to PHI must be logged with elevated audit detail.

### 15.5 Entity Design Rules for PHI

Every entity that stores PHI **must** include the following:

```typescript
@Entity()
export class PatientRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- PHI fields (encrypted at rest) ---
  @Column({ type: 'text' })
  encryptedFirstName: string; // Store encrypted, never plain text

  // --- Metadata (required on all PHI entities) ---
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  updatedBy: string; // User ID of last modifier

  @DeleteDateColumn()
  deletedAt: Date; // Soft-delete only — never hard-delete PHI

  @Column({ default: false })
  isArchived: boolean;
}
```

**Hard rules for PHI entities:**

- **Soft-delete only.** Never use hard deletes on PHI data. Use `@DeleteDateColumn()` + TypeORM's `softDelete`.
- **Timestamps are mandatory.** `createdAt`, `updatedAt`, and `deletedAt` on every PHI entity.
- **Track who modified the record.** Store `updatedBy` (user ID) on every write.
- **UUIDs as primary keys.** Never use auto-incrementing integers for PHI entities — they leak record counts.

### 15.6 Module Design Rules

When creating a new module that handles PHI:

1. **Import `AuditModule`** so audit logging is available.
2. **Import `EncryptionModule`** so PHI fields can be encrypted/decrypted.
3. **Apply `JwtAuthGuard` + `RolesGuard`** at the controller level (or rely on the global JWT guard).
4. **Never expose PHI in error messages** — sanitize exceptions before they reach the client.
5. **Never log PHI to stdout/files.** If you need to log for debugging, log the record ID only, never the PHI values.
6. **Response DTOs must exclude raw PHI** unless the requesting user has explicit access. Use `ClassSerializerInterceptor` + `@Exclude()` to prevent accidental leakage.

### 15.7 Data Retention and Disposal

- PHI must be retained according to applicable regulations (typically 6-7 years minimum).
- When data is eligible for disposal, use a secure wipe process — never just `DELETE FROM`.
- Backups containing PHI must also be encrypted.

### 15.8 Session and Authentication Security

- Sessions accessing PHI must auto-expire after **15 minutes** of inactivity.
- Enforce MFA for users with access to PHI (when MFA module is implemented).
- Log all authentication events (login, logout, failed attempts) via `AuditService`.
- Lock accounts after **5 consecutive failed login attempts**.

### 15.9 Third-Party Integrations

- Any third-party service that receives PHI **must** have a signed Business Associate Agreement (BAA).
- Do not send PHI to external APIs (analytics, logging services, etc.) unless they are HIPAA-compliant and covered by a BAA.
- Use the `integrations/` folder for all external service clients and document their HIPAA status.

### 15.10 Non-Negotiable HIPAA Rules

- **Never** store PHI in plain text in the database.
- **Never** log PHI values to console, files, or external logging services.
- **Never** hard-delete PHI records — always soft-delete.
- **Never** expose PHI in API error responses or stack traces.
- **Never** send PHI to third-party services without a BAA.
- **Always** encrypt PHI at rest (AES-256-GCM) and in transit (TLS 1.2+).
- **Always** audit every access to PHI (read, create, update, delete).
- **Always** enforce role-based + resource-based access control on PHI endpoints.
- **Always** include `createdAt`, `updatedAt`, `deletedAt`, and `updatedBy` on PHI entities.
- **Always** use UUIDs as primary keys for PHI entities.
