"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Activity, MapPin, RefreshCw } from 'lucide-react';

type Venue = {
  id: string;
  name: string;
  address: string | null;
  capacity: number;
  current_occupancy: number;
  current_male_count?: number | null;
  current_female_count?: number | null;
};

type LogRow = { id: string; venue_id: string; delta: number; source: string | null; created_at: string; gender?: string | null };

export default function VenueOverviewTab({
  venueId,
  venue,
  onRefresh,
}: {
  venueId: string;
  venue: Venue;
  onRefresh: () => void;
}) {
  const [occupancy, setOccupancy] = useState<number | null>(null);
  const [maleCount, setMaleCount] = useState<number>(venue?.current_male_count ?? 0);
  const [femaleCount, setFemaleCount] = useState<number>(venue?.current_female_count ?? 0);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from('venues')
      .select('current_occupancy, current_male_count, current_female_count')
      .eq('id', venueId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setOccupancy(data.current_occupancy ?? 0);
        setMaleCount(data.current_male_count ?? 0);
        setFemaleCount(data.current_female_count ?? 0);
        setLoading(false);
      });

    const channel = supabase
      .channel(`venues:${venueId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'venues', filter: `id=eq.${venueId}` },
        (payload) => {
          const next = payload.new as {
            current_occupancy?: number | null;
            current_male_count?: number | null;
            current_female_count?: number | null;
          };
          if (typeof next.current_occupancy === 'number') setOccupancy(next.current_occupancy);
          setMaleCount(next.current_male_count ?? 0);
          setFemaleCount(next.current_female_count ?? 0);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase
      .from('occupancy_logs')
      .select('id, venue_id, delta, source, created_at, gender')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load occupancy_logs', error);
        }
        if (cancelled) return;
        setLogs((data ?? []) as LogRow[]);
        setLogsLoading(false);
      });
    const channel = supabase
      .channel(`occupancy_logs:${venueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'occupancy_logs', filter: `venue_id=eq.${venueId}` },
        (payload) => {
          const next = payload.new as LogRow;
          if (!next?.id) return;
          setLogs((prev) => {
            const updated = [next, ...prev];
            return updated.slice(0, 12);
          });
          setLogsLoading(false);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  const current = occupancy ?? venue.current_occupancy ?? 0;
  const cap = venue.capacity || 0;
  const pct = cap > 0 ? (current / cap) * 100 : 0;
  let barColor = 'bg-primary';
  if (pct > 90) barColor = 'bg-red-500';
  else if (pct > 75) barColor = 'bg-amber-500';

  const mockTotalEntries = 160;
  const mockScansProcessed = 164;
  const mockBannedHits = 1;

  const ageBuckets = [
    { label: '18-20', value: 12 },
    { label: '21-25', value: 45 },
    { label: '26-30', value: 32 },
    { label: '31-40', value: 18 },
    { label: '40+', value: 8 },
  ];
  const maxAge = Math.max(...ageBuckets.map((b) => b.value));

  const genderTotal = maleCount + femaleCount;
  const malePct = genderTotal > 0 ? Math.round((maleCount / genderTotal) * 100) : 0;
  const femalePct = genderTotal > 0 ? Math.round((femaleCount / genderTotal) * 100) : 0;

  const liveLogContent = () => {
    if (logsLoading) return <div className="text-sm text-slate-500">Loading events…</div>;
    if (logs.length === 0) return <div className="text-sm text-slate-500">No recent events.</div>;
    return logs.map((log) => {
      const type = log.delta >= 0 ? 'ENTRY' : 'EXIT';
      const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return (
        <div key={log.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className={cn('text-xs font-semibold', log.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {type}
          </div>
          <div className="text-xs text-slate-500 mt-1">{time}</div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-widest">Live Occupancy</div>
          {loading && occupancy === null ? (
            <div className="text-3xl font-bold text-slate-500 mt-2">—</div>
          ) : (
            <>
            <div className="text-3xl font-bold text-white mt-2">{current}</div>
            <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span>{Math.round(pct)}%</span>
            </div>
            </>
          )}
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-widest">Total Entries</div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">{mockTotalEntries}</div>
          <div className="text-xs text-slate-500 mt-1">Exits: —</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-widest">Scans Processed</div>
          <div className="text-3xl font-bold text-indigo-400 mt-2">{mockScansProcessed}</div>
          <div className="text-xs text-slate-500 mt-1">5% Denied</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-widest">Banned Hits</div>
          <div className="text-3xl font-bold text-red-400 mt-2">{mockBannedHits}</div>
          <div className="text-xs text-slate-500 mt-1">Flagged instantly</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              Age Distribution
            </div>
            <div className="space-y-4">
              {ageBuckets.map((b) => (
                <div key={b.label} className="flex items-center gap-4">
                  <div className="w-12 text-xs text-slate-400">{b.label}</div>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(b.value / maxAge) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs text-slate-400">{b.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
            <div className="text-sm font-semibold text-white mb-4">Gender Breakdown</div>
            <div className="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div className="h-full bg-blue-500" style={{ width: `${malePct}%` }} />
              <div className="h-full bg-pink-500" style={{ width: `${femalePct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-3">
              <span>Male {malePct}%</span>
              <span>Female {femalePct}%</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
          <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Live Event Log</span>
          </div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
            {liveLogContent()}
          </div>
        </div>
      </div>
    </div>
  );
}