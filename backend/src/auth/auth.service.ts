import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
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
}
