import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Area,
  Business,
  Clicr,
  CountEvent,
  IDScanEvent,
  SyncState,
  User,
  Venue,
} from './dto';

@Injectable()
export class SyncService {
  constructor(private readonly supabase: SupabaseService) {}

  async getState(userId?: string, userEmail?: string): Promise<SyncState> {
    const sb = this.supabase.getClient();

    const [
      { data: sbBusinesses },
      { data: sbVenues },
      { data: sbAreas },
      { data: sbProfiles },
    ] = await Promise.all([
      sb.from('businesses').select('*'),
      sb.from('venues').select('*'),
      sb.from('areas').select('*'),
      sb.from('profiles').select('*'),
    ]);

    let business: Business | null = null;
    if (sbBusinesses?.[0]) {
      const b = sbBusinesses[0] as Record<string, unknown>;
      business = {
        id: (b.id as string) ?? '',
        name: (b.name as string) ?? '',
        timezone: (b.timezone as string) ?? 'UTC',
        settings: (b.settings as Record<string, unknown>) ?? { refresh_interval_sec: 5, capacity_thresholds: [80, 90, 100], reset_rule: 'MANUAL' },
      };
    }

    const venues: Venue[] = (sbVenues ?? []).map((v: Record<string, unknown>) => ({
      id: v.id as string,
      business_id: v.business_id as string,
      name: v.name as string,
      address: v.address as string,
      city: 'City',
      state: 'State',
      zip: '00000',
      capacity: v.total_capacity as number,
      timezone: (v.timezone as string) ?? 'UTC',
      status: 'ACTIVE',
      capacity_enforcement_mode: 'WARN_ONLY',
      created_at: (v.created_at as string) ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      default_capacity_total: v.total_capacity as number,
    }));

    let areas: Area[] = (sbAreas ?? []).map((a: Record<string, unknown>) => ({
      id: a.id as string,
      venue_id: a.venue_id as string,
      name: a.name as string,
      default_capacity: a.capacity as number,
      parent_area_id: a.parent_area_id as string | null,
      area_type: 'MAIN',
      counting_mode: 'MANUAL',
      is_active: true,
      created_at: (a.created_at as string) ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const users: User[] = [];
    if (sbProfiles) {
      for (const p of sbProfiles as Record<string, unknown>[]) {
        const businessVenues = venues.filter((v) => v.business_id === p.business_id).map((v) => v.id);
        users.push({
          id: p.id as string,
          name: (p.full_name as string) ?? (p.email as string)?.split('@')[0] ?? 'User',
          email: (p.email as string) ?? '',
          role: (p.role as string) ?? 'OWNER',
          assigned_venue_ids: businessVenues,
          assigned_area_ids: [],
          assigned_clicr_ids: [],
        });
      }
    }

    const { data: snapshots } = await sb.from('occupancy_snapshots').select('*');
    if (snapshots?.length) {
      const missingAreas = areas.filter((a) => !snapshots.find((s: Record<string, unknown>) => s.area_id === a.id));
      for (const a of missingAreas) {
        const venue = venues.find((v) => v.id === a.venue_id);
        const bizId = venue?.business_id ?? 'biz_001';
        await sb.from('occupancy_snapshots').insert({
          business_id: bizId,
          venue_id: a.venue_id,
          area_id: a.id,
          current_occupancy: 0,
          updated_at: new Date().toISOString(),
        });
      }
      const { data: snapshotsAfter } = await sb.from('occupancy_snapshots').select('*');
      const snapList = snapshotsAfter ?? snapshots;
      areas = areas.map((a) => {
        const snap = snapList.find((s: Record<string, unknown>) => s.area_id === a.id);
        return { ...a, current_occupancy: (snap?.current_occupancy as number) ?? 0 };
      });
    }

    const { data: occEvents } = await sb
      .from('occupancy_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    const events: CountEvent[] = (occEvents ?? []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      venue_id: e.venue_id as string,
      area_id: (e.area_id as string) ?? '',
      clicr_id: (e.session_id as string) ?? '',
      user_id: 'system',
      business_id: e.business_id as string,
      timestamp: new Date(e.timestamp as string).getTime(),
      delta: e.delta as number,
      flow_type: e.flow_type as string,
      event_type: e.event_type as string,
    }));

    const { data: scans } = await sb
      .from('scan_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    const scanEvents: IDScanEvent[] = (scans ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      timestamp: new Date(s.timestamp as string).getTime(),
    })) as IDScanEvent[];

