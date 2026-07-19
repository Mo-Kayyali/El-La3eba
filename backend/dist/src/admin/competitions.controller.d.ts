import { AdminCompetitionsService, CreateCompetitionDto, UpdateCompetitionDto } from './competitions.service';
export declare class AdminCompetitionsController {
    private readonly competitionsService;
    constructor(competitionsService: AdminCompetitionsService);
    create(createDto: CreateCompetitionDto, req: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        type: import(".prisma/client").$Enums.CompetitionType;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    findAll(countryCode?: string, search?: string, page?: string, limit?: string, sort?: string, order?: string): Promise<{
        data: {
            id: string;
            createdAt: Date;
            name: string;
            createdBy: string | null;
            countryCode: string | null;
            type: import(".prisma/client").$Enums.CompetitionType;
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
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        type: import(".prisma/client").$Enums.CompetitionType;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    update(id: string, updateDto: UpdateCompetitionDto, req: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        type: import(".prisma/client").$Enums.CompetitionType;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        countryCode: string | null;
        type: import(".prisma/client").$Enums.CompetitionType;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
}
