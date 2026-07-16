import { PrismaService } from '../prisma/prisma.service';
import { CompetitionType } from '@prisma/client';
export declare class CreateCompetitionDto {
    name: string;
    type: CompetitionType;
    countryCode?: string;
    tier?: number;
}
export declare class UpdateCompetitionDto {
    name?: string;
    type?: CompetitionType;
    countryCode?: string;
    tier?: number;
}
export declare class AdminCompetitionsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        name: string;
        countryCode: string | null;
        tier: number | null;
    }[]>;
    findOne(id: string): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        name: string;
        countryCode: string | null;
        tier: number | null;
    }>;
    create(dto: CreateCompetitionDto): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        name: string;
        countryCode: string | null;
        tier: number | null;
    }>;
    update(id: string, dto: UpdateCompetitionDto): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        name: string;
        countryCode: string | null;
        tier: number | null;
    }>;
    remove(id: string): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        name: string;
        countryCode: string | null;
        tier: number | null;
    }>;
}
