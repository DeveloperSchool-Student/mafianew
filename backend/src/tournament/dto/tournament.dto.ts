import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(2, { message: 'Назва турніру занадто коротка' })
  @MaxLength(100)
  name!: string;

  @IsNumber()
  @IsOptional()
  @Min(4)
  @Max(128)
  maxParticipants?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  prizePool?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  entryFee?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  rules?: string;
}

export class MatchResultDto {
  @IsString()
  winnerId!: string;

  @IsString()
  loserId!: string;
}

export class EliminatePlayerDto {
  @IsString()
  userId!: string;
}

export class EndTournamentDto {
  @IsString()
  @IsOptional()
  winnerId?: string;
}
