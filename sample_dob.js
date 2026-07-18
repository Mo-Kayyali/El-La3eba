const fs = require('fs');
const csv = require('csv-parser');

const samples = {};

fs.createReadStream('RAW_ALL_PLAYERS.csv')
  .pipe(csv())
  .on('data', (data) => {
    const batch = data.source_batch || data.source;
    if (!samples[batch]) samples[batch] = [];
    const dob = data.date_of_birth || data.dob;
    if (dob && samples[batch].length < 3) samples[batch].push(dob);
  })
  .on('end', () => {
    console.log(JSON.stringify(samples, null, 2));
  });
