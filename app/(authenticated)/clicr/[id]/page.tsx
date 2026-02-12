'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, RotateCcw, Users } from 'lucide-react'

type DeviceRow = { id: string; area_id: string; name: string }
type AreaRow = {
  id: string
  name: string
  current_occupancy: number
  capacity?: number | null
  count_male?: number
  count_female?: number
}

export default function ClicrDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''
  const [device, setDevice] = useState<DeviceRow | null>(null)
  const [area, setArea] = useState<AreaRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    const supabase = createClient()
    const { data: dev, error: devErr } = await supabase
      .from('devices')
      .select('id, area_id, name')
      .eq('id', id)
      .single()
    if (devErr || !dev) {
      setError(devErr?.message ?? 'Device not found')
      setDevice(null)
      setArea(null)
      setLoading(false)
      return
    }
    setDevice(dev as DeviceRow)
    const { data: areaData, error: areaErr } = await supabase
      .from('areas')
      .select('id, name, count_male, count_female, capacity')
      .eq('id', (dev as DeviceRow).area_id)
      .single()
    if (areaErr || !areaData) {
      setError(areaErr?.message ?? 'Area not found')
      setArea(null)
      setLoading(false)
      return
    }
    const row = areaData as AreaRow
    setArea({
      ...row,
      count_male: row.count_male ?? 0,
      count_female: row.count_female ?? 0,
    })
    setError(null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (!id) {
      queueMicrotask(() => {
        setLoading(false)
        setError('Invalid device id')
      })
      return
    }
    queueMicrotask(() => {
      fetchData()
    })
  }, [id, fetchData])

  const updateAreaCount = useCallback(
    (kind: 'male' | 'female', delta: number) => {
      if (!area || !device) return
      const male = Math.max(0, (area.count_male ?? 0) + (kind === 'male' ? delta : 0))
      const female = Math.max(0, (area.count_female ?? 0) + (kind === 'female' ? delta : 0))
      // Update UI immediately so taps feel instant
      setArea((prev) =>
        prev
          ? {
              ...prev,
              count_male: male,
              count_female: female,
              current_occupancy: male + female,
            }
          : null
      )
      // Persist and audit in background via RPC (updates area + logs to occupancy_logs with device_id)
      const supabase = createClient()
      const areaId = area.id
      const deviceId = device.id
      ;(async () => {
        const { error: rpcError } = await supabase.rpc('update_area_occupancy', {
          p_area_id: areaId,
          p_device_id: deviceId,
          p_count_male: male,
          p_count_female: female,
        })
        if (rpcError) {
          setError(rpcError.message)
          fetchData()
        }
      })()
    },
    [area, device, fetchData]
  )

  const clearCount = useCallback(() => {
    if (!area || !device) return
    setArea((prev) =>
      prev
        ? {
            ...prev,
            count_male: 0,
            count_female: 0,
            current_occupancy: 0,
          }
        : null
    )
    const supabase = createClient()
    const areaId = area.id
    const deviceId = device.id
    ;(async () => {
      const { error: rpcError } = await supabase.rpc('update_area_occupancy', {
        p_area_id: areaId,
        p_device_id: deviceId,
        p_count_male: 0,
        p_count_female: 0,
      })
      if (rpcError) {
        setError(rpcError.message)
        fetchData()
      }
    })()
  }, [area, device, fetchData])
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (error || !device || !area) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-slate-500 gap-6 p-6">
        <h1 className="text-xl font-bold text-white">Unable to load clicker</h1>
        <p className="text-slate-400 text-center max-w-md">
          {error ?? 'This device may have been removed or you do not have access.'}
        </p>
        <Link href="/clicr" className="text-primary hover:underline font-medium">
          Back to Clicrs
        </Link>
      </div>
    )
  }

  const male = area.count_male ?? 0
  const female = area.count_female ?? 0
  const total = area.current_occupancy ?? male + female
  const capacity = area.capacity ?? 0

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col p-6">
      <div className="flex items-center gap-4">
        <Link
          href="/clicr"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Back to Clicrs"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Users className="w-5 h-5" />
            <h1 className="text-2xl font-semibold">{area.name}</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {device.name}
            {capacity > 0 ? ` • Capacity: ${capacity}` : ''}
          </p>
        </div>

        <div className="w-full max-w-md rounded-[32px] bg-gradient-to-b from-white/5 to-white/0 border border-white/10 p-8 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="text-xs tracking-[0.3em] text-slate-500 uppercase">Occupancy</div>
            <div className="text-7xl md:text-8xl font-mono font-bold tabular-nums text-white">
              {total}
            </div>
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="text-sm font-medium text-slate-300">Male</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-white">{male}</div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={male <= 0}
                onClick={() => updateAreaCount('male', -1)}
                className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-xl text-slate-200 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-[transform,colors] duration-75 touch-manipulation select-none"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => updateAreaCount('male', 1)}
                className="w-12 h-12 rounded-xl bg-white text-black text-xl font-semibold hover:bg-white/90 active:scale-[0.98] transition-[transform,colors] duration-75 touch-manipulation select-none"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="text-sm font-medium text-slate-300">Female</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-white">{female}</div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={female <= 0}
                onClick={() => updateAreaCount('female', -1)}
                className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-xl text-slate-200 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-[transform,colors] duration-75 touch-manipulation select-none"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => updateAreaCount('female', 1)}
                className="w-12 h-12 rounded-xl bg-white text-black text-xl font-semibold hover:bg-white/90 active:scale-[0.98] transition-[transform,colors] duration-75 touch-manipulation select-none"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={clearCount}
          disabled={total === 0}
          className="w-full max-w-md flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-[transform,colors] duration-75 touch-manipulation select-none"
        >
          <RotateCcw className="w-4 h-4" />
          Clear count
        </button>
      </div>
    </div>
  )
}
