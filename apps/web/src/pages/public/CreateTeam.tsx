import { useQueryClient } from '@tanstack/react-query';
import { POSITIONS, validateSquad, type Position } from '@kiwanja/core';
import { Shuffle, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pitch, type PitchSlot } from '../../components/Pitch';
import { PlayerMarket } from '../../components/PlayerMarket';
import { ErrorBox, Field, Modal, PageHeader } from '../../components/ui';
import { useMeta, usePlayers, type Player } from '../../hooks/data';
import { api } from '../../lib/api';
import { price } from '../../lib/format';

export function CreateTeamPage() {
  const { data: meta } = useMeta();
  const rules = meta!.rules;
  const nav = useNavigate();
  const qc = useQueryClient();
  const all = usePlayers({});
  const [picked, setPicked] = useState<Player[]>([]);
  const [slotPos, setSlotPos] = useState<Position | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const spent = picked.reduce((s, p) => s + p.price, 0);
  const left = rules.squad.budget - spent;
  const squad = picked.map((p) => ({ playerId: p.id, position: p.position, clubId: p.clubId, price: p.price }));
  const issues = useMemo(() => validateSquad(squad, rules, { partial: true }), [squad, rules]);
  const complete = picked.length === rules.squad.size && !validateSquad(squad, rules).length;

  const canAdd = (p: Player) => {
    if (picked.some((x) => x.id === p.id)) return 'Selected';
    if (picked.filter((x) => x.position === p.position).length >= rules.squad.composition[p.position]) return `${p.position} full`;
    if (picked.filter((x) => x.clubId === p.clubId).length >= rules.squad.maxPerClub) return `${rules.squad.maxPerClub} from club`;
    if (p.price > left) return 'Too expensive';
    return null;
  };

  const slots: PitchSlot[] = POSITIONS.flatMap((pos) => {
    const mine = picked.filter((p) => p.position === pos);
    return Array.from({ length: rules.squad.composition[pos] }, (_, i) => {
      const p = mine[i];
      return p
        ? { key: p.id, position: pos, name: p.lastName, club: p.club, caption: price(p.price) }
        : { key: `empty-${pos}-${i}`, position: pos, empty: true };
    });
  });

  const autoFill = () => {
    const pool = [...(all.data?.players ?? [])].filter((p) => p.status === 'AVAILABLE').sort(() => Math.random() - 0.5);
    const next = [...picked];
    for (const pos of ['GK', 'FWD', 'MID', 'DEF'] as Position[]) {
      for (const p of pool) {
        const need = rules.squad.composition[pos] - next.filter((x) => x.position === pos).length;
        if (need <= 0) break;
        if (p.position !== pos || next.some((x) => x.id === p.id)) continue;
        if (next.filter((x) => x.clubId === p.clubId).length >= rules.squad.maxPerClub) continue;
        const remainingSlots = rules.squad.size - next.length - 1;
        if (rules.squad.budget - next.reduce((s, x) => s + x.price, 0) - p.price < remainingSlots * 45) continue;
        next.push(p);
      }
    }
    setPicked(next);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/fantasy/team', { body: { name, playerIds: picked.map((p) => p.id) } });
      await qc.invalidateQueries({ queryKey: ['fantasy'] });
      nav('/my-team');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Pick your squad" subtitle={`${rules.squad.size} players: ${rules.squad.composition.GK} GK, ${rules.squad.composition.DEF} DEF, ${rules.squad.composition.MID} MID, ${rules.squad.composition.FWD} FWD · max ${rules.squad.maxPerClub} per club`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <div className="text-xs font-semibold uppercase text-ink/50">Selected</div>
              <div className="font-display text-xl font-bold">
                {picked.length}/{rules.squad.size}
              </div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xs font-semibold uppercase text-ink/50">Budget left</div>
              <div className={`font-display text-xl font-bold ${left < 0 ? 'text-clay' : ''}`}>{price(left)}</div>
            </div>
            <div className="card flex items-center justify-center gap-2 p-3">
              <button className="btn-ghost px-3" onClick={autoFill} title="Auto-complete">
                <Shuffle className="h-4 w-4" /> <span className="hidden sm:inline">Auto</span>
              </button>
              <button className="btn-ghost px-3" onClick={() => setPicked([])} title="Reset" aria-label="Reset">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <Pitch
            starters={slots}
            onSelect={(key) => {
              if (key.startsWith('empty-')) setSlotPos(key.split('-')[1] as Position);
              else setPicked(picked.filter((p) => p.id !== key));
            }}
          />
          <p className="text-center text-xs text-ink/50">Tap an empty shirt to add a player, tap a player to remove.</p>
        </div>
        <div className="card space-y-4 p-4">
          <Field label="Team name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kampala Crushers" maxLength={30} />
          </Field>
          {issues.map((i) => (
            <div key={i.message} className="rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-600">
              {i.message}
            </div>
          ))}
          <ErrorBox error={error} />
          <button className="btn-primary w-full" disabled={!complete || name.length < 3 || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Save squad'}
          </button>
          <div className="hidden lg:block">
            <h3 className="mb-2 font-display font-bold">Player market</h3>
            <PlayerMarket compact action={(p) => <AddButton reason={canAdd(p)} onAdd={() => setPicked([...picked, p])} />} />
          </div>
        </div>
      </div>
      <Modal open={!!slotPos} onClose={() => setSlotPos(null)} title={`Add a ${slotPos}`} wide>
        {slotPos && (
          <PlayerMarket
            compact
            lockedPosition={slotPos}
            action={(p) => (
              <AddButton
                reason={canAdd(p)}
                onAdd={() => {
                  setPicked([...picked, p]);
                  setSlotPos(null);
                }}
              />
            )}
          />
        )}
      </Modal>
    </div>
  );
}

function AddButton({ reason, onAdd }: { reason: string | null; onAdd: () => void }) {
  return (
    <button className="btn-primary w-24 px-2 py-1.5 text-xs" disabled={!!reason} onClick={onAdd} title={reason ?? 'Add'}>
      {reason ?? 'Add'}
    </button>
  );
}
