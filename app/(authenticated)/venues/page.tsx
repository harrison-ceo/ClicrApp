'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRole, canCreateVenues } from '@/components/RoleContext'
import { MapPin, Users, Plus, ArrowRight, Search } from 'lucide-react'
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
    <div className="group relative bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 transition-all hover:bg-slate-900/60 hover:shadow-xl overflow-hidden">
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
              {venue.name}
            </h3>
            {orgName && <p className="text-xs text-slate-500 mt-0.5">{orgName}</p>}
            {venue.address && (
              <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {venue.address}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Occupancy
            </div>
            {loading ? (
              <div className="text-2xl font-bold font-mono text-slate-500">—</div>
            ) : (
              <div className="text-2xl font-bold font-mono text-white">
                {current.toLocaleString()}
                <span className="text-xs text-slate-500 font-sans ml-1">
                  / {cap > 0 ? cap.toLocaleString() : '∞'}
                </span>
              </div>
            )}
            {cap > 0 && (
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <Link
          href={`/venues/${venue.id}`}
          className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 border-t border-slate-800 rounded-xl transition-colors group/btn"
        >
          <span className="text-sm font-medium text-slate-300 group-hover/btn:text-white">Manage Venue</span>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover/btn:text-white transition-transform group-hover/btn:translate-x-1" />
        </Link>
      </div>
    </div>
  )
}

export default function VenuesPage() {
  const role = useRole()
  const showAddVenue = canCreateVenues(role)
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: venueList, error: venueError } = await supabase
          .from('venues')
          .select('id, name, address, capacity, org_id, organizations(name)')
          .order('name')

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

  const filteredVenues = venues.filter((v) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    return (
      v.name.toLowerCase().includes(term) ||
      (v.address?.toLowerCase().includes(term) ?? false)
    )
  })

  let emptyMessage = 'No venues yet. Add your first venue to get started.'
  if (role === 'staff') emptyMessage = 'Venues assigned to you will appear here.'
  else if (searchTerm) emptyMessage = 'No venues match your search.'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-slate-400">Loading venues…</p>
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Venues
          </h1>
          <p className="text-slate-400 mt-1">
            {role === 'staff' ? 'Your assigned locations' : 'Manage your locations and capacity.'}
          </p>
        </div>
        {showAddVenue && (
          <Link
            href="/venues/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-lg hover:shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Add Venue
          </Link>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm text-white placeholder-slate-500"
        />
      </div>

      {filteredVenues.length === 0 ? (
        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500">
          <MapPin className="w-12 h-12 mb-4 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} orgName={orgName ?? undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
