// Multi-process entrypoint. Forks one Node worker per CPU core so a single
// machine can handle thousands of concurrent logins.
//
// Use in production:
//   NODE_ENV=production node src/cluster.js
//
// Dev still uses src/index.js (single process, faster restart).
import cluster from 'node:cluster';
import os from 'node:os';

const desired = Number(process.env.WEB_CONCURRENCY) || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[cluster] primary ${process.pid} forking ${desired} workers`);
  for (let i = 0; i < desired; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[cluster] worker ${worker.process.pid} died (${signal || code}). Restarting…`);
    cluster.fork();
  });
} else {
  await import('./index.js');
}
