import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async upsertProfile(
    id: string,
    email: string,
    role: string,
    fullName?: string,
  ): Promise<void> {
    await this.supabase.getClient().from('profiles').upsert({
      id,
      email,
      role,
      full_name: fullName ?? email.split('@')[0],
    });
  }
}
