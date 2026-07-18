import { AdminCompetitionsService, CreateCompetitionDto, UpdateCompetitionDto } from './competitions.service';
export declare class AdminCompetitionsController {
    private readonly competitionsService;
    constructor(competitionsService: AdminCompetitionsService);
    create(createDto: CreateCompetitionDto): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    findAll(): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    update(id: string, updateDto: UpdateCompetitionDto): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.CompetitionType;
        countryCode: string | null;
        region: import(".prisma/client").$Enums.Region | null;
        tier: number | null;
    }>;
}
