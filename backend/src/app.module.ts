import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { GameModule } from './game/game.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, AuthModule, RedisModule, GameModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [],
})
export class AppModule {}
