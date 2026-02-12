'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, MapPin, ArrowRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type VenueRow = {
  id: string
  name: string
  address: string | null
  capacity: number
  org_id: string | null
  organizations?: { name: string }[] | { name: string } | null
}

type OccupancyState = { current_occupancy: number } | null

function VenueCard({ venue, orgName: orgNameProp }: { venue: VenueRow; orgName?: string }) {
  const orgName = orgNameProp ?? (Array.isArray(venue.organizations) ? venue.organizations[0]?.name : venue.organizations?.name)
  const [occupancy, setOccupancy] = useState<OccupancyState>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const fetchOccupancy = () => {
      supabase
        .from('venues')
        .select('current_occupancy')
        .eq('id', venue.id)
        .single()
        .then(({ data, error }) => {
          if (cancelled) return
          if (!error && data) setOccupancy({ current_occupancy: data.current_occupancy ?? 0 })
          setLoading(false)
        })
    }

    fetchOccupancy()
    const interval = setInterval(fetchOccupancy, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [venue.id])

  const current = occupancy?.current_occupancy ?? 0
  const cap = venue.capacity || 0
  const pct = cap > 0 ? (current / cap) * 100 : 0
  let barColor = 'bg-primary'
  if (pct > 90) barColor = 'bg-red-500'
  else if (pct > 75) barColor = 'bg-amber-500'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-800 rounded-xl">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{venue.name}</h3>
            {orgName && (
              <p className="text-xs text-slate-500 mt-0.5">{orgName}</p>
            )}
            {venue.address && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {venue.address}
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/venues/${venue.id}`}
          className="text-xs font-bold text-white bg-primary px-4 py-2 rounded-full hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all flex items-center gap-2 group"
        >
          Manage
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

        <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-500 mb-1">Live occupancy</div>
          {loading ? (
            <div className="text-xl font-bold font-mono text-slate-500">—</div>
          ) : (
            <div className="text-xl font-bold font-mono text-white">
              {current}
              <span className="text-slate-500 text-sm font-sans ml-1">/ {cap > 0 ? cap : '∞'}</span>
            </div>
          )}
        </div>
        {cap > 0 && (
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: venueList, error: venueError } = await supabase
          .from('venues')
          .select('id, name, address, capacity, org_id, organizations(name)')
          .order('current_occupancy', { ascending: false })

        if (venueError) throw venueError
        const rows = (venueList ?? []) as VenueRow[]
        setVenues(rows)
        const first = rows[0]
        const firstOrg = first?.organizations
        const name = Array.isArray(firstOrg) ? firstOrg[0]?.name : firstOrg?.name
        if (name) setOrgName(name)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load venues')
        setVenues([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-slate-400">Loading dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-6 text-red-200">
        <p className="font-medium">Could not load venues</p>
        <p className="text-sm text-red-300/80 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            {orgName ? (
              <>Overview for <span className="text-primary font-semibold">{orgName}</span></>
            ) : (
              'Venue overview'
            )}
          </p>
        </div>
        <Link
            href="/venues/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl"
          >
            Add venue
            <Plus className="w-4 h-4" />
          </Link>
      </div>

      {venues.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No venues yet</h2>
          <p className="text-slate-400 text-sm mb-6">
            Add your first venue to see live occupancy here.
          </p>
          <Link
            href="/venues/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl"
          >
            Add venue
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} orgName={orgName ?? undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
