export type Role = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'USER';

export type BanScope = 'BUSINESS' | 'VENUE';
export type BanStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type BanRecord = {
    id: string;
    org_id: string; // usually business_id
    user_id: string;
    scope_type: BanScope;
    scope_venue_ids: string[]; // empty if business ban
    status: BanStatus;

    starts_at: string; // ISO String
    ends_at: string | null; // null for permanent

    reason_category: string;
    reason_text: string;
    internal_notes?: string;
    evidence_url?: string;

    notify_user: boolean;
    notify_message?: string;

    created_by_user_id: string;
    created_at: number;

    revoked_by_user_id?: string;
    revoked_at?: number;
    revoked_reason?: string;
};

export type User = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: Role;
    assigned_venue_ids: string[];
    assigned_area_ids: string[];
    assigned_clicr_ids: string[];

    // Derived/UI fields for Ban status
    ban_state?: 'none' | 'business_banned' | 'venue_banned';
    banned_venue_count?: number;
    active_ban_id?: string;
};

export type Business = {
    id: string;
    name: string;
    timezone: string;
    settings: {
        refresh_interval_sec: number;
        capacity_thresholds: [number, number, number]; // e.g. [80, 90, 100]
        reset_rule: 'MANUAL' | 'SCHEDULED';
    };
};

export type VenueStatus = 'ACTIVE' | 'INACTIVE';
export type CapacityEnforcementMode = 'WARN_ONLY' | 'HARD_STOP' | 'MANAGER_OVERRIDE';

export type Venue = {
    id: string;
    business_id: string;
    name: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string; // default "US"
    timezone: string;
    status: VenueStatus;
    default_capacity_total?: number | null;
    capacity_enforcement_mode: CapacityEnforcementMode;
    created_at: string;
    updated_at: string;

    // Legacy/Backwards Compat (if needed, or map to new fields)
    active?: boolean; // map to status === 'ACTIVE'
};

export type AreaType = 'ENTRY' | 'MAIN' | 'PATIO' | 'VIP' | 'BAR' | 'EVENT_SPACE' | 'OTHER';
export type CountingMode = 'MANUAL' | 'AUTO_FROM_SCANS' | 'BOTH';

export type Area = {
    id: string;
    venue_id: string;
    name: string;
    area_type: AreaType;
    default_capacity?: number | null;
    counting_mode: CountingMode;
    is_active: boolean; // default true
    sort_order?: number;
    created_at: string;
    updated_at: string;

    // Legacy fields
    capacity_limit?: number; // map to default_capacity
    active?: boolean; // map to is_active
    current_occupancy?: number; // Server-side calculated true occupancy
};

export type FlowMode = 'IN_ONLY' | 'OUT_ONLY' | 'BIDIRECTIONAL';

// Legacy Clicr type - plan to migrate to Device
export type Clicr = {
    id: string;
    area_id: string;
    name: string;
    flow_mode: FlowMode;
    current_count: number; // Cached value
    active: boolean;
    button_config?: {
        label_a: string; // Defaults to "MALE"
        label_b: string; // Defaults to "FEMALE"
    };
    command?: string; // Hardware mapping/pairing code
};

export type DeviceType = 'COUNTER' | 'SCANNER' | 'COMBO';
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'LOST' | 'MAINTENANCE';

export type Device = {
    id: string;
    business_id: string;
    venue_id?: string | null;
    area_id?: string | null;
    device_type: DeviceType;
    device_name: string;
    serial_number: string;
    status: DeviceStatus;
    last_seen_at?: string | null;
    firmware_version?: string;
    created_at: string;
    updated_at: string;
};

export type CapacityOverride = {
    id: string;
    venue_id: string;
    area_id?: string | null; // if null, applies to whole venue
    start_datetime: string;
    end_datetime: string;
    capacity_value: number;
    reason?: string;
    created_by_user_id: string;
    created_at: string;
};

