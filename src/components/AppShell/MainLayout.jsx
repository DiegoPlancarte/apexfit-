import Header from './Header';
import Content from './Content';
import Footer from './Footer';

/**
 * MainLayout Component (App Shell Architecture)
 *
 * Coordinates decoupled Header, Content, and Footer components based on
 * the centralized View Registry (VIEW_CONFIG), removing inline view-conditional chains.
 *
 * @param {Object} props
 * @param {string} props.currentView - Active view identifier ('dashboard' | 'history' | 'workout')
 * @param {Object} props.viewConfig - Active view configuration from VIEW_CONFIG
 * @param {Record<string, Function>} props.actionMap - Mapped actions for header/footer triggers
 * @param {string} [props.workoutName] - Current workout name
 * @param {string} [props.formattedSessionClock] - Formatted session timer
 * @param {boolean} [props.isWorkoutStarted] - Workout progress state
 * @param {Function} [props.onTriggerStartWorkout] - Workout start trigger handler
 * @param {boolean} [props.showSettings] - Settings modal visibility state
 * @param {Function} [props.onToggleSettings] - Settings modal toggle handler
 * @param {Object} [props.activeRestSetInfo] - Active rest set information
 * @param {Object} [props.activeExerciseForRest] - Exercise for active rest
 * @param {number} [props.restTriggerKey] - Rest timer trigger key
 * @param {Function} [props.onRestUpdate] - Rest update callback
 * @param {Function} [props.onStopOrCompleteRest] - Stop rest callback
 * @param {Function} [props.onUpdateExerciseRest] - Update exercise rest callback
 * @param {React.ReactNode} props.children - Main view content
 */
export const MainLayout = ({
  currentView,
  viewConfig,
  actionMap,
  workoutName = '',
  formattedSessionClock = '00:00',
  isWorkoutStarted = false,
  onTriggerStartWorkout,
  showSettings = false,
  onToggleSettings,
  activeRestSetInfo = null,
  activeExerciseForRest = null,
  restTriggerKey = 0,
  onRestUpdate,
  onStopOrCompleteRest,
  onUpdateExerciseRest,
  children,
}) => {
  return (
    <div className={`mobile-app-shell view-${currentView} ${activeRestSetInfo ? 'has-active-rest' : ''}`}>
      <Header
        viewConfig={viewConfig}
        actionMap={actionMap}
        workoutName={workoutName}
        formattedSessionClock={formattedSessionClock}
        isWorkoutStarted={isWorkoutStarted}
        onTriggerStartWorkout={onTriggerStartWorkout}
        showSettings={showSettings}
        onToggleSettings={onToggleSettings}
      />

      <Content>{children}</Content>

      <Footer
        viewConfig={viewConfig}
        activeRestSetInfo={activeRestSetInfo}
        activeExerciseForRest={activeExerciseForRest}
        restTriggerKey={restTriggerKey}
        onRestUpdate={onRestUpdate}
        onStopOrCompleteRest={onStopOrCompleteRest}
        onUpdateExerciseRest={onUpdateExerciseRest}
      />
    </div>
  );
};

export default MainLayout;
