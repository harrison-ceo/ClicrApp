import { Body, Controller, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Controller('api/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  async complete(
    @Body()
    body: {
      userId: string;
      userEmail: string;
      businessName: string;
      venueName: string;
      venueCapacity?: number;
      venueTimezone?: string;
    },
  ) {
    await this.onboardingService.complete({
      userId: body.userId,
      userEmail: body.userEmail,
      businessName: body.businessName,
      venueName: body.venueName,
      venueCapacity: body.venueCapacity ?? 500,
      venueTimezone: body.venueTimezone ?? 'UTC',
    });
    return { success: true };
  }
}
