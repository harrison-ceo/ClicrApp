import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LogErrorService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(userId: string | null, message: string, context: string, payload: unknown): Promise<void> {
    await this.supabase.getClient().from('app_errors').insert({
      user_id: userId,
      error_message: message,
      context,
      payload,
    });
  }
}
