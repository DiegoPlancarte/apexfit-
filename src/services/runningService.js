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

export const DEFAULT_SHOES = [];

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
 * Excludes partial final splits (under 0.95 miles) from winning the "Fastest"
 * badge so that only full or near-full miles compete for fastest pace.
 *
 * @param {string} splitsStr - The raw split string
 * @param {number|null} [totalDistanceMiles=null] - Total run distance in miles to determine final partial split
 * @returns {Array<{ id: string, label: string, pace: string, paceSeconds: number, isFastest: boolean, isSlowest: boolean, barPercent: number, splitDistance: number, isFullMile: boolean }>}
 */
export const parseSplits = (splitsStr, totalDistanceMiles = null) => {
  if (!splitsStr || typeof splitsStr !== 'string') return [];

  // Split by pipe '|', semicolon ';', or comma ','
  const chunks = splitsStr
    .split(/[|;,]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) return [];

  const rawParsed = [];
  const parsedTotalDist = Number(totalDistanceMiles);
  const hasTotalDist = Number.isFinite(parsedTotalDist) && parsedTotalDist > 0;

  chunks.forEach((chunk, index) => {
    // Examples: "M1: 8:45", "Mile 1: 8:32", "Rem (0.19m): 8:10/mi", "1: 8:45"
    const colonIdx = chunk.indexOf(':');
    let label = `Mile ${index + 1}`;
    let pacePortion = chunk;
    let explicitDistance = null;

    // Check for explicit distance in chunk, e.g. "(0.19m)", "(0.22 mi)", "(0.22)"
    const distMatch = chunk.match(/\((\d+(?:\.\d+)?)\s*(?:m|mi|miles)?\)/i);
    if (distMatch) {
      explicitDistance = parseFloat(distMatch[1]);
    }

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

    // Determine split distance in miles
    let splitDistance = 1.0;
    if (explicitDistance !== null && Number.isFinite(explicitDistance)) {
      splitDistance = explicitDistance;
    } else if (hasTotalDist) {
      if (index < chunks.length - 1) {
        splitDistance = 1.0;
      } else {
        // Final split distance
        const remainder = Math.round((parsedTotalDist - (chunks.length - 1)) * 100) / 100;
        splitDistance = remainder > 0 ? remainder : 1.0;
      }
    } else if (/^rem/i.test(chunk)) {
      splitDistance = 0.5; // explicitly marked as remainder split
    }

    // A split is considered a full mile if its distance is at least 0.95 miles
    const isFullMile = splitDistance >= 0.95;

    // Enrich label with distance if it's a partial final split and doesn't already contain it
    if (!isFullMile && !label.includes('(') && !label.toLowerCase().includes('rem')) {
      label = `${label} (${splitDistance} mi)`;
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
      splitDistance,
      isFullMile,
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

  // Only full or near-full miles (distance >= 0.95 mi) compete for the fastest badge
  const eligibleFastestPaces = rawParsed
    .filter((s) => s.isFullMile && s.paceSeconds > 0)
    .map((s) => s.paceSeconds);

  const minSec = eligibleFastestPaces.length > 0 ? Math.min(...eligibleFastestPaces) : null;
  const maxSec = Math.max(...validPaces);
  const avgSeconds = Math.round(
    validPaces.reduce((sum, val) => sum + val, 0) / validPaces.length
  );

  return rawParsed.map((s) => {
    // Partial final splits under 0.95 miles are excluded from winning the fastest badge
    const isFastest =
      s.isFullMile &&
      s.paceSeconds > 0 &&
      minSec !== null &&
      s.paceSeconds === minSec &&
      validPaces.length > 1;

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
 * Clears lingering legacy storage keys and mock shoe test caches.
 */
export const purgeMockShoes = () => {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY_SHOES);
    const cached = localStorage.getItem(STORAGE_KEY_SHOES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (s) =>
            s &&
            s.id &&
            !s.id.startsWith('shoe_pegasus_40') &&
            !s.id.startsWith('shoe_endorphin_speed_3') &&
            !s.id.startsWith('shoe_speedgoat_5')
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_SHOES, JSON.stringify(cleaned));
        }
      }
    }
  } catch {
    // ignore
  }
};

/**
 * Retrieves the stored shoe list from localStorage, falling back to clean DEFAULT_SHOES.
 */
export const getStoredShoes = () => {
  try {
    purgeMockShoes();
    const cached = localStorage.getItem(STORAGE_KEY_SHOES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (s) =>
            s &&
            s.id &&
            !s.id.startsWith('shoe_pegasus_40') &&
            !s.id.startsWith('shoe_endorphin_speed_3') &&
            !s.id.startsWith('shoe_speedgoat_5')
        );
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
