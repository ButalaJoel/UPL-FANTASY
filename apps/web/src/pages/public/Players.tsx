import { PlayerMarket } from '../../components/PlayerMarket';
import { PageHeader } from '../../components/ui';

export function PlayersPage() {
  return (
    <div>
      <PageHeader title="Player market" subtitle="Prices, form and points come straight from our match-event database." />
      <div className="card p-4">
        <PlayerMarket />
      </div>
    </div>
  );
}
