import { SupabaseService } from '../supabase/supabase.service';
import { SyncState } from './dto';
export declare class SyncService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    getState(userId?: string, userEmail?: string): Promise<SyncState>;
    postAction(action: string, payload: unknown, venueIdFromBody: string | undefined, userId?: string, userEmail?: string): Promise<SyncState>;
}
