import {
  VIEW_KEYS,
  VIEW_CONFIG,
  getViewConfig,
} from '../src/config/viewConfig';

describe('View Registry / Route Map Configuration (viewConfig)', () => {
  describe('VIEW_KEYS', () => {
    it('defines expected unique view keys', () => {
      expect(VIEW_KEYS.DASHBOARD).toBe('dashboard');
      expect(VIEW_KEYS.HISTORY).toBe('history');
      expect(VIEW_KEYS.WORKOUT).toBe('workout');

      const values = Object.values(VIEW_KEYS);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('VIEW_CONFIG Schema & Metadata', () => {
    it('defines complete metadata for the dashboard view', () => {
      const config = VIEW_CONFIG[VIEW_KEYS.DASHBOARD];
      expect(config).toBeDefined();
      expect(config.id).toBe('dashboard');
      expect(config.type).toBe('brand');
      expect(config.title).toBe('ApexFit');
      expect(config.subtitle).toBeNull();
      expect(config.showBack).toBe(false);

      expect(Array.isArray(config.headerActions)).toBe(true);
      expect(config.headerActions).toHaveLength(1);

      const [historyAction] = config.headerActions;
      expect(historyAction.id).toBe('history_nav');
      expect(historyAction.actionKey).toBe('navigateToHistory');

      expect(config.footer).toBeDefined();
      expect(config.footer.showRestTimerHUD).toBe(false);
    });

    it('defines complete metadata for the history view', () => {
      const config = VIEW_CONFIG[VIEW_KEYS.HISTORY];
      expect(config).toBeDefined();
      expect(config.id).toBe('history');
      expect(config.type).toBe('text');
      expect(config.title).toBe('LOGBOOK ARCHIVE');
      expect(config.subtitle).toBe('Past Sessions & Sets');
      expect(config.showBack).toBe(false);

      expect(Array.isArray(config.headerActions)).toBe(true);
      expect(config.headerActions).toHaveLength(1);

      const [planAction] = config.headerActions;
      expect(planAction.id).toBe('plan_nav');
      expect(planAction.actionKey).toBe('navigateToDashboard');

      expect(config.footer.showRestTimerHUD).toBe(false);
    });

    it('defines complete metadata for the workout view', () => {
      const config = VIEW_CONFIG[VIEW_KEYS.WORKOUT];
      expect(config).toBeDefined();
      expect(config.id).toBe('workout');
      expect(config.type).toBe('dynamic_workout');
      expect(config.defaultTitle).toBe('ACTIVE WORKOUT');
      expect(config.showBack).toBe(true);
      expect(config.backActionKey).toBe('navigateToDashboard');
      expect(config.backLabel).toBe('← Plan');

      expect(Array.isArray(config.headerActions)).toBe(true);
      expect(config.headerActions).toHaveLength(1);
      expect(config.headerActions[0].type).toBe('workout_state_slot');

      expect(config.footer.showRestTimerHUD).toBe(true);
    });
  });

  describe('getViewConfig Resolver', () => {
    it('returns requested view config for valid keys', () => {
      expect(getViewConfig('dashboard')).toBe(VIEW_CONFIG[VIEW_KEYS.DASHBOARD]);
      expect(getViewConfig('history')).toBe(VIEW_CONFIG[VIEW_KEYS.HISTORY]);
      expect(getViewConfig('workout')).toBe(VIEW_CONFIG[VIEW_KEYS.WORKOUT]);
    });

    it('falls back safely to dashboard config for unknown or missing keys', () => {
      expect(getViewConfig('unknown_view')).toBe(VIEW_CONFIG[VIEW_KEYS.DASHBOARD]);
      expect(getViewConfig(null)).toBe(VIEW_CONFIG[VIEW_KEYS.DASHBOARD]);
      expect(getViewConfig(undefined)).toBe(VIEW_CONFIG[VIEW_KEYS.DASHBOARD]);
      expect(getViewConfig('')).toBe(VIEW_CONFIG[VIEW_KEYS.DASHBOARD]);
    });
  });
});
