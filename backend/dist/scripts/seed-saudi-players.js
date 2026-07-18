"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const nationalityMap = {
    'Portugal': 'POR',
    'Brazil': 'BRA',
    'France': 'FRA',
    'Senegal': 'SEN',
    'Algeria': 'ALG',
    'Serbia': 'SRB',
    'Morocco': 'MAR',
    'Netherlands': 'NLD',
    'Ivory Coast': 'CIV',
    'England': 'ENG',
    'Spain': 'ESP',
    'Croatia': 'HRV',
    'Gabon': 'GAB',
    'Belgium': 'BEL',
    'Turkey': 'TUR',
    'Mexico': 'MEX',
    'Italy': 'ITA',
    'Cameroon': 'CMR',
    'Jamaica': 'JAM',
    'Greece': 'GRC',
    'Uruguay': 'URY',
    'Sweden': 'SWE',
    'Poland': 'POL',
    'Romania': 'ROU',
    'Germany': 'GER',
    'Saudi Arabia': 'SAU'
};
const clubCountries = {
    'Al Nassr': 'SAU', 'Al Hilal': 'SAU', 'Al Ittihad': 'SAU', 'Al Ahli': 'SAU', 'Al Ettifaq': 'SAU', 'Al Qadsiah': 'SAU', 'Al Shabab': 'SAU', 'Al Fayha': 'SAU', 'Al Khaleej': 'SAU', 'Abha': 'SAU', 'Al Okhdood': 'SAU', 'Al Tai': 'SAU', 'Al Wehda': 'SAU',
    'Real Madrid': 'ESP', 'Barcelona': 'ESP', 'Atlético Madrid': 'ESP', 'Sevilla': 'ESP', 'Athletic Bilbao': 'ESP', 'Mallorca': 'ESP', 'Real Betis': 'ESP', 'Villarreal': 'ESP',
    'Manchester United': 'ENG', 'Manchester City': 'ENG', 'Leicester City': 'ENG', 'Chelsea': 'ENG', 'Wolverhampton Wanderers': 'ENG', 'Fulham': 'ENG', 'Newcastle United': 'ENG', 'Liverpool': 'ENG', 'Brentford': 'ENG', 'Aston Villa': 'ENG', 'Nottingham Forest': 'ENG', 'Everton': 'ENG', 'Sunderland': 'ENG', 'Arsenal': 'ENG', 'Tottenham Hotspur': 'ENG',
    'Juventus': 'ITA', 'Napoli': 'ITA', 'Lazio': 'ITA', 'AC Milan': 'ITA', 'Roma': 'ITA', 'Inter Milan': 'ITA', 'Atalanta': 'ITA', 'Udinese': 'ITA', 'Genoa': 'ITA', 'Cagliari': 'ITA', 'Palermo': 'ITA',
    'Bayern Munich': 'GER', 'Hoffenheim': 'GER', 'Bayer Leverkusen': 'GER', 'Borussia Dortmund': 'GER', 'Wolfsburg': 'GER', 'RB Leipzig': 'GER', 'Schalke 04 II': 'GER', 'Kaiserslautern': 'GER', 'Mainz 05': 'GER',
    'Paris Saint-Germain': 'FRA', 'Lyon': 'FRA', 'Monaco': 'FRA', 'Rennes': 'FRA', 'Reims': 'FRA', 'Lens': 'FRA', 'Strasbourg': 'FRA', 'Nice': 'FRA',
    'Sporting CP': 'POR', 'Porto': 'POR', 'Benfica': 'POR',
    'Santos': 'BRA', 'Athletico Paranaense': 'BRA',
    'Zenit St. Petersburg': 'RUS',
    'Beşiktaş': 'TUR', 'Fenerbahçe': 'TUR',
    'Club América': 'MEX', 'Atlas': 'MEX',
    'Tigre': 'ARG', 'Boca Juniors': 'ARG',
    'Ajax': 'NLD',
    'Olympiacos': 'GRC', 'Aris Thessaloniki': 'GRC',
    'Celtic': 'SCO',
    'Neuchâtel Xamax': 'CHE',
    'Hajduk Split': 'HRV',
    'Anorthosis Famagusta': 'CYP',
    'FCSB': 'ROU', 'CFR Cluj': 'ROU',
    'Al Jazira': 'ARE', 'Baniyas': 'ARE', 'Al Ain': 'ARE',
    'Red Star Belgrade': 'SRB', 'Čukarički': 'SRB',
};
const playersData = [
    { f: 'Cristiano', l: 'Ronaldo', n: 'Portugal', p: ['Sporting CP', 'Manchester United', 'Real Madrid', 'Juventus'], c: 'Al Nassr', r: false },
    { f: 'Neymar', l: 'da Silva Santos', a: ['Neymar'], n: 'Brazil', p: ['Barcelona', 'Paris Saint-Germain'], c: 'Al Hilal', r: false },
    { f: 'Karim', l: 'Benzema', n: 'France', p: ['Lyon', 'Real Madrid'], c: 'Al Ittihad', r: false },
    { f: 'Sadio', l: 'Mané', n: 'Senegal', p: ['Liverpool', 'Bayern Munich'], c: 'Al Nassr', r: false },
    { f: 'Riyad', l: 'Mahrez', n: 'Algeria', p: ['Leicester City', 'Manchester City'], c: 'Al Ahli', r: false },
    { f: "N'Golo", l: 'Kanté', n: 'France', p: ['Chelsea', 'Leicester City'], c: 'Al Ittihad', r: false },
    { f: 'Kalidou', l: 'Koulibaly', n: 'Senegal', p: ['Napoli', 'Chelsea'], c: 'Al Hilal', r: false },
    { f: 'Rúben', l: 'Neves', n: 'Portugal', p: ['Porto', 'Wolverhampton Wanderers'], c: 'Al Hilal', r: false },
    { f: 'Aleksandar', l: 'Mitrović', n: 'Serbia', p: ['Fulham', 'Newcastle United'], c: 'Al Hilal', r: false },
    { f: 'Sergej', l: 'Milinković-Savić', n: 'Serbia', p: ['Lazio'], c: 'Al Hilal', r: false },
    { f: 'Yassine', l: 'Bounou', a: ['Bono'], n: 'Morocco', p: ['Sevilla', 'Atlético Madrid'], c: 'Al Hilal', r: false },
    { f: 'Roberto', l: 'Firmino', n: 'Brazil', p: ['Liverpool', 'Hoffenheim'], c: 'Al Ahli', r: false },
    { f: 'Fábio', l: 'Tavares (Fabinho)', a: ['Fabinho'], n: 'Brazil', p: ['Liverpool', 'Monaco'], c: 'Al Ittihad', r: false },
    { f: 'Georginio', l: 'Wijnaldum', a: ['Gini Wijnaldum'], n: 'Netherlands', p: ['Liverpool', 'Paris Saint-Germain'], c: 'Al Ettifaq', r: false },
    { f: 'Franck', l: 'Kessié', n: 'Ivory Coast', p: ['AC Milan', 'Barcelona'], c: 'Al Ahli', r: false },
    { f: 'Ivan', l: 'Toney', n: 'England', p: ['Brentford', 'Newcastle United'], c: 'Al Ahli', r: false },
    { f: 'João', l: 'Cancelo', n: 'Portugal', p: ['Manchester City', 'Bayern Munich', 'Barcelona'], c: 'Al Hilal', r: false },
    { f: 'Moussa', l: 'Diaby', n: 'France', p: ['Aston Villa', 'Bayer Leverkusen'], c: 'Al Ittihad', r: false },
    { f: 'Aymeric', l: 'Laporte', n: 'Spain', p: ['Manchester City', 'Athletic Bilbao'], c: 'Al Nassr', r: false },
    { f: 'Malcom', l: 'Filipe Silva', a: ['Malcom'], n: 'Brazil', p: ['Barcelona', 'Zenit St. Petersburg'], c: 'Al Hilal', r: false },
    { f: 'Marcelo', l: 'Brozović', n: 'Croatia', p: ['Inter Milan'], c: 'Al Nassr', r: false },
    { f: 'Otávio', l: 'Monteiro', a: ['Otávio'], n: 'Portugal', p: ['Porto'], c: 'Al Nassr', r: false },
    { f: 'Anderson', l: 'Talisca', a: ['Talisca'], n: 'Brazil', p: ['Benfica', 'Beşiktaş'], c: 'Al Nassr', r: false },
    { f: 'Édouard', l: 'Mendy', n: 'Senegal', p: ['Chelsea', 'Rennes'], c: 'Al Ahli', r: false },
    { f: 'Pierre-Emerick', l: 'Aubameyang', n: 'Gabon', p: ['Arsenal', 'Borussia Dortmund', 'Barcelona'], c: 'Al Qadsiah', r: false },
    { f: 'Nacho', l: 'Fernández', a: ['Nacho'], n: 'Spain', p: ['Real Madrid'], c: 'Al Qadsiah', r: false },
    { f: 'Koen', l: 'Casteels', n: 'Belgium', p: ['Wolfsburg', 'Hoffenheim'], c: 'Al Qadsiah', r: false },
    { f: 'Houssem', l: 'Aouar', n: 'Algeria', p: ['Lyon', 'Roma'], c: 'Al Ittihad', r: false },
    { f: 'Steven', l: 'Bergwijn', n: 'Netherlands', p: ['Tottenham Hotspur', 'Ajax'], c: 'Al Ittihad', r: false },
    { f: 'Predrag', l: 'Rajković', n: 'Serbia', p: ['Mallorca', 'Reims'], c: 'Al Ittihad', r: false },
    { f: 'João', l: 'Félix', n: 'Portugal', p: ['Atlético Madrid', 'Chelsea', 'Barcelona'], c: 'Al Nassr', r: false },
    { f: 'Danilo', l: 'Pereira', n: 'Portugal', p: ['Paris Saint-Germain', 'Porto'], c: 'Al Ittihad', r: false },
    { f: 'Julián', l: 'Quiñones', n: 'Mexico', p: ['Club América', 'Atlas'], c: 'Al Qadsiah', r: false },
    { f: 'Renan', l: 'Lodi', n: 'Brazil', p: ['Atlético Madrid', 'Nottingham Forest'], c: 'Al Hilal', r: false },
    { f: 'Merih', l: 'Demiral', n: 'Turkey', p: ['Juventus', 'Atalanta'], c: 'Al Ahli', r: false },
    { f: 'Yannick', l: 'Carrasco', n: 'Belgium', p: ['Atlético Madrid', 'Monaco'], c: 'Al Shabab', r: false },
    { f: 'Seko', l: 'Fofana', n: 'Ivory Coast', p: ['Lens', 'Udinese'], c: 'Al Ettifaq', r: false },
    { f: 'Roger', l: 'Ibañez', n: 'Brazil', p: ['Roma', 'Atalanta'], c: 'Al Ahli', r: false },
    { f: 'Mohamed', l: 'Simakan', n: 'France', p: ['RB Leipzig', 'Strasbourg'], c: 'Al Nassr', r: false },
    { f: 'Chris', l: 'Smalling', n: 'England', p: ['Manchester United', 'Roma'], c: 'Al Fayha', r: false },
    { f: 'Marcos', l: 'Leonardo', n: 'Brazil', p: ['Santos', 'Benfica'], c: 'Al Hilal', r: false },
    { f: 'Bento', l: 'Krepski', a: ['Bento'], n: 'Brazil', p: ['Athletico Paranaense'], c: 'Al Nassr', r: false },
    { f: 'Luiz', l: 'Felipe', n: 'Italy', p: ['Lazio', 'Real Betis'], c: 'Al Ittihad', r: false },
    { f: 'Moussa', l: 'Dembélé', n: 'France', p: ['Lyon', 'Celtic', 'Atlético Madrid'], c: 'Al Ettifaq', r: false },
    { f: 'Karl', l: 'Toko Ekambi', n: 'Cameroon', p: ['Lyon', 'Villarreal'], c: 'Al Ettifaq', r: false },
    { f: 'Demarai', l: 'Gray', n: 'Jamaica', p: ['Leicester City', 'Everton'], c: 'Al Ettifaq', r: false },
    { f: 'Mateo', l: 'Retegui', n: 'Italy', p: ['Genoa', 'Tigre'], c: 'Al Qadsiah', r: false },
    { f: 'Kingsley', l: 'Coman', n: 'France', p: ['Bayern Munich', 'Juventus'], c: 'Al Nassr', r: false },
    { f: 'Kostas', l: 'Fortounis', n: 'Greece', p: ['Olympiacos', 'Kaiserslautern'], c: 'Al Khaleej', r: false },
    { f: 'Nahitan', l: 'Nández', n: 'Uruguay', p: ['Cagliari', 'Boca Juniors'], c: 'Al Qadsiah', r: false },
    { f: 'Jordan', l: 'Henderson', n: 'England', p: ['Liverpool', 'Sunderland', 'Al Ettifaq'], c: 'Ajax', r: false },
    { f: 'Allan', l: 'Saint-Maximin', n: 'France', p: ['Newcastle United', 'Nice', 'Al Ahli'], c: 'Fenerbahçe', r: false },
    { f: 'João Pedro', l: 'Neves (Jota)', a: ['Jota'], n: 'Portugal', p: ['Celtic', 'Benfica', 'Al Ittihad'], c: 'Rennes', r: false },
    { f: 'Ivan', l: 'Rakitić', n: 'Croatia', p: ['Barcelona', 'Sevilla', 'Al Shabab'], c: 'Hajduk Split', r: false },
    { f: 'Robin', l: 'Quaison', n: 'Sweden', p: ['Mainz 05', 'Palermo', 'Al Ettifaq'], c: 'Aris Thessaloniki', r: false },
    { f: 'Grzegorz', l: 'Krychowiak', n: 'Poland', p: ['Sevilla', 'Paris Saint-Germain', 'Abha'], c: 'Anorthosis Famagusta', r: false },
    { f: 'Florin', l: 'Tănase', n: 'Romania', p: ['FCSB', 'Al Jazira', 'Al Okhdood'], c: 'FCSB', r: false },
    { f: 'Andrei', l: 'Burcă', n: 'Romania', p: ['CFR Cluj', 'Al Okhdood'], c: 'Baniyas', r: false },
    { f: 'Milan', l: 'Pavkov', n: 'Serbia', p: ['Red Star Belgrade', 'Al Fayha'], c: 'Čukarički', r: false },
    { f: 'Amin', l: 'Younes', n: 'Germany', p: ['Ajax', 'Napoli', 'Al Ettifaq'], c: 'Schalke 04 II', r: false },
    { f: 'Majed', l: 'Abdullah', n: 'Saudi Arabia', p: ['Al Nassr'], c: null, r: true },
    { f: 'Sami', l: 'Al-Jaber', n: 'Saudi Arabia', p: ['Al Hilal', 'Wolverhampton Wanderers'], c: null, r: true },
    { f: 'Yasser', l: 'Al-Qahtani', n: 'Saudi Arabia', p: ['Al Hilal', 'Al Ain', 'Al Qadsiah'], c: null, r: true },
    { f: 'Saeed', l: 'Al-Owairan', n: 'Saudi Arabia', p: ['Al Shabab'], c: null, r: true },
    { f: 'Mohamed', l: 'Al-Deayea', n: 'Saudi Arabia', p: ['Al Tai', 'Al Hilal'], c: null, r: true },
    { f: 'Nawaf', l: 'Al-Temyat', n: 'Saudi Arabia', p: ['Al Hilal'], c: null, r: true },
    { f: 'Fahad', l: 'Al-Bishi', n: 'Saudi Arabia', p: ['Al Nassr'], c: null, r: true },
    { f: 'Yousuf', l: 'Al-Thunayan', n: 'Saudi Arabia', p: ['Al Hilal'], c: null, r: true },
    { f: 'Hussein', l: 'Abdulghani', n: 'Saudi Arabia', p: ['Al Ahli', 'Al Nassr', 'Neuchâtel Xamax'], c: null, r: true },
    { f: 'Mohammad', l: 'Noor', n: 'Saudi Arabia', p: ['Al Ittihad', 'Al Nassr'], c: null, r: true },
    { f: 'Saleh', l: 'Al-Nu\'eimah', n: 'Saudi Arabia', p: ['Al Hilal'], c: null, r: true },
    { f: 'Obeid', l: 'Al-Dosari', n: 'Saudi Arabia', p: ['Al Wehda', 'Al Ahli'], c: null, r: true },
    { f: 'Fuad', l: 'Anwar', n: 'Saudi Arabia', p: ['Al Shabab', 'Al Nassr'], c: null, r: true },
    { f: 'Khaled', l: 'Al-Muwallid', n: 'Saudi Arabia', p: ['Al Ahli', 'Al Ittihad'], c: null, r: true },
    { f: 'Ahmed', l: 'Jamil', n: 'Saudi Arabia', p: ['Al Ittihad'], c: null, r: true },
];
async function main() {
    for (const pd of playersData) {
        const natCode = nationalityMap[pd.n] || 'SAU';
        const allClubs = [...pd.p];
        if (pd.c) {
            if (!allClubs.includes(pd.c)) {
                allClubs.push(pd.c);
            }
        }
        for (const clubName of allClubs) {
            let ctyCode = clubCountries[clubName];
            if (!ctyCode) {
                console.warn(`Missing country code for club: ${clubName}, defaulting to SAU`);
                ctyCode = 'SAU';
            }
            const existingClub = await prisma.club.findFirst({
                where: { name: clubName }
            });
            if (!existingClub) {
                await prisma.club.create({
                    data: {
                        name: clubName,
                        countryCode: ctyCode,
                    }
                });
                console.log(`Created club: ${clubName}`);
            }
        }
        const fullName = `${pd.f} ${pd.l}`.trim();
        let player = await prisma.player.findFirst({
            where: { name: fullName }
        });
        if (!player) {
            let currentClubId = null;
            if (pd.c) {
                const cClub = await prisma.club.findFirst({ where: { name: pd.c } });
                if (cClub)
                    currentClubId = cClub.id;
            }
            const aliases = pd.a || [];
            player = await prisma.player.create({
                data: {
                    firstName: pd.f,
                    lastName: pd.l,
                    name: fullName,
                    aliases,
                    nationality: natCode,
                    isRetired: pd.r,
                    currentClubId: currentClubId,
                }
            });
            console.log(`Created player: ${fullName}`);
        }
        else {
            console.log(`Player already exists: ${fullName}`);
        }
        let isCurrentForHistoryCheck = pd.c;
        for (const cName of pd.p) {
            const c = await prisma.club.findFirst({ where: { name: cName } });
            if (c) {
                const existingPc = await prisma.playerClub.findFirst({
                    where: { playerId: player.id, clubId: c.id }
                });
                if (!existingPc) {
                    await prisma.playerClub.create({
                        data: {
                            playerId: player.id,
                            clubId: c.id,
                            isCurrent: false,
                        }
                    });
                }
            }
        }
        if (pd.c) {
            const currentC = await prisma.club.findFirst({ where: { name: pd.c } });
            if (currentC) {
                const existingPc = await prisma.playerClub.findFirst({
                    where: { playerId: player.id, clubId: currentC.id, isCurrent: true }
                });
                if (!existingPc) {
                    await prisma.playerClub.upsert({
                        where: { id: "not-a-real-id" },
                        create: {
                            playerId: player.id,
                            clubId: currentC.id,
                            isCurrent: true
                        },
                        update: {}
                    }).catch(async (e) => {
                        const isThere = await prisma.playerClub.findFirst({ where: { playerId: player.id, clubId: currentC.id } });
                        if (isThere) {
                            await prisma.playerClub.update({
                                where: { id: isThere.id },
                                data: { isCurrent: true }
                            });
                        }
                        else {
                            await prisma.playerClub.create({
                                data: { playerId: player.id, clubId: currentC.id, isCurrent: true }
                            });
                        }
                    });
                }
            }
        }
    }
}
main().then(() => {
    console.log('Seeding saudi players finished.');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=seed-saudi-players.js.map