import "server-only";
import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { database, databaseReady } from "./db";
import type { User } from "./types";
const scrypt = promisify(scryptCallback);
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get("ecf_session")?.value;
  if (!token || !databaseReady()) return null;
  const sql = database();
  const rows =
    await sql`SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${digest(token)} AND s.expires_at>NOW() AND u.active=true`;
  return (rows[0] as User) || null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const sql = database();
  await sql`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (${digest(token)},${userId},NOW()+INTERVAL '8 hours')`;
  (await cookies()).set("ecf_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 28800,
  });
}
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds = 900,
) {
  const sql = database();
  const bucket = `${digest(key)}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  const rows =
    await sql`INSERT INTO rate_limits(key,attempts,expires_at) VALUES(${bucket},1,NOW()+INTERVAL '2 hours') ON CONFLICT(key) DO UPDATE SET attempts=rate_limits.attempts+1 RETURNING attempts`;
  return Number(rows[0].attempts) <= limit;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const host = request.headers.get("host") || new URL(request.url).host;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname);
    return (
      source.host === host &&
      (source.protocol === "https:" || (local && source.protocol === "http:"))
    );
  } catch {
    return false;
  }
}
