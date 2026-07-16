import { AdminCompetitionsService, CreateCompetitionDto, UpdateCompetitionDto } from './competitions.service';
export declare class AdminCompetitionsController {
    private readonly competitionsService;
    constructor(competitionsService: AdminCompetitionsService);
    create(createDto: CreateCompetitionDto): Promise<{
        type: import(".prisma/client").$Enums.CompetitionType;
        id: string;
        name: string;
        countryCode: string | null;
        tier: number | null;
    }>;
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
    update(id: string, updateDto: UpdateCompetitionDto): Promise<{
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
