import { SupabaseService } from '../supabase/supabase.service';
export declare class ReportsService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    aggregate(businessId: string, date: string): Promise<{
        message: string;
        count: number;
        success?: undefined;
        report?: undefined;
    } | {
        success: boolean;
        report: {
            date: string;
            generated_at: string;
            metrics: {
                total_entries: number;
                total_exits: number;
                peak_occupancy: number;
                closing_occupancy: number;
            };
            hourly_breakdown: {
                entries: number;
                exits: number;
                peak: number;
                hour: number;
            }[];
        };
        message?: undefined;
        count?: undefined;
    }>;
}
