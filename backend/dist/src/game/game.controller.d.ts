import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';
import { MatchmakingService } from './matchmaking.service';
import { GameService } from './game.service';
export declare class GameController {
    private readonly leaderboardService;
    private readonly matchmakingService;
    private readonly gameService;
    constructor(leaderboardService: LeaderboardService, matchmakingService: MatchmakingService, gameService: GameService);
    getLeaderboard(): Promise<LeaderboardEntry[]>;
    getActiveGame(req: {
        user: {
            userId: string;
        };
    }): Promise<{
        gameSessionId: string | null;
    }>;
    createSuggestion(req: {
        user: {
            userId: string;
        };
    }, body: {
        questionId: string;
        playerId?: string | null;
        guessText: string;
        comment?: string;
    }): Promise<{
        status: string;
        suggestion: {
            id: string;
            createdAt: Date;
            playerId: string | null;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            questionId: string;
            guessText: string;
            suggestedBy: string;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
        message?: undefined;
    } | {
        status: string;
        message: string;
    }>;
}
