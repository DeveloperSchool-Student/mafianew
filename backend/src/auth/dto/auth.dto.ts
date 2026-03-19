import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Нікнейм має бути не менше 3 символів' })
  @MaxLength(20, { message: 'Нікнейм має бути не більше 20 символів' })
  @Matches(/^[a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9_]+$/, {
    message: 'Нікнейм може містити лише літери, цифри та підкреслення',
  })
  username!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль має бути не менше 6 символів' })
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsOptional()
  fingerprint?: string;
}

export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'Введіть нікнейм' })
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(1, { message: 'Введіть пароль' })
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsOptional()
  fingerprint?: string;
}

export class BindEmailDto {
  @IsEmail({}, { message: 'Невалідний email' })
  email!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Невалідний email' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(6, { message: 'Новий пароль має бути не менше 6 символів' })
  @MaxLength(100)
  newPassword!: string;
}

export class TwoFactorTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  token!: string;
}

export class TwoFactorAuthDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  token!: string;
}
