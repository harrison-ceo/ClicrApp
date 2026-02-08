'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Play, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

type VenueRow = { id: string; name: string }
type AreaRow = { id: string; name: string; venue_id: string; current_occupancy: number | null }
type DeviceRow = { id: string; area_id: string; name: string; flow_mode: string; current_count: number }

export default function ClicrListPage() {
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)

useEffect(() => {
  let cancelled = false;
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch Venues first (RLS handles the "which org" logic)
    const { data: venuesData, error: vError } = await supabase
      .from('venues')
      .select('id, name');

    if (cancelled || vError) return;
    setVenues((venuesData ?? []) as VenueRow[]);

    const venueIds = venuesData?.map((v) => v.id) || [];

    if (venueIds.length > 0) {

      const [aRes, dRes] = await Promise.all([
        supabase
          .from('areas')
          .select('id, name, venue_id, current_occupancy')
          .in('venue_id', venueIds),

        supabase
          .from('devices')
          .select('id, area_id, name, flow_mode, current_count')
      ]);

      if (cancelled) return;

      setAreas((aRes.data ?? []) as AreaRow[]);
      setDevices((dRes.data ?? []) as DeviceRow[]);
    } else {
      setAreas([]);
      setDevices([]);
    }

    setLoading(false);
  };

  fetchData();

  return () => {
    cancelled = true;
  };
}, []);

  const venuesWithContent = venues.map((venue) => {
    const venueAreas = areas.filter((a) => a.venue_id === venue.id)
    const areasWithDevices = venueAreas.map((area) => ({
      ...area,
      devices: devices.filter((d) => d.area_id === area.id),
    }))
    return { ...venue, areas: areasWithDevices }
  })

  if (loading) {
    return (
      <div className="p-8 text-white">Loading Clicrs…</div>
    )
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Clicrs</h1>
          <p className="text-slate-400">Select a device to start counting.</p>
        </div>
      </div>

      {venuesWithContent.map((venue) => (
        <div key={venue.id} className="space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-2">
            <h2 className="text-2xl font-bold text-primary">{venue.name}</h2>
          </div>

          {venue.areas.map((area) => (
            <div key={area.id} className="ml-0 md:ml-4">
              <div className="flex items-center gap-2 mb-4 text-slate-300">
                <Layers className="w-4 h-4 text-slate-500" />
                <h3 className="text-lg font-semibold">{area.name}</h3>
                <span className="text-xs text-slate-600 uppercase tracking-widest ml-2">Area</span>
              </div>

              {area.devices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {area.devices.map((device) => (
                    <ClicrCard
                      key={device.id}
                      device={device}
                      occupancy={area.current_occupancy ?? 0}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-slate-600 text-sm ml-6">
                  No devices in this area.
                </div>
              )}
            </div>
          ))}

          {venue.areas.length === 0 && (
            <div className="p-6 text-slate-500 italic">No areas defined for this venue.</div>
          )}
        </div>
      ))}

      {venuesWithContent.length === 0 && (
        <div className="p-8 text-center text-slate-500 rounded-2xl border border-dashed border-slate-800">
          No venues or devices yet. Add a venue and areas, then add devices from the venue Devices tab.
        </div>
      )}
    </div>
  )
}

function ClicrCard({ device, occupancy }: { device: DeviceRow; occupancy: number }) {
  const flowMode = device.flow_mode || 'BIDIRECTIONAL'
  let badgeClass = 'bg-blue-500/10 text-blue-400'
  if (flowMode === 'IN_ONLY') badgeClass = 'bg-emerald-500/10 text-emerald-400'
  else if (flowMode === 'OUT_ONLY') badgeClass = 'bg-amber-500/10 text-amber-400'

  return (
    <Link
      href={`/clicr/${device.id}`}
      className="block p-5 rounded-xl hover:bg-slate-800/80 transition-all group relative overflow-hidden border border-white/5 hover:border-primary/50 bg-slate-900/50"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Play className="w-20 h-20 text-primary" />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
            {device.name}
          </h3>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider', badgeClass)}>
            {flowMode.replaceAll('_', ' ')}
          </span>
        </div>

        <div className="flex items-end justify-between mt-4">
          <div className="text-3xl font-mono font-bold text-slate-200">
            {occupancy}
          </div>
          <div className="flex items-center gap-1 text-slate-500 group-hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  )
}
