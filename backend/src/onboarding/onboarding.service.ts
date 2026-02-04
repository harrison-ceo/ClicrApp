import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly supabase: SupabaseService) {}

  async complete(params: {
    userId: string;
    userEmail: string;
    businessName: string;
    venueName: string;
    venueCapacity: number;
    venueTimezone: string;
  }): Promise<void> {
    const sb = this.supabase.getClient();

    const { data: business, error: bizError } = await sb
      .from('businesses')
      .insert({ name: params.businessName })
      .select()
      .single();

    if (bizError) throw new Error(`Business Creation Failed: ${bizError.message}`);

    const { error: memberError } = await sb.from('business_members').insert({
      business_id: business.id,
      user_id: params.userId,
      role: 'OWNER',
      is_default: true,
    });

    if (memberError) throw new Error(`Membership Creation Failed: ${memberError.message}`);

    await sb
      .from('profiles')
      .upsert({
        id: params.userId,
        business_id: business.id,
        role: 'OWNER',
        email: params.userEmail,
        full_name: 'Admin User',
      });

    const { data: venue, error: venueError } = await sb
      .from('venues')
      .insert({
        business_id: business.id,
        name: params.venueName,
        total_capacity: params.venueCapacity,
        timezone: params.venueTimezone,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (venueError) throw new Error(`Venue Creation Failed: ${venueError.message}`);

    await sb.from('areas').insert({
      venue_id: venue.id,
      name: 'General Admission',
      capacity: params.venueCapacity,
    });

    await sb
      .from('businesses')
      .update({ settings: { onboarding_completed_at: new Date().toISOString() } })
      .eq('id', business.id);
  }
}
