// infra/migrate.js
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION = path.join(__dirname, 'migrations', '001_init.sql');
const DEFAULT_DB = 'postgres://postgres:postgres@localhost:5432/notion_ai';
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DB;

function has(cmd, args = ['--version']) {
  try {
    const res = spawnSync(cmd, args, { stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

function sh(command, opts = {}) {
  console.log(`$ ${command}`);
  execSync(command, { stdio: 'inherit', ...opts });
}

async function run() {
  if (has('psql')) {
    sh(`psql "${DATABASE_URL}" -f "${MIGRATION}"`);
    return;
  }
  if (has('docker', ['--version'])) {
    const compose = 'docker compose';
    const composeFile = path.join(__dirname, 'docker-compose.yml');
    sh(`${compose} -f "${composeFile}" up -d`);
    const cid = execSync(`${compose} -f "${composeFile}" ps -q db`).toString().trim();
    if (!cid) throw new Error('db container not found');
    sh(`docker cp "${MIGRATION}" ${cid}:/tmp/001_init.sql`);
    sh(`${compose} -f "${composeFile}" exec -T db psql -U postgres -d notion_ai -f /tmp/001_init.sql`);
    return;
  }
  // node pg fallback
  const { Client } = await import('pg');
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query(sql);
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
