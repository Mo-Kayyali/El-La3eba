import { PrismaService } from '../prisma/prisma.service';
import { PlayerDenormService } from '../game/player-denorm.service';
import { Position, PreferredFoot } from '@prisma/client';
export declare class ClubHistoryDto {
    clubId: string;
    startYear?: number;
    endYear?: number;
    isCurrent: boolean;
}
export declare class CreatePlayerDto {
    firstName: string;
    lastName: string;
    name: string;
    aliases?: string[];
    nationality: string;
    dateOfBirth?: string;
    heightCm?: number;
    preferredFoot?: PreferredFoot;
    positions: Position[];
    primaryPosition?: Position;
    isRetired: boolean;
    currentClubId?: string;
    imageUrl?: string;
}
export declare class UpdatePlayerDto extends CreatePlayerDto {
}
export declare class PatchPlayerDto {
    firstName?: string;
    lastName?: string;
    name?: string;
    aliases?: string[];
    nationality?: string;
    dateOfBirth?: string;
    heightCm?: number;
    preferredFoot?: PreferredFoot;
    positions?: Position[];
    primaryPosition?: Position;
    isRetired?: boolean;
    currentClubId?: string;
    imageUrl?: string;
    clubHistory?: ClubHistoryDto[];
}
export declare class AdminPlayersService {
    private prisma;
    private playerDenormService;
    constructor(prisma: PrismaService, playerDenormService: PlayerDenormService);
    private validateFks;
    search(query: string): Promise<{
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
    findAll(filters?: {
        competitionId?: string;
        compCountryCode?: string;
        clubId?: string;
        isRetired?: string;
        nationality?: string;
        search?: string;
        page?: number;
        limit?: number;
        sort?: string;
        order?: string;
    }): Promise<{
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
            aliases: string[];
            createdBy: string | null;
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
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<{
        playerClubs: ({
            club: {
                id: string;
                createdAt: Date;
                name: string;
                competitions: string[];
                aliases: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                logoUrl: string | null;
                createdBy: string | null;
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
            createdAt: Date;
            name: string;
            competitions: string[];
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
            createdBy: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        createdBy: string | null;
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
    create(dto: CreatePlayerDto, adminUserId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        createdBy: string | null;
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
    update(id: string, dto: PatchPlayerDto, adminUserId: string): Promise<{
        playerClubs: ({
            club: {
                id: string;
                createdAt: Date;
                name: string;
                competitions: string[];
                aliases: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                logoUrl: string | null;
                createdBy: string | null;
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
            createdAt: Date;
            name: string;
            competitions: string[];
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
            createdBy: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        createdBy: string | null;
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
        createdAt: Date;
        name: string;
        clubs: string[];
        competitions: string[];
        aliases: string[];
        createdBy: string | null;
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
