import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({ example: 'player123' })
  @IsString()
  @MinLength(1)
  identifier!: string;
}
