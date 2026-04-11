export class LoginDto {
  email!: string;
  password!: string;
  /** When true, JWT expires in 30 days instead of the default short session. */
  rememberMe?: boolean;
}
