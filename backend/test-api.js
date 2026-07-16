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

  console.log("\n2. Create a valid club...");
  const clubRes = await req('POST', '/admin/clubs', {
    name: "Test Club",
    countryCode: "ESP"
  }, token);
  const firstClub = clubRes.body;
  
  // Make a non-existent UUID by changing the first character of the valid UUID
  const nonExistentUuid = firstClub.id.replace(/^./, firstClub.id[0] === 'a' ? 'b' : 'a');

  console.log("\n3. Test POST /admin/players with bad Club reference (Valid UUID but non-existent)...");
  const badClubRes = await req('POST', '/admin/players', {
    firstName: "Test",
    lastName: "Player",
    name: "Test Player",
    nationality: "ESP", 
    currentClubId: nonExistentUuid,
    positions: ["ST"],
    isRetired: false
  }, token);
  console.log("Status:", badClubRes.status);
  console.log("Body:", badClubRes.body);

  console.log("\nDone!");
}

runTest().catch(console.error);
