import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

// CRM-style customer details that the reservation rows don't carry (email,
// birthday, tags, etc.), keyed by restaurant + phone. Stored in a JSON file to
// keep the feature migration-free (same approach as the audit log).
const FILE = path.join(process.cwd(), 'customer-meta.json');

export interface CustomerMeta {
  email?: string;
  birthday?: string;
  company?: string;
  address?: string;
  tags?: string[];
  notes?: string;
}

@Injectable()
export class CustomerMetaService {
  private key(restaurantId: string, phone: string) {
    return `${restaurantId}:${phone}`;
  }

  private async readAll(): Promise<Record<string, CustomerMeta>> {
    try {
      return JSON.parse(await fs.readFile(FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  async get(restaurantId: string, phone: string): Promise<CustomerMeta> {
    const all = await this.readAll();
    return all[this.key(restaurantId, phone)] ?? {};
  }

  async set(restaurantId: string, phone: string, meta: CustomerMeta): Promise<CustomerMeta> {
    const all = await this.readAll();
    const clean: CustomerMeta = {
      email: meta.email?.trim() || undefined,
      birthday: meta.birthday?.trim() || undefined,
      company: meta.company?.trim() || undefined,
      address: meta.address?.trim() || undefined,
      tags: Array.isArray(meta.tags) ? meta.tags.map((t) => String(t).trim()).filter(Boolean) : undefined,
      notes: meta.notes?.trim() || undefined,
    };
    all[this.key(restaurantId, phone)] = clean;
    try {
      await fs.writeFile(FILE, JSON.stringify(all, null, 2), 'utf8');
    } catch {
      /* swallow — best effort */
    }
    return clean;
  }
}
