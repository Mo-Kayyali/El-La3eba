import { AdminPlayersService, CreatePlayerDto, PatchPlayerDto } from './players.service';
export declare class AdminPlayersController {
    private readonly playersService;
    constructor(playersService: AdminPlayersService);
    create(createDto: CreatePlayerDto): Promise<{
        id: string;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        firstName: string;
        lastName: string;
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
    }>;
    findAll(competitionId?: string, compCountryCode?: string, clubId?: string, isRetired?: string, nationality?: string): Promise<({
        currentClub: {
            id: string;
            name: string;
            logoUrl: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        firstName: string;
        lastName: string;
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
    })[]>;
    search(q: string): Promise<{
        id: string;
        name: string;
        firstName: string;
        lastName: string;
        nationality: string;
        isRetired: boolean;
        currentClub: {
            name: string;
        } | null;
    }[]>;
    findOne(id: string): Promise<{
        playerClubs: ({
            club: {
                id: string;
                name: string;
                competitions: string[];
                aliases: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                logoUrl: string | null;
            };
        } & {
            id: string;
            playerId: string;
            clubId: string;
            startYear: number | null;
            endYear: number | null;
            isCurrent: boolean;
        })[];
        currentClub: {
            id: string;
            name: string;
            competitions: string[];
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        firstName: string;
        lastName: string;
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
    }>;
    update(id: string, updateDto: PatchPlayerDto): Promise<{
        playerClubs: ({
            club: {
                id: string;
                name: string;
                competitions: string[];
                aliases: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                logoUrl: string | null;
            };
        } & {
            id: string;
            playerId: string;
            clubId: string;
            startYear: number | null;
            endYear: number | null;
            isCurrent: boolean;
        })[];
        currentClub: {
            id: string;
            name: string;
            competitions: string[];
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        firstName: string;
        lastName: string;
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        firstName: string;
        lastName: string;
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
    }>;
}