    const { data: devices } = await sb.from('devices').select('*').is('deleted_at', null);

    const clicrs: Clicr[] = [];
    if (devices?.length) {
      for (const d of devices as Record<string, unknown>[]) {
        if (d.device_type === 'COUNTER_ONLY') {
          clicrs.push({
            id: d.id as string,
            area_id: d.area_id as string,
            name: d.name as string,
            current_count: 0,
            flow_mode: 'BIDIRECTIONAL',
            active: true,
            button_config: (d.config as Record<string, unknown>)?.button_config as Record<string, unknown> ?? {
              left: { label: 'IN', delta: 1, color: 'green' },
              right: { label: 'OUT', delta: -1, color: 'red' },
            },
          });
        }
      }
      for (let i = 0; i < clicrs.length; i++) {
        const c = clicrs[i];
        const match = (devices as Record<string, unknown>[]).find((d) => d.id === c.id);
        if (match) {
          clicrs[i] = {
            ...c,
            name: match.name as string,
            button_config: (match.config as Record<string, unknown>)?.button_config as Record<string, unknown> ?? c.button_config,
          };
        }
      }
    }

    let currentUser: User | undefined = userId ? users.find((u) => u.id === userId) : undefined;
    if (userId && userEmail && !currentUser) {
      await sb.from('profiles').upsert({
        id: userId,
        email: userEmail,
        role: 'OWNER',
        full_name: userEmail.split('@')[0],
      });
      currentUser = {
        id: userId,
        name: userEmail.split('@')[0],
        email: userEmail,
        role: 'OWNER',
        assigned_venue_ids: [],
        assigned_area_ids: [],
        assigned_clicr_ids: [],
      };
      users.push(currentUser);
    }

    if (userId && currentUser) {
      const { data: profile } = await sb.from('profiles').select('business_id').eq('id', userId).single();
      if (profile?.business_id) {
        const { data: myBusiness } = await sb.from('businesses').select('*').eq('id', profile.business_id).single();
        if (myBusiness) {
          const b = myBusiness as Record<string, unknown>;
          business = {
            id: b.id as string,
            name: b.name as string,
            timezone: (b.timezone as string) ?? 'UTC',
            settings: (b.settings as Record<string, unknown>) ?? { refresh_interval_sec: 5, capacity_thresholds: [80, 90, 100], reset_rule: 'MANUAL' },
          };
        }
      }
    }

    const state: SyncState = {
      business,
      venues,
      areas,
      clicrs,
      events,
      scanEvents,
      users,
      currentUser: currentUser ?? users[0] ?? ({} as User),
    };

    if (userId && currentUser) {
      const visibleVenueIds = currentUser.assigned_venue_ids ?? [];
      state.venues = venues.filter((v) => visibleVenueIds.includes(v.id));
      state.areas = areas.filter((a) => visibleVenueIds.includes(a.venue_id));
      const visibleAreaIds = state.areas.map((a) => a.id);
      state.clicrs = clicrs.filter((c) => visibleAreaIds.includes(c.area_id));
      state.events = events.filter((e) => visibleVenueIds.includes(e.venue_id));
      state.scanEvents = scanEvents.filter((s) => visibleVenueIds.includes(s.venue_id));
      state.users = users.filter(
        (u) => u.id === currentUser!.id || (u.assigned_venue_ids ?? []).some((vid) => visibleVenueIds.includes(vid)),
      );
      state.currentUser = currentUser;
    }

    return state;
  }

  async postAction(
    action: string,
    payload: unknown,
    venueIdFromBody: string | undefined,
    userId?: string,
    userEmail?: string,
  ): Promise<SyncState> {
    const sb = this.supabase.getClient();

    switch (action) {
      case 'RECORD_EVENT': {
        const event = payload as CountEvent;
        let eventBizId = event.business_id;
        if (!eventBizId && userId) {
          const { data: p } = await sb.from('profiles').select('business_id').eq('id', userId).single();
          if (p) eventBizId = p.business_id;
        }
        const finalBizId = eventBizId ?? 'biz_001';
        const { error: rpcError } = await sb.rpc('process_occupancy_event', {
          p_business_id: finalBizId,
          p_venue_id: event.venue_id,
          p_area_id: event.area_id,
          p_device_id: event.clicr_id,
          p_user_id: userId ?? '00000000-0000-0000-0000-000000000000',
          p_delta: event.delta,
          p_flow_type: event.flow_type,
          p_event_type: event.event_type,
          p_session_id: event.clicr_id,
        });
        if (rpcError) {
          throw new HttpException(`Count Failed: ${rpcError.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        break;
      }

      case 'RECORD_SCAN': {
        const scan = payload as IDScanEvent;
        await sb.from('scan_events').insert({
          business_id: 'biz_001',
          venue_id: scan.venue_id,
          timestamp: new Date(scan.timestamp).toISOString(),
          scan_result: scan.scan_result,
          age: scan.age,
          gender: scan.sex,
          zip_code: scan.zip_code,
          first_name: scan.first_name,
          last_name: scan.last_name,
          dob: scan.dob,
          id_number: scan.id_number,
          issuing_state: scan.issuing_state,
          city: scan.city,
          address_street: scan.address_street,
        });
        break;
      }

      case 'RESET_COUNTS': {
        const resetPayload = (payload ?? {}) as { area_id?: string; venue_id?: string };
        const resetAreaId = resetPayload.area_id;
        const resetVenueId = venueIdFromBody ?? resetPayload.venue_id;
        const updateQuery = { current_occupancy: 0, updated_at: new Date().toISOString() };
        if (resetAreaId) {
          await sb.from('occupancy_snapshots').update(updateQuery).eq('area_id', resetAreaId);
          await sb.from('occupancy_events').insert({
            business_id: 'biz_001',
            venue_id: resetVenueId,
            area_id: resetAreaId,
            timestamp: new Date().toISOString(),
            flow_type: 'RESET',
            delta: 0,
            event_type: 'MANUAL_RESET',
          });
        } else if (resetVenueId) {
          await sb.from('occupancy_snapshots').update(updateQuery).eq('venue_id', resetVenueId);
        }
        break;
      }

      case 'DELETE_ACCOUNT': {
        const delPayload = payload as { id: string };
        if (delPayload?.id) {
          await sb.auth.admin.deleteUser(delPayload.id);
          await sb.from('profiles').delete().eq('id', delPayload.id);
        }
        break;
      }

      case 'ADD_CLICR': {
        const newClicr = payload as Clicr;
        let clicrBizId: string | null = null;
        if (userId) {
          const { data: p } = await sb.from('profiles').select('business_id').eq('id', userId).single();
          if (p) clicrBizId = p.business_id;
        }
        clicrBizId = clicrBizId ?? 'biz_001';
        const { error } = await sb.from('devices').insert({
          id: newClicr.id,
          business_id: clicrBizId,
          area_id: newClicr.area_id,
          name: newClicr.name,
          pairing_code: newClicr.command ?? null,
          device_type: 'COUNTER_ONLY',
          is_active: newClicr.active ?? true,
          config: { button_config: newClicr.button_config },
        });
        if (error) {
          throw new HttpException(`Database Insert Failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        break;
      }

      case 'UPDATE_VENUE': {
        const venue = payload as Venue;
        await sb
          .from('venues')
          .update({
            name: venue.name,
            total_capacity: venue.default_capacity_total,
            capacity_enforcement_mode: venue.capacity_enforcement_mode,
            status: venue.status,
          })
          .eq('id', venue.id);
        break;
      }

      case 'UPDATE_AREA': {
        const areaPayload = payload as Area;
        await sb
          .from('areas')
          .update({ name: areaPayload.name, capacity: areaPayload.default_capacity })
          .eq('id', areaPayload.id);
        break;
      }

      case 'DELETE_CLICR': {
        const delPayload = payload as { id: string };
        if (!delPayload?.id) {
          throw new HttpException('Missing device ID', HttpStatus.BAD_REQUEST);
        }
        const { error } = await sb
          .from('devices')
          .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
          .eq('id', delPayload.id)
          .select()
          .single();
        if (error) {
          const msg = error.code === '42501' ? 'Permission Denied' : error.message;
          throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        break;
      }

      default:
        throw new HttpException('Invalid action', HttpStatus.BAD_REQUEST);
    }

    return this.getState(userId, userEmail);
  }
}
