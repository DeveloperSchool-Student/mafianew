import { IsString, IsNumber, IsIn, Min } from 'class-validator';

export class CreateTradeDto {
  @IsString()
  receiverId!: string;

  @IsNumber()
  @Min(1, { message: 'Сума пропозиції має бути більше 0' })
  offerAmount!: number;

  @IsString()
  @IsIn(['SOFT', 'HARD'])
  offerCurrency!: 'SOFT' | 'HARD';

  @IsNumber()
  @Min(1, { message: 'Сума запиту має бути більше 0' })
  requestAmount!: number;

  @IsString()
  @IsIn(['SOFT', 'HARD'])
  requestCurrency!: 'SOFT' | 'HARD';
}
