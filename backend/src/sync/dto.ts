// DTOs / interfaces matching frontend types for sync API

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  assigned_venue_ids: string[];
  assigned_area_ids: string[];
  assigned_clicr_ids: string[];
}

export interface Business {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
}

export interface Venue {
  id: string;
  business_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  capacity?: number;
  timezone: string;
  status: string;
  capacity_enforcement_mode: string;
  created_at: string;
  updated_at: string;
  default_capacity_total?: number;
}

export interface Area {
  id: string;
  venue_id: string;
  name: string;
  default_capacity?: number;
  parent_area_id?: string | null;
  area_type: string;
  counting_mode: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_occupancy?: number;
}

export interface Clicr {
  id: string;
  area_id: string;
  name: string;
  default_capacity?: number;
  flow_mode: string;
  current_count: number;
  active: boolean;
  button_config?: Record<string, unknown>;
  command?: string;
}

export interface CountEvent {
  id: string;
  venue_id: string;
  area_id: string;
  clicr_id: string;
  user_id: string;
  business_id: string;
  timestamp: number;
  delta: number;
  flow_type: string;
  event_type: string;
}

export interface IDScanEvent {
  id: string;
  timestamp: number;
  venue_id: string;
  scan_result: string;
  age: number;
  sex: string;
  zip_code: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  id_number?: string;
  issuing_state?: string;
  city?: string;
  address_street?: string;
}

export interface SyncState {
  business: Business | null;
  venues: Venue[];
  areas: Area[];
  clicrs: Clicr[];
  events: CountEvent[];
  scanEvents: IDScanEvent[];
  users: User[];
  currentUser: User;
}
