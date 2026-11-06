/**
 * Running & Cardio Service
 * Provides split string parsing, pace calculation, terrain taxonomy,
 * and shoe mileage management against a 350-mile retirement threshold.
 */

import { saveAllShoes } from './db';
import { getLocalDateString } from '../utils/date';

export const STORAGE_KEY_SHOES = 'apexfit_shoes';
export const LEGACY_STORAGE_KEY_SHOES = 'iron_log_shoes';
export const RETIREMENT_THRESHOLD_MILES = 350;

export const TERRAIN_TYPES = ['Road', 'Treadmill', 'Trail', 'Hills', 'Track'];

export const TERRAIN_ICONS = {
  Road: '🛣️',
  Treadmill: '🏃‍♂️',
  Trail: '🌲',
  Hills: '⛰️',
  Track: '🏟️',
};

export const DEFAULT_SHOES = [
  {
    id: 'shoe_pegasus_40',
    name: 'Nike Pegasus 40',
    brand: 'Nike',
    currentMiles: 145.6,
    maxMiles: 350,
    isActive: true,
    terrain: 'Road',
    purchasedDate: '2026-08-10',
  },
  {
    id: 'shoe_endorphin_speed_3',
    name: 'Saucony Endorphin Speed 3',
    brand: 'Saucony',
    currentMiles: 232.4,
    maxMiles: 350,
    isActive: false,
    terrain: 'Track',
    purchasedDate: '2026-06-15',
  },
  {
    id: 'shoe_speedgoat_5',
    name: 'Hoka Speedgoat 5',
    brand: 'Hoka',
    currentMiles: 88.0,
    maxMiles: 350,
    isActive: false,
    terrain: 'Trail',
    purchasedDate: '2026-09-02',
  },
];

/**
 * Returns the icon emoji associated with a given terrain type.
 */
export const getTerrainIcon = (terrain) => TERRAIN_ICONS[terrain] || '🏃';

/**
 * Converts a "MM:SS" or "M:SS" pace string to total seconds.
 */
export const paceToSeconds = (paceStr) => {
  if (!paceStr) return 0;
  const clean = paceStr.replace(/[^0-9:]/g, '');
  const parts = clean.split(':');
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10) || 0;
    const sec = parseInt(parts[1], 10) || 0;
    return min * 60 + sec;
  }
  return 0;
};

/**
 * Converts total seconds into "M:SS" pace format.
 */
export const secondsToPace = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Parses a Google Sheets split string into a structured array of split objects.
 * Example input: "M1: 8:45 | M2: 8:32 | Rem (0.19m): 8:10/mi"
 *
 * @param {string} splitsStr - The raw split string
 * @returns {Array<{ id: string, label: string, pace: string, paceSeconds: number, isFastest: boolean, isSlowest: boolean, barPercent: number }>}
 */
export const parseSplits = (splitsStr) => {
  if (!splitsStr || typeof splitsStr !== 'string') return [];

  // Split by pipe '|', semicolon ';', or comma ','
  const chunks = splitsStr
    .split(/[|;,]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) return [];

  const rawParsed = [];

  chunks.forEach((chunk, index) => {
    // Examples: "M1: 8:45", "Mile 1: 8:32", "Rem (0.19m): 8:10/mi", "1: 8:45"
    const colonIdx = chunk.indexOf(':');
    let label = `Mile ${index + 1}`;
    let pacePortion = chunk;

    if (colonIdx !== -1) {
      const leftPart = chunk.slice(0, colonIdx).trim();
      pacePortion = chunk.slice(colonIdx + 1).trim();

      // Clean up common labels
      if (/^m\d+$/i.test(leftPart)) {
        label = `Mile ${leftPart.replace(/[^0-9]/g, '')}`;
      } else if (/^km\d+$/i.test(leftPart)) {
        label = `Km ${leftPart.replace(/[^0-9]/g, '')}`;
      } else if (/^rem/i.test(leftPart)) {
        label = leftPart.replace(/\((\d+(\.\d+)?)m\)/i, '($1 mi)');
      } else if (leftPart) {
        label = leftPart;
      }
    }

    // Extract pace like "8:45" or "8:45/mi"
    const paceMatch = pacePortion.match(/\b\d{1,2}:\d{2}\b/);
    const pace = paceMatch ? paceMatch[0] : pacePortion.trim();
    const paceSeconds = paceToSeconds(pace);

    rawParsed.push({
      id: `split_${index + 1}`,
      raw: chunk,
      label,
      pace: pace ? `${pace} /mi` : '—',
      paceSeconds,
    });
  });

  const validPaces = rawParsed.map((s) => s.paceSeconds).filter((sec) => sec > 0);
  if (validPaces.length === 0) {
    return rawParsed.map((s) => ({
      ...s,
      isFastest: false,
      isSlowest: false,
      barPercent: 50,
      deltaSeconds: 0,
      deltaFormatted: null,
      deltaType: 'even',
    }));
  }

  const minSec = Math.min(...validPaces);
  const maxSec = Math.max(...validPaces);
  const avgSeconds = Math.round(
    validPaces.reduce((sum, val) => sum + val, 0) / validPaces.length
  );

  return rawParsed.map((s) => {
    const isFastest = s.paceSeconds > 0 && s.paceSeconds === minSec && validPaces.length > 1;
    const isSlowest = s.paceSeconds > 0 && s.paceSeconds === maxSec && validPaces.length > 1;

    let deltaSeconds = 0;
    let deltaFormatted = null;
    let deltaType = 'even'; // 'faster' | 'slower' | 'even'

    if (s.paceSeconds > 0 && validPaces.length > 1) {
      deltaSeconds = s.paceSeconds - avgSeconds;
      if (deltaSeconds < 0) {
        deltaFormatted = `${deltaSeconds}s`; // e.g. "-10s" (faster than average)
        deltaType = 'faster';
      } else if (deltaSeconds > 0) {
        deltaFormatted = `+${deltaSeconds}s`; // e.g. "+12s" (slower than average)
        deltaType = 'slower';
      } else {
        deltaFormatted = '0s';
        deltaType = 'even';
      }
    }

    // Relative bar percentage kept for backwards compatibility
    let barPercent = 75;
    if (maxSec > minSec && s.paceSeconds > 0) {
      const ratio = 1 - (s.paceSeconds - minSec) / (maxSec - minSec);
      barPercent = Math.round(55 + ratio * 45);
    }

    return {
      ...s,
      isFastest,
      isSlowest,
      barPercent,
      avgSeconds,
      deltaSeconds,
      deltaFormatted,
      deltaType,
    };
  });
}

