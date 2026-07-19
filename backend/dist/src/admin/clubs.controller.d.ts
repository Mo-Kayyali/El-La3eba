import { AdminClubsService, CreateClubDto, UpdateClubDto } from './clubs.service';
export declare class AdminClubsController {
    private readonly clubsService;
    constructor(clubsService: AdminClubsService);
    create(createDto: CreateClubDto, req: any): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    findAll(competitionId?: string, countryCode?: string, search?: string, page?: string, limit?: string, sort?: string, order?: string): Promise<{
        data: ({
            clubCompetitions: {
                id: string;
                clubId: string;
                competitionId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            name: string;
            createdBy: string | null;
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
        createdAt: Date;
        name: string;
        createdBy: string | null;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    update(id: string, updateDto: UpdateClubDto, req: any): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string | null;
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        competitions: string[];
        logoUrl: string | null;
    }>;
}
