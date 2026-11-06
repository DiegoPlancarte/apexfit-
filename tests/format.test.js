import { formatDuration, formatClock, formatVolumeLbs } from '../src/utils/format';

describe('Format Utilities (formatDuration, formatClock, formatVolumeLbs)', () => {
  describe('formatDuration', () => {
    it('formats 0 or falsy duration as 0m', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(null)).toBe('0m');
      expect(formatDuration(undefined)).toBe('0m');
      expect(formatDuration('invalid')).toBe('0m');
    });

    it('formats durations under one hour in minutes', () => {
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(1800)).toBe('30m');
      expect(formatDuration(3540)).toBe('59m');
    });

    it('formats durations of one hour or more in hours and minutes', () => {
      expect(formatDuration(3600)).toBe('1h 0m');
      expect(formatDuration(3660)).toBe('1h 1m');
      expect(formatDuration(5400)).toBe('1h 30m');
      expect(formatDuration(7200)).toBe('2h 0m');
    });
  });

  describe('formatClock', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatClock(0)).toBe('00:00');
      expect(formatClock(null)).toBe('00:00');
      expect(formatClock(undefined)).toBe('00:00');
    });

    it('pads single-digit minutes and seconds with leading zeroes', () => {
      expect(formatClock(5)).toBe('00:05');
      expect(formatClock(65)).toBe('01:05');
      expect(formatClock(599)).toBe('09:59');
    });

    it('formats two-digit minutes correctly', () => {
      expect(formatClock(600)).toBe('10:00');
      expect(formatClock(3599)).toBe('59:59');
      expect(formatClock(3600)).toBe('60:00');
    });
  });

  describe('formatVolumeLbs', () => {
    it('formats volume with thousands separators', () => {
      expect(formatVolumeLbs(0)).toBe('0');
      expect(formatVolumeLbs(450)).toBe('450');
      expect(formatVolumeLbs(1000)).toBe('1,000');
      expect(formatVolumeLbs(14250)).toBe('14,250');
      expect(formatVolumeLbs(125000)).toBe('125,000');
    });

    it('handles falsy or invalid input gracefully', () => {
      expect(formatVolumeLbs(null)).toBe('0');
      expect(formatVolumeLbs(undefined)).toBe('0');
      expect(formatVolumeLbs('abc')).toBe('0');
    });
  });
});
