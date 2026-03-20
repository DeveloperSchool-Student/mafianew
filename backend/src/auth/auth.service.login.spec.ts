import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  it('throws UnauthorizedException when account is banned', async () => {
    const usersServiceMock = {
      findByUsername: jest.fn(),
      create: jest.fn(),
    };

    const jwtServiceMock = {
      sign: jest.fn(() => 'token'),
    };

    const prismaMock = {
      user: { update: jest.fn() },
    };

    const mailServiceMock = {
      sendPasswordResetMail: jest.fn(),
    };

    const service = new AuthService(
      usersServiceMock as any,
      jwtServiceMock as any,
      prismaMock as any,
      mailServiceMock as any,
    );

    const bannedUntil = new Date(Date.now() + 60_000).toISOString();

    jest
      .spyOn(service, 'validateUser')
      .mockResolvedValue({
        id: 'u1',
        username: 'alice',
        role: 'USER',
        staffRoleKey: null,
        password: 'hashed',
        profile: { bannedUntil },
        isTwoFactorEnabled: false,
      });

    await expect(
      service.login({ username: 'alice', password: 'pw' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

