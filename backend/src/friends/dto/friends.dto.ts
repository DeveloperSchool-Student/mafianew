import { IsString, MinLength, MaxLength } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  friendUsername!: string;
}
