import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService.resetPassword', () => {
  let service: AuthService;
  let prismaMock: any;
  let mailServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
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

    const jwtServiceMock = {
      sign: jest.fn(),
    };

    service = new AuthService(
      usersServiceMock as any,
      jwtServiceMock as any,
      prismaMock as any,
      mailServiceMock as any,
    );
  });

  it('throws UnauthorizedException when reset token is invalid/expired', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: 'bad', newPassword: 'NewPass123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates password and clears resetToken/resetTokenExpiry on success', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPW');

    prismaMock.user.findFirst.mockResolvedValue({ id: 'user1' });
    prismaMock.user.update.mockResolvedValue({ id: 'user1' });

    const result = await service.resetPassword({
      token: 'good',
      newPassword: 'NewPass123!',
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resetToken: 'good',
          resetTokenExpiry: { gt: expect.any(Date) },
        },
      }),
    );

    expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 10);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: {
        password: 'hashedPW',
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    expect(result).toEqual({
      success: true,
      message: 'Пароль успішно змінено. Тепер ви можете увійти.',
    });
  });
});

