import { SyncService } from './sync.service';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    getState(userId: string | undefined, userEmail: string | undefined): Promise<import("./dto").SyncState>;
    postAction(userId: string | undefined, userEmail: string | undefined, body: {
        action: string;
        payload?: unknown;
        venue_id?: string;
    }): Promise<import("./dto").SyncState>;
}
