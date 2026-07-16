import { PrismaService } from '../prisma/prisma.service';
export declare class CreateClubDto {
    name: string;
    aliases?: string[];
    countryCode: string;
    currentCompetitionId?: string;
    logoUrl?: string;
}
export declare class UpdateClubDto {
    name?: string;
    aliases?: string[];
    countryCode?: string;
    currentCompetitionId?: string;
    logoUrl?: string;
}
export declare class AdminClubsService {
    private prisma;
    constructor(prisma: PrismaService);
    private validateFks;
    findAll(): Promise<{
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    create(dto: CreateClubDto): Promise<{
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    update(id: string, dto: UpdateClubDto): Promise<{
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
}
