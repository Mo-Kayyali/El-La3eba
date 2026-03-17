const io = require('socket.io-client');
const axios = require('axios');

const HTTP_URL = 'http://localhost:3000';

async function testWebSockets() {
  console.log('--- WebSocket Verification ---');

  // Test 1: No token
  console.log('\nTest 1: Connecting without a token...');
  const socketNoToken = io(HTTP_URL);
  
  socketNoToken.on('connect', () => {
    console.log('❌ SUCCESS (Expected FAILURE) for no token');
    socketNoToken.disconnect();
  });
  socketNoToken.on('disconnect', () => {
    console.log('✅ DISCONNECTED as expected for no token');
  });

  // Test 2: Invalid token
  console.log('\nTest 2: Connecting with an invalid token...');
  const socketInvalidToken = io(HTTP_URL, {
    auth: { token: 'invalid.jwt.token' }
  });

  socketInvalidToken.on('connect', () => {
    console.log('❌ SUCCESS (Expected FAILURE) for invalid token');
    socketInvalidToken.disconnect();
  });
  socketInvalidToken.on('disconnect', () => {
    console.log('✅ DISCONNECTED as expected for invalid token');
  });

  // Test 3: Valid token
  console.log('\nTest 3: Connecting with a valid token...');
  try {
    // Generate random user
      const random = Math.random().toString(36).substring(7) + Date.now();
      const user = {
        username: `testuser_${random}`,
        email: `test_${random}@example.com`,
        password: 'password123'
      };

    // Register
    await axios.post(`${HTTP_URL}/auth/register`, user);
    
    // Login
    const loginRes = await axios.post(`${HTTP_URL}/auth/login`, {
      email: user.email,
      password: user.password
    });
    
    const token = loginRes.data.access_token;
    console.log(`Got valid token. Logging in...`);

    const socketValidToken = io(HTTP_URL, {
      auth: { token }
    });

    socketValidToken.on('connect', () => {
      console.log('✅ SUCCESS Connecting with valid token!', socketValidToken.id);
      setTimeout(() => {
        socketValidToken.disconnect();
        console.log('\nAll tests complete. Exiting...');
        process.exit(0);
      }, 1000);
    });
    
    socketValidToken.on('disconnect', (reason) => {
      if(reason === 'io server disconnect') {
         console.log('❌ SERVER REJECTED CONNECTION!');
      }
    });

  } catch (err) {
    if (err.response) {
      console.error('Error in valid token test:', err.message, err.response.data);
    } else {
      console.error('Error in valid token test:', err.message);
    }
  }
}

testWebSockets();
