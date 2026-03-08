import {
  IsString,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  @IsIn(['CASUAL', 'RANKED', 'TOURNAMENT'])
  type?: 'CASUAL' | 'RANKED' | 'TOURNAMENT';
}

export class RoomIdDto {
  @IsUUID()
  roomId!: string;
}

export class InviteToRoomDto {
  @IsString()
  targetUserId!: string;

  @IsUUID()
  roomId!: string;
}

export class ReplyInviteDto {
  @IsString()
  @MaxLength(50)
  inviterUsername!: string;

  @IsBoolean()
  accepted!: boolean;
}

export class ReadyDto {
  @IsUUID()
  roomId!: string;

  @IsBoolean()
  isReady!: boolean;
}

export class UpdateRoomSettingsDto {
  @IsUUID()
  roomId!: string;

  @IsOptional()
  settings?: any;
}

export class NightActionDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  targetId!: string;

  @IsString()
  actionType!: string;
}

export class VoteDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  targetId!: string;
}

export class SaveLastWillDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  @MaxLength(1000)
  lastWill!: string;
}

export class PlaceBetDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  faction!: string;

  @IsNumber()
  amount!: number;
}

export class WhisperDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  targetId!: string;

  @IsString()
  @MaxLength(1000)
  message!: string;
}

export class AdminActionDto {
  @IsString()
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @IsIn(['KICK', 'BAN', 'MUTE'])
  action!: 'KICK' | 'BAN' | 'MUTE';
}

export class ChatMessageDto {
  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @MaxLength(2000)
  message!: string;
}
