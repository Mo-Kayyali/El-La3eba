import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username }
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('Username or Email already exists');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
      },
    });

    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, username: user.username, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
      }
    };
  }

  async requestVerification(userId: string, email: string) {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `verify_email:${userId}`;

    // Store in Redis with 15 mins (900 seconds) TTL
    await this.redisService.set(key, code, 'EX', 900);

    // Simulate sending email
    console.log(`[SIMULATED EMAIL] To: ${email} - Verification Code: ${code}`);

    return { success: true, message: 'Verification code generated and "sent" via email.' };
  }

  async verifyEmail(userId: string, code: string) {
    const key = `verify_email:${userId}`;
    const storedCode = await this.redisService.get(key);

    if (!storedCode) {
      throw new UnauthorizedException('Verification code expired or not found.');
    }

    if (storedCode !== code) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    // Code matches, update user
    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });

    // Clean up Redis
    await this.redisService.del(key);

    return { success: true, message: 'Email successfully verified.' };
  }
}
