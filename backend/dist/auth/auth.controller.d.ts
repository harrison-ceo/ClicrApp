import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    upsertProfile(body: {
        id: string;
        email: string;
        role?: string;
        full_name?: string;
    }): Promise<{
        success: boolean;
    }>;
}
