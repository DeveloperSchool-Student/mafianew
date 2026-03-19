import { IsString, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  targetId!: string;

  @IsString()
  @MinLength(1, { message: 'Повідомлення не може бути порожнім' })
  @MaxLength(2000, { message: 'Повідомлення занадто довге (макс. 2000 символів)' })
  content!: string;
}
