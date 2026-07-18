import { AdminCompetitionsService, CreateCompetitionDto, UpdateCompetitionDto } from './competitions.service';
export declare class AdminCompetitionsController {
    private readonly competitionsService;
    constructor(competitionsService: AdminCompetitionsService);
    create(createDto: CreateCompetitionDto, req: any): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
        createdAt: Date;
        createdBy: string | null;
    }>;
    findAll(countryCode?: string, search?: string, page?: string, limit?: string, sort?: string, order?: string): Promise<{
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
    update(id: string, updateDto: UpdateCompetitionDto, req: any): Promise<{
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
