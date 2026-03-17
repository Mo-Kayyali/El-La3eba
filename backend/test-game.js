const { io } = require('socket.io-client');

async function getToken(playerNum) {
  const email = `testbot${playerNum}@test.com`;
  const password = 'password123';

  // 1. Register the bot (we catch and ignore the error if it already exists)
  await fetch('http://localhost:3000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username: `TestBot${playerNum}`, password }),
  }).catch(() => {});

  // 2. Log the bot in
  const res = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  return { token: data.access_token, id: data.user?.id };
}

async function runTest() {
  console.log('Authenticating bots...');
  const p1 = await getToken(1);
  const p2 = await getToken(2);

  if (!p1.token || !p2.token) {
    return console.error('❌ Failed to authenticate. Is your backend running?');
  }

  console.log('✅ Tokens received. Connecting to WebSockets...');

  const client1 = io('http://localhost:3000', {
    auth: { token: p1.token },
    autoConnect: false,
  });

  const client2 = io('http://localhost:3000', {
    auth: { token: p2.token },
    autoConnect: false,
  });

  let gameSessionId = null;

  // --- 1. ERROR & DISCONNECT LISTENERS --- //
  const attachErrorListeners = (client, botName) => {
    client.on('connect_error', (err) =>
      console.error(`❌ ${botName} Connect Error:`, err.message),
    );
    client.on('disconnect', (reason) =>
      console.log(`⚠️ ${botName} Disconnected:`, reason),
    );
    client.on('exception', (err) =>
      console.error(`🔥 ${botName} Exception:`, err),
    );
  };

  attachErrorListeners(client1, 'Bot 1');
  attachErrorListeners(client2, 'Bot 2');

  // --- 2. QUEUE & MATCHMAKING --- //
  client1.on('connect', () => {
    console.log(`Bot 1 (${p1.id}) connected. Joining queue...`);
    client1.emit('joinQueue');
  });

  client2.on('connect', () => {
    console.log(`Bot 2 (${p2.id}) connected. Joining queue...`);
    client2.emit('joinQueue');
  });

  const handleMatch = (playerNum, client, data) => {
    console.log(
      `\n🎉 Bot ${playerNum} matched! Session ID:`,
      data.gameSessionId,
    );
    gameSessionId = data.gameSessionId;

    // Tell the server we are officially entering the room
    client.emit('joinGameRoom', { gameSessionId: data.gameSessionId });
  };

  client1.on('matchFound', (data) => handleMatch(1, client1, data));
  client2.on('matchFound', (data) => handleMatch(2, client2, data));

  // --- 3. GAMEPLAY LOGIC --- //
  const handleGameStateUpdate = (botNum, client, playerId, payload) => {
    // Extract the nested state, or fallback if the backend sends it flat
    const state = payload.state || payload;

    // Only log the state once per turn to avoid console spam
    if (botNum === 1) {
      console.log('\n--- 🎮 GAME STATE UPDATE ---');
      console.log(
        `Current Turn: ${state.currentTurn === p1.id ? 'Bot 1' : 'Bot 2'}`,
      );
      console.log('Guessed Players:', state.guessedPlayers);
      console.log('Scores:', state.scores);
      console.log('Strikes:', state.strikes);
    }

    // Bot 1 Turn Logic
    if (botNum === 1 && state.currentTurn === playerId) {
      if (state.guessedPlayers?.length === 0) {
        console.log('\n🤖 Bot 1 typing: "Messi"...');
        setTimeout(() => {
          client.emit('submitGuess', { gameSessionId, guessName: 'Messi' });
        }, 1500);
      } else if (state.guessedPlayers?.length >= 2) {
        console.log('\n🤖 Bot 1 typing: "Mbappe"...');
        setTimeout(() => {
          client.emit('submitGuess', { gameSessionId, guessName: 'Mbappe' });
        }, 1500);
      }
    }

    // Bot 2 Turn Logic
    if (botNum === 2 && state.currentTurn === playerId) {
      if (state.guessedPlayers?.length === 1) {
        console.log('\n🤖 Bot 2 typing: "Bellingham"...');
        setTimeout(() => {
          // CHANGED: guess -> guessName
          client.emit('submitGuess', {
            gameSessionId,
            guessName: 'Bellingham',
          });
        }, 1500);
      } else if (state.guessedPlayers?.length > 1) {
        console.log('\n🤖 Bot 2 typing: "Fake Player" (Testing strike)...');
        setTimeout(() => {
          // CHANGED: guess -> guessName
          client.emit('submitGuess', {
            gameSessionId,
            guessName: 'Fake Player',
          });
        }, 1500);
      }
    }
  };

  client1.on('gameStateUpdated', (payload) =>
    handleGameStateUpdate(1, client1, p1.id, payload),
  );
  client2.on('gameStateUpdated', (payload) =>
    handleGameStateUpdate(2, client2, p2.id, payload),
  );

  // --- 4. GAME OVER LOGIC --- //
  const handleGameOver = (payload) => {
    console.log('\n🏁 --- GAME OVER --- 🏁');
    console.log('Final Result:', payload);
    console.log('Disconnecting bots and exiting test...');
    client1.disconnect();
    client2.disconnect();
    process.exit(0); // Exits the Node script cleanly
  };

  // Listen for game over events (adjust the string if your backend uses a different event name)
  client1.on('gameOver', handleGameOver);
  client1.on('gameEnded', handleGameOver);

  // --- START THE TEST --- //
  client1.connect();
  client2.connect();
}

runTest();
