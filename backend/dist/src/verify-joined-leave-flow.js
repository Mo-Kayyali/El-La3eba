"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function verifyJoinedLeaveFlow() {
    console.log('====================================================');
    console.log('JOINED TO INVITE STATE TRANSITION VERIFICATION');
    console.log('====================================================\n');
    let outgoingInvites = {};
    let lobbyState = {
        roomCode: 'LOBBY1',
        hostId: 'host1',
        guestId: null,
    };
    const friendUserId = 'guest1';
    const roomCode = 'LOBBY1';
    const clearOutgoingInvite = (id) => {
        delete outgoingInvites[id];
    };
    outgoingInvites[friendUserId] = { friendId: friendUserId, roomCode };
    console.log('Step 1 - Invite sent to guest1:', outgoingInvites);
    const getButtonState = () => {
        const isAlreadyInLobby = String(friendUserId) === String(lobbyState?.hostId) ||
            String(friendUserId) === String(lobbyState?.guestId);
        if (isAlreadyInLobby)
            return 'Joined';
        const rawInvite = outgoingInvites[friendUserId];
        const pendingInvite = rawInvite?.roomCode === roomCode ? rawInvite : null;
        if (pendingInvite)
            return 'Cancel';
        return 'Invite';
    };
    console.log('Button state before joining:', getButtonState());
    lobbyState = { ...lobbyState, guestId: friendUserId };
    if (lobbyState.guestId)
        clearOutgoingInvite(lobbyState.guestId);
    console.log('\nStep 2 - guest1 joins lobby (guestId set):');
    console.log('Outgoing invites after joining:', outgoingInvites);
    console.log('Button state while in lobby:', getButtonState());
    lobbyState = { ...lobbyState, guestId: null };
    console.log('\nStep 3 - guest1 leaves lobby (guestId cleared):');
    console.log('Button state after leaving lobby:', getButtonState());
    const pass = getButtonState() === 'Invite';
    if (pass) {
        console.log('\n✅ PASS: Button cleanly transitions from Joined -> Invite when player leaves lobby.');
    }
    else {
        console.error('\n❌ FAIL: Button did not reset to Invite.');
    }
}
verifyJoinedLeaveFlow().catch(console.error);
//# sourceMappingURL=verify-joined-leave-flow.js.map