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
  const userId = data.user?.id || data.user?.sub || data.user?.userId || data.userId;
  return { token: data.access_token, id: userId };
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

    if (state.status === 'match_completed' || state.winner) {
      return; // Ignore if game is already over
    }

    // Only log the state once per turn to avoid console spam
    if (botNum === 1) {
      console.log('\n--- 🎮 GAME STATE UPDATE ---');
      console.log(`Round ${state.currentRound} | Overall Scores: Bot 1 [${state.overallScores?.[p1.id] || 0}] - Bot 2 [${state.overallScores?.[p2.id] || 0}]`);
      console.log(
        `Current Turn: ${state.currentTurn === p1.id ? 'Bot 1' : 'Bot 2'}`,
      );
      console.log('Guessed Players:', state.guessedPlayers);
      console.log('Scores:', state.scores);
      console.log('Strikes:', state.strikes);
    }

    // Bot 1 Turn Logic
    if (botNum === 1 && state.currentTurn === playerId) {
      console.log(`\n🤖 Bot 1 is thinking... (Strikes: ${state.strikes[playerId]})`);
      
      let nextGuess = 'Messi';
      // If round 1, bot 1 wins (by guessing correctly)
      if (state.currentRound === 1) {
          if (state.guessedPlayers?.length === 1) nextGuess = 'Ronaldo';
          if (state.guessedPlayers?.length >= 2) nextGuess = 'Mbappe';
      }
      // If round 2, bot 1 throws the game to let bot 2 win
      else if (state.currentRound === 2) {
          nextGuess = 'Bot 1 intentionally failing ' + Math.random();
      }
      // If round 3, bot 1 tries to win again
      else {
          if (state.guessedPlayers?.length === 0) nextGuess = 'Vinicius Junior';
          if (state.guessedPlayers?.length === 1) nextGuess = 'Bellingham';
          if (state.guessedPlayers?.length >= 2) nextGuess = 'Haaland';
      }
      
      setTimeout(() => {
        console.log(`🤖 Bot 1 submitting guess: "${nextGuess}"`);
        client.emit('submitGuess', { gameSessionId, guessName: nextGuess });
      }, 2000);
    }

    // Bot 2 Turn Logic
    if (botNum === 2 && state.currentTurn === playerId) {
      console.log(`\n🤖 Bot 2 is thinking... (Strikes: ${state.strikes[playerId]})`);
      
      let nextGuess = 'Kevin De Bruyne';
      // If round 1, bot 2 throws
      if (state.currentRound === 1) {
          nextGuess = 'Bot 2 intentionally failing ' + Math.random();
      }
      // If round 2, bot 2 tries to win
      else if (state.currentRound === 2) {
          if (state.guessedPlayers?.length === 0) nextGuess = 'Salah';
          if (state.guessedPlayers?.length === 1) nextGuess = 'Saka';
          if (state.guessedPlayers?.length >= 2) nextGuess = 'Foden';
      }
      // If round 3, bot 2 throws again
      else {
          nextGuess = 'Bot 2 fails again ' + Math.random();
      }
      
      setTimeout(() => {
        console.log(`🤖 Bot 2 submitting guess: "${nextGuess}"`);
        client.emit('submitGuess', { gameSessionId, guessName: nextGuess });
      }, 2000);
    }
  };

  client1.on('gameStateUpdated', (payload) =>
    handleGameStateUpdate(1, client1, p1.id, payload),
  );
  client2.on('gameStateUpdated', (payload) =>
    handleGameStateUpdate(2, client2, p2.id, payload),
  );

  client1.on('nextRoundStarted', (payload) => {
    console.log(`\n🔔 --- ROUND ${payload.state.currentRound} STARTED --- 🔔`);
    handleGameStateUpdate(1, client1, p1.id, payload);
  });
  client2.on('nextRoundStarted', (payload) => {
    handleGameStateUpdate(2, client2, p2.id, payload);
  });

  // --- 4. GAME OVER LOGIC --- //
  const handleGameOver = (payload) => {
    console.log('\n🏁 --- GAME OVER --- 🏁');
    console.log('Final Result:', payload);
    console.log('Disconnecting bots and exiting test...');
    client1.disconnect();
    client2.disconnect();
    process.exit(0); // Exits the Node script cleanly
  };

  // Listen for game over events
  client1.on('matchOver', handleGameOver);
  client2.on('matchOver', handleGameOver);

  // --- START THE TEST --- //
  console.log('Connecting Bot 1...');
  client1.connect();
  
  setTimeout(() => {
    console.log('Connecting Bot 2...');
    client2.connect();
  }, 1000);
}

runTest();
