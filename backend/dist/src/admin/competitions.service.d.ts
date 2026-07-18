import { PrismaService } from '../prisma/prisma.service';
import { CompetitionType, Region } from '@prisma/client';
export declare class CreateCompetitionDto {
    name: string;
    type: CompetitionType;
    countryCode?: string;
    region?: Region;
    tier?: number;
}
export declare class UpdateCompetitionDto {
    name?: string;
    type?: CompetitionType;
    countryCode?: string;
    region?: Region;
    tier?: number;
}
export declare class AdminCompetitionsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(filters?: {
        countryCode?: string;
        search?: string;
        page?: number;
        limit?: number;
        sort?: string;
        order?: string;
    }): Promise<{
        data: {
            id: string;
            name: string;
            type: import(".prisma/client").$Enums.CompetitionType;
            countryCode: string | null;
            region: import(".prisma/client").$Enums.Region | null;
            tier: number | null;
            createdAt: Date;
            createdBy: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
        createdAt: Date;
        createdBy: string | null;
    }>;
    private validateRules;
    create(dto: CreateCompetitionDto, adminUserId: string): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
        createdAt: Date;
        createdBy: string | null;
    }>;
    update(id: string, dto: UpdateCompetitionDto, adminUserId: string): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
        createdAt: Date;
        createdBy: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
        createdAt: Date;
        createdBy: string | null;
    }>;
}
