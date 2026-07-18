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
        firstName: string;
        lastName: string;
        name: string;
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
    }): Promise<{
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
    create(dto: CreatePlayerDto): Promise<{
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
    update(id: string, dto: PatchPlayerDto): Promise<{
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
