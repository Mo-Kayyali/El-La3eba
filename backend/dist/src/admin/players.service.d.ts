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
    findAll(): Promise<({
        currentClub: {
            id: string;
            name: string;
            logoUrl: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        aliases: string[];
        competitions: string[];
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
        clubs: string[];
    })[]>;
    findOne(id: string): Promise<{
        playerClubs: ({
            club: {
                id: string;
                name: string;
                aliases: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                competitions: string[];
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
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            competitions: string[];
            logoUrl: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        aliases: string[];
        competitions: string[];
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
        clubs: string[];
    }>;
    create(dto: CreatePlayerDto): Promise<{
        id: string;
        name: string;
        aliases: string[];
        competitions: string[];
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
        clubs: string[];
    }>;
    update(id: string, dto: PatchPlayerDto): Promise<{
        playerClubs: ({
            club: {
                id: string;
                name: string;
                aliases: string[];
                countryCode: string;
                currentCompetitionId: string | null;
                competitions: string[];
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
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            competitions: string[];
            logoUrl: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        aliases: string[];
        competitions: string[];
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
        clubs: string[];
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        aliases: string[];
        competitions: string[];
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
        clubs: string[];
    }>;
}
