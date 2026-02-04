import { OnboardingService } from './onboarding.service';
export declare class OnboardingController {
    private readonly onboardingService;
    constructor(onboardingService: OnboardingService);
    complete(body: {
        userId: string;
        userEmail: string;
        businessName: string;
        venueName: string;
        venueCapacity?: number;
        venueTimezone?: string;
    }): Promise<{
        success: boolean;
    }>;
}
