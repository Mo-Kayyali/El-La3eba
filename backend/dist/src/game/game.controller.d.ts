import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';
export declare class GameController {
    private readonly leaderboardService;
    constructor(leaderboardService: LeaderboardService);
    getLeaderboard(): Promise<LeaderboardEntry[]>;
}
