import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { MatchmakingService } from './matchmaking.service';
import { GameService } from './game.service';
import { LeaderboardService } from './leaderboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [AuthModule, RedisModule, PrismaModule, FriendsModule],
  controllers: [GameController],
  providers: [GameGateway, MatchmakingService, GameService, LeaderboardService],
})
export class GameModule {}
