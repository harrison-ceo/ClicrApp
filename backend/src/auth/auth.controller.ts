import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('upsert-profile')
  async upsertProfile(
    @Body() body: { id: string; email: string; role?: string; full_name?: string },
  ) {
    await this.authService.upsertProfile(
      body.id,
      body.email,
      body.role ?? 'OWNER',
      body.full_name,
    );
    return { success: true };
  }
}
