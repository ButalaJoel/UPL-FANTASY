import { Download } from 'lucide-react';
import { PlayerMarket } from '../../components/PlayerMarket';
import { PageHeader } from '../../components/ui';
import { downloadCsv } from './FixtureSetup';

export function OpsStatisticsPage() {
  return (
    <div>
      <PageHeader
        title="Statistics"
        subtitle="Player statistics derived from verified events. Export for analysis or partners."
        actions={
          <>
            <button className="btn-ghost" onClick={() => downloadCsv('/ops/export/player-stats?basis=CONFIRMED', 'player-stats-confirmed.csv')}>
              <Download className="h-4 w-4" /> Confirmed player stats
            </button>
            <button className="btn-ghost" onClick={() => downloadCsv('/ops/export/player-stats?basis=PROVISIONAL', 'player-stats-provisional.csv')}>
              <Download className="h-4 w-4" /> Provisional
            </button>
            <button className="btn-dark" onClick={() => downloadCsv('/ops/export/events', 'match-events.csv')}>
              <Download className="h-4 w-4" /> All match events
            </button>
          </>
        }
      />
      <div className="card p-4">
        <PlayerMarket />
      </div>
    </div>
  );
}
