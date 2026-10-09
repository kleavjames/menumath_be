import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

const cwd = process.cwd();

config({ path: resolve(cwd, '.env') });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envByNode = resolve(cwd, `.env.${nodeEnv}`);
if (existsSync(envByNode)) {
  config({ path: envByNode, override: true });
}

const envLocal = resolve(cwd, '.env.local');
if (existsSync(envLocal)) {
  config({ path: envLocal, override: true });
}
