'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'
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
  Copy,
  Check,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import VenueAreas from './_components/VenueAreas'
import VenueDevicesTab from './_components/VenueDevicesTab'

type Venue = {
  id: string
  name: string
  address: string | null
  capacity: number
  current_occupancy: number
  current_male_count?: number | null
  current_female_count?: number | null
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

const TAB_IDS = new Set<TabId>(TABS.map((t) => t.id))

function tabFromSearchParams(searchParams: URLSearchParams): TabId {
  const t = searchParams.get('tab') as TabId | null
  return t && TAB_IDS.has(t) ? t : 'OVERVIEW'
}

export default function VenueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const venueId = params?.venueId as string
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeTab = tabFromSearchParams(searchParams)

  const fetchVenue = useCallback(async () => {
    if (!venueId) return
    const supabase = createClient()
    const { data, error: e } = await supabase
      .from('venues')
      .select('id, name, address, capacity, current_occupancy, current_male_count, current_female_count, org_id, owner_id, created_at')
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
    queueMicrotask(() => {
      fetchVenue()
    })
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
              type="button"
              onClick={() => router.replace(`${pathname}?tab=${tab.id}`)}
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
        {activeTab === 'AREAS' && <VenueAreas venueId={venueId} venueCapacity={venue.capacity} />}
        {activeTab === 'CAPACITY' && <VenueCapacityTab venue={venue} onRefresh={fetchVenue} />}
        {activeTab === 'DEVICES' && <VenueDevicesTab venueId={venueId} />}
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
  const [logs, setLogs] = useState<LogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

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

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('occupancy_logs')
      .select('id, venue_id, delta, source, created_at, gender')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load occupancy_logs', error)
        }
        console.log(JSON.stringify(data, null, 2))
        if (cancelled) return
        setLogs((data ?? []) as LogRow[])
        setLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [venueId])

  const current = occupancy ?? venue.current_occupancy ?? 0
  const cap = venue.capacity || 0
  const pct = cap > 0 ? (current / cap) * 100 : 0
  let barColor = 'bg-primary'
  if (pct > 90) barColor = 'bg-red-500'
  else if (pct > 75) barColor = 'bg-amber-500'

  const mockTotalEntries = 160
  const mockScansProcessed = 164
  const mockBannedHits = 1

  const ageBuckets = [
    { label: '18-20', value: 12 },
    { label: '21-25', value: 45 },
    { label: '26-30', value: 32 },
    { label: '31-40', value: 18 },
    { label: '40+', value: 8 },
  ]
  const maxAge = Math.max(...ageBuckets.map((b) => b.value))

  const maleCount = venue.current_male_count ?? 0
  const femaleCount = venue.current_female_count ?? 0
  const genderTotal = maleCount + femaleCount
  const malePct = genderTotal > 0 ? Math.round((maleCount / genderTotal) * 100) : 0
  const femalePct = genderTotal > 0 ? Math.round((femaleCount / genderTotal) * 100) : 0


  const liveLogContent = () => {
    if (logsLoading) return <div className="text-sm text-slate-500">Loading events…</div>
    if (logs.length === 0) return <div className="text-sm text-slate-500">No recent events.</div>
    return logs.map((log) => {
      const type = log.delta >= 0 ? 'ENTRY' : 'EXIT'
      const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return (
        <div key={log.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className={cn('text-xs font-semibold', log.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {type}
          </div>
          <div className="text-xs text-slate-500 mt-1">{time}</div>
        </div>
      )
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-widest">Live Occupancy</div>
          {loading && occupancy === null ? (
            <div className="text-3xl font-bold text-slate-500 mt-2">—</div>
          ) : (
            <div className="text-3xl font-bold text-white mt-2">{current}</div>
          )}
          {/* <div className="text-xs text-slate-500 mt-1">Peak: {cap > 0 ? cap : '—'}</div> */}
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

      <div className="flex items-center gap-3 text-sm text-slate-500">
        {cap > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span>{Math.round(pct)}%</span>
          </div>
        )}
        {venue.address && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            {venue.address}
          </div>
        )}
        <button type="button" onClick={onRefresh} className="text-primary hover:underline flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
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
  const [inviteLink, setInviteLink] = useState('')
  const [inviteRole, setInviteRole] = useState<'staff' | 'venue_owner'>('staff')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
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
                setInviteLoading(true)
                setInviteError('')
                const supabase = createClient()
                const { data: authData, error: authError } = await supabase.auth.getUser()
                if (authError || !authData?.user) throw new Error('Not authenticated')
                if (!venue.org_id) throw new Error('Organization not found')

                const code = crypto.randomUUID()
                const { error } = await supabase.from('venue_invites').insert({
                  org_id: venue.org_id,
                  venue_id: venue.id,
                  code,
                  role: inviteRole,
                  created_by: authData.user.id,
                })
                if (error) throw new Error(error.message)

                const baseUrl =
                  process.env.NEXT_PUBLIC_APP_URL ||
                  (typeof globalThis !== 'undefined' && 'location' in globalThis
                    ? (globalThis as { location: Location }).location.origin
                    : 'http://localhost:3000')
                setInviteLink(`${baseUrl}/onboarding?code=${code}`)
              } catch (err) {
                setInviteError((err as Error).message || 'Failed to create invite link')
              } finally {
                setInviteLoading(false)
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
                    setInviteCopied(true)
                    setTimeout(() => setInviteCopied(false), 1500)
                  })
                  .catch(() => {
                    setInviteError('Copy failed. Please select and copy the link.')
                  })
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
  )
}

type LogRow = { id: string; venue_id: string; delta: number; source: string | null; created_at: string; gender?: string | null }

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
