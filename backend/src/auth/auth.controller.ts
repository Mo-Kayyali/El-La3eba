import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Login and receive a JWT' })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile (from database)' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: { user: { userId: string } }) {
    return this.authService.getProfileById(req.user.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request an email verification code' })
  @UseGuards(JwtAuthGuard)
  @Post('request-verification')
  requestVerification(@Request() req: any) {
    return this.authService.requestVerification(
      req.user.userId,
      req.user.email,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify email using the 6-digit code' })
  @UseGuards(JwtAuthGuard)
  @Post('verify-email')
  verifyEmail(@Request() req: any, @Body('code') code: string) {
    return this.authService.verifyEmail(req.user.userId, code);
  }
}
