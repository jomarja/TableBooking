import { Injectable } from '@nestjs/common';

/**
 * Mock import provider abstraction. Real Google Maps scraping is out of scope;
 * this returns deterministic prefill derived from the URL so the wizard's
 * "verify imported info" step is demonstrable. New providers slot in here.
 */
@Injectable()
export class ImportService {
  prefill(url: string, provider = 'GOOGLE_MAPS') {
    const name = this.guessName(url);
    // Deterministic mock — real scraping is out of scope.
    // Returns a richer shape so all sync/import consumers get consistent fields.
    return {
      provider,
      sourceUrl: url,
      data: {
        name,
        address: 'Rustaveli Ave 11, Tbilisi, Georgia',
        website: `www.${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.ge`,
        phone: '+995 555 100 200',
        rating: 4.5,
        reviewCount: 1234,
        priceLevel: 2,
        openingHours: {
          mon: { open: '10:00', close: '23:00' },
          tue: { open: '10:00', close: '23:00' },
          wed: { open: '10:00', close: '23:00' },
          thu: { open: '10:00', close: '23:00' },
          fri: { open: '10:00', close: '00:00' },
          sat: { open: '10:00', close: '00:00' },
          sun: { open: '11:00', close: '23:00' },
        },
        openingTime: '10:00',
        kitchenClosing: '22:30',
        closingTime: '23:00',
        photos: [
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        ],
      },
    };
  }

  private guessName(url: string): string {
    try {
      const decoded = decodeURIComponent(url);
      const match = decoded.match(/maps\/place\/([^/@]+)/i);
      if (match) {
        return match[1].replace(/\+/g, ' ').trim();
      }
    } catch {
      // ignore
    }
    return 'Imported Restaurant';
  }
}
