import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

/* ── Staff ── */

export class SetStaffRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  roleKey!: string;

  @IsString()
  @IsOptional()
  confirmPin?: string;
}

export class TargetUsernameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;
}

/* ── Punishments ── */

export class PunishDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @IsIn(['BAN', 'MUTE', 'KICK', 'WARN'])
  type!: 'BAN' | 'MUTE' | 'KICK' | 'WARN';

  @IsNumber()
  @IsOptional()
  @Min(0)
  durationSeconds?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  scope?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class UnpunishDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @IsIn(['BAN', 'MUTE', 'KICK'])
  type!: 'BAN' | 'MUTE' | 'KICK';
}

/* ── Economy ── */

export class AdjustEconomyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsNumber()
  delta!: number;
}

/* ── Nickname ── */

export class ChangeNicknameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @MinLength(3, { message: 'Нікнейм має бути не менше 3 символів' })
  @MaxLength(20, { message: 'Нікнейм має бути не більше 20 символів' })
  newUsername!: string;
}

/* ── Reports ── */

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @MinLength(5, { message: 'Причина має бути не менше 5 символів' })
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  screenshotUrl?: string;
}

export class ResolveReportDto {
  @IsString()
  @IsIn(['RESOLVED', 'REJECTED'])
  status!: 'RESOLVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

/* ── Appeals ── */

export class SubmitAppealDto {
  @IsString()
  @IsIn(['UNBAN', 'UNMUTE'])
  type!: 'UNBAN' | 'UNMUTE';

  @IsString()
  @MinLength(10, { message: 'Причина має бути не менше 10 символів' })
  @MaxLength(2000)
  reason!: string;
}

export class ResolveAppealDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}

/* ── Logs ── */

export class ClearLogsDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(365)
  olderThanDays?: number;
}

/* ── Delete User ── */

export class DeleteUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;
}

/* ── Titles ── */

export class SetTitleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  targetUsername!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  title!: string | null;
}

/* ── Clan Wars ── */

export class ResolveClanWarDto {
  @IsString()
  @IsOptional()
  winnerId!: string | null;
}

/* ── Events ── */

export class LaunchEventDto {
  @IsString()
  @MinLength(3, { message: 'Назва івенту занадто коротка' })
  @MaxLength(100)
  eventName!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  rewardCoins?: number;

  @IsString({ each: true })
  @IsOptional()
  eventRoles?: string[];
}

/* ── Seasons ── */

export class StartSeasonDto {
  @IsString()
  @MinLength(1, { message: "Назва сезону обов'язкова" })
  @MaxLength(100)
  name!: string;
}
