import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

// At least 3 letters and at least 1 number
const PASSWORD_REGEX = /^(?=(?:.*[A-Za-z]){3,})(?=.*\d).+$/;

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 24)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(PASSWORD_REGEX, {
    message: 'Password must contain at least 3 letters and at least 1 number',
  })
  password!: string;
}