/**
 * Calculates the formatted average pace string from a list of parsed splits.
 * @param {Array<{ paceSeconds: number }>} parsedSplits
 * @returns {string|null} e.g. "8:15 /mi" or null if unavailable
 */
export const getAverageSplitPace = (parsedSplits) => {
  if (!Array.isArray(parsedSplits) || parsedSplits.length === 0) return null;
  const valid = parsedSplits.filter((s) => s.paceSeconds > 0);
  if (valid.length === 0) return null;
  const avgSec = Math.round(valid.reduce((sum, s) => sum + s.paceSeconds, 0) / valid.length);
  return `${secondsToPace(avgSec)} /mi`;
};

/**
 * Retrieves the stored shoe list from localStorage, falling back to DEFAULT_SHOES.
 */
export const getStoredShoes = () => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY_SHOES) || localStorage.getItem(LEGACY_STORAGE_KEY_SHOES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_SHOES;
};

/**
 * Saves shoe list to localStorage.
 */
export const saveStoredShoes = (shoes) => {
  try {
    localStorage.setItem(STORAGE_KEY_SHOES, JSON.stringify(shoes));
  } catch (err) {
    console.warn('Failed to save shoes to localStorage:', err);
  }
  // Mirror to IndexedDB shoe_rotation store
  saveAllShoes(shoes).catch(() => {});
};

/**
 * Returns the currently active shoe.
 */
export const getActiveShoe = () => {
  const shoes = getStoredShoes();
  return shoes.find((s) => s.isActive) || shoes[0] || null;
};

/**
 * Sets a specific shoe as active and saves to localStorage.
 */
export const setActiveShoe = (shoeId) => {
  const shoes = getStoredShoes().map((shoe) => ({
    ...shoe,
    isActive: shoe.id === shoeId,
  }));
  saveStoredShoes(shoes);
  return shoes;
};

/**
 * Adds a new shoe to the tracker.
 */
export const addNewShoe = ({ name, brand = '', startingMiles = 0, terrain = 'Road', maxMiles = 350 }) => {
  const shoes = getStoredShoes();
  const newShoe = {
    id: `shoe_${Date.now()}`,
    name: name.trim(),
    brand: brand.trim(),
    currentMiles: Math.max(0, Number(startingMiles) || 0),
    maxMiles: Number(maxMiles) || RETIREMENT_THRESHOLD_MILES,
    isActive: shoes.length === 0, // active if first shoe
    terrain,
    purchasedDate: getLocalDateString(),
  };

  const updated = [newShoe, ...shoes];
  saveStoredShoes(updated);
  return updated;
};

/**
 * Logs miles onto a shoe's odometer.
 */
export const addMilesToShoe = (shoeId, miles) => {
  const numMiles = Number(miles);
  if (!Number.isFinite(numMiles) || numMiles <= 0) return getStoredShoes();

  const shoes = getStoredShoes().map((shoe) => {
    if (shoe.id === shoeId) {
      const newTotal = Math.round((shoe.currentMiles + numMiles) * 10) / 10;
      return { ...shoe, currentMiles: newTotal };
    }
    return shoe;
  });

  saveStoredShoes(shoes);
  return shoes;
};

/**
 * Evaluates shoe health and distance relative to the 350-mile retirement threshold.
 *
 * @param {number} currentMiles
 * @param {number} [maxMiles=350]
 * @returns {{ percentage: number, remainingMiles: number, status: 'good'|'moderate'|'warning'|'retired', statusLabel: string, colorClass: string }}
 */
export const getShoeHealth = (currentMiles = 0, maxMiles = RETIREMENT_THRESHOLD_MILES) => {
  const miles = Math.max(0, Number(currentMiles) || 0);
  const limit = Math.max(1, Number(maxMiles) || RETIREMENT_THRESHOLD_MILES);
  const percentage = Math.min(100, Math.round((miles / limit) * 100));
  const remainingMiles = Math.max(0, Math.round((limit - miles) * 10) / 10);

  if (miles >= limit) {
    return {
      percentage: 100,
      remainingMiles: 0,
      status: 'retired',
      statusLabel: 'Retire Shoe (350+ mi reached)',
      colorClass: 'shoe-health-retired',
    };
  }

  if (percentage >= 85) {
    return {
      percentage,
      remainingMiles,
      status: 'warning',
      statusLabel: `${remainingMiles} mi to retirement`,
      colorClass: 'shoe-health-warning',
    };
  }

  if (percentage >= 60) {
    return {
      percentage,
      remainingMiles,
      status: 'moderate',
      statusLabel: `${remainingMiles} mi left`,
      colorClass: 'shoe-health-moderate',
    };
  }

  return {
    percentage,
    remainingMiles,
    status: 'good',
    statusLabel: `${remainingMiles} mi left`,
    colorClass: 'shoe-health-good',
  };
};
