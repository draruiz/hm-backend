import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  /**
   * NIST 800-63B: minimum 8 chars, at least one uppercase, one lowercase,
   * one digit, one special character.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};:'",.<>?/\\|`~])/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
    },
  )
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** ISO-8601 date string, e.g. "1990-01-15" */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateOfBirth?: string;

  @IsBoolean()
  @IsNotEmpty()
  hipaaConsent: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tosVersion?: string;
}
