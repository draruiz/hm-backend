import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1776345947818 implements MigrationInterface {
  name = 'InitialSchema1776345947818';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "emailHash" character varying NOT NULL, "email" text NOT NULL, "password" text NOT NULL, "firstName" text NOT NULL, "lastName" text NOT NULL, "phone" text, "dateOfBirth" text, "role" character varying NOT NULL DEFAULT 'user', "status" character varying NOT NULL DEFAULT 'active', "failedLoginAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "passwordChangedAt" TIMESTAMP WITH TIME ZONE, "hipaaConsent" boolean NOT NULL, "consentedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consentIp" character varying NOT NULL, "tosVersion" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_9e8fe0cd68634a2dc2fd7d17126" UNIQUE ("emailHash"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e8fe0cd68634a2dc2fd7d1712" ON "users" ("emailHash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text NOT NULL, "phone" text, "preferredDate" text, "time" text, "comment" text, "hipaaConsent" boolean NOT NULL, "consentedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consentIp" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5b7b44e69fd5866a5769aeeb9d8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "resource" character varying NOT NULL, "resourceId" character varying, "userId" character varying NOT NULL, "userEmail" character varying NOT NULL, "userRole" character varying NOT NULL, "ip" character varying NOT NULL, "userAgent" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "slug" character varying(300) NOT NULL, "excerpt" character varying(500), "content" text NOT NULL, "coverImageUrl" character varying(500), "status" character varying NOT NULL DEFAULT 'draft', "publishedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid NOT NULL, "updatedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_1123ff6815c5b8fec0ba9fec370" UNIQUE ("slug"), CONSTRAINT "PK_0a6e2c450d83e0b6052c2793334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1123ff6815c5b8fec0ba9fec37" ON "articles" ("slug") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_1123ff6815c5b8fec0ba9fec37"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "contact_submissions"`);
    await queryRunner.query(`DROP INDEX "IDX_9e8fe0cd68634a2dc2fd7d1712"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
