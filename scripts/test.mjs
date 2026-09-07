import { spawnSync } from 'node:child_process';

const files = process.argv.slice(2).map((file) => file.endsWith('.ts')
  ? `dist/${file.slice(0, -3)}.js`
  : file);
const result = spawnSync(process.execPath, ['--test', ...(files.length ? files : ['dist/test'])], { stdio: 'inherit' });
process.exit(result.status ?? 1);
