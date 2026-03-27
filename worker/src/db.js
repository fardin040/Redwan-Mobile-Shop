// ============================================================
// worker/src/db.js — Neon Serverless PostgreSQL
// Replaces: pg (node-postgres)
// ============================================================
import { Pool, neon } from '@neondatabase/serverless';

// Use Pool for most queries (connection pooled over HTTP)
export const getPool = (env) => new Pool({ connectionString: env.DATABASE_URL });

// Helper: run a single query
export const query = (env, text, params) => {
  const pool = getPool(env);
  return pool.query(text, params);
};

// Helper: get a client for transactions
export const getClient = async (env) => {
  const pool = getPool(env);
  return pool.connect();
};
