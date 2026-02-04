import { SupabaseService } from '../supabase/supabase.service';
export declare class LogErrorService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    log(userId: string | null, message: string, context: string, payload: unknown): Promise<void>;
}
