/**
 * ApexFit UI Formatting Utilities
 *
 * Provides centralized, tested helper functions for duration, clock timers,
 * volume metrics, and distance labels across all components.
 */

/**
 * Formats a duration in seconds into a clean human-readable string (e.g. '45m' or '1h 15m').
 *
 * @param {number} [durationSec=0]
 * @returns {string}
 */
export const formatDuration = (durationSec = 0) => {
  if (!durationSec || Number.isNaN(Number(durationSec))) return '0m';
  const totalMin = Math.round(Number(durationSec) / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hrs}h ${mins}m`;
};

/**
 * Formats elapsed seconds into standard stopwatch clock format 'MM:SS'.
 *
 * @param {number} [totalSeconds=0]
 * @returns {string} e.g. '04:12'
 */
export const formatClock = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Formats weight volume in lbs with thousands comma separators.
 *
 * @param {number} [volumeLbs=0]
 * @returns {string} e.g. '14,250'
 */
export const formatVolumeLbs = (volumeLbs = 0) => {
  const safe = Number(volumeLbs) || 0;
  return safe.toLocaleString('en-US');
};
