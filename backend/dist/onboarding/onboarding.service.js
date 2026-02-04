"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let OnboardingService = class OnboardingService {
    constructor(supabase) {
        this.supabase = supabase;
    }
    async complete(params) {
        const sb = this.supabase.getClient();
        const { data: business, error: bizError } = await sb
            .from('businesses')
            .insert({ name: params.businessName })
            .select()
            .single();
        if (bizError)
            throw new Error(`Business Creation Failed: ${bizError.message}`);
        const { error: memberError } = await sb.from('business_members').insert({
            business_id: business.id,
            user_id: params.userId,
            role: 'OWNER',
            is_default: true,
        });
        if (memberError)
            throw new Error(`Membership Creation Failed: ${memberError.message}`);
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
        if (venueError)
            throw new Error(`Venue Creation Failed: ${venueError.message}`);
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
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map