import { SupabaseService } from '../supabase/supabase.service';
export declare class OnboardingService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    complete(params: {
        userId: string;
        userEmail: string;
        businessName: string;
        venueName: string;
        venueCapacity: number;
        venueTimezone: string;
    }): Promise<void>;
}
