import { AdminPlayersService, CreatePlayerDto, PatchPlayerDto } from './players.service';
export declare class AdminPlayersController {
    private readonly playersService;
    constructor(playersService: AdminPlayersService);
    create(createDto: CreatePlayerDto): Promise<{
        id: string;
        firstName: string;
        lastName: string;
        name: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        clubs: string[];
        competitions: string[];
    }>;
    findAll(competitionId?: string, compCountryCode?: string, clubId?: string, isRetired?: string, nationality?: string, search?: string, page?: string, limit?: string): Promise<{
        data: ({
            currentClub: {
                id: string;
                name: string;
                logoUrl: string | null;
            } | null;
        } & {
            id: string;
            firstName: string;
            lastName: string;
            name: string;
            aliases: string[];
            nationality: string;
            dateOfBirth: Date | null;
            heightCm: number | null;
            preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
            positions: import(".prisma/client").$Enums.Position[];
            primaryPosition: import(".prisma/client").$Enums.Position | null;
            isRetired: boolean;
            currentClubId: string | null;
            imageUrl: string | null;
            clubs: string[];
            competitions: string[];
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    search(q: string): Promise<{
        id: string;
        firstName: string;
        lastName: string;
        name: string;
        nationality: string;
        isRetired: boolean;
        currentClub: {
            name: string;
        } | null;
    }[]>;
    findOne(id: string): Promise<{
        currentClub: {
            id: string;
            name: string;
            aliases: string[];
            competitions: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
        } | null;
        playerClubs: ({
            club: {
                id: string;
                name: string;
                aliases: string[];
                competitions: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                logoUrl: string | null;
            };
        } & {
            id: string;
            startYear: number | null;
            isCurrent: boolean;
            playerId: string;
            clubId: string;
            endYear: number | null;
        })[];
    } & {
        id: string;
        firstName: string;
        lastName: string;
        name: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        clubs: string[];
        competitions: string[];
    }>;
    update(id: string, updateDto: PatchPlayerDto): Promise<{
        currentClub: {
            id: string;
            name: string;
            aliases: string[];
            competitions: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
        } | null;
        playerClubs: ({
            club: {
                id: string;
                name: string;
                aliases: string[];
                competitions: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                logoUrl: string | null;
            };
        } & {
            id: string;
            startYear: number | null;
            isCurrent: boolean;
            playerId: string;
            clubId: string;
            endYear: number | null;
        })[];
    } & {
        id: string;
        firstName: string;
        lastName: string;
        name: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        clubs: string[];
        competitions: string[];
    }>;
    remove(id: string): Promise<{
        id: string;
        firstName: string;
        lastName: string;
        name: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        clubs: string[];
        competitions: string[];
    }>;
}
