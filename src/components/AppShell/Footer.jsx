import RestTimer from '../RestTimer';

/**
 * Decoupled Footer Component
 *
 * Renders persistent bottom elements, such as the sticky RestTimer HUD
 * when configured by the active view or when an active rest countdown is underway.
 *
 * @param {Object} props
 * @param {Object} props.viewConfig - Active view configuration from VIEW_CONFIG
 * @param {Object} [props.activeRestSetInfo] - Active rest set information if counting down
 * @param {Object} [props.activeExerciseForRest] - Exercise associated with active rest
 * @param {number} [props.restTriggerKey] - Re-render trigger key for timer resets
 * @param {Function} [props.onRestUpdate] - Rest timer update handler
 * @param {Function} [props.onStopOrCompleteRest] - Handler for stopping or finishing rest
 * @param {Function} [props.onUpdateExerciseRest] - Handler for updating exercise default rest
 * @param {React.ReactNode} [props.children] - Optional slot for bottom navigation or actions
 */
export const Footer = ({
  viewConfig,
  activeRestSetInfo = null,
  activeExerciseForRest = null,
  restTriggerKey = 0,
  onRestUpdate,
  onStopOrCompleteRest,
  onUpdateExerciseRest,
  children = null,
}) => {
  const shouldShowRestTimer = Boolean(viewConfig?.footer?.showRestTimerHUD || activeRestSetInfo);

  return (
    <footer className="app-footer">
      {shouldShowRestTimer && (
        <RestTimer
          activeExercise={activeExerciseForRest}
          triggerKey={restTriggerKey}
          targetSetInfo={activeRestSetInfo}
          onRestUpdate={onRestUpdate}
          onStopOrCompleteRest={onStopOrCompleteRest}
          onUpdateExerciseRest={onUpdateExerciseRest}
        />
      )}
      {children}
    </footer>
  );
};

export default Footer;
