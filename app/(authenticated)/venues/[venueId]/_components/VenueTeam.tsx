"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users } from 'lucide-react';

type StaffRow = {
  id: string;
  venue_id: string;
  user_id: string;
  role: string;
  profiles?: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null;
};

export default function VenueTeamTab({ venueId }: { venueId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('venue_staff')
      .select('id, venue_id, user_id, role, profiles(full_name, email)')
      .eq('venue_id', venueId)
      .then(({ data }) => {
        setStaff((data ?? []) as unknown as StaffRow[]);
        setLoading(false);
      });
  }, [venueId]);

  if (loading) return <p className="text-slate-500">Loading team…</p>;
  if (staff.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 max-w-md mx-auto">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No team members assigned to this venue yet. Add staff via venue_staff or your invite flow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <h3 className="text-lg font-semibold text-white">Venue staff</h3>
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
        {staff.map((s) => (
          <li key={s.id} className="p-4 bg-slate-900/50 flex items-center justify-between">
            <div>
              <div className="font-medium text-white">
                {(() => {
                  const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
                  return p?.full_name ?? p?.email ?? s.user_id;
                })()}
              </div>
              {(() => {
                const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
                if (p?.email && p?.full_name) return <div className="text-sm text-slate-500">{p.email}</div>;
                return null;
              })()}
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">{s.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
