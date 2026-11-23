import { DEFAULT_GAME_RULES as rules } from '@kiwanja/core';
import { describe, expect, it } from 'vitest';
import { addBlocker, applyFormation, autoFill, buyBlocker, canSwap, countdown, currentFormation, lineupIssues, makeCaptain, makeViceCaptain, squadAfter, squadComplete, swap, type LineupDraft, type Player } from '../src/index';

let n = 0;
const player = (position: Player['position'], price = 50, clubId = `c${n % 8}`): Player =>
  ({ id: `p${++n}`, firstName: 'A', lastName: `P${n}`, position, price, clubId, shirtNumber: n, status: 'AVAILABLE', origin: 'SAMPLE', club: { id: clubId, name: clubId, shortName: 'CLB', primaryColor: '#000', secondaryColor: '#fff', origin: 'SAMPLE' } });

/** 4-4-2 with bench GK, DEF, MID, FWD. Captain slot 1 (GK is cheapest so captain = most expensive). */
function draft442(): LineupDraft[] {
  n = 0;
  const xi = [player('GK', 45), ...Array.from({ length: 4 }, () => player('DEF', 50)), ...Array.from({ length: 4 }, () => player('MID', 70)), player('FWD', 90), player('FWD', 80)];
  const subs = [player('GK', 40), player('DEF', 45), player('MID', 45), player('FWD', 45)];
  return [...xi, ...subs].map((p, i) => ({ playerId: p.id, position: p.position, slot: i + 1, isCaptain: i === 9, isViceCaptain: i === 10, player: p, nextOpponent: null }));
}

describe('pick team logic', () => {
  it('starts valid and reports the formation', () => {
    const d = draft442();
    expect(lineupIssues(d, rules)).toEqual([]);
    expect(currentFormation(d, rules)).toBe('4-4-2');
  });

  it('allows a bench forward for a starting midfielder (4-3-3) but never GK for outfield', () => {
    const d = draft442();
    const mid = d[5].playerId; // slot 6 MID
    const benchFwd = d[14].playerId;
    const benchGk = d[11].playerId;
    expect(canSwap(d, mid, benchFwd, rules)).toBe(true);
    const next = swap(d, mid, benchFwd, rules);
    expect(currentFormation(next, rules)).toBe('4-3-3');
    expect(canSwap(d, mid, benchGk, rules)).toBe(false);
    expect(swap(d, mid, benchGk, rules)).toBe(d);
  });

  it('keeps armbands on starters when the captain is benched', () => {
    const d = draft442();
    const captain = d[9].playerId; // FWD
    const benchFwd = d[14].playerId;
    const next = swap(d, captain, benchFwd, rules);
    expect(next.find((x) => x.playerId === captain)!.isCaptain).toBe(false);
    expect(next.filter((x) => x.isCaptain && x.slot <= 11)).toHaveLength(1);
    expect(next.filter((x) => x.isViceCaptain && x.slot <= 11)).toHaveLength(1);
    expect(lineupIssues(next, rules)).toEqual([]);
  });

  it('swaps armbands when captain and vice trade places', () => {
    const d = draft442();
    const vice = d[10].playerId;
    const cap = d[9].playerId;
    const next = makeCaptain(d, vice);
    expect(next.find((x) => x.playerId === vice)!.isCaptain).toBe(true);
    expect(next.find((x) => x.playerId === cap)!.isViceCaptain).toBe(true);
    const back = makeViceCaptain(next, vice);
    expect(back.find((x) => x.playerId === cap)!.isCaptain).toBe(true);
    expect(back.find((x) => x.playerId === vice)!.isViceCaptain).toBe(true);
  });

  it('rearranges into any legal formation', () => {
    const d = draft442();
    for (const f of ['3-4-3', '4-5-1', '5-4-1', '3-5-2', '4-3-3']) {
      const next = applyFormation(d, f, rules);
      if (next === d) continue; // squad cannot field this shape
      expect(currentFormation(next, rules)).toBe(f);
      expect(lineupIssues(next, rules)).toEqual([]);
      expect(next.find((x) => x.slot === 12)!.position).toBe('GK');
    }
  });
});

describe('squad building and transfers', () => {
  it('blocks a fourth player from one club and over-budget picks', () => {
    n = 0;
    const picked = [player('DEF', 50, 'x'), player('MID', 50, 'x'), player('FWD', 50, 'x')];
    expect(addBlocker(picked, player('GK', 45, 'x'), rules)).toBe('3 from club');
    expect(addBlocker(picked, player('GK', 900, 'y'), rules)).toBe('Too expensive');
    expect(addBlocker(picked, picked[0], rules)).toBe('Selected');
  });

  it('auto-fill always produces a complete, legal squad', () => {
    n = 0;
    const pool = [...Array.from({ length: 10 }, () => player('GK', 45)), ...Array.from({ length: 30 }, (_, i) => player('DEF', 45 + (i % 4) * 5)), ...Array.from({ length: 30 }, (_, i) => player('MID', 50 + (i % 6) * 10)), ...Array.from({ length: 20 }, (_, i) => player('FWD', 55 + (i % 6) * 10))];
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 20; i++) expect(squadComplete(autoFill([], pool, rules, rand), rules)).toBe(true);
  });

  it('tracks bank and blocks illegal replacements', () => {
    n = 0;
    const squad = [player('MID', 80, 'a'), player('MID', 60, 'b'), player('FWD', 70, 'b'), player('DEF', 50, 'b')];
    const cand = player('MID', 95, 'b');
    const after = squadAfter(squad, [], 10);
    expect(buyBlocker(after.players, after.bank, squad[0], cand, rules)).toBe('3 from club');
    expect(buyBlocker(after.players, after.bank, squad[0], player('MID', 95, 'z'), rules)).toBe('Too expensive');
    expect(buyBlocker(after.players, after.bank, squad[0], player('FWD', 50, 'z'), rules)).toBe('Wrong position');
    const cheap = player('MID', 60, 'z');
    expect(buyBlocker(after.players, after.bank, squad[0], cheap, rules)).toBeNull();
    expect(squadAfter(squad, [{ out: squad[0], in: cheap }], 10).bank).toBe(30);
  });
});

describe('formatting', () => {
  it('counts down to a deadline', () => {
    const now = Date.parse('2026-11-23T10:00:00Z');
    expect(countdown('2026-11-25T11:02:03Z', now)).toBe('2d 01:02:03');
    expect(countdown('2026-11-23T09:00:00Z', now)).toBeNull();
  });
});
