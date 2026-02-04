import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    aggregate(body: {
        businessId: string;
        date: string;
    }): Promise<{
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
