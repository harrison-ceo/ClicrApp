'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  LayoutDashboard,
  Layers,
  ShieldAlert,
  MonitorSmartphone,
  Settings,
  FileText,
  Users,
  RefreshCw,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Venue = {
  id: string
  name: string
  address: string | null
  capacity: number
  current_occupancy: number
  org_id: string | null
  owner_id: string | null
  created_at?: string
}

type TabId = 'OVERVIEW' | 'AREAS' | 'CAPACITY' | 'DEVICES' | 'TEAM' | 'SETTINGS' | 'LOGS'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
  { id: 'AREAS', label: 'Areas', icon: Layers },
  { id: 'CAPACITY', label: 'Capacity', icon: ShieldAlert },
  { id: 'DEVICES', label: 'Devices', icon: MonitorSmartphone },
  { id: 'TEAM', label: 'Team', icon: Users },
  { id: 'SETTINGS', label: 'Settings', icon: Settings },
  { id: 'LOGS', label: 'Logs', icon: FileText },
]

export default function VenueDetailPage() {
  const params = useParams()
  const venueId = params?.venueId as string
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('OVERVIEW')

  const fetchVenue = useCallback(async () => {
    if (!venueId) return
    const supabase = createClient()
    const { data, error: e } = await supabase
      .from('venues')
      .select('id, name, address, capacity, current_occupancy, org_id, owner_id, created_at')
      .eq('id', venueId)
      .single()
    if (e) {
      setError(e.message)
      setVenue(null)
    } else {
      setVenue(data as Venue)
      setError(null)
    }
    setLoading(false)
  }, [venueId])

  useEffect(() => {
    fetchVenue()
  }, [fetchVenue])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p>Loading venue…</p>
      </div>
    )
  }

  if (error || !venue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-4">
        <ShieldAlert className="w-12 h-12 text-slate-700" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Venue not found</h2>
          <p className="max-w-md mx-auto mb-4">
            We couldn&apos;t find this venue. It may have been deleted or you don&apos;t have access.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => fetchVenue()} className="text-primary hover:underline">
              Retry
            </button>
            <span className="text-slate-700">•</span>
            <Link href="/venues" className="text-primary hover:underline">
              Back to Venues
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/venues"
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{venue.name}</h1>
          <p className="text-sm text-slate-400">
            {venue.address ?? 'No address set'}
          </p>
        </div>
      </div>

      <div className="border-b border-slate-800 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap rounded-t-lg',
                isActive
                  ? 'border-primary bg-slate-800 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-current')} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'OVERVIEW' && (
          <VenueOverviewTab venueId={venueId} venue={venue} onRefresh={fetchVenue} />
        )}
        {activeTab === 'AREAS' && <VenueAreasPlaceholder />}
        {activeTab === 'CAPACITY' && <VenueCapacityTab venue={venue} onRefresh={fetchVenue} />}
        {activeTab === 'DEVICES' && <VenueDevicesPlaceholder />}
        {activeTab === 'TEAM' && <VenueTeamTab venueId={venueId} />}
        {activeTab === 'SETTINGS' && <VenueSettingsTab venue={venue} onRefresh={fetchVenue} />}
        {activeTab === 'LOGS' && <VenueLogsTab venueId={venueId} />}
      </div>
    </div>
  )
}

function VenueOverviewTab({
  venueId,
  venue,
  onRefresh,
}: {
  venueId: string
  venue: Venue
  onRefresh: () => void
}) {
  const [occupancy, setOccupancy] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const fetchOccupancy = () => {
      supabase
        .from('venues')
        .select('current_occupancy')
        .eq('id', venueId)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) setOccupancy(data.current_occupancy ?? 0)
          setLoading(false)
        })
    }
    fetchOccupancy()
    const interval = setInterval(fetchOccupancy, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [venueId])

  const current = occupancy ?? venue.current_occupancy ?? 0
  const cap = venue.capacity || 0
  const pct = cap > 0 ? (current / cap) * 100 : 0
  let barColor = 'bg-primary'
  if (pct > 90) barColor = 'bg-red-500'
  else if (pct > 75) barColor = 'bg-amber-500'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-500 mb-1">Live occupancy</div>
          {loading && occupancy === null ? (
            <div className="text-2xl font-bold font-mono text-slate-500">—</div>
          ) : (
            <div className="text-2xl font-bold font-mono text-white">
              {current}
              <span className="text-slate-500 text-sm font-sans ml-1">/ {cap > 0 ? cap : '∞'}</span>
            </div>
          )}
        </div>
      </div>
      {cap > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">Capacity usage</div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      )}
      {venue.address && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <MapPin className="w-4 h-4 shrink-0" />
          {venue.address}
        </div>
      )}
      <button
        type="button"
        onClick={onRefresh}
        className="text-sm text-primary hover:underline flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>
    </div>
  )
}

