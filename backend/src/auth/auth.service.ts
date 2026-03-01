import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
// @ts-ignore
import { generateSecret, verifySync } from 'otplib';
import * as qrcode from 'qrcode';
import { RegisterDto, LoginDto, BindEmailDto, ForgotPasswordDto, ResetPasswordDto, TwoFactorTokenDto, TwoFactorAuthDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.profile?.bannedUntil && new Date(user.profile.bannedUntil) > new Date()) {
      throw new UnauthorizedException('Акаунт заблоковано адміністратором.');
    }

    if (user.isTwoFactorEnabled) {
      return {
        requires2FA: true,
        userId: user.id,
      };
    }

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role ?? 'USER',
      staffRoleKey: user.staffRoleKey ?? null,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role ?? 'USER',
        staffRoleKey: user.staffRoleKey ?? null,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const username = registerDto.username.trim();

    // Базова валідація ніку: довжина + простий фільтр матюків
    if (username.length < 3 || username.length > 20) {
      throw new UnauthorizedException('Нікнейм має бути від 3 до 20 символів.');
    }

    const bannedWords = ['fuck', 'shit', 'сука', 'бляд', 'хуй', 'пизд', 'еба', 'нахуй'];
    const lower = username.toLowerCase();
    if (bannedWords.some((w) => lower.includes(w))) {
      throw new UnauthorizedException('Нікнейм містить заборонені слова.');
    }

    const existingUser = await this.usersService.findByUsername(username);
    if (existingUser) {
      throw new UnauthorizedException('Username already taken');
    }
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      username,
      password: hashedPassword,
    });

    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role ?? 'USER',
      staffRoleKey: user.staffRoleKey ?? null,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role ?? 'USER',
        staffRoleKey: user.staffRoleKey ?? null,
      },
    };
  }

  async bindEmail(userId: string, bindEmailDto: BindEmailDto) {
    const { email } = bindEmailDto;

    // Check if email already in use
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== userId) {
      throw new UnauthorizedException('Ця пошта вже використовується іншим акаунтом.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { email },
    });

    return { success: true, message: 'Пошту успішно прив\'язано.' };
  }

  async forgotPassword(forgotDto: ForgotPasswordDto) {
    const { email } = forgotDto;
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return success even if not found to prevent email enumeration
      return { success: true, message: 'Якщо пошта знайдена, на неї відправлено лист із посиланням.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const resetLink = `${process.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    await this.mailService.sendPasswordResetMail(email, resetLink);

    return { success: true, message: 'Якщо пошта знайдена, на неї відправлено лист із посиланням.' };
  }

  async resetPassword(resetDto: ResetPasswordDto) {
    const { token, newPassword } = resetDto;

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Токен недійсний або його час дії минув.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { success: true, message: 'Пароль успішно змінено. Тепер ви можете увійти.' };
  }



  async generateTwoFactorSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = generateSecret();
    const appName = encodeURIComponent('Mafia Online');
    const accountName = encodeURIComponent(user.username);
    const otpauthUrl = `otpauth://totp/${appName}:${accountName}?secret=${secret}&issuer=${appName}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return {
      qrCodeDataUrl: await qrcode.toDataURL(otpauthUrl),
    };
  }

  async turnOnTwoFactorAuthentication(userId: string, twoFactorTokenDto: TwoFactorTokenDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('Не вдалося увімкнути 2FA. Спочатку згенеруйте секретний ключ.');
    }

    const verification = verifySync({
      token: twoFactorTokenDto.token,
      secret: user.twoFactorSecret,
    });

    if (!verification?.valid) {
      throw new UnauthorizedException('Хибний код 2FA.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });

    return { success: true, message: '2FA успішно увімкнено.' };
  }

  async turnOffTwoFactorAuthentication(userId: string, twoFactorTokenDto: TwoFactorTokenDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA не увімкнено.');
    }

    const verification = verifySync({
      token: twoFactorTokenDto.token,
      secret: user.twoFactorSecret,
    });

    if (!verification?.valid) {
      throw new UnauthorizedException('Хибний код 2FA.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: false, twoFactorSecret: null },
    });

    return { success: true, message: '2FA успішно вимкнено.' };
  }

  async authenticate2FA(twoFactorAuthDto: TwoFactorAuthDto) {
    const user = await this.prisma.user.findUnique({ where: { id: twoFactorAuthDto.userId } });
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA не увімкнено для цього акаунта.');
    }

    const verification = verifySync({
      token: twoFactorAuthDto.token,
      secret: user.twoFactorSecret,
    });

    if (!verification?.valid) {
      throw new UnauthorizedException('Хибний код 2FA.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role ?? 'USER',
      staffRoleKey: user.staffRoleKey ?? null,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role ?? 'USER',
        staffRoleKey: user.staffRoleKey ?? null,
      },
    };
  }
}
