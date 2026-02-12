'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, MonitorSmartphone, LogIn, LogOut, ChevronDown, ChevronRight } from 'lucide-react'
import { useRole } from '@/components/RoleContext'
import DeviceAddModal from '@/components/ui/modals/deviceAddModal'

type AreaRow = { id: string; name: string; venue_id: string }
type DeviceRow = { id: string; area_id: string; name: string; flow_mode: string; current_count: number; is_active: boolean }

export default function VenueDevicesTab({ venueId }: { venueId: string }) {
  const role = useRole()
  const isStaff = role === 'staff'
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    if (!venueId) return
    const supabase = createClient()
    const { data: areasData, error: areasErr } = await supabase
      .from('areas')
      .select('id, name, venue_id')
      .eq('venue_id', venueId)
    if (areasErr) {
      setError(areasErr.message)
      setLoading(false)
      return
    }
    const areaList = (areasData ?? []) as AreaRow[]
    setAreas(areaList)
    if (areaList.length === 0) {
      setDevices([])
      setLoading(false)
      return
    }
    const areaIds = areaList.map((a) => a.id)
    const { data: devicesData, error: devicesErr } = await supabase
      .from('devices')
      .select('id, area_id, name, flow_mode, current_count, is_active')
      .in('area_id', areaIds)
    setError(devicesErr?.message ?? null)
    setDevices((devicesData ?? []) as DeviceRow[])
    setLoading(false)
  }, [venueId])

  useEffect(() => {
    let cancelled = false
    if (!venueId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    ;(async () => {
      const { data: areasData, error: areasErr } = await supabase
        .from('areas')
        .select('id, name, venue_id')
        .eq('venue_id', venueId)
      if (cancelled) return
      if (areasErr) {
        setError(areasErr.message)
        setAreas([])
        setDevices([])
        setLoading(false)
        return
      }
      const areaList = (areasData ?? []) as AreaRow[]
      setAreas(areaList)
      if (areaList.length === 0) {
        setDevices([])
        setLoading(false)
        return
      }
      const areaIds = areaList.map((a) => a.id)
      const { data: devicesData, error: devicesErr } = await supabase
        .from('devices')
        .select('id, area_id, name, flow_mode, current_count, is_active')
        .in('area_id', areaIds)
      if (cancelled) return
      setError(devicesErr?.message ?? null)
      setDevices((devicesData ?? []) as DeviceRow[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [venueId])

  const handleLog = async (deviceId: string, delta: number) => {
    const dev = devices.find((d) => d.id === deviceId)
    if (!dev) return
    const newCount = Math.max(0, dev.current_count + delta)
    setLoggingId(deviceId)
    const supabase = createClient()
    await supabase.from('devices').update({ current_count: newCount, updated_at: new Date().toISOString() }).eq('id', deviceId)
    setLoggingId(null)
    await fetchData()
  }

  const toggleArea = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  const devicesByArea = areas.map((area) => ({
    area,
    devices: devices.filter((d) => d.area_id === area.id),
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Devices (Clickers)</h2>
        {!isStaff && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {(() => {
        if (loading) {
          return <div className="p-8 text-center text-slate-500">Loading devices…</div>
        }
        if (devicesByArea.length === 0) {
          return (
            <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
              <p className="text-slate-500">No areas yet. Add areas first, then add devices to log occupancy.</p>
            </div>
          )
        }
        return (
        <div className="space-y-2">
          {devicesByArea.map(({ area, devices: areaDevices }) => {
            const isExpanded = expandedAreas.has(area.id) || areaDevices.length === 0
            const showChevron = areaDevices.length > 0
            const ChevronIcon = isExpanded ? ChevronDown : ChevronRight
            return (
              <div key={area.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleArea(area.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                  {showChevron ? <ChevronIcon className="w-4 h-4 text-slate-500" /> : null}
                  <span className="font-medium text-white">{area.name}</span>
                  <span className="text-slate-500 text-sm">({areaDevices.length} device{areaDevices.length !== 1 ? 's' : ''})</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-800 p-4 space-y-3">
                    {areaDevices.length === 0 ? (
                      <p className="text-slate-500 text-sm">No devices. Add one to log occupancy.</p>
                    ) : (
                      areaDevices.map((dev) => (
                        <div
                          key={dev.id}
                          className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800"
                        >
                          <MonitorSmartphone className="w-5 h-5 text-slate-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white">{dev.name}</div>
                            <div className="text-xs text-slate-500">{dev.flow_mode.replace(/_/g, ' ')}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-mono font-bold text-white tabular-nums w-10 text-center">
                              {dev.current_count}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={loggingId === dev.id}
                                onClick={() => handleLog(dev.id, 1)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-primary/20 text-slate-400 hover:text-primary disabled:opacity-50 transition-colors"
                                title="Count in"
                              >
                                <LogIn className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={loggingId === dev.id}
                                onClick={() => handleLog(dev.id, -1)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 disabled:opacity-50 transition-colors"
                                title="Count out"
                              >
                                <LogOut className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )
      })()}

      {!isStaff && (
        <DeviceAddModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSuccess={fetchData}
          areas={areas}
        />
      )}
    </div>
  )
}
