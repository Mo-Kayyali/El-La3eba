import { PrismaService } from '../prisma/prisma.service';
export declare class CreateClubDto {
    name: string;
    aliases?: string[];
    countryCode: string;
    currentCompetitionId?: string;
    competitionIds?: string[];
    logoUrl?: string;
}
export declare class UpdateClubDto {
    name?: string;
    aliases?: string[];
    countryCode?: string;
    currentCompetitionId?: string;
    competitionIds?: string[];
    logoUrl?: string;
}
import { ClubDenormService } from '../game/club-denorm.service';
export declare class AdminClubsService {
    private prisma;
    private clubDenormService;
    constructor(prisma: PrismaService, clubDenormService: ClubDenormService);
    private validateFks;
    private validateCompetitions;
    findAll(): Promise<({
        clubCompetitions: {
            id: string;
            clubId: string;
            competitionId: string;
        }[];
    } & {
        id: string;
        name: string;
        countryCode: string;
        aliases: string[];
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    })[]>;
    findOne(id: string): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        name: string;
        countryCode: string;
        aliases: string[];
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    create(dto: CreateClubDto): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        name: string;
        countryCode: string;
        aliases: string[];
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    update(id: string, dto: UpdateClubDto): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        name: string;
        countryCode: string;
        aliases: string[];
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        countryCode: string;
        aliases: string[];
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
}
