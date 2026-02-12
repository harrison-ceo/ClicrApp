"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

type LogRow = {
  id: string;
  venue_id: string;
  delta: number;
  source: string | null;
  created_at: string;
  gender?: string | null;
};

export default function VenueLogsTab({ venueId }: { venueId: string }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('occupancy_logs')
      .select('id, venue_id, delta, source, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs((data ?? []) as LogRow[]);
        setLoading(false);
      });
  }, [venueId]);

  if (loading) return <p className="text-slate-500">Loading logs…</p>;
  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 max-w-md mx-auto">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No occupancy logs for this venue yet. Logs appear when traffic is recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <h3 className="text-lg font-semibold text-white">Recent occupancy logs</h3>
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
        {logs.map((log) => (
          <li key={log.id} className="p-4 bg-slate-900/50 flex items-center justify-between text-sm">
            <span className={cn('font-mono', log.delta >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
              {log.delta >= 0 ? '+' : ''}
              {log.delta}
            </span>
            <span className="text-slate-500">{log.source ?? '—'}</span>
            <span className="text-slate-500">
              {new Date(log.created_at).toLocaleString(undefined, { timeZone: 'America/New_York', timeStyle: 'full' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
