import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class ChangeAvatarDto {
  @IsString()
  @MinLength(1, { message: 'URL не може бути порожнім' })
  @MaxLength(500, { message: 'URL занадто довгий (макс. 500 символів)' })
  avatarUrl!: string;
}

export class BuyFrameDto {
  @IsString()
  @MinLength(1)
  frameId!: string;
}

export class EquipFrameDto {
  @IsString()
  @MinLength(1)
  frameId!: string;
}

export class CreateClanDto {
  @IsString()
  @MinLength(2, { message: 'Назва клану занадто коротка' })
  @MaxLength(30, { message: 'Назва клану занадто довга (макс. 30 символів)' })
  name!: string;
}

export class JoinClanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  clanName!: string;
}

export class KickFromClanDto {
  @IsString()
  targetUserId!: string;
}

export class PromoteInClanDto {
  @IsString()
  targetUserId!: string;

  @IsString()
  @IsIn(['MEMBER', 'OFFICER', 'OWNER'])
  newRole!: 'MEMBER' | 'OFFICER' | 'OWNER';
}

export class DeclareClanWarDto {
  @IsString()
  targetClanId!: string;

  @IsNumber()
  @Min(0)
  customBet!: number;
}

export class ClaimQuestDto {
  @IsString()
  questId!: string;
}
