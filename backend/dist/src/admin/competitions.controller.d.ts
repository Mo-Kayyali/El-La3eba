import { AdminCompetitionsService, CreateCompetitionDto, UpdateCompetitionDto } from './competitions.service';
export declare class AdminCompetitionsController {
    private readonly competitionsService;
    constructor(competitionsService: AdminCompetitionsService);
    create(createDto: CreateCompetitionDto, req: any): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    findAll(countryCode?: string, search?: string, page?: string, limit?: string, sort?: string, order?: string): Promise<{
        data: {
            type: import(".prisma/client").$Enums.CompetitionType;
            id: string;
            createdAt: Date;
            name: string;
            createdBy: string | null;
            countryCode: string | null;
            region: import(".prisma/client").$Enums.Region | null;
            tier: number | null;
        }[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    update(id: string, updateDto: UpdateCompetitionDto, req: any): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    remove(id: string): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
}
