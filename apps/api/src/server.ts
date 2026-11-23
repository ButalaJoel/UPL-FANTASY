import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { initRealtime } from './lib/realtime.js';
import { recomputeFixture } from './services/scoringPipeline.js';

const app = createApp();
const server = createServer(app);
initRealtime(server);

/**
 * Live matches: player minutes grow with the clock (appearance and clean-sheet points depend on
 * minutes), so live fixtures are re-scored once a minute even when no event arrives.
 */
setInterval(async () => {
  try {
    const live = await prisma.fixture.findMany({ where: { status: { in: ['FIRST_HALF', 'SECOND_HALF'] } }, select: { id: true } });
    for (const f of live) await recomputeFixture(f.id);
  } catch (e) {
    console.error('live tick failed', e);
  }
}, 60_000).unref();

server.listen(config.port, () => {
  console.log(`Kiwanja API listening on http://localhost:${config.port}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
