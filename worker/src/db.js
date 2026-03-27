// ============================================================
// worker/src/db.js — Cloudflare D1 (SQLite) query wrapper
// Replaces: @neondatabase/serverless (PostgreSQL)
// ============================================================

// Convert PostgreSQL $1,$2 placeholders → SQLite ?
const pg2sqlite = (sql) => sql.replace(/\$\d+/g, '?');

// Convert PostgreSQL-isms → SQLite equivalents
const convertSQL = (sql) =>
  pg2sqlite(sql)
    .replace(/\bNOW\(\)/g, "datetime('now')")
    .replace(/\bTRUE\b/g, '1')
    .replace(/\bFALSE\b/g, '0')
    .replace(/INTERVAL '(\d+) days'/g, (_, n) => `'-${n} days'`)
    .replace(/::text\b/gi, '')
    .replace(/::bigint\b/gi, '')
    .replace(/::int\b/gi, '')
    .replace(/::numeric\b/gi, '')
    .replace(/json_agg\(json_build_object\(/g, 'json_group_array(json_object(')
    .replace(/json_build_object\(/g, 'json_object(')
    .replace(/USING GIN\b[^)]+\)/gi, '');

// ── Single query helper ───────────────────────────────────────
export const query = async (env, sql, params = []) => {
  const d1sql = convertSQL(sql);
  const stmt  = env.DB.prepare(d1sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;

  // Use .all() for SELECT or queries with RETURNING
  const isRead = /^\s*SELECT/i.test(sql.trim()) || /\bRETURNING\b/i.test(sql);
  if (isRead) {
    const result = await bound.all();
    return { rows: result.results || [] };
  }
  const result = await bound.run();
  return { rows: [], rowCount: result.changes || 0 };
};

// ── First-row helper ──────────────────────────────────────────
export const queryOne = async (env, sql, params = []) => {
  const d1sql = convertSQL(sql);
  const stmt  = env.DB.prepare(d1sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.first();
};

// ── Batch / Transaction helper ────────────────────────────────
// D1 batch() is atomic — either all succeed or all fail
export const batch = async (env, statements) => {
  if (!statements.length) return [];
  const prepared = statements.map(({ sql, params = [] }) => {
    const d1sql = convertSQL(sql);
    const stmt  = env.DB.prepare(d1sql);
    return params.length > 0 ? stmt.bind(...params) : stmt;
  });
  return env.DB.batch(prepared);
};

// ── UUID generator (replaces uuid_generate_v4()) ─────────────
export const uuid = () => crypto.randomUUID();
