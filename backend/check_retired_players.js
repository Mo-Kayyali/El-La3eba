const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const keptCountries = [
  "Argentina", "Spain", "France", "England", "Portugal", "Brazil", 
  "Morocco", "Netherlands", "Belgium", "Germany", "Croatia", "Italy", 
  "Colombia", "Mexico", "Senegal", "Uruguay", "USA", "Japan", 
  "Switzerland", "Denmark", "Türkiye", "Ecuador", "South Korea", 
  "Nigeria", "Algeria", "Egypt", "Norway", "Ukraine", "Ivory Coast", 
  "Poland", "Wales", "Sweden", "Czechia", "Scotland", "Cameroon", 
  "Tunisia", "Saudi Arabia", "Jordan", "Ghana"
];

// Mapping for alternative names if needed
const altNames = {
  "USA": "United States of America",
  "South Korea": "Republic of Korea",
  "Ivory Coast": "Côte d'Ivoire",
  "Türkiye": "Turkey",
  "Czechia": "Czech Republic"
};

async function main() {
  const allCountries = await prisma.country.findMany();
  
  // Find matching IDs
  const keptIds = new Set();
  const notFound = [];
  
  for (const name of keptCountries) {
    const searchName = altNames[name] || name;
    const country = allCountries.find(c => 
      c.name.toLowerCase() === searchName.toLowerCase() ||
      c.name.toLowerCase() === name.toLowerCase()
    );
    if (country) {
      keptIds.add(country.id);
    } else {
      notFound.push(name);
    }
  }

  if (notFound.length > 0) {
    console.log("WARNING: Could not find these countries in the DB:", notFound.join(", "));
    // Let's try to find partial matches
    for (const name of notFound) {
       const partial = allCountries.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
       if (partial) {
         console.log(`  -> Did you mean ${partial.name} (${partial.id}) for ${name}?`);
       }
    }
  }

  // Find retired players NOT in keptIds
  const keptIdsArray = Array.from(keptIds);
  
  const toDeleteStats = await prisma.player.groupBy({
    by: ['nationality'],
    where: {
      isRetired: true,
      nationality: {
        notIn: keptIdsArray
      }
    },
    _count: {
      id: true
    }
  });

  let totalToDelete = 0;
  const breakdown = [];

  for (const stat of toDeleteStats) {
    const count = stat._count.id;
    totalToDelete += count;
    
    // Find country name
    const country = allCountries.find(c => c.id === stat.nationality);
    breakdown.push({
      countryId: stat.nationality,
      countryName: country ? country.name : "Unknown",
      count: count
    });
  }

  // Sort by count descending
  breakdown.sort((a, b) => b.count - a.count);

  console.log("\n--- DRY RUN RESULTS ---");
  console.log(`Total retired players to be deleted: ${totalToDelete}`);
  console.log("\nBreakdown by country:");
  console.table(breakdown);

  // ACTUAL DELETION
  console.log("\nExecuting deletion...");
  const deleteRes = await prisma.player.deleteMany({
    where: {
      isRetired: true,
      nationality: {
        notIn: keptIdsArray
      }
    }
  });
  console.log(`Successfully deleted ${deleteRes.count} players.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
