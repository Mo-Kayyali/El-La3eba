import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { MatchmakingService } from './matchmaking.service';
import { GameService } from './game.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, RedisModule, PrismaModule],
  providers: [GameGateway, MatchmakingService, GameService],
})
export class GameModule {}
