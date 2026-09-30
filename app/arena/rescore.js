'use strict';
// Score a folder of match logs again with today's fun.js, without replaying a
// single match: rewrites each log's `fun`, the folder's summary.jsonl and
// aggregate.json. How the weights and cut-offs are tuned.
//
//   node app/arena/rescore.js /mnt/project-files/ai-behaviors/runs/baseline-4.35

const fs = require('fs');
const path = require('path');
const { funScore } = require('./fun');
const { aggregate, summaryOf, groupKey } = require('./run');

const dir = process.argv[2];
if (!dir) { console.error('usage: node app/arena/rescore.js <run folder>'); process.exit(1); }
const logs = [];
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'aggregate.json' && !n.startsWith('map-')).sort()) {
  const file = path.join(dir, f);
  const log = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!log.samples) continue;
  if (log.result.reason !== 'error') log.fun = funScore(log);
  fs.writeFileSync(file, JSON.stringify(log));
  logs.push(log);
}
fs.writeFileSync(path.join(dir, 'summary.jsonl'), logs.map((l) => JSON.stringify(summaryOf(l))).join('\n') + '\n');
const groups = {};
for (const l of logs) (groups[groupKey(l)] = groups[groupKey(l)] || []).push(l);
const agg = {};
for (const k in groups) agg[k] = aggregate(groups[k]);
fs.writeFileSync(path.join(dir, 'aggregate.json'), JSON.stringify(agg, null, 2));
for (const k in agg) console.log(k + ': fun ' + agg[k].fun + ' ' + JSON.stringify(agg[k].parts));
