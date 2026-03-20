import {
  IsString,
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
  @IsString()
  roomId!: string;
}

export class InviteToRoomDto {
  @IsString()
  targetUserId!: string;

  @IsString()
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
  @IsString()
  roomId!: string;

  @IsBoolean()
  isReady!: boolean;
}

export class RoomSettingsDto {
  @IsOptional()
  @IsNumber()
  dayTimerMs?: number;

  @IsOptional()
  @IsNumber()
  nightTimerMs?: number;

  @IsOptional()
  @IsBoolean()
  enableSerialKiller?: boolean;

  @IsOptional()
  @IsBoolean()
  enableEscort?: boolean;

  @IsOptional()
  @IsBoolean()
  enableJester?: boolean;

  @IsOptional()
  @IsBoolean()
  enableLawyer?: boolean;

  @IsOptional()
  @IsBoolean()
  enableBodyguard?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTracker?: boolean;

  @IsOptional()
  @IsBoolean()
  enableInformer?: boolean;

  @IsOptional()
  @IsBoolean()
  enableMayor?: boolean;

  @IsOptional()
  @IsBoolean()
  enableJudge?: boolean;

  @IsOptional()
  @IsBoolean()
  enableBomber?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTrapper?: boolean;

  @IsOptional()
  @IsBoolean()
  enableSilencer?: boolean;

  @IsOptional()
  @IsBoolean()
  enableLovers?: boolean;

  @IsOptional()
  @IsBoolean()
  enableWhore?: boolean;

  @IsOptional()
  @IsBoolean()
  enableJournalist?: boolean;
}

export class UpdateRoomSettingsDto {
  @IsString()
  roomId!: string;

  @IsOptional()
  settings?: RoomSettingsDto;
}

export class NightActionDto {
  @IsString()
  roomId!: string;

  @IsString()
  targetId!: string;

  @IsString()
  actionType!: string;
}

export class VoteDto {
  @IsString()
  roomId!: string;

  @IsString()
  targetId!: string;
}

export class SaveLastWillDto {
  @IsString()
  roomId!: string;

  @IsString()
  @MaxLength(1000)
  lastWill!: string;
}

export class PlaceBetDto {
  @IsString()
  roomId!: string;

  @IsString()
  faction!: string;

  @IsNumber()
  amount!: number;
}

export class WhisperDto {
  @IsString()
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
  @MaxLength(50)
  roomId?: string;

  @IsString()
  @MaxLength(2000)
  message!: string;
}
