const fs = require('fs');
const csv = require('csv-parser');

const samples = {
  clubs_and_years: [],
  previous_clubs: [],
  years_active_at_club: []
};

fs.createReadStream('RAW_ALL_PLAYERS.csv')
  .pipe(csv())
  .on('data', (data) => {
    if (data.clubs_and_years && samples.clubs_and_years.length < 5) samples.clubs_and_years.push(data.clubs_and_years);
    if (data.previous_clubs && samples.previous_clubs.length < 5) samples.previous_clubs.push(data.previous_clubs);
    if (data.years_active_at_club && samples.years_active_at_club.length < 5) samples.years_active_at_club.push(data.years_active_at_club);
  })
  .on('end', () => {
    console.log(JSON.stringify(samples, null, 2));
  });