export type VenueAuditLogAction = 'VENUE_CREATED' | 'VENUE_UPDATED' | 'AREA_CREATED' | 'AREA_UPDATED' | 'CAPACITY_OVERRIDE_CREATED' | 'DEVICE_ASSIGNED' | 'DEVICE_UNASSIGNED' | 'RULES_UPDATED';

export type VenueAuditLog = {
    id: string;
    venue_id: string;
    action: VenueAuditLogAction;
    performed_by_user_id: string;
    timestamp: string;
    details_json: any;
};

export type CountEvent = {
    id: string;
    venue_id: string;
    area_id: string;
    clicr_id: string;
    user_id: string;
    business_id: string;
    timestamp: number;
    delta: number; // +1 or -1 (or more for bulk)
    flow_type: 'IN' | 'OUT';
    gender?: 'M' | 'F'; // Added for gender tracking
    event_type: 'TAP' | 'SCAN' | 'BULK' | 'RESET';
    idempotency_key?: string;
};

export type IDScanEvent = {
    id: string;
    timestamp: number;
    venue_id: string;
    scan_result: 'ACCEPTED' | 'DENIED' | 'PENDING';
    age: number;
    age_band: string;
    sex: string;
    zip_code: string;

    // PII for Guest Directory
    first_name?: string;
    last_name?: string;
    dob?: string; // YYYYMMDD or ISO
    id_number_last4?: string;
    issuing_state?: string;
    id_type?: string;

    // Advanced Demographics
    address_street?: string;
    city?: string;
    state?: string;
    eye_color?: string;
    hair_color?: string;
    height?: string;
    weight?: string;
    id_number?: string;
};

// --- PATRON BANNING SYSTEM TYPES ---

export type AuditAction = 'CREATED' | 'UPDATED' | 'EXTENDED' | 'EXPIRED' | 'REMOVED' | 'REINSTATED';

export type BannedPerson = {
    id: string; // uuid
    first_name: string;
    last_name: string;
    date_of_birth?: string; // ISO date string YYYY-MM-DD
    id_type: 'DRIVERS_LICENSE' | 'PASSPORT' | 'OTHER';
    id_number_full?: string; // Encrypted ideally, but we'll mock it
    id_number_last4?: string;
    issuing_state_or_country: string;
    aliases?: string[];
    notes_private?: string;
    created_at: string;
    updated_at: string;
};

export type PatronBan = {
    id: string; // uuid
    banned_person_id: string;
    business_id: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REMOVED';
    ban_type: 'TEMPORARY' | 'PERMANENT';
    start_datetime: string;
    end_datetime?: string | null;
    reason_category: 'VIOLENCE_THREATS' | 'HARASSMENT' | 'THEFT' | 'FAKE_ID_FRAUD' | 'DRUGS' | 'POLICY_VIOLATION' | 'OTHER';
    reason_notes?: string;
    incident_report_number?: string;
    created_by_user_id: string;
    removed_by_user_id?: string;
    removed_reason?: string;
    applies_to_all_locations: boolean;
    location_ids: string[]; // Logic: if applies_to_all_locations is true, this might be ignored or used as cache
    created_at: string;
    updated_at: string;
};

export type BanAuditLog = {
    id: string;
    ban_id: string;
    action: AuditAction;
    performed_by_user_id: string;
    timestamp: string;
    details_json: any;
};

export type BanEnforcementEvent = {
    id: string;
    ban_id: string;
    location_id: string;
    device_id?: string;
    scanner_user_id: string;
    scan_datetime: string;
    result: 'BLOCKED' | 'WARNED' | 'ALLOWED_OVERRIDE';
    override_reason?: string;
    notes?: string;
    // Snapshot of person details for the record
    person_snapshot_name?: string;
};

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SupportMessage = {
    id: string;
    ticket_id: string;
    sender_id: string; // User ID or 'SYSTEM' or 'SUPPORT_AGENT'
    message_text: string;
    timestamp: string;
    is_internal: boolean; // If true, only visible to support staff
};

export type SupportTicket = {
    id: string;
    business_id: string;
    user_id: string; // Creator
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'OTHER';
    created_at: string;
    updated_at: string;
    messages: SupportMessage[];
};
