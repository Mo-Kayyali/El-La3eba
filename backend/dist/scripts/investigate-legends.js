"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const prisma = new client_1.PrismaClient();
const rawList = `
1. Pelé — Edson Arantes do Nascimento
2. Garrincha — Manuel Francisco dos Santos
3. Zico — Arthur Antunes Coimbra
4. Kaká — Ricardo Izecson dos Santos Leite
5. Ronaldinho — Ronaldo de Assis Moreira
6. Cafu — Marcos Evangelista de Morais
7. Dunga — Carlos Caetano Bledorn Verri
8. Bebeto — José Roberto Gama de Oliveira
9. Dida — Nélson de Jesus Silva
10. Vampeta — Marcos André Batista Santos
11. Careca — Antônio de Oliveira Filho
12. Alemão — Ricardo Rogério de Brito
13. Pepe — Képler Laveran de Lima Ferreira
14. Deco — Anderson Luís de Souza
15. Nani — Luís Carlos Almeida da Cunha
16. Hulk — Givanildo Vieira de Sousa
17. Pato — Alexandre Rodrigues da Silva
18. Ganso — Paulo Henrique Chagas de Lima
19. Grafite — Edinaldo Batista Libânio
20. Fabinho — Fábio Henrique Tavares
21. Marquinhos — Marcos Aoás Corrêa
22. Fred — Frederico Rodrigues de Paula Santos
23. Raphinha — Raphael Dias Belloli
24. Gabigol — Gabriel Barbosa Almeida
25. Paulinho — José Paulo Bezerra Maciel Júnior
26. Xavi — Xavier Hernández Creus
27. Guti — José María Gutiérrez Hernández
28. Pedri — Pedro González López
29. Gavi — Pablo Martín Páez Gavira
30. Isco — Francisco Román Alarcón Suárez
31. Koke — Jorge Resurrección Merodio
32. Michu — Miguel Pérez Cuesta
33. Nolito — Manuel Agudo Durán
34. Juanfran — Juan Francisco Torres Belén
35. Míchel — José Miguel González Martín del Campo
36. Joaquín — Joaquín Sánchez Rodríguez
37. Suso — Jesús Joaquín Fernández Sáenz de la Torre
38. Munir — Munir El Haddadi Mohamed
39. Joselu — José Luís Mato Sanmartín
40. Mista — Miguel Ángel Ferrer Martínez
41. Vitinha — Vítor Machado Ferreira
42. Jota — João Pedro Neves Filipe
43. Palhinha — João Maria Lobo Alves Palhinha Gonçalves
44. Chico Conceição — Francisco Fernandes da Conceição
45. Beto — António Alberto Bastos Pimparel
46. Gervinho — Gervais Lombe Yao Kouassi
47. Kanu — Nwankwo Kanu
48. Jay-Jay Okocha — Augustine Azuka Okocha
49. Chimy Ávila — Luis Ezequiel Ávila
50. El Tren Valencia — Adolfo José Valencia Mosquera
51. CR7 — Cristiano Ronaldo dos Santos Aveiro
52. Leo Messi — Lionel Andrés Messi
53. R9 — Ronaldo Luís Nazário de Lima
54. Zlatan — Zlatan Ibrahimović
55. Memphis — Memphis Depay (recommends just 'Memphis')
56. Virgil — Virgil van Dijk (wears 'Virgil' due to family reasons)
57. Dele — Bamidele Jermaine Alli (dropped "Alli" for "Dele")
58. Kvara — Khvicha Kvaratskhelia
59. Chicharito — Javier Hernández Balcázar (means "Little Pea")
60. Kun Agüero — Sergio Leonel Agüero del Castillo (nickname from a cartoon)
61. Falcao — Radamel Falcao García Zárate (named after a player)
62. Lord Bendtner — Nicklas Bendtner
63. Santi Cazorla — Santiago Cazorla González
64. Gabi — Gabriel Fernández Arenas
65. Edu — Eduardo César Daude Gaspar
66. Sylvinho — Sylvio Mendes Campos Júnior
67. Maxwell — Maxwell Scherrer Cabelino Andrade
68. Emerson — Emerson Ferreira da Rosa
69. Maicon — Maicon Douglas Sisenando
70. Lúcio — Lucimar da Silva Ferreira
71. Juan — Juan Silveira dos Santos
72. Roque Júnior — José Vitor Roque Júnior
73. Belletti — Juliano Haus Belletti
74. Adriano — Adriano Leite Ribeiro
75. Dani Alves — Daniel Alves da Silva
76. El Niño — Fernando José Torres Sanz
77. Zizou — Zinedine Yazid Zidane
78. El Apache — Carlos Alberto Martínez Tevez
79. El Fideo — Ángel Fabián Di María Hernández
80. La Joya — Paulo Bruno Exequiel Dybala
81. El Pistolero — Luis Alberto Suárez Díaz
82. El Matador — Edinson Roberto Cavani Gómez
83. Der Bomber — Gerhard "Gerd" Müller
84. Il Divin Codino — Roberto Baggio ("The Divine Ponytail")
85. Kaiser — Franz Anton Beckenbauer
86. El Rey Arturo — Arturo Erasmo Vidal Pardo
87. La Araña — Julián Álvarez
88. El Mago — David Josué Jiménez Silva
89. El Loco — René Higuita
90. Pitbull — Gary Alexis Medel Soto
91. Tarzan — Carles Puyol i Saforcada
92. El Toro — Lautaro Javier Martínez
93. Black Panther — Eusébio da Silva Ferreira
94. San Iker — Iker Casillas Fernández
95. The Non-Flying Dutchman — Dennis Bergkamp
96. The Galloping Major — Ferenc Puskás
97. Captain Marvel — Bryan Robson
98. El Cholo — Diego Pablo Simeone
99. Batigol — Gabriel Omar Batistuta
100. El Brujita — Juan Sebastián Verón
`;
function normalize(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
async function run() {
    const players = await prisma.player.findMany({
        select: { id: true, name: true, nationality: true, isRetired: true, playerClubs: { include: { club: true } } }
    });
    const lines = rawList.trim().split('\n');
    const results = [];
    for (const line of lines) {
        if (!line.trim())
            continue;
        const match = line.match(/^\d+\.\s+(.*?)\s+—\s+(.*)$/);
        if (!match)
            continue;
        const knownName = match[1].trim();
        const rawReal = match[2].trim();
        let cleanReal = rawReal.replace(/\s*\(.*?\)\s*/g, '').replace(/"/g, '').trim();
        if (rawReal.includes('"Gerd" Müller')) {
            cleanReal = 'Gerd Müller';
        }
        const matchesMap = new Map();
        for (const p of players) {
            const pNorm = normalize(p.name);
            const knownNorm = normalize(knownName);
            const realNorm = normalize(cleanReal);
            const pWords = pNorm.split(/\s+/);
            const realWords = realNorm.split(/\s+/);
            let matchedOn = '';
            if (pNorm === knownNorm)
                matchedOn = 'knownName exact';
            else if (pNorm === realNorm)
                matchedOn = 'realName exact';
            else if (pWords.includes(knownNorm))
                matchedOn = 'knownName word match';
            else if (realNorm.includes(pNorm) && pNorm.length > 5 && (pNorm.startsWith(realWords[0]) || pNorm.endsWith(realWords[realWords.length - 1]))) {
                matchedOn = 'realName subset';
            }
            else if (pNorm.includes(realNorm)) {
                matchedOn = 'p.name superset of realName';
            }
            else if (pNorm === 'eusebio' && knownNorm === 'black panther') {
                matchedOn = 'realName subset';
            }
            if (matchedOn) {
                matchesMap.set(p.id, { player: p, matchedOn });
            }
        }
        const matches = Array.from(matchesMap.values());
        const safeMatches = matches.filter(m => {
            if (m.matchedOn === 'knownName word match' && knownName.length <= 3 && m.player.name.toLowerCase() !== knownName.toLowerCase())
                return false;
            return true;
        });
        let cat = '';
        if (safeMatches.length === 0)
            cat = 'C';
        else if (safeMatches.length === 1)
            cat = 'A';
        else {
            if (safeMatches.length === 2) {
                cat = 'B/D';
            }
            else {
                cat = 'D';
            }
        }
        results.push({
            line: line.trim(),
            knownName,
            cleanReal,
            matches: safeMatches,
            cat
        });
    }
    for (const r of results) {
        if (r.cat === 'B/D' || r.cat === 'D') {
            const distinctNames = new Set(r.matches.map((m) => normalize(m.player.name)));
            if (r.matches.length === 2 && distinctNames.size === 2) {
                const hasKnown = r.matches.some((m) => m.matchedOn.includes('knownName'));
                const hasReal = r.matches.some((m) => m.matchedOn.includes('realName'));
                if (hasKnown && hasReal)
                    r.cat = 'B';
                else
                    r.cat = 'D';
            }
            else {
                r.cat = 'D';
            }
        }
    }
    const report = [];
    report.push('# Legend Aliases Investigation Report\n');
    const groups = ['A', 'B', 'C', 'D'];
    for (const g of groups) {
        const items = results.filter(r => r.cat === g);
        report.push(`## Category ${g} (${items.length})\n`);
        if (items.length === 0) {
            report.push('No entries in this category.\n');
            continue;
        }
        if (g === 'A') {
            report.push('| Known Name | Real Name | Matched Player | Nationality | Matched On |');
            report.push('| :--- | :--- | :--- | :--- | :--- |');
            for (const item of items) {
                const m = item.matches[0];
                report.push(`| ${item.knownName} | ${item.cleanReal} | ${m.player.name} (${m.player.id}) | ${m.player.nationality} | ${m.matchedOn} |`);
            }
        }
        else if (g === 'B' || g === 'D') {
            for (const item of items) {
                report.push(`### ${item.knownName} — ${item.cleanReal}`);
                for (const m of item.matches) {
                    const clubStr = m.player.playerClubs.map((pc) => pc.club.name).slice(0, 3).join(', ');
                    report.push(`- **${m.player.name}** (${m.player.nationality}) - *${m.matchedOn}* - [${m.player.id}] - Retired: ${m.player.isRetired} - Clubs: ${clubStr}`);
                }
                report.push('');
            }
        }
        else if (g === 'C') {
            report.push('| Known Name | Real Name |');
            report.push('| :--- | :--- |');
            for (const item of items) {
                report.push(`| ${item.knownName} | ${item.cleanReal} |`);
            }
        }
        report.push('\n');
    }
    fs.writeFileSync('C:/Users/moham/.gemini/antigravity-ide/brain/170c822a-06a7-4fea-b2dd-611c12ab0462/legend_investigation.md', report.join('\n'));
    console.log('Investigation written to artifact.');
}
run()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=investigate-legends.js.map