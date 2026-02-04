import { LogErrorService } from './log-error.service';
export declare class LogErrorController {
    private readonly logErrorService;
    constructor(logErrorService: LogErrorService);
    log(userId: string | undefined, body: {
        message: string;
        context?: string;
        payload?: unknown;
    }): Promise<{
        success: boolean;
    }>;
}
