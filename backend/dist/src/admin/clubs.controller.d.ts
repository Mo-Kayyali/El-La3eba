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
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
    }>;
    findAll(): Promise<({
        clubCompetitions: {
            id: string;
            clubId: string;
            competitionId: string;
        }[];
    } & {
        id: string;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
    })[]>;
    findOne(id: string): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
    }>;
    update(id: string, updateDto: UpdateClubDto): Promise<{
        competitionIds: string[];
        clubCompetitions: {
            competitionId: string;
        }[];
        id: string;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        competitions: string[];
        aliases: string[];
        countryCode: string;
        currentCompetitionId: string | null;
        logoUrl: string | null;
    }>;
}
