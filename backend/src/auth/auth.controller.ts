import { Body, Controller, Post, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, BindEmailDto, ForgotPasswordDto, ResetPasswordDto, TwoFactorTokenDto, TwoFactorAuthDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('bind-email')
  async bindEmail(@Request() req: any, @Body() bindEmailDto: BindEmailDto) {
    return this.authService.bindEmail(req.user.id, bindEmailDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/generate')
  async generateTwoFactorSecret(@Request() req: any) {
    return this.authService.generateTwoFactorSecret(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/turn-on')
  async turnOnTwoFactorAuthentication(@Request() req: any, @Body() body: TwoFactorTokenDto) {
    return this.authService.turnOnTwoFactorAuthentication(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/turn-off')
  async turnOffTwoFactorAuthentication(@Request() req: any, @Body() body: TwoFactorTokenDto) {
    return this.authService.turnOffTwoFactorAuthentication(req.user.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('2fa/authenticate')
  async authenticate2FA(@Body() body: TwoFactorAuthDto) {
    return this.authService.authenticate2FA(body);
  }
}
