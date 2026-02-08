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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import VenueAreas from './_components/VenueAreas'
import VenueDevicesTab from './_components/VenueDevices'
import VenueOverviewTab from './_components/VenueOverview'
import VenueTeamTab from './_components/VenueTeam'
import VenueSettingsTab from './_components/VenueSettings'
import VenueLogsTab from './_components/VenueLogs'

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

type TabId = 'OVERVIEW' | 'AREAS' | 'DEVICES' | 'TEAM' | 'SETTINGS' | 'LOGS'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
  { id: 'AREAS', label: 'Areas', icon: Layers },
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
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to Dashboard
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
          href="/dashboard"
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
        {activeTab === 'AREAS' && <VenueAreas venueId={venueId} venueCapacity={venue.capacity} venueName={venue?.name} />}
        {activeTab === 'DEVICES' && <VenueDevicesTab venueId={venueId} />}
        {activeTab === 'TEAM' && <VenueTeamTab venueId={venueId} />}
        {activeTab === 'SETTINGS' && <VenueSettingsTab venue={venue} onRefresh={fetchVenue} />}
        {activeTab === 'LOGS' && <VenueLogsTab venueId={venueId} />}
      </div>
    </div>
  )
}
