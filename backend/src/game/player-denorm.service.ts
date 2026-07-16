import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PlayerDenormService
 *
 * Owns the logic for regenerating Player.clubs and Player.competitions from
 * the PlayerClub join table + Club.competitions.
 *
 * DESIGN NOTES
 * ─────────────
 * • Player.clubs and Player.competitions are denormalised arrays — they must
 *   NEVER be set directly by callers. All writes must go through
 *   regenerateForPlayer() so the two arrays stay consistent with each other
 *   and with the PlayerClub rows.
 *
 * • This service is intentionally thin: it only derives and writes the two
 *   arrays. The admin CRUD that creates/updates PlayerClub rows (and calls
 *   this service afterwards) lives in a separate future task.
 *
 * • The derivation logic:
 *     clubs       = distinct club names from every PlayerClub row for this player
 *     competitions = distinct competition names from every Club.competitions[]
 *                   that belongs to a club the player has history with
 */
@Injectable()
export class PlayerDenormService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Regenerate Player.clubs and Player.competitions for a single player.
   *
   * Steps:
   *   1. Load all PlayerClub rows for the player, including the linked Club
   *      (name + competitions array).
   *   2. Derive `clubs`  = unique club names, in order of first appearance.
   *   3. Derive `competitions` = union of all Club.competitions[], deduplicated.
   *   4. Write both arrays back to Player in a single prisma.update call.
   *
   * @param playerId  UUID of the Player to regenerate.
   * @returns The updated { clubs, competitions } arrays that were persisted.
   */
  async regenerateForPlayer(
    playerId: string,
  ): Promise<{ clubs: string[]; competitions: string[] }> {
    const playerClubs = await this.prisma.playerClub.findMany({
      where: { playerId },
      include: {
        club: {
          select: {
            name: true,
            competitions: true,
          },
        },
      },
      orderBy: [
        // Prefer current clubs first so the denormalised list starts with the
        // most relevant entry, then order chronologically by start year.
        { isCurrent: 'desc' },
        { startYear: 'asc' },
      ],
    });

    // clubs: ordered unique club names (preserves first-seen order)
    const clubsSeen = new Set<string>();
    const clubs: string[] = [];
    for (const pc of playerClubs) {
      if (!clubsSeen.has(pc.club.name)) {
        clubsSeen.add(pc.club.name);
        clubs.push(pc.club.name);
      }
    }

    // competitions: union of all Club.competitions[], deduplicated
    const competitionsSeen = new Set<string>();
    for (const pc of playerClubs) {
      for (const comp of pc.club.competitions) {
        competitionsSeen.add(comp);
      }
    }
    const competitions = Array.from(competitionsSeen);

    await this.prisma.player.update({
      where: { id: playerId },
      data: { clubs, competitions },
    });

    return { clubs, competitions };
  }

  /**
   * Regenerate Player.clubs and Player.competitions for every player who has
   * at least one PlayerClub row linked to a given club.
   *
   * Useful after a Club's competitions[] changes (e.g. a club gets promoted/
   * relegated) so all affected players' denormalised arrays stay in sync.
   *
   * @param clubId  UUID of the Club whose competitions changed.
   */
  async regenerateForClub(clubId: string): Promise<void> {
    const affectedPlayers = await this.prisma.playerClub.findMany({
      where: { clubId },
      select: { playerId: true },
      distinct: ['playerId'],
    });

    for (const { playerId } of affectedPlayers) {
      await this.regenerateForPlayer(playerId);
    }
  }
}
