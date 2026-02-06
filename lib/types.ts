export type Venue = {
  id: string
  name: string
  business_id?: string
  city?: string
  state?: string
  status?: string
  default_capacity_total?: number
  [key: string]: unknown
}
export type Area = { id: string; name?: string; venue_id?: string; current_occupancy?: number; [key: string]: unknown }
export type Clicr = { id: string; name?: string; area_id?: string; active?: boolean; [key: string]: unknown }
export type Device = { id: string; name?: string; venue_id?: string; area_id?: string; status?: string; [key: string]: unknown }
export type CountEvent = { id?: string; [key: string]: unknown }
export type IDScanEvent = { id?: string; [key: string]: unknown }
export type User = { id?: string; role?: string; [key: string]: unknown }
export type Role = string
export type BanRecord = { id?: string; [key: string]: unknown }
export type BanEnforcementEvent = { [key: string]: unknown }
export type SupportTicket = { id?: string; [key: string]: unknown }
export type CapacityOverride = { [key: string]: unknown }
export type AreaType = string
export type CountingMode = string
export type FlowMode = string
export type BanScope = string
export type ParsedID = { age?: number; [key: string]: unknown }
