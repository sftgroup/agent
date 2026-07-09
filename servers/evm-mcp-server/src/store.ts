import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "state.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = db!;
  d.exec(`
    CREATE TABLE IF NOT EXISTS nonces (
      chain TEXT NOT NULL,
      deployer TEXT NOT NULL,
      next_nonce INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (chain, deployer)
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      deployer TEXT NOT NULL,
      constructor_args TEXT,
      abi_hash TEXT,
      bytecode_hash TEXT,
      compiler_version TEXT,
      deployed_at TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS tx_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      deployer TEXT NOT NULL,
      contract TEXT,
      method TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      replaced_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_chain ON deployments(chain);
    CREATE INDEX IF NOT EXISTS idx_deployments_name ON deployments(name);
    CREATE INDEX IF NOT EXISTS idx_deployments_address ON deployments(address);
    CREATE INDEX IF NOT EXISTS idx_tx_queue_status ON tx_queue(status, chain);
  `);
}

// --- Nonce management ---

export function getNonce(chain: string, deployer: string): number {
  const row = getDb()
    .prepare("SELECT next_nonce FROM nonces WHERE chain = ? AND deployer = ?")
    .get(chain, deployer) as { next_nonce: number } | undefined;
  return row?.next_nonce ?? -1;
}

export function setNonce(chain: string, deployer: string, nonce: number) {
  getDb()
    .prepare("INSERT OR REPLACE INTO nonces (chain, deployer, next_nonce, updated_at) VALUES (?, ?, ?, ?)")
    .run(chain, deployer, nonce, new Date().toISOString());
}

export function incrementNonce(chain: string, deployer: string): number {
  const row = getDb()
    .prepare("SELECT next_nonce FROM nonces WHERE chain = ? AND deployer = ?")
    .get(chain, deployer) as { next_nonce: number } | undefined;
  const next = (row?.next_nonce ?? 0) + 1;
  setNonce(chain, deployer, next);
  return next - 1;
}

// --- Deployment registry ---

export interface Deployment {
  id?: number;
  chain: string;
  name: string;
  address: string;
  tx_hash: string;
  deployer: string;
  constructor_args?: string;
  abi_hash?: string;
  bytecode_hash?: string;
  compiler_version?: string;
  deployed_at: string;
  verified: number;
  tags: string[];
}

export function saveDeployment(d: Deployment) {
  getDb().prepare(`
    INSERT INTO deployments (chain, name, address, tx_hash, deployer, constructor_args, abi_hash, bytecode_hash, compiler_version, deployed_at, verified, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    d.chain, d.name, d.address, d.tx_hash, d.deployer,
    d.constructor_args ?? null, d.abi_hash ?? null, d.bytecode_hash ?? null,
    d.compiler_version ?? null, d.deployed_at, d.verified,
    JSON.stringify(d.tags)
  );
}

export function getDeployments(filter: {
  chain?: string;
  name?: string;
  address?: string;
  tag?: string;
}): Deployment[] {
  let sql = "SELECT * FROM deployments WHERE 1=1";
  const params: any[] = [];
  if (filter.chain) { sql += " AND chain = ?"; params.push(filter.chain); }
  if (filter.name)  { sql += " AND name = ?";  params.push(filter.name); }
  if (filter.address) { sql += " AND address = ?"; params.push(filter.address); }
  if (filter.tag) { sql += " AND tags LIKE ?"; params.push(`%${filter.tag}%`); }
  sql += " ORDER BY deployed_at DESC LIMIT 100";

  const d = getDb();
  const rows = d.prepare(sql).all(...params) as any[];
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || "[]") }));
}

// --- Tx queue ---

export interface TxRecord {
  id?: number;
  chain: string;
  tx_hash: string;
  nonce: number;
  deployer: string;
  contract?: string;
  method?: string;
  status: "pending" | "confirmed" | "failed";
  created_at: string;
  confirmed_at?: string;
  replaced_by?: string;
}

export function saveTx(tx: TxRecord) {
  getDb().prepare(`
    INSERT INTO tx_queue (chain, tx_hash, nonce, deployer, contract, method, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tx.chain, tx.tx_hash, tx.nonce, tx.deployer, tx.contract ?? null, tx.method ?? null, tx.status, tx.created_at);
}

export function confirmTx(tx_hash: string) {
  getDb().prepare(
    "UPDATE tx_queue SET status = 'confirmed', confirmed_at = ? WHERE tx_hash = ?"
  ).run(new Date().toISOString(), tx_hash);
}

export function replaceTx(oldTxHash: string, newTxHash: string) {
  getDb().prepare(
    "UPDATE tx_queue SET status = 'failed', replaced_by = ? WHERE tx_hash = ?"
  ).run(newTxHash, oldTxHash);
}

export function getPendingTx(chain: string, deployer: string): TxRecord[] {
  return getDb().prepare(
    "SELECT * FROM tx_queue WHERE chain = ? AND deployer = ? AND status = 'pending' ORDER BY nonce ASC"
  ).all(chain, deployer) as TxRecord[];
}
