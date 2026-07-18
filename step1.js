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
      if (!countryCode) {
        console.error(`Missing country code for: ${data.country}`);
      }
      
      let compId = null;
      if (data.division.toLowerCase().includes('first')) {
        compId = 'EGY1';
      } else if (data.division.toLowerCase().includes('second')) {
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
    console.log(`Processed ${baseCount} base clubs and ${egyptCount} egypt clubs. Total: ${results.length}`);
  });
