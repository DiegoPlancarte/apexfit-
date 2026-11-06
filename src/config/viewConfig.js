/**
 * Centralized View Registry / Route Map Configuration (VIEW_CONFIG)
 *
 * Defines declarative metadata for each application view:
 * - Title / Heading & Subtitle rules
 * - Header brand mark or dynamic workout titles
 * - Action buttons & secondary header slots
 * - Footer configuration (e.g., sticky RestTimer HUD)
 */

export const VIEW_KEYS = {
  DASHBOARD: 'dashboard',
  HISTORY: 'history',
  WORKOUT: 'workout',
};

export const VIEW_CONFIG = {
  [VIEW_KEYS.DASHBOARD]: {
    id: VIEW_KEYS.DASHBOARD,
    type: 'brand', // Renders the ApexFit brand logo mark
    title: 'ApexFit',
    subtitle: null,
    showBack: false,
    headerActions: [
      {
        id: 'history_nav',
        type: 'button',
        label: '📖 History',
        className: 'topbar-btn topbar-nav-btn',
        title: 'View historical logbook',
        ariaLabel: 'Open Historical Records',
        actionKey: 'navigateToHistory',
      },
    ],
    footer: {
      showRestTimerHUD: false, // Only rendered if activeRestSetInfo is present
    },
  },

  [VIEW_KEYS.HISTORY]: {
    id: VIEW_KEYS.HISTORY,
    type: 'text',
    title: 'LOGBOOK ARCHIVE',
    subtitle: 'Past Sessions & Sets',
    showBack: false,
    headerActions: [
      {
        id: 'plan_nav',
        type: 'button',
        label: '📅 Plan',
        className: 'topbar-btn topbar-nav-btn',
        title: 'Return to Weekly Plan',
        ariaLabel: 'Open Weekly Plan',
        actionKey: 'navigateToDashboard',
      },
    ],
    footer: {
      showRestTimerHUD: false,
    },
  },

  [VIEW_KEYS.WORKOUT]: {
    id: VIEW_KEYS.WORKOUT,
    type: 'dynamic_workout',
    defaultTitle: 'ACTIVE WORKOUT',
    showBack: true,
    backActionKey: 'navigateToDashboard',
    backLabel: '← Plan',
    backTitle: 'Return to Weekly Plan',
    headerActions: [
      {
        id: 'workout_state_action',
        type: 'workout_state_slot',
      },
    ],
    footer: {
      showRestTimerHUD: true,
    },
  },
};

/**
 * Resolves view configuration object by key with fallback to dashboard.
 *
 * @param {string} viewKey
 * @returns {typeof VIEW_CONFIG[keyof typeof VIEW_CONFIG]}
 */
export const getViewConfig = (viewKey) => {
  return VIEW_CONFIG[viewKey] || VIEW_CONFIG[VIEW_KEYS.DASHBOARD];
};
