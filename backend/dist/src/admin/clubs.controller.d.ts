import { AdminClubsService, CreateClubDto, UpdateClubDto } from './clubs.service';
export declare class AdminClubsController {
    private readonly clubsService;
    constructor(clubsService: AdminClubsService);
    create(createDto: CreateClubDto): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    findAll(competitionId?: string, countryCode?: string, search?: string, page?: string, limit?: string): Promise<{
        data: ({
            clubCompetitions: {
                id: string;
                clubId: string;
                competitionId: string;
            }[];
        } & {
            id: string;
            name: string;
            aliases: string[];
            countryCode: string;
            currentCompetitionId: string | null;
            competitions: string[];
            logoUrl: string | null;
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
        name: string;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    update(id: string, updateDto: UpdateClubDto): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
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
