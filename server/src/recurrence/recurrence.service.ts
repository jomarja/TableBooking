import { Injectable } from '@nestjs/common';

export interface RecurrenceRule {
  freq: 'WEEKLY' | 'MONTHLY';
  byWeekday?: number; // 0 = Sunday ... 6 = Saturday
  byMonthDay?: number; // 1..31
  until?: string; // YYYY-MM-DD inclusive
}

/**
 * Expands recurring blocked periods into concrete occurrences for a single date.
 * Kept intentionally minimal: weekly-by-weekday and monthly-by-monthday, which
 * covers "Every Monday", "Every Friday", "first/Nth of the month".
 */
@Injectable()
export class RecurrenceService {
  /** Returns true if a recurring rule produces an occurrence on the given date. */
  occursOn(rule: RecurrenceRule | null | undefined, dateStr: string): boolean {
    if (!rule) return false;
    const date = this.parse(dateStr);
    if (!date) return false;

    if (rule.until) {
      const until = this.parse(rule.until);
      if (until && date > until) return false;
    }

    if (rule.freq === 'WEEKLY') {
      if (typeof rule.byWeekday !== 'number') return true; // every day fallback
      return date.getDay() === rule.byWeekday;
    }
    if (rule.freq === 'MONTHLY') {
      if (typeof rule.byMonthDay !== 'number') return true;
      return date.getDate() === rule.byMonthDay;
    }
    return false;
  }

  /** Human-readable summary, e.g. "Every Monday", "Monthly on day 1". */
  describe(rule: RecurrenceRule | null | undefined): string {
    if (!rule) return '';
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    if (rule.freq === 'WEEKLY') {
      return typeof rule.byWeekday === 'number'
        ? `Every ${days[rule.byWeekday]}`
        : 'Daily';
    }
    if (rule.freq === 'MONTHLY') {
      return typeof rule.byMonthDay === 'number'
        ? `Monthly on day ${rule.byMonthDay}`
        : 'Monthly';
    }
    return '';
  }

  private parse(dateStr: string): Date | null {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
}
