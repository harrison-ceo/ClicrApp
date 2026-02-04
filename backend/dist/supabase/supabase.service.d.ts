import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private readonly configService;
    private readonly client;
    constructor(configService: ConfigService);
    getClient(): SupabaseClient;
}
