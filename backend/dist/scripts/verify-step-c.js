"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const BASE_URL = 'http://localhost:3000';
async function registerAndLogin(username) {
    await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${username}@example.com`, password: 'password123', username })
    });
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${username}@example.com`, password: 'password123' })
    });
    const data = await loginRes.json();
    return data.access_token;
}
const waitForEvent = (socket, event) => {
    return new Promise((resolve) => {
        socket.once(event, resolve);
    });
};
const emitWithAck = (socket, event, payload) => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ack on ${event}`)), 2000);
        const cb = (res) => {
            clearTimeout(timeout);
            resolve(res);
        };
        if (payload) {
            socket.emit(event, payload, cb);
        }
        else {
            socket.emit(event, cb);
        }
    });
};
async function createClient(username) {
    const token = await registerAndLogin(username);
    const socket = (0, socket_io_client_1.io)(BASE_URL, { auth: { token } });
    await waitForEvent(socket, 'connect');
    const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const me = await res.json();
    return { socket, userId: me.id, username: me.username };
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runCodeFlow() {
    console.log('\n--- SCENARIO 1: JOIN VIA CODE ---');
    const host = await createClient(`host_code_${Date.now()}`);
    const guest = await createClient(`guest_code_${Date.now()}`);
    let hostRoomCode = '';
    host.socket.on('lobbyStateUpdated', (state) => {
        console.log(`[Host ${host.username}] lobbyStateUpdated:`, JSON.stringify(state, null, 2));
    });
    guest.socket.on('lobbyStateUpdated', (state) => {
        console.log(`[Guest ${guest.username}] lobbyStateUpdated:`, JSON.stringify(state, null, 2));
    });
    console.log('>>> Host creating lobby...');
    const createRes = await emitWithAck(host.socket, 'createLobby', {
        config: { composition: ['STRIKES'], timerConfig: { STRIKES: 15000 } }
    });
    hostRoomCode = createRes.roomCode;
    await sleep(100);
    console.log(`\n>>> Guest joining lobby ${hostRoomCode}...`);
    await emitWithAck(guest.socket, 'joinPrivateMatch', { roomCode: hostRoomCode });
    await sleep(100);
    console.log('\n>>> Guest readying up...');
    await emitWithAck(guest.socket, 'toggleLobbyReady');
    await sleep(100);
    console.log('\n>>> Host readying up...');
    await emitWithAck(host.socket, 'toggleLobbyReady');
    await sleep(100);
    console.log('\n>>> Host starting match...');
    host.socket.on('matchFound', (data) => console.log(`[Host] matchFound:`, data));
    guest.socket.on('matchFound', (data) => console.log(`[Guest] matchFound:`, data));
    await emitWithAck(host.socket, 'startLobbyMatch');
    await sleep(100);
    host.socket.disconnect();
    guest.socket.disconnect();
}
async function runInviteFlow() {
    console.log('\n--- SCENARIO 2: JOIN VIA INVITE ---');
    const host = await createClient(`host_inv_${Date.now()}`);
    const guest = await createClient(`guest_inv_${Date.now()}`);
    host.socket.on('lobbyStateUpdated', (state) => {
        console.log(`[Host ${host.username}] lobbyStateUpdated:`, JSON.stringify(state, null, 2));
    });
    guest.socket.on('lobbyStateUpdated', (state) => {
        console.log(`[Guest ${guest.username}] lobbyStateUpdated:`, JSON.stringify(state, null, 2));
    });
    let inviteEvent = null;
    guest.socket.on('gameInviteReceived', (data) => {
        console.log(`[Guest ${guest.username}] gameInviteReceived:`, data);
        inviteEvent = data;
    });
    console.log('>>> Host creating lobby...');
    await emitWithAck(host.socket, 'createLobby', {
        config: { composition: ['TOP_10'], timerConfig: { TOP_10: 10000 } }
    });
    await sleep(100);
    console.log('\n>>> Host sending invite...');
    await emitWithAck(host.socket, 'sendGameInvite', { friendId: guest.userId });
    await sleep(100);
    console.log('\n>>> Guest accepting invite...');
    await emitWithAck(guest.socket, 'acceptGameInvite', { inviterId: host.userId });
    await sleep(100);
    host.socket.disconnect();
    guest.socket.disconnect();
}
async function main() {
    await runCodeFlow();
    await runInviteFlow();
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=verify-step-c.js.map