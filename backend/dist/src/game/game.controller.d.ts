import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';
import { MatchmakingService } from './matchmaking.service';
export declare class GameController {
    private readonly leaderboardService;
    private readonly matchmakingService;
    constructor(leaderboardService: LeaderboardService, matchmakingService: MatchmakingService);
    getLeaderboard(): Promise<LeaderboardEntry[]>;
    getActiveGame(req: {
        user: {
            userId: string;
        };
    }): Promise<{
        gameSessionId: string | null;
    }>;
}
