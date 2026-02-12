'use client'

import React, { createContext, useContext } from 'react'

type AppState = {
  currentUser: { role?: string } | null
  business: unknown
  venues: unknown[]
  areas: unknown[]
  clicrs: unknown[]
  devices: unknown[]
  events: unknown[]
  scanEvents: unknown[]
  isLoading: boolean
  traffic: unknown
  deviceLayouts: unknown
  areaTraffic: unknown
  venueAuditLogs: unknown[]
  capacityOverrides: unknown[]
  bans: unknown[]
  users: unknown[]
  patrons: unknown[]
  patronBans: unknown[]
  resetCounts: () => void
  addVenue: (...args: unknown[]) => void
  addArea: (...args: unknown[]) => void
  addClicr: (...args: unknown[]) => void
  updateBusiness: (...args: unknown[]) => void
  updateVenue: (...args: unknown[]) => void
  updateArea: (...args: unknown[]) => void
  updateClicr: (...args: unknown[]) => void
  recordEvent: (...args: unknown[]) => void
  recordScan: (...args: unknown[]) => void
  upsertDeviceLayout: (...args: unknown[]) => void
  addDevice: (...args: unknown[]) => void
  updateDevice: (...args: unknown[]) => void
  addCapacityOverride: (...args: unknown[]) => void
  addUser: (...args: unknown[]) => void
  updateUser: (...args: unknown[]) => void
  removeUser: (...args: unknown[]) => void
  addBan: (...args: unknown[]) => void
  revokeBan: (...args: unknown[]) => void
  refreshTrafficStats: () => void
  recordTurnaround?: (...args: unknown[]) => void
  renameDevice?: (...args: unknown[]) => void
  debug?: unknown
  turnarounds?: unknown[]
}

const noop = () => {}
const noop1 = (_: unknown) => {}

const defaultState: AppState = {
  currentUser: null,
  business: null,
  venues: [],
  areas: [],
  clicrs: [],
  devices: [],
  events: [],
  scanEvents: [],
  isLoading: false,
  traffic: { total_in: 0, total_out: 0 },
  deviceLayouts: null,
  areaTraffic: null,
  venueAuditLogs: [],
  capacityOverrides: [],
  bans: [],
  users: [],
  patrons: [],
  patronBans: [],
  resetCounts: noop,
  addVenue: noop1,
  addArea: noop1,
  addClicr: noop1,
  updateBusiness: noop1,
  updateVenue: noop1,
  updateArea: noop1,
  updateClicr: noop1,
  recordEvent: noop1,
  recordScan: noop1,
  upsertDeviceLayout: noop1,
  addDevice: noop1,
  updateDevice: noop1,
  addCapacityOverride: noop1,
  addUser: noop1,
  updateUser: noop1,
  removeUser: noop1,
  addBan: noop1,
  revokeBan: noop1,
  refreshTrafficStats: noop,
  recordTurnaround: noop1,
  renameDevice: noop1,
  debug: null,
  turnarounds: [],
}

const AppContext = createContext<AppState>(defaultState)

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={defaultState}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppState {
  return useContext(AppContext)
}
