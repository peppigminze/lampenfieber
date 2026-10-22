import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
export const DATA_FILES = ['enemies', 'acts', 'upgrades', 'lanterns', 'workshop', 'achievements'];
export function loadData() {
  const d = {};
  for (const f of DATA_FILES) d[f] = JSON.parse(readFileSync(join(root, f + '.json'), 'utf8'));
  return d;
}
