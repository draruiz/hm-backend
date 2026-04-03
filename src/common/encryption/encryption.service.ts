import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'base64' as const;
const SEPARATOR = ':';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hex = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    this.key = Buffer.from(hex, 'hex');

    if (this.key.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)',
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString(ENCODING),
      authTag.toString(ENCODING),
      encrypted.toString(ENCODING),
    ].join(SEPARATOR);
  }

  decrypt(ciphertext: string): string {
    const [ivB64, authTagB64, encryptedB64] = ciphertext.split(SEPARATOR);

    const iv = Buffer.from(ivB64, ENCODING);
    const authTag = Buffer.from(authTagB64, ENCODING);
    const encrypted = Buffer.from(encryptedB64, ENCODING);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  encryptIfPresent(value: string | undefined | null): string | null {
    if (value == null || value === '') return null;
    return this.encrypt(value);
  }

  decryptIfPresent(value: string | undefined | null): string | null {
    if (value == null || value === '') return null;
    return this.decrypt(value);
  }
}
