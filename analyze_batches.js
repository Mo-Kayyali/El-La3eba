const fs = require('fs');
const csv = require('csv-parser');

const batchColumns = {};

fs.createReadStream('RAW_ALL_PLAYERS.csv')
  .pipe(csv())
  .on('data', (data) => {
    const batch = data.source_batch || data.source;
    if (!batchColumns[batch]) {
      batchColumns[batch] = new Set();
    }
    for (const key in data) {
      if (data[key] && data[key].trim() !== '') {
        batchColumns[batch].add(key);
      }
    }
  })
  .on('end', () => {
    for (const batch in batchColumns) {
      console.log(`Batch: ${batch}`);
      console.log(`Columns: ${Array.from(batchColumns[batch]).join(', ')}\n`);
    }
  });
