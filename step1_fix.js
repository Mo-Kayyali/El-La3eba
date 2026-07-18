const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

const crosswalk = JSON.parse(fs.readFileSync('country_crosswalk.json', 'utf-8'));

const results = [];
let baseCount = 0;
let egyptCount = 0;

fs.createReadStream('RAW_ALL_CLUBS.csv')
  .pipe(csv())
  .on('data', (data) => {
    if (data.source_batch === 'egypt_manual') {
      const countryCode = crosswalk[data.country];
      
      let compId = null;
      // It's 1.0 or 2.0 in the CSV based on previous check
      if (String(data.division) === '1.0' || String(data.division).includes('1')) {
        compId = 'EGY1';
      } else if (String(data.division) === '2.0' || String(data.division).includes('2')) {
        compId = 'EGY2';
      }

      results.push({
        club_id: uuidv4(),
        club_slug: data.club_name.toLowerCase().replace(/\s+/g, '-'),
        clean_name: data.club_name,
        countryCode: countryCode,
        competition_id: compId,
        logo_url: null,
        source_batch: data.source_batch
      });
      egyptCount++;
    } else {
      results.push({
        club_id: data.club_id,
        club_slug: data.club_slug,
        clean_name: data.clean_name,
        countryCode: data.countryCode,
        competition_id: data.competition_id,
        logo_url: data.logo_url,
        source_batch: data.source_batch
      });
      baseCount++;
    }
  })
  .on('end', () => {
    fs.writeFileSync('clean_clubs.json', JSON.stringify(results, null, 2));
    console.log(`Regenerated clean_clubs.json. Processed ${baseCount} base clubs and ${egyptCount} egypt clubs. Total: ${results.length}`);
  });
