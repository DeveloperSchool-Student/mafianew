import { UnauthorizedException } from '@nestjs/common';
import * as otplib from 'otplib';
import { AuthService } from './auth.service';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'secret'),
  verifySync: jest.fn(),
}));

describe('AuthService 2FA flows', () => {
  let service: AuthService;
  let prismaMock: any;
  let mailServiceMock: any;
  let jwtServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mailServiceMock = {
      sendPasswordResetMail: jest.fn(),
    };

    const usersServiceMock = {
      findByUsername: jest.fn(),
      create: jest.fn(),
    };

    jwtServiceMock = {
      sign: jest.fn(() => 'signedToken'),
    };

    service = new AuthService(
      usersServiceMock as any,
      jwtServiceMock as any,
      prismaMock as any,
      mailServiceMock as any,
    );
  });

  describe('turnOnTwoFactorAuthentication', () => {
    it('throws UnauthorizedException if user not found or has no twoFactorSecret', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.turnOnTwoFactorAuthentication('u1', { token: '123456' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException if verification is invalid', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ twoFactorSecret: null });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        twoFactorSecret: 'secret123',
        id: 'u1',
        username: 'alice',
      });

      (otplib.verifySync as unknown as jest.Mock).mockReturnValue({
        valid: false,
      });

      await expect(
        service.turnOnTwoFactorAuthentication('u1', { token: 'bad' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('enables 2FA and updates user when verification is valid', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        twoFactorSecret: 'secret123',
      });

      (otplib.verifySync as unknown as jest.Mock).mockReturnValue({
        valid: true,
      });

      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        isTwoFactorEnabled: true,
      });

      const result = await service.turnOnTwoFactorAuthentication('u1', {
        token: '123456',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isTwoFactorEnabled: true },
      });
      expect(result).toEqual({
        success: true,
        message: '2FA успішно увімкнено.',
      });
    });
  });

  describe('authenticate2FA', () => {
    it('throws UnauthorizedException if 2FA not enabled for user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        isTwoFactorEnabled: false,
        twoFactorSecret: 'secret',
      });

      await expect(
        service.authenticate2FA({ userId: 'u1', token: '123456' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException if verification is invalid', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        isTwoFactorEnabled: true,
        twoFactorSecret: 'secret',
        username: 'alice',
        role: 'USER',
        staffRoleKey: null,
      });

      (otplib.verifySync as unknown as jest.Mock).mockReturnValue({
        valid: false,
      });

      await expect(
        service.authenticate2FA({ userId: 'u1', token: 'bad' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns access token and updates lastLoginAt on success', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        isTwoFactorEnabled: true,
        twoFactorSecret: 'secret',
        username: 'alice',
        role: 'USER',
        staffRoleKey: null,
      });

      (otplib.verifySync as unknown as jest.Mock).mockReturnValue({
        valid: true,
      });

      prismaMock.user.update.mockResolvedValue({ id: 'u1' });

      const result = await service.authenticate2FA({
        userId: 'u1',
        token: '123456',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastLoginAt: expect.any(Date) },
      });

      expect(jwtServiceMock.sign).toHaveBeenCalled();
      expect(result).toMatchObject({
        access_token: 'signedToken',
        user: {
          id: 'u1',
          username: 'alice',
          role: 'USER',
          staffRoleKey: null,
        },
      });
    });
  });
});