function VenueAreasPlaceholder() {
  return (
    <div className="py-12 text-center text-slate-500 max-w-md mx-auto">
      <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>Areas are not configured in the current schema. You can add an areas table later to define zones within a venue.</p>
    </div>
  )
}

function VenueCapacityTab({ venue, onRefresh }: { venue: Venue; onRefresh: () => void }) {
  const current = venue.current_occupancy ?? 0
  const cap = venue.capacity || 0
  const pct = cap > 0 ? (current / cap) * 100 : 0

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white">Capacity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Max capacity</div>
            <div className="text-xl font-mono text-white">{cap > 0 ? cap : 'Not set'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Current occupancy</div>
            <div className="text-xl font-mono text-white">{current}</div>
          </div>
        </div>
        {cap > 0 && (
          <div className="pt-2">
            <div className="text-xs text-slate-500 mb-2">Usage</div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  pct > 90 && 'bg-red-500',
                  pct > 75 && pct <= 90 && 'bg-amber-500',
                  pct <= 75 && 'bg-primary'
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <button type="button" onClick={onRefresh} className="text-sm text-primary hover:underline">
        Refresh
      </button>
    </div>
  )
}

function VenueDevicesPlaceholder() {
  return (
    <div className="py-12 text-center text-slate-500 max-w-md mx-auto">
      <MonitorSmartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>Devices (clickers) are not in the current schema. Add a devices table to manage hardware per venue.</p>
    </div>
  )
}

type StaffRow = { id: string; venue_id: string; user_id: string; role: string; profiles?: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null }

function VenueTeamTab({ venueId }: { venueId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('venue_staff')
      .select('id, venue_id, user_id, role, profiles(full_name, email)')
      .eq('venue_id', venueId)
      .then(({ data }) => {
        setStaff((data ?? []) as unknown as StaffRow[])
        setLoading(false)
      })
  }, [venueId])

  if (loading) return <p className="text-slate-500">Loading team…</p>
  if (staff.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 max-w-md mx-auto">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No team members assigned to this venue yet. Add staff via venue_staff or your invite flow.</p>
      </div>
    )
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
                  const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
                  return p?.full_name ?? p?.email ?? s.user_id
                })()}
              </div>
              {(() => {
                const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
                if (p?.email && p?.full_name) return <div className="text-sm text-slate-500">{p.email}</div>
                return null
              })()}
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">{s.role}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VenueSettingsTab({ venue, onRefresh }: { venue: Venue; onRefresh: () => void }) {
  const [name, setName] = useState(venue.name)
  const [address, setAddress] = useState(venue.address ?? '')
  const [capacity, setCapacity] = useState(venue.capacity ?? 0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setName(venue.name)
    setAddress(venue.address ?? '')
    setCapacity(venue.capacity ?? 0)
  }, [venue.id, venue.name, venue.address, venue.capacity])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('venues')
      .update({ name, address: address || null, capacity: Math.max(0, capacity) })
      .eq('id', venue.id)
    setSaving(false)
    if (error) {
      alert('Failed to save: ' + error.message)
    } else {
      onRefresh()
    }
  }

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
    </div>
  )
}

type LogRow = { id: string; venue_id: string; delta: number; source: string | null; created_at: string }

function VenueLogsTab({ venueId }: { venueId: string }) {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('occupancy_logs')
      .select('id, venue_id, delta, source, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs((data ?? []) as LogRow[])
        setLoading(false)
      })
  }, [venueId])

  if (loading) return <p className="text-slate-500">Loading logs…</p>
  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 max-w-md mx-auto">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No occupancy logs for this venue yet. Logs appear when traffic is recorded.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <h3 className="text-lg font-semibold text-white">Recent occupancy logs</h3>
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
        {logs.map((log) => (
          <li key={log.id} className="p-4 bg-slate-900/50 flex items-center justify-between text-sm">
            <span className={cn('font-mono', log.delta >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
              {log.delta >= 0 ? '+' : ''}{log.delta}
            </span>
            <span className="text-slate-500">{log.source ?? '—'}</span>
            <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
