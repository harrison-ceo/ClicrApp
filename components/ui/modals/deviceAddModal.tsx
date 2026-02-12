'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export type DeviceAddModalArea = { id: string; name?: string }

export type DeviceAddModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void | Promise<void>
  areaId?: string
  areas?: DeviceAddModalArea[]
  title?: string
}

export default function DeviceAddModal({
  open,
  onClose,
  onSuccess,
  areaId,
  areas = [],
  title = 'Add Device (Clicker)',
}: Readonly<DeviceAddModalProps>) {
  const [saving, setSaving] = useState(false)
  const [newDeviceAreaId, setNewDeviceAreaId] = useState('')
  const [newDeviceName, setNewDeviceName] = useState('')
  const [newDeviceEntranceType1, setNewDeviceEntranceType1] = useState<string>('')
  const [newDeviceEntranceType2, setNewDeviceEntranceType2] = useState<string>('')
  const [newDeviceFlow, setNewDeviceFlow] = useState<string>('BIDIRECTIONAL')
  const [error, setError] = useState<string | null>(null)

  const effectiveAreaId = areaId ?? newDeviceAreaId
  const showAreaSelect = areaId == null && areas.length > 0

  useEffect(() => {
    if (!open) return
    const reset = () => {
      setError(null)
      if (!areaId) setNewDeviceAreaId('')
      setNewDeviceName('')
      setNewDeviceFlow('BIDIRECTIONAL')
    }
    queueMicrotask(reset)
  }, [open, areaId])

  const handleSubmit = async (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!effectiveAreaId || !newDeviceName.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: insertErr } = await supabase.from('devices').insert({
      area_id: effectiveAreaId,
      name: newDeviceName.trim(),
      flow_mode: newDeviceFlow || 'BIDIRECTIONAL',
      current_count: 0,
      is_active: true,
    })
    setSaving(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    onClose()
    await onSuccess?.()
  }

  const handleBackdropClick = () => {
    if (!saving) onClose()
  }

  useEffect(() => {
    if (!open) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open, saving, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={handleBackdropClick}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-add-modal-title"
        className="relative z-10 bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
      >
        <h3 id="device-add-modal-title" className="text-lg font-bold text-white mb-4">
          {title}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {showAreaSelect && (
            <div>
              <label htmlFor="dev-area" className="block text-sm font-medium text-slate-400 mb-1">
                Area
              </label>
              <select
                id="dev-area"
                required
                value={newDeviceAreaId}
                onChange={(e) => setNewDeviceAreaId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="dev-name" className="block text-sm font-medium text-slate-400 mb-1">
              Name
            </label>
            <input
              id="dev-name"
              type="text"
              required
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="e.g. Door 1, Front Entrance"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label htmlFor="dev-flow" className="block text-sm font-medium text-slate-400 mb-1">
              Flow mode
            </label>
            <select
              id="dev-flow"
              value={newDeviceFlow}
              onChange={(e) => setNewDeviceFlow(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="BIDIRECTIONAL">Bidirectional (in + out)</option>
              <option value="IN_ONLY">In only</option>
              <option value="OUT_ONLY">Out only</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
            <label htmlFor="dev-entrance-type-1" className="block text-sm font-medium text-slate-400 mb-1">
                Entrance Type 1
            </label>
            <input
              type="text"
              id="dev-entrance-type-1"
              value={newDeviceEntranceType1}
              onChange={(e) => setNewDeviceEntranceType1(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            </div>
            <div>
            <label htmlFor="dev-entrance-type-2" className="block text-sm font-medium text-slate-400 mb-1">
                Entrance Type 2
            </label>
            <input
              type="text"
              id='dev-entrance-type-2'
              value={newDeviceEntranceType2}
              onChange={(e) => setNewDeviceEntranceType2(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
