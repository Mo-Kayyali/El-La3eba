"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const colombiaClubs = [
    "Águilas Doradas", "Alianza F.C.", "América de Cali", "Atlético Bucaramanga",
    "Atlético Nacional", "Boyacá Chicó", "Deportes Tolima", "Deportivo Cali",
    "Deportivo Pasto", "Deportivo Pereira", "Envigado", "Fortaleza C.E.I.F.",
    "Independiente Medellín", "Independiente Santa Fe", "Jaguares de Córdoba",
    "Junior", "La Equidad", "Millonarios", "Once Caldas", "Patriotas Boyacá"
];
const chileClubs = [
    "Audax Italiano", "Cobresal", "Cobreloa", "Colo-Colo", "Deportes Copiapó",
    "Deportes Iquique", "Everton", "Huachipato", "Ñublense", "O'Higgins",
    "Palestino", "Coquimbo Unido", "Unión Española", "Unión La Calera",
    "Universidad Católica", "Universidad de Chile"
];
const legendsToAdd = [
    { name: "Manuel Francisco dos Santos", nat: "BRA", ret: true, alias: "Garrincha" },
    { name: "José Roberto Gama de Oliveira", nat: "BRA", ret: true, alias: "Bebeto" },
    { name: "Givanildo Vieira de Sousa", nat: "BRA", ret: false, alias: "Hulk", clubStr: "Fluminense" },
    { name: "Edinaldo Batista Libânio", nat: "BRA", ret: true, alias: "Grafite" },
    { name: "Francisco Fernandes da Conceição", nat: "POR", ret: false, alias: "Chico Conceição", clubStr: "Juventus" },
    { name: "Gervais Lombe Yao Kouassi", nat: "CIV", ret: true, alias: "Gervinho" },
    { name: "Augustine Azuka Okocha", nat: "NGA", ret: true, alias: "Jay-Jay Okocha" },
    { name: "Adolfo José Valencia Mosquera", nat: "COL", ret: true, alias: "El Tren Valencia" },
    { name: "Memphis Depay", nat: "NLD", ret: false, alias: "Memphis", clubStr: "Corinthians" },
    { name: "Javier Hernández Balcázar", nat: "MEX", ret: false, alias: "Chicharito" },
    { name: "Radamel Falcao García Zárate", nat: "COL", ret: false, alias: "Falcao", clubStr: "Millonarios" },
    { name: "Ángel Fabián Di María Hernández", nat: "ARG", ret: false, alias: "El Fideo", clubStr: "Rosario Central" },
    { name: "Luis Alberto Suárez Díaz", nat: "URY", ret: false, alias: "El Pistolero", clubStr: "Inter Miami" },
    { name: "Edinson Roberto Cavani Gómez", nat: "URY", ret: false, alias: "El Matador" },
    { name: "Gerd Müller", nat: "GER", ret: true, alias: "Der Bomber" },
    { name: "Arturo Erasmo Vidal Pardo", nat: "CHL", ret: false, alias: "El Rey Arturo", clubStr: "Colo-Colo" },
    { name: "René Higuita", nat: "COL", ret: true, alias: "El Loco" },
    { name: "Dennis Bergkamp", nat: "NLD", ret: true, alias: "The Non-Flying Dutchman" },
    { name: "Ferenc Puskás", nat: "HUN", ret: true, alias: "The Galloping Major" },
    { name: "Bryan Robson", nat: "ENG", ret: true, alias: "Captain Marvel" },
    { name: "Diego Pablo Simeone", nat: "ARG", ret: true, alias: "El Cholo" },
    { name: "Carlos Caetano Bledorn Verri", nat: "BRA", ret: true, alias: "Dunga" },
    { name: "José Miguel González Martín del Campo", nat: "ESP", ret: true, alias: "Míchel" },
    { name: "João Pedro Neves Filipe", nat: "POR", ret: false, alias: "Jota", clubStr: "Celtic" },
    { name: "Bamidele Jermaine Alli", nat: "ENG", ret: false, alias: "Dele" },
    { name: "Sergio Leonel Agüero del Castillo", nat: "ARG", ret: true, alias: "Kun Agüero" },
    { name: "Eduardo César Daude Gaspar", nat: "BRA", ret: true, alias: "Edu" },
    { name: "Fernando José Torres Sanz", nat: "ESP", ret: true, alias: "El Niño" },
    { name: "Roberto Baggio", nat: "ITA", ret: true, alias: "Il Divin Codino" },
    { name: "Gary Alexis Medel Soto", nat: "CHL", ret: false, alias: "Pitbull", clubStr: "Universidad Católica" }
];
const existingAliasesToAssign = [
    { id: "e5fe554c-560e-44a4-934a-64c8967758b3", alias: "Pelé" },
    { id: "6b8e476f-20f8-46f7-9557-4802f46e0990", alias: "Zico" },
    { id: "79bb665a-e2c6-4a48-b9dd-98cad4e30ef9", alias: "Vampeta" },
    { id: "f8bfa432-2041-47eb-98c2-842cb446d044", alias: "Careca" },
    { id: "85691fda-823a-4015-97ed-53ace46e47e6", alias: "Nani" },
    { id: "20364cf2-064b-488e-9850-bdf838587380", alias: "Ganso" },
    { id: "9046740f-1694-4a41-a880-82799b14f0fa", alias: "Raphinha" },
    { id: "e4a88817-8c6f-4c27-9992-639a92c06244", alias: "Gabigol" },
    { id: "190cfbfa-bd35-47a9-801e-9d461c530fa8", alias: "Pedri" },
    { id: "b4f4a1c1-984d-464d-a9c6-3a72595bcf4d", alias: "Gavi" },
    { id: "2d3bb153-0255-47a7-ab5a-58dd0d1eb48e", alias: "Isco" },
    { id: "5d2f8406-cf6f-4cfc-a888-acce83609341", alias: "Koke" },
    { id: "223c752c-8827-47d4-8c4a-99b0ac9d28de", alias: "Nolito" },
    { id: "c3f742d7-904b-4ee7-b99e-6b066883ee9b", alias: "Suso" },
    { id: "7c90a929-d70c-4008-9737-1cd0a16950b1", alias: "Joselu" },
    { id: "b31d9a95-024c-4b55-80ec-2967f2293132", alias: "Palhinha" },
    { id: "8e90bf44-d874-4dad-b0e4-9385b598e858", alias: "Chimy Ávila" },
    { id: "7b86975a-da99-44b1-9b50-ca32f09935e3", alias: "CR7" },
    { id: "d04eed00-e542-42f5-aaf8-f9c2525804ff", alias: "R9" },
    { id: "eb4d7633-acde-4950-8004-0c653c3e367a", alias: "Virgil" },
    { id: "e956f1d0-ae61-41ee-809d-60fe5f5a69f8", alias: "Kvara" },
    { id: "0533357e-a297-4881-8129-e881fe7d1b68", alias: "Lord Bendtner" },
    { id: "64e60ec5-8f3e-446f-a5cd-9c36ac634efa", alias: "Santi Cazorla" },
    { id: "5d26d023-e2b7-455e-8a4f-2972d9980ccb", alias: "Belletti" },
    { id: "40ae4015-1a65-4bcc-91ca-97cd278ade21", alias: "El Apache" },
    { id: "6edd7b54-e4a0-4d81-bb26-f71bfd78f176", alias: "Kaiser" },
    { id: "b4099538-ac7c-4fc5-a293-647c51ced2d9", alias: "La Araña" },
    { id: "1a64155f-5243-467a-b2c7-45d463079f27", alias: "Tarzan" },
    { id: "39f9010f-6633-48a5-850a-378dcb939465", alias: "Black Panther" },
    { id: "3e1765ba-c3d2-492a-87e9-06a3e4f9279b", alias: "San Iker" },
    { id: "e4a88817-8c6f-4c27-9992-639a92c06244", alias: "Batigol" },
    { id: "5340f15d-ce6a-494f-aef5-1d8c9d38b6a2", alias: "El Brujita" },
    { id: "27e04cf3-2f5f-409f-9e52-4ac5a5a0d7cf", alias: "Kaká" },
    { id: "0eb10690-a84c-472f-b7b0-1217c98c18ad", alias: "Dida" },
    { id: "97b386cd-d9c5-4f0b-8054-ec9782c76b41", alias: "Alemão" },
    { id: "e32c99e0-131f-419d-818c-aac723851ec6", alias: "Paulinho" },
    { id: "78a7621f-f5cd-41e8-8c2a-a6127b2aa86d", alias: "Guti" },
    { id: "c7b7651d-4d50-424a-a498-a90589d63ce3", alias: "Michu" },
    { id: "86bb75ff-77c0-489c-8c54-08d13744e907", alias: "Mista" },
    { id: "37f7e332-9eaf-43a5-b480-ba54164b488d", alias: "Kanu" },
    { id: "769a0d36-3695-443e-8819-43eae842dbb4", alias: "Zlatan" },
    { id: "e4731df7-fd2f-4dda-bdf6-3ed44125a20c", alias: "Sylvinho" },
    { id: "8f0d015d-5e6a-4688-9784-209146b8c37e", alias: "Roque Júnior" },
    { searchStr: "Lionel Messi", alias: "Leo Messi" },
    { searchStr: "Zinedine Zidane", alias: "Zizou" },
    { searchStr: "Paulo Dybala", alias: "La Joya" },
    { searchStr: "David Mendes Da Silva", alias: "El Mago", skip: true },
    { searchStr: "David Silva", alias: "El Mago", nat: "ESP" },
    { searchStr: "Lautaro Martinez", alias: "El Toro" },
    { searchStr: "Sulley Muniru", alias: "Munir", skip: true },
    { id: "a8115bff-9d84-4eee-8f61-6faa16fe3420", alias: "Ronaldinho" },
    { id: "0909f93c-69b9-4869-b92b-ac3b2c21c140", alias: "Cafu" },
    { id: "dd6b50b8-9c41-4bbe-929b-3cf81751d770", alias: "Pepe" },
    { id: "030ca648-1118-46b5-bc0b-6c0e34b87240", alias: "Deco" },
    { id: "ca7d995f-d895-4c70-9094-e061fa1374c9", alias: "Pato" },
    { id: "128ae89b-f419-4565-bf85-474aa9498690", alias: "Fabinho" },
    { id: "82352d6a-2a90-4427-a3ed-51f9edb323a0", alias: "Marquinhos" },
    { id: "b7b69482-ce3c-44fa-b08e-f2ddab87c630", alias: "Fred" },
    { id: "44c55a04-31cf-4a67-aa55-d8f442d4472f", alias: "Xavi" },
    { id: "11c46c00-4195-4506-af7c-0f4a042f0646", alias: "Juanfran" },
    { id: "76e791e5-5990-435d-826f-cde4af53bd49", alias: "Joaquín" },
    { id: "17db4368-7627-43ca-9add-d43b5da24b10", alias: "Vitinha" },
    { id: "fd2c5f24-32f6-434b-99ef-aa92a082c989", alias: "Beto" },
    { id: "7ae8245e-e3d7-496a-8c2e-17e0148985aa", alias: "Gabi" },
    { id: "fbdcc4cc-ebd2-4e20-9ebe-7c1de7fa7134", alias: "Maxwell" },
    { id: "4b4925b5-4817-481c-a1d3-2000065a8be6", alias: "Emerson" },
    { id: "d569ef51-21be-451b-bb4f-3e074ebd1116", alias: "Maicon" },
    { id: "775b45c5-d816-4c59-9cb3-dfd2c2fd2e61", alias: "Lúcio" },
    { id: "6f7fa04d-f4d8-4ba3-8723-cad94c4350b4", alias: "Juan" },
    { id: "c5bc1e02-6500-4dea-a45e-fe2bf74fb6be", alias: "Adriano" },
    { id: "13320a0c-37b7-4dc4-aba0-729f24511265", alias: "Dani Alves" }
];
legendsToAdd.push({ name: "Munir El Haddadi Mohamed", nat: "MAR", ret: false, alias: "Munir" });
async function run() {
    console.log("=== SEEDING COMPETITIONS & CLUBS ===");
    let colComp = await prisma.competition.findFirst({ where: { countryCode: "COL" } });
    if (!colComp) {
        colComp = await prisma.competition.create({
            data: { name: "Categoría Primera A", countryCode: "COL", type: client_1.CompetitionType.DOMESTIC_LEAGUE, tier: 1 }
        });
        console.log("Created Colombia Comp:", colComp.id);
    }
    for (const c of colombiaClubs) {
        const exists = await prisma.club.findFirst({ where: { name: c } });
        if (!exists) {
            await prisma.club.create({
                data: { name: c, countryCode: "COL", currentCompetitionId: colComp.id, competitions: [colComp.name] }
            });
            console.log("  Created Club:", c);
        }
    }
    let chlComp = await prisma.competition.findFirst({ where: { countryCode: "CHL" } });
    if (!chlComp) {
        chlComp = await prisma.competition.create({
            data: { name: "Primera División", countryCode: "CHL", type: client_1.CompetitionType.DOMESTIC_LEAGUE, tier: 1 }
        });
        console.log("Created Chile Comp:", chlComp.id);
    }
    for (const c of chileClubs) {
        const exists = await prisma.club.findFirst({ where: { name: c } });
        if (!exists) {
            await prisma.club.create({
                data: { name: c, countryCode: "CHL", currentCompetitionId: chlComp.id, competitions: [chlComp.name] }
            });
            console.log("  Created Club:", c);
        }
    }
    console.log("\n=== ADDING MISSING LEGENDS ===");
    for (const leg of legendsToAdd) {
        const exists = await prisma.player.findFirst({ where: { name: leg.name } });
        if (!exists) {
            const nameParts = leg.name.split(' ');
            const p = await prisma.player.create({
                data: {
                    firstName: nameParts[0],
                    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0],
                    name: leg.name,
                    nationality: leg.nat,
                    isRetired: leg.ret,
                    aliases: [leg.alias]
                }
            });
            console.log("Created Legend:", leg.name);
            if (leg.clubStr) {
                const club = await prisma.club.findFirst({ where: { name: { contains: leg.clubStr } } });
                if (club) {
                    await prisma.playerClub.create({
                        data: {
                            playerId: p.id,
                            clubId: club.id,
                            isCurrent: true
                        }
                    });
                    console.log(`  Linked ${leg.name} to ${club.name}`);
                }
                else {
                    console.log(`  WARNING: Club ${leg.clubStr} not found for ${leg.name}`);
                }
            }
        }
        else {
            console.log("Legend already exists:", leg.name);
            if (!exists.aliases.includes(leg.alias)) {
                await prisma.player.update({
                    where: { id: exists.id },
                    data: { aliases: { push: leg.alias } }
                });
            }
        }
    }
    console.log("\n=== ASSIGNING ALIASES TO EXISTING PLAYERS ===");
    for (const item of existingAliasesToAssign) {
        if (item.skip)
            continue;
        let p;
        if (item.id) {
            p = await prisma.player.findUnique({ where: { id: item.id } });
        }
        else if (item.searchStr) {
            const q = { name: { equals: item.searchStr, mode: 'insensitive' } };
            if (item.nat)
                q.nationality = item.nat;
            p = await prisma.player.findFirst({ where: q });
        }
        if (p) {
            if (!p.aliases.includes(item.alias)) {
                await prisma.player.update({
                    where: { id: p.id },
                    data: { aliases: { push: item.alias } }
                });
                console.log(`Assigned '${item.alias}' to ${p.name}`);
            }
            else {
                console.log(`Alias '${item.alias}' already on ${p.name}`);
            }
        }
        else {
            console.log(`WARNING: Player not found for alias ${item.alias}`);
        }
    }
}
run()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=execute-legends.js.map