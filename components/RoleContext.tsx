'use client'

import React, { createContext, useContext } from 'react'

export type AppRole = 'org_owner' | 'staff' | null

const RoleContext = createContext<AppRole>(null)

export function RoleProvider({
  role,
  children,
}: Readonly<{
  role: AppRole
  children: React.ReactNode
}>) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole(): AppRole {
  return useContext(RoleContext)
}

/** Staff cannot create venues; only view assigned venues/clickers. */
export function canCreateVenues(role: AppRole): boolean {
  return role === 'org_owner'
}
