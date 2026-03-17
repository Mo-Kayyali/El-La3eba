import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('request-verification')
  requestVerification(@Request() req: any) {
    return this.authService.requestVerification(req.user.userId, req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-email')
  verifyEmail(@Request() req: any, @Body('code') code: string) {
    return this.authService.verifyEmail(req.user.userId, code);
  }
}
