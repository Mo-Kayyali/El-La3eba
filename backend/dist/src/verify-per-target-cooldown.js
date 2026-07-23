"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function verifyPerTargetCooldown() {
    console.log('====================================================');
    console.log('PER-TARGET INVITE COOLDOWN VERIFICATION');
    console.log('====================================================\n');
    const cooldowns = new Map();
    const inviteCooldownKey = (inviterId, inviteeId) => `game_invite_cooldown:${inviterId}:${inviteeId}`;
    const trySendInvite = (inviterId, inviteeId) => {
        const key = inviteCooldownKey(inviterId, inviteeId);
        const expiresAt = cooldowns.get(key) ?? 0;
        if (Date.now() < expiresAt) {
            const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
            return { status: 'error', message: `Please wait ${remaining} more second(s).` };
        }
        cooldowns.set(key, Date.now() + 5000);
        return { status: 'success' };
    };
    const res1 = trySendInvite('userA', 'userB');
    console.log('User A invites User B (1st attempt):', res1);
    const res2 = trySendInvite('userA', 'userB');
    console.log('User A invites User B immediately (2nd attempt):', res2);
    const res3 = trySendInvite('userA', 'userC');
    console.log('User A invites User C immediately:', res3);
    const pass = res1.status === 'success' && res2.status === 'error' && res3.status === 'success';
    if (pass) {
        console.log('\n✅ PASS: Cooldown is scoped per (inviter, invitee). User C invite unblocked.');
    }
    else {
        console.error('\n❌ FAIL: Per-target cooldown logic failed.');
    }
}
verifyPerTargetCooldown().catch(console.error);
//# sourceMappingURL=verify-per-target-cooldown.js.map