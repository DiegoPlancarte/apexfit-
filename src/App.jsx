import './App.css';
import { useMemo, useState, useEffect } from 'react';
import ActiveWorkout from './components/ActiveWorkout';
import ActiveWorkoutBanner from './components/ActiveWorkoutBanner';
import ActiveWorkoutGuardModal from './components/ActiveWorkoutGuardModal';
import ConfirmModal from './components/ConfirmModal';
import CountdownOverlay from './components/CountdownOverlay';
import Dashboard from './components/Dashboard';
import HistoryLog from './components/HistoryLog';
import SettingsModal from './components/SettingsModal';
import SplashScreen from './components/SplashScreen';
import { MainLayout } from './components/AppShell';
import { getViewConfig, VIEW_KEYS } from './config/viewConfig';
import { useComponentLogic } from './hooks';
import { initializeAppFlow } from './utils/appInit';

export default function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initStatusMessage, setInitStatusMessage] = useState(
    'INITIALIZING APEXFIT • HYDRATING LOCAL DATA'
  );

  useEffect(() => {
    let isMounted = true;
    initializeAppFlow({
      minBrandingMs: 1200,
      maxTimeoutMs: 3500,
      onStatusUpdate: (msg) => {
        if (isMounted) setInitStatusMessage(msg);
      },
    }).finally(() => {
      if (isMounted) {
        setIsInitialLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);
  const {
    currentView,
    setCurrentView,
    completedDayNumbers,
    handleSelectWorkoutDay,
    handleOpenTodaysWod,
    workoutState,
    lastSessionHistory,
    restTriggerKey,
    activeRestSetInfo,
    activeExerciseForRest,
    formattedSessionClock,
    isWorkoutStarted,
    isGuardModalOpen,
    guardAlertMessage,
    handleTriggerGuardAlert,
    handleCloseGuardModal,
    handleResumeActiveWorkout,
    isEndEarlyModalOpen,
    handleRequestEndEarly,
    handleCancelEndEarly,
    handleConfirmEndEarly,
    isCountdownActive,
    handleTriggerStartWorkout,
    handleCountdownComplete,
    handleCancelCountdown,
    showSettings,
    setShowSettings,
    gasUrlInput,
    setGasUrlInput,
    syncStatus,
    currentPayload,
    handleUpdateWorkoutMeta,
    handleUpdateExerciseRest,
    handleAddExercise,
    handleRemoveExercise,
    handleUpdateSet,
    handleToggleCompleteSet,
    handleAddSet,
    handleRemoveSet,
    handleRestoreSet,
    handleRestUpdate,
    handleStopOrCompleteRest,
    handleSaveSettings,
    handleSyncWorkout,
    handleResetWorkout,
  } = useComponentLogic();

  // Resolve declarative view metadata from centralized View Registry
  const viewConfig = useMemo(() => getViewConfig(currentView), [currentView]);

  // Action mapping dispatched to dynamic header/footer actions based on registry action keys
  const actionMap = useMemo(
    () => ({
      navigateToDashboard: () => {
        if (isWorkoutStarted && currentView === VIEW_KEYS.WORKOUT) {
          handleTriggerGuardAlert();
          return;
        }
        setCurrentView(VIEW_KEYS.DASHBOARD);
      },
      navigateToHistory: () => {
        if (isWorkoutStarted && currentView === VIEW_KEYS.WORKOUT) {
          handleTriggerGuardAlert();
          return;
        }
        setCurrentView(VIEW_KEYS.HISTORY);
      },
      openTodaysWod: handleOpenTodaysWod,
      endWorkoutEarly: handleRequestEndEarly,
    }),
    [isWorkoutStarted, currentView, handleTriggerGuardAlert, setCurrentView, handleOpenTodaysWod, handleRequestEndEarly]
  );

  const isAppLoadingOrSyncing = isInitialLoading || Boolean(syncStatus?.loading);
  const splashMessage = syncStatus?.loading
    ? syncStatus.message || 'SAVING WORKOUT & SYNCING GOOGLE SHEETS...'
    : initStatusMessage;

  return (
    <>
      <MainLayout
        currentView={currentView}
        viewConfig={viewConfig}
        actionMap={actionMap}
        workoutName={workoutState.workoutName}
        formattedSessionClock={formattedSessionClock}
        isWorkoutStarted={isWorkoutStarted}
        onTriggerStartWorkout={handleTriggerStartWorkout}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
        activeRestSetInfo={activeRestSetInfo}
        activeExerciseForRest={activeExerciseForRest}
        restTriggerKey={restTriggerKey}
        onRestUpdate={handleRestUpdate}
        onStopOrCompleteRest={handleStopOrCompleteRest}
        onUpdateExerciseRest={handleUpdateExerciseRest}
      >
        {/* Persistent Warning Banner when viewing secondary screens during active session */}
        {isWorkoutStarted && currentView !== VIEW_KEYS.WORKOUT && (
          <ActiveWorkoutBanner
            workoutName={workoutState.workoutName}
            formattedSessionClock={formattedSessionClock}
            onResumeWorkout={handleResumeActiveWorkout}
          />
        )}

        {/* Active View Content Component */}
        {currentView === VIEW_KEYS.DASHBOARD && (
          <Dashboard
            onSelectDay={handleSelectWorkoutDay}
            completedDayNumbers={completedDayNumbers}
            isReadOnly={isWorkoutStarted}
            activePlanDayNumber={workoutState.planDayNumber}
            onBlockedAction={handleTriggerGuardAlert}
          />
        )}

        {currentView === VIEW_KEYS.HISTORY && (
          <HistoryLog
            isReadOnly={isWorkoutStarted}
            onBlockedAction={handleTriggerGuardAlert}
          />
        )}

        {currentView === VIEW_KEYS.WORKOUT && (
          <ActiveWorkout
            workoutState={workoutState}
            lastSessionHistory={lastSessionHistory}
            onUpdateWorkoutMeta={handleUpdateWorkoutMeta}
            onUpdateExerciseRest={handleUpdateExerciseRest}
            onAddExercise={handleAddExercise}
            onRemoveExercise={handleRemoveExercise}
            onUpdateSet={handleUpdateSet}
            onToggleCompleteSet={handleToggleCompleteSet}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onRestoreSet={handleRestoreSet}
            onSyncWorkout={handleSyncWorkout}
            onResetWorkout={handleResetWorkout}
            syncStatus={syncStatus}
          />
        )}
      </MainLayout>

      {/* Settings & Integration Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        gasUrlInput={gasUrlInput}
        setGasUrlInput={setGasUrlInput}
        onSaveSettings={handleSaveSettings}
        currentPayload={currentPayload}
      />

      {/* Full-Screen Loading & Synchronization Screen */}
      <SplashScreen
        isVisible={isAppLoadingOrSyncing}
        message={splashMessage}
      />

      {/* Active Workout Interaction & Navigation Guard Intercept Modal */}
      <ActiveWorkoutGuardModal
        isOpen={isGuardModalOpen}
        message={guardAlertMessage}
        onClose={handleCloseGuardModal}
        onResumeWorkout={handleResumeActiveWorkout}
        onProceedReadOnly={
          currentView === VIEW_KEYS.WORKOUT
            ? () => {
                handleCloseGuardModal();
                setCurrentView(VIEW_KEYS.DASHBOARD);
              }
            : undefined
        }
      />

      {/* Confirmation Modal: End Workout Early / Premature Completion */}
      <ConfirmModal
        isOpen={isEndEarlyModalOpen}
        title="End Workout Early?"
        message="You have unfinished exercises remaining. Would you like to save your completed sets and finish the session now?"
        confirmText="Confirm & Save"
        cancelText="Cancel"
        confirmVariant="primary"
        onConfirm={handleConfirmEndEarly}
        onCancel={handleCancelEndEarly}
      />

      {/* 3-Second Workout Start Countdown Overlay with Audio Cues */}
      <CountdownOverlay
        key={isCountdownActive ? 'countdown-active' : 'countdown-idle'}
        isActive={isCountdownActive}
        onComplete={handleCountdownComplete}
        onCancel={handleCancelCountdown}
      />
    </>
  );
}
