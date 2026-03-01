export class RegisterDto {
  username!: string;
  password!: string;
}

export class LoginDto {
  username!: string;
  password!: string;
}

export class BindEmailDto {
  email!: string;
}

export class ForgotPasswordDto {
  email!: string;
}

export class ResetPasswordDto {
  token!: string;
  newPassword!: string;
}

export class TwoFactorTokenDto {
  token!: string;
}

export class TwoFactorAuthDto {
  userId!: string;
  token!: string;
}
