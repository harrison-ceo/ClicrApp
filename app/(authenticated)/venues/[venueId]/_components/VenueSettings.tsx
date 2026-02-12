"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, Copy } from 'lucide-react';

type Venue = {
  id: string;
  name: string;
  address: string | null;
  capacity: number;
  current_occupancy: number;
  current_male_count?: number | null;
  current_female_count?: number | null;
  org_id: string | null;
};

export default function VenueSettingsTab({ venue, onRefresh }: { venue: Venue; onRefresh: () => void }) {
  const [name, setName] = useState(venue.name);
  const [address, setAddress] = useState(venue.address ?? '');
  const [capacity, setCapacity] = useState(venue.capacity ?? 0);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'venue_owner'>('staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    setName(venue.name);
    setAddress(venue.address ?? '');
    setCapacity(venue.capacity ?? 0);
  }, [venue.id, venue.name, venue.address, venue.capacity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('venues')
      .update({ name, address: address || null, capacity: Math.max(0, capacity) })
      .eq('id', venue.id);
    setSaving(false);
    if (error) {
      alert('Failed to save: ' + error.message);
    } else {
      onRefresh();
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-bold text-white">Venue settings</h2>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div>
            <label htmlFor="venue-name" className="block text-sm font-medium text-slate-400 mb-2">Name</label>
            <input
              id="venue-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label htmlFor="venue-address" className="block text-sm font-medium text-slate-400 mb-2">Address</label>
            <input
              id="venue-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label htmlFor="venue-capacity" className="block text-sm font-medium text-slate-400 mb-2">Capacity</label>
            <input
              id="venue-capacity"
              type="number"
              min={0}
              value={Math.max(0, capacity)}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="border-t border-slate-800 pt-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Invite to venue</h3>
        <p className="text-sm text-slate-400">
          Generate a one-time onboarding link for this venue.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'staff' | 'venue_owner')}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300"
          >
            <option value="staff">Venue staff</option>
            <option value="venue_owner">Venue owner</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              try {
                setInviteLoading(true);
                setInviteError('');
                const supabase = createClient();
                const { data: authData, error: authError } = await supabase.auth.getUser();
                if (authError || !authData?.user) throw new Error('Not authenticated');
                if (!venue.org_id) throw new Error('Organization not found');

                const code = crypto.randomUUID();
                const { error } = await supabase.from('venue_invites').insert({
                  org_id: venue.org_id,
                  venue_id: venue.id,
                  code,
                  role: inviteRole,
                  created_by: authData.user.id,
                });
                if (error) throw new Error(error.message);

                const baseUrl =
                  process.env.NEXT_PUBLIC_APP_URL ||
                  (typeof globalThis !== 'undefined' && 'location' in globalThis
                    ? (globalThis as { location: Location }).location.origin
                    : 'http://localhost:3000');
                setInviteLink(`${baseUrl}/onboarding?code=${code}`);
              } catch (err) {
                setInviteError((err as Error).message || 'Failed to create invite link');
              } finally {
                setInviteLoading(false);
              }
            }}
            disabled={inviteLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50"
          >
            {inviteLoading ? 'Creating…' : 'Generate venue invite link'}
          </button>
        </div>
        {inviteLink && (
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={async () => {
                navigator.clipboard
                  .writeText(inviteLink)
                  .then(() => {
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 1500);
                  })
                  .catch(() => {
                    setInviteError('Copy failed. Please select and copy the link.');
                  });
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
              title="Copy invite link"
            >
              {inviteCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
        {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
      </div>
    </div>
  );
}
