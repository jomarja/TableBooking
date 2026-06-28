import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt.strategy';

// Append-only audit log stored as JSON Lines. This keeps the feature
// migration-free (no Prisma schema change) and gives indefinite retention —
// the file simply grows. Reads parse + filter in memory, which is fine at this
// platform's scale. The shape is stable so it could move to a table later.
const LOG_PATH = path.join(process.cwd(), 'audit-log.jsonl');

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO
  userId: string;
  userName: string;
  role: 'admin' | 'staff';
  impersonating: boolean; // true when an admin performed this while "logged in as" a restaurant
  restaurantId: string | null;
  restaurantName: string; // "Platform" for non-restaurant actions
  action: string;
  target: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
}

export interface AuditActor {
  user: JwtPayload;
  ip?: string | null;
}

export interface AuditLogInput {
  user: JwtPayload;
  ip?: string | null;
  action: string;
  restaurantId?: string | null;
  restaurantName?: string | null;
  target?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export interface AuditQuery {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  restaurantId?: string;
  user?: string;
  action?: string;
  role?: string;
  search?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  private nameCache = new Map<string, string>();

  constructor(private prisma: PrismaService) {}

  private async restaurantName(id: string | null, provided?: string | null): Promise<string> {
    if (provided) return provided;
    if (!id) return 'Platform';
    if (this.nameCache.has(id)) return this.nameCache.get(id)!;
    const r = await this.prisma.restaurant.findUnique({
      where: { id },
      select: { name: true },
    });
    const name = r?.name || id;
    this.nameCache.set(id, name);
    return name;
  }

  /** Record an action. Never throws — audit logging must not break a request. */
  async log(input: AuditLogInput): Promise<void> {
    try {
      const u = input.user;
      const impersonating = !!u.impersonatedBy;
      const restaurantId = input.restaurantId ?? u.restaurantId ?? null;
      const entry: AuditEntry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        userId: impersonating ? u.impersonatorId || u.sub : u.sub,
        userName: impersonating ? u.impersonatedBy! : u.name,
        role: impersonating ? 'admin' : u.role,
        impersonating,
        restaurantId,
        restaurantName: await this.restaurantName(restaurantId, input.restaurantName),
        action: input.action,
        target: input.target ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        ip: input.ip ?? null,
      };
      await fs.appendFile(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      /* swallow — logging failures must never surface to the user */
    }
  }

  /** Newest-first list of entries matching the given filters/search. */
  async query(q: AuditQuery): Promise<AuditEntry[]> {
    let raw: string;
    try {
      raw = await fs.readFile(LOG_PATH, 'utf8');
    } catch {
      return [];
    }
    const entries: AuditEntry[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as AuditEntry);
      } catch {
        /* skip malformed line */
      }
    }
    entries.reverse(); // newest first

    const search = q.search?.trim().toLowerCase();
    const userTerm = q.user?.trim().toLowerCase();

    const filtered = entries.filter((e) => {
      const day = e.timestamp.slice(0, 10);
      if (q.from && day < q.from) return false;
      if (q.to && day > q.to) return false;
      if (q.restaurantId && e.restaurantId !== q.restaurantId) return false;
      if (q.role && e.role !== q.role) return false;
      if (q.action && e.action !== q.action) return false;
      if (userTerm && !e.userName.toLowerCase().includes(userTerm)) return false;
      if (search) {
        const hay = [
          e.userName,
          e.restaurantName,
          e.action,
          e.target,
          e.oldValue,
          e.newValue,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return filtered.slice(0, q.limit ?? 500);
  }
}
