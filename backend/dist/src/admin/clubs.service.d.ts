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
    findAll(filters?: {
        competitionId?: string;
        countryCode?: string;
        search?: string;
        page?: number;
        limit?: number;
        sort?: string;
        order?: string;
    }): Promise<{
        data: ({
            clubCompetitions: {
                id: string;
                clubId: string;
                competitionId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            name: string;
            competitions: string[];
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            logoUrl: string | null;
            createdBy: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        createdAt: Date;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
        createdBy: string | null;
    }>;
    create(dto: CreateClubDto, adminUserId: string): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        createdAt: Date;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
        createdBy: string | null;
    }>;
    update(id: string, dto: UpdateClubDto, adminUserId: string): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        createdAt: Date;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
        createdBy: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
        createdBy: string | null;
    }>;
}
