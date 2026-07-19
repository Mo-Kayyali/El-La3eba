import { AdminPlayersService, CreatePlayerDto, PatchPlayerDto } from './players.service';
export declare class AdminPlayersController {
    private readonly playersService;
    constructor(playersService: AdminPlayersService);
    create(createDto: CreatePlayerDto, req: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        firstName: string;
        lastName: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positionCategories: import(".prisma/client").$Enums.PositionCategory[];
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        createdBy: string | null;
    }>;
    findAll(competitionId?: string, compCountryCode?: string, clubId?: string, isRetired?: string, nationality?: string, search?: string, page?: string, limit?: string, sort?: string, order?: string): Promise<{
        data: ({
            currentClub: {
                id: string;
                name: string;
                logoUrl: string | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            name: string;
            clubs: string[];
            competitions: string[];
            firstName: string;
            lastName: string;
            aliases: string[];
            nationality: string;
            dateOfBirth: Date | null;
            heightCm: number | null;
            preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
            positionCategories: import(".prisma/client").$Enums.PositionCategory[];
            positions: import(".prisma/client").$Enums.Position[];
            primaryPosition: import(".prisma/client").$Enums.Position | null;
            isRetired: boolean;
            currentClubId: string | null;
            imageUrl: string | null;
            createdBy: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
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
        currentClub: {
            id: string;
            createdAt: Date;
            name: string;
            competitions: string[];
            aliases: string[];
            createdBy: string | null;
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
        } | null;
        playerClubs: ({
            club: {
                id: string;
                createdAt: Date;
                name: string;
                competitions: string[];
                aliases: string[];
                createdBy: string | null;
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
    } & {
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        firstName: string;
        lastName: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positionCategories: import(".prisma/client").$Enums.PositionCategory[];
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        createdBy: string | null;
    }>;
    update(id: string, updateDto: PatchPlayerDto, req: any): Promise<{
        currentClub: {
            id: string;
            createdAt: Date;
            name: string;
            competitions: string[];
            aliases: string[];
            createdBy: string | null;
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
        } | null;
        playerClubs: ({
            club: {
                id: string;
                createdAt: Date;
                name: string;
                competitions: string[];
                aliases: string[];
                createdBy: string | null;
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
    } & {
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        firstName: string;
        lastName: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positionCategories: import(".prisma/client").$Enums.PositionCategory[];
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        createdBy: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        firstName: string;
        lastName: string;
        aliases: string[];
        nationality: string;
        dateOfBirth: Date | null;
        heightCm: number | null;
        preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
        positionCategories: import(".prisma/client").$Enums.PositionCategory[];
        positions: import(".prisma/client").$Enums.Position[];
        primaryPosition: import(".prisma/client").$Enums.Position | null;
        isRetired: boolean;
        currentClubId: string | null;
        imageUrl: string | null;
        createdBy: string | null;
    }>;
}
