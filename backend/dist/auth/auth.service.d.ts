import { SupabaseService } from '../supabase/supabase.service';
export declare class AuthService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    upsertProfile(id: string, email: string, role: string, fullName?: string): Promise<void>;
}
