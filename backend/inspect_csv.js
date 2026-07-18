const fs = require('fs');
const readline = require('readline');

async function readLines(filePath, startLine, endLine) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentLine = 1;
  const lines = [];
  for await (const line of rl) {
    if (currentLine >= startLine && currentLine <= endLine) {
      lines.push(`${currentLine}: ${line}`);
    }
    if (currentLine > endLine) {
      break;
    }
    currentLine++;
  }
  return lines;
}

async function run() {
  console.log('--- Rows 14388 - 14392 (Header of first block) ---');
  const b1 = await readLines('../RAW_ALL_PLAYERS.csv', 14388, 14392);
  console.log(b1.join('\n'));

  console.log('\n--- Rows 14542 - 14545 (Header of second block) ---');
  const b2 = await readLines('../RAW_ALL_PLAYERS.csv', 14542, 14545);
  console.log(b2.join('\n'));
  
  console.log('\n--- Rows 14592 - 14595 (Header of third block) ---');
  const b3 = await readLines('../RAW_ALL_PLAYERS.csv', 14592, 14595);
  console.log(b3.join('\n'));
}

run().catch(console.error);
