/**
 * Decoupled Header Component
 *
 * Renders the top app bar dynamically based strictly on the active view's configuration
 * from the centralized View Registry (VIEW_CONFIG), eliminating inline view-conditional chains.
 *
 * @param {Object} props
 * @param {Object} props.viewConfig - Active view configuration from VIEW_CONFIG
 * @param {Record<string, Function>} props.actionMap - Mapped action callbacks indexed by actionKey
 * @param {string} [props.workoutName] - Current active workout name if applicable
 * @param {string} [props.formattedSessionClock] - Formatted session timer (MM:SS)
 * @param {boolean} [props.isWorkoutStarted] - Whether an active session is in progress
 * @param {Function} [props.onTriggerStartWorkout] - Handler to begin active workout countdown
 * @param {boolean} [props.showSettings] - Whether settings modal is open
 * @param {Function} [props.onToggleSettings] - Handler to toggle settings modal
 */
export const Header = ({
  viewConfig,
  actionMap = {},
  workoutName = '',
  formattedSessionClock = '00:00',
  isWorkoutStarted = false,
  onTriggerStartWorkout,
  showSettings = false,
  onToggleSettings,
}) => {
  const {
    showBack,
    backActionKey,
    backLabel = '← Plan',
    backTitle = 'Return to Weekly Plan',
    type: headerType,
    title,
    subtitle,
    defaultTitle,
    headerActions = [],
  } = viewConfig;

  return (
    <header className="app-topbar">
      <div className="brand-block">
        {showBack && (
          <button
            type="button"
            className="topbar-back-btn"
            onClick={actionMap[backActionKey]}
            title={backTitle}
            aria-label={backTitle}
          >
            {backLabel}
          </button>
        )}

        <div className="brand-title-wrap">
          {headerType === 'brand' && (
            <div className="brand-logo-container">
              <img
                src="/apexfit-logo.png"
                alt="ApexFit"
                className="app-header-logo-img"
              />
            </div>
          )}

          {headerType === 'text' && (
            <>
              <h1 className="app-title">{title}</h1>
              {subtitle && <span className="session-clock">{subtitle}</span>}
            </>
          )}

          {headerType === 'dynamic_workout' && (
            <>
              <h1 className="app-title">{workoutName || defaultTitle}</h1>
              <span className="session-clock">{`Session: ${formattedSessionClock}`}</span>
            </>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        {headerActions.map((action) => {
          if (action.type === 'button') {
            return (
              <button
                key={action.id}
                type="button"
                className={action.className}
                onClick={actionMap[action.actionKey]}
                title={action.title}
                aria-label={action.ariaLabel || action.title}
              >
                {action.label}
              </button>
            );
          }

          if (action.type === 'workout_state_slot') {
            if (!isWorkoutStarted) {
              return (
                <button
                  key={action.id}
                  type="button"
                  className="topbar-btn topbar-start-btn"
                  onClick={onTriggerStartWorkout}
                  title="Start workout timer"
                  aria-label="Start workout"
                >
                  ▶ Start
                </button>
              );
            }

            return (
              <div key={action.id} className="topbar-workout-active-group">
                <span className="topbar-active-badge" title="Workout in progress">
                  ● Active
                </span>
              </div>
            );
          }

          return null;
        })}

        <button
          type="button"
          className={`topbar-btn topbar-icon-btn ${showSettings ? 'active' : ''}`}
          onClick={onToggleSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
};

export default Header;
