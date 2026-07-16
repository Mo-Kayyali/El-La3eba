import { AdminClubsService, CreateClubDto, UpdateClubDto } from './clubs.service';
export declare class AdminClubsController {
    private readonly clubsService;
    constructor(clubsService: AdminClubsService);
    create(createDto: CreateClubDto): Promise<{
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
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
    update(id: string, updateDto: UpdateClubDto): Promise<{
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
