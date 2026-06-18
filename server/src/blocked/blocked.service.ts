import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeBlockedPeriod } from '../common/serializers';

@Injectable()
export class BlockedService {
  constructor(private prisma: PrismaService) {}

  async listForRestaurant(restaurantId: string) {
    const rows = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId, isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeBlockedPeriod);
  }

  async create(restaurantId: string, dto: any) {
    const created = await this.prisma.blockedPeriod.create({
      data: {
        restaurantId,
        scope: dto.scope ?? 'TABLES',
        tableIds: dto.tableIds ?? [],
        zoneId: dto.zoneId ?? null,
        type: dto.type ?? 'SINGLE',
        date: dto.date ?? null,
        recurrenceRule: dto.recurrenceRule ?? null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason ?? 'Private Event',
      },
    });
    return serializeBlockedPeriod(created);
  }

  async update(restaurantId: string, id: string, dto: any) {
    const existing = await this.prisma.blockedPeriod.findFirst({
      where: { id, restaurantId, isArchived: false },
    });
    if (!existing) throw new NotFoundException('Blocked period not found');
    const data: any = {};
    for (const f of [
      'scope',
      'tableIds',
      'zoneId',
      'type',
      'date',
      'recurrenceRule',
      'startTime',
      'endTime',
      'reason',
    ]) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }
    const updated = await this.prisma.blockedPeriod.update({
      where: { id },
      data,
    });
    return serializeBlockedPeriod(updated);
  }

  async archive(restaurantId: string, id: string) {
    const existing = await this.prisma.blockedPeriod.findFirst({
      where: { id, restaurantId, isArchived: false },
    });
    if (!existing) throw new NotFoundException('Blocked period not found');
    await this.prisma.blockedPeriod.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
    return { ok: true };
  }
}
