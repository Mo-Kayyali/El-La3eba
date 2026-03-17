import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [AuthModule, RedisModule],
  providers: [GameGateway, MatchmakingService],
})
export class GameModule {}
