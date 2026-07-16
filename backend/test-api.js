const http = require('http');

async function req(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log("1. Login as admin...");
  const loginRes = await req('POST', '/auth/login', { email: 'admin@gmail.com', password: 'admin123' });
  const token = loginRes.body.access_token;

  console.log("\n2. Get a valid player ID for testing...");
  const searchRes = await req('GET', '/admin/players/search?q=a', null, token);
  let validPlayerId = null;
  if (searchRes.body.length > 0) {
    validPlayerId = searchRes.body[0].id;
  } else {
    console.log("No players found, creating one...");
    const playerRes = await req('POST', '/admin/players', {
      firstName: "Test", lastName: "Guy", name: "Test Guy", nationality: "ESP", positions: ["ST"], isRetired: false
    }, token);
    validPlayerId = playerRes.body.id;
  }
  
  const invalidPlayerId = "00000000-0000-0000-0000-000000000000";

  console.log("\n--- SHAPE VALIDATION TESTS ---");

  console.log("\nTest A: STRIKES / FILTER missing filterValue -> Expect 400");
  let res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "STRIKES", answerType: "FILTER", filterType: "NATIONALITY", filterValue: null
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest B: STRIKES / FILTER with answers -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "STRIKES", answerType: "FILTER", filterType: "NATIONALITY", filterValue: "ESP",
    answers: [{ playerId: validPlayerId }]
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest C: TOP_10 missing ranks -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "TOP_10",
    answers: [{ playerId: validPlayerId }] // No rank
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest D: TOP_10 duplicate ranks -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "TOP_10",
    answers: [{ playerId: validPlayerId, rank: 1 }, { playerId: validPlayerId, rank: 1 }]
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest E: TOP_10 duplicate playerId -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "TOP_10",
    answers: [{ playerId: validPlayerId, rank: 1 }, { playerId: validPlayerId, rank: 2 }]
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest F: LINEUP missing slotLabel -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "LINEUP",
    answers: [{ playerId: validPlayerId }] // No slotLabel
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest G: PHOTO_GUESS missing photoPlayerId -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "PHOTO_GUESS"
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest H: PHOTO_GUESS with answers array -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "PHOTO_GUESS", photoPlayerId: validPlayerId,
    answers: [{ playerId: validPlayerId }]
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\n--- FK VALIDATION TESTS ---");

  console.log("\nTest I: LIST with invalid playerId -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "STRIKES", answerType: "LIST",
    answers: [{ playerId: invalidPlayerId }]
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\nTest J: PHOTO_GUESS with invalid photoPlayerId -> Expect 400");
  res = await req('POST', '/admin/questions', {
    text: "Q1", gameMode: "PHOTO_GUESS", photoPlayerId: invalidPlayerId
  }, token);
  console.log(`Status: ${res.status}`, res.body.message);

  console.log("\n--- VALID CREATION TEST ---");
  console.log("\nTest K: Valid STRIKES / FILTER");
  res = await req('POST', '/admin/questions', {
    text: "Name a player from Spain", gameMode: "STRIKES", answerType: "FILTER",
    filterType: "NATIONALITY", filterValue: "ESP"
  }, token);
  console.log(`Status: ${res.status}`);
  if (res.status === 201) console.log("Success! ID:", res.body.id);

  console.log("\nDone!");
}

runTest().catch(console.error);
