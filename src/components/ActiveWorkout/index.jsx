import ConfirmModal from '../ConfirmModal';
import ExerciseCard from '../ExerciseCard';
import ExercisePickerModal from '../ExercisePickerModal';
import { useComponentLogic } from './hooks';

/**
 * ActiveWorkout Component
 * Main active session view for exercise list, sets, RIR tracking, and session actions.
 * Protects against accidental deletion of exercises and workouts via ConfirmModal.
 */
export default function ActiveWorkout(props) {
  const {
    workoutState,
    lastSessionHistory = {},
    onUpdateExerciseRest,
    onUpdateSet,
    onToggleCompleteSet,
    onAddSet,
    onSyncWorkout,
    syncStatus,
  } = props;

  const {
    exercisePendingDelete,
    isResetModalOpen,
    isPickerOpen,
    pickerInitialSearch,
    undoToast,
    totalExercisesCount,
    totalSetsCount,
    completedSetsCount,
    totalVolumeLbs,
    handleOpenPicker,
    handleClosePicker,
    handleSelectExerciseFromLibrary,
    handleRemoveSetWithUndo,
    handleUndoDeleteSet,
    handleDismissUndoToast,
    handleWorkoutNameChange,
    handleWorkoutNotesChange,
    handleRequestDeleteExercise,
    handleConfirmDeleteExercise,
    handleCancelDeleteExercise,
    handleRequestReset,
    handleConfirmReset,
    handleCancelReset,
  } = useComponentLogic(props);

  return (
    <main className="active-workout-container">
      <section className="session-meta-card">
        <div className="session-title-row">
          <input
            type="text"
            className="workout-name-input"
            value={workoutState.workoutName}
            onChange={handleWorkoutNameChange}
            placeholder="Workout Name (e.g., Push Day A)"
            aria-label="Workout Name"
          />
        </div>

        <div className="session-stats-grid">
          <div className="stat-pill">
            <span className="stat-label">Exercises</span>
            <span className="stat-value">{totalExercisesCount}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Completed Sets</span>
            <span className="stat-value">
              {completedSetsCount} / {totalSetsCount}
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Volume</span>
            <span className="stat-value">{totalVolumeLbs.toLocaleString()} lb</span>
          </div>
        </div>

        <textarea
          className="workout-notes-input"
          rows={2}
          value={workoutState.notes || ''}
          onChange={handleWorkoutNotesChange}
          placeholder="Session notes (energy level, sleep, gym equipment notes...)"
        />
      </section>

      <section className="exercises-list">
        {workoutState.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            previousHistory={lastSessionHistory[exercise.exerciseName] || []}
            onUpdateExerciseRest={onUpdateExerciseRest}
            onUpdateSet={onUpdateSet}
            onToggleCompleteSet={onToggleCompleteSet}
            onAddSet={onAddSet}
            onRemoveSet={handleRemoveSetWithUndo}
            onRemoveExercise={handleRequestDeleteExercise}
          />
        ))}
      </section>

      <section className="add-movement-section" aria-label="Add Movement">
        <button
          type="button"
          className="btn-add-movement btn-add-exercise"
          onClick={() => handleOpenPicker('')}
          aria-label="Add Exercise"
        >
          <span className="btn-add-movement-icon">＋</span>
          <span className="btn-add-movement-text">Add Exercise</span>
        </button>
      </section>

      <section className="workout-footer-actions">
        {syncStatus?.message && (
          <div
            className={`sync-banner ${
              syncStatus.type === 'error'
                ? 'sync-banner-error'
                : syncStatus.type === 'success'
                ? 'sync-banner-success'
                : 'sync-banner-info'
            }`}
          >
            {syncStatus.message}
          </div>
        )}

        <div className="action-buttons-row">
          <button
            type="button"
            className="btn-sync"
            onClick={onSyncWorkout}
            disabled={syncStatus?.loading}
            aria-label="End Session & Sync"
          >
            {syncStatus?.loading ? 'Ending & Syncing...' : '✓ End Session & Sync'}
          </button>

          <button
            type="button"
            className="btn-reset btn-reset-session"
            onClick={handleRequestReset}
            disabled={syncStatus?.loading}
            aria-label="Reset Session"
          >
            Reset Session
          </button>
        </div>
      </section>

      {/* Dock spacer to guarantee action buttons never get obscured by the floating rest timer dock */}
      <div className="rest-timer-dock-spacer" aria-hidden="true" />

      {/* Confirmation Modal: Delete Exercise */}
      <ConfirmModal
        isOpen={Boolean(exercisePendingDelete)}
        title="Delete Exercise?"
        message={`Are you sure you want to remove "${exercisePendingDelete?.exerciseName}" and its logged sets? This action cannot be undone.`}
        confirmText="Delete Exercise"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDeleteExercise}
        onCancel={handleCancelDeleteExercise}
      />

      {/* Confirmation Modal: Reset Active Session */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset Session?"
        message="Are you sure you want to reset the current session? Any unsaved sets and progress in this workout will be cleared."
        confirmText="Reset Session"
        cancelText="Keep Session"
        confirmVariant="danger"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />

      {/* Standardized Exercise Library & Picker Modal */}
      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={handleClosePicker}
        initialSearch={pickerInitialSearch}
        onSelectExercise={handleSelectExerciseFromLibrary}
      />

      {/* Floating Undo Safety Net Snackbar for Set Deletions */}
      {undoToast && (
        <div className="undo-snackbar" role="status" aria-live="polite">
          <div className="undo-snackbar-content">
            <span className="undo-snackbar-icon">🗑️</span>
            <span className="undo-snackbar-text">
              Set {undoToast.setNumber ? `${undoToast.setNumber}` : ''} deleted
            </span>
          </div>
          <div className="undo-snackbar-actions">
            <button
              type="button"
              className="btn-undo-action"
              onClick={handleUndoDeleteSet}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn-undo-dismiss"
              onClick={handleDismissUndoToast}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
