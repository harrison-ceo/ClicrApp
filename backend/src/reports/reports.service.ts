import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ReportsService {
  constructor(private readonly supabase: SupabaseService) {}

  async aggregate(businessId: string, date: string) {
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

    if (error) throw error;
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
      } else {
        currentOccupancy -= Math.abs(event.delta);
        totalExits += Math.abs(event.delta);
        hourlyTraffic[hour].exits += Math.abs(event.delta);
      }
      if (currentOccupancy > peakOccupancy) peakOccupancy = currentOccupancy;
      if (currentOccupancy > hourlyTraffic[hour].peak) hourlyTraffic[hour].peak = currentOccupancy;
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
}
