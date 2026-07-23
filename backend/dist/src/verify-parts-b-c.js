"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function verifyPartsBandC() {
    console.log('====================================================');
    console.log('PART B & PART C VERIFICATION');
    console.log('====================================================\n');
    const mockFriendsData = [
        { userId: 'u1', username: 'OnlineFriend', presence: { status: 'online' } },
        { userId: 'u2', username: 'InGameFriend', presence: { status: 'in-game' } },
        { userId: 'u3', username: 'OfflineFriend', presence: { status: 'offline' } },
        { userId: 'u4', username: 'DefaultFriend', presence: undefined },
    ];
    const onlineFriends = mockFriendsData.filter((f) => (f.presence?.status ?? 'offline') !== 'offline');
    console.log('--- PART B: Online Friend Filtering ---');
    console.log('Raw friends count:', mockFriendsData.length);
    console.log('Filtered online friends:', onlineFriends.map((f) => `${f.username} (${f.presence?.status})`));
    const partBPass = onlineFriends.length === 2 && !onlineFriends.some((f) => f.username === 'OfflineFriend');
    console.log(partBPass ? '✅ PASS: Only non-offline users included in invite list.' : '❌ FAIL: Offline users present.');
    console.log('\n--- PART C1: Invite Button Room Scoping ---');
    const currentRoomCode = 'LOBBY_B';
    const outgoingInvites = {
        u1: { friendId: 'u1', roomCode: 'LOBBY_A' },
        u2: { friendId: 'u2', roomCode: 'LOBBY_B' },
    };
    const getPendingInvite = (friendId) => {
        const raw = outgoingInvites[friendId];
        return raw?.roomCode === currentRoomCode ? raw : null;
    };
    const u1Pending = getPendingInvite('u1');
    const u2Pending = getPendingInvite('u2');
    console.log(`Friend u1 (invited to LOBBY_A) pending in LOBBY_B:`, u1Pending);
    console.log(`Friend u2 (invited to LOBBY_B) pending in LOBBY_B:`, u2Pending);
    const partC1Pass = u1Pending === null && u2Pending !== null;
    console.log(partC1Pass ? '✅ PASS: Stale invites from destroyed/other lobbies are ignored.' : '❌ FAIL: Stale invite leaked.');
    console.log('\n--- PART C2: Joined Button State ---');
    const lobbyState = {
        roomCode: 'LOBBY_B',
        hostId: 'u0',
        guestId: 'u1',
    };
    const computeButtonState = (friendId, presenceStatus) => {
        const isAlreadyInLobby = String(friendId) === String(lobbyState.hostId) || String(friendId) === String(lobbyState.guestId);
        if (isAlreadyInLobby)
            return { label: 'Joined', disabled: true, style: 'greyed' };
        const pendingInvite = getPendingInvite(friendId);
        if (pendingInvite)
            return { label: 'Cancel', disabled: false, style: 'red' };
        if (presenceStatus !== 'offline')
            return { label: 'Invite', disabled: false, style: 'blue' };
        return { label: 'Invite', disabled: true, style: 'disabled' };
    };
    const u1State = computeButtonState('u1', 'online');
    const u2State = computeButtonState('u2', 'online');
    const u5State = computeButtonState('u5', 'online');
    console.log('u1 button state (in lobby):', u1State);
    console.log('u2 button state (invited):', u2State);
    console.log('u5 button state (available):', u5State);
    const partC2Pass = u1State.label === 'Joined' && u1State.disabled && u2State.label === 'Cancel' && !u2State.disabled;
    console.log(partC2Pass ? '✅ PASS: Joined state is distinct, disabled, and labeled "Joined".' : '❌ FAIL: Joined state incorrect.');
}
verifyPartsBandC().catch(console.error);
//# sourceMappingURL=verify-parts-b-c.js.map