"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let ReportsService = class ReportsService {
    constructor(supabase) {
        this.supabase = supabase;
    }
    async aggregate(businessId, date) {
        const sb = this.supabase.getClient();
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        const { data: events, error } = await sb
            .from('occupancy_events')
            .select('*')
            .eq('business_id', businessId)
            .gte('timestamp', startOfDay)
            .lte('timestamp', endOfDay)
            .order('timestamp', { ascending: true });
        if (error)
            throw error;
        if (!events?.length) {
            return { message: 'No events found for date', count: 0 };
        }
        let peakOccupancy = 0;
        let currentOccupancy = 0;
        let totalEntries = 0;
        let totalExits = 0;
        const hourlyTraffic = new Array(24).fill(0).map(() => ({ entries: 0, exits: 0, peak: 0 }));
        for (const event of events) {
            const hour = new Date(event.timestamp).getHours();
            if (event.direction === 'IN' || event.flow_type === 'IN') {
                currentOccupancy += event.delta;
                totalEntries += event.delta;
                hourlyTraffic[hour].entries += event.delta;
            }
            else {
                currentOccupancy -= Math.abs(event.delta);
                totalExits += Math.abs(event.delta);
                hourlyTraffic[hour].exits += Math.abs(event.delta);
            }
            if (currentOccupancy > peakOccupancy)
                peakOccupancy = currentOccupancy;
            if (currentOccupancy > hourlyTraffic[hour].peak)
                hourlyTraffic[hour].peak = currentOccupancy;
        }
        return {
            success: true,
            report: {
                date,
                generated_at: new Date().toISOString(),
                metrics: {
                    total_entries: totalEntries,
                    total_exits: totalExits,
                    peak_occupancy: peakOccupancy,
                    closing_occupancy: currentOccupancy,
                },
                hourly_breakdown: hourlyTraffic.map((h, i) => ({ hour: i, ...h })),
            },
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map