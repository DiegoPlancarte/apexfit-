import { useComponentLogic } from './hooks';
import { ACTIVE_WORKOUT_GUARD_MESSAGE } from '../../config/workoutGuard';
import RunDetailsModal from '../RunDetailsModal';
import ManualRunLogger from '../ManualRunLogger';
import SessionReviewModal from '../SessionReviewModal';

/**
 * Dashboard Component
 * Executive weekly regimen overview tracking 7-day schedule, workouts, runs, rest days,
 * and a 10,000 daily step goal with multi-tier day completion milestones.
 */
export default function Dashboard(props) {
  const {
    enhancedDays,
    selectedDayNumber,
    selectedDateMeta,
    currentDaySteps,
    stepGoal,
    stepProgressPct,
    stepInputVal,
    stepInputError,
    handleStepInputChange,
    activeModalItem,
    setActiveModalItem,
    isRunLoggerOpen,
    runLoggerDayItem,
    runLogToastMsg,
    cardsListRef,
    cardRefs,
    isReadOnly,
    activePlanDayNumber,
    handleAddSteps,
    handleSetExactSteps,
    handleToggleDayComplete,
    handleToggleRestHabit,
    handleCardClick,
    handleSelectDayTab,
    handleOpenRunLogger,
    handleCloseRunLogger,
    handleRunLoggedSuccess,
    selectedWorkoutForReview,
    handleCloseWorkoutReview,
    handleSaveWorkoutReview,
  } = useComponentLogic(props);

  return (
    <div className="dashboard-container">
      {/* Static / Sticky Top Section */}
      <div className="dashboard-top-section">
        {/* 10,000 Daily Step Goal Progress Meter */}
        <section className="step-tracker-card" aria-label="Daily Step Goal Meter">
        <div className="step-tracker-header">
          <div>
            <span className="step-tracker-title">Daily Step Goal</span>
            <span className="step-tracker-date">
              {selectedDateMeta.isToday ? 'Today • ' : ''}
              {selectedDateMeta.formattedDate}
            </span>
          </div>

          <div className="step-readout">
            <span className="step-current">{currentDaySteps.toLocaleString()}</span>
            <span className="step-goal">/ {stepGoal.toLocaleString()}</span>
          </div>
        </div>

        {/* Horizontal Progress Bar */}
        <div className="step-progress-track">
          <div
            className={`step-progress-fill ${
              currentDaySteps >= stepGoal ? 'step-progress-fill-complete' : ''
            }`}
            style={{ width: `${stepProgressPct}%` }}
          />
        </div>

        <div className="step-tracker-footer">
          <span className="step-pct-text">
            {stepProgressPct}% {currentDaySteps >= stepGoal ? '• Goal Reached! 🎉' : 'completed'}
          </span>

          <div className="step-quick-buttons">
            <button
              type="button"
              className={`step-btn ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAddSteps(500)}
              disabled={isReadOnly}
              title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Add 500 steps'}
            >
              +500
            </button>
            <button
              type="button"
              className={`step-btn ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAddSteps(1000)}
              disabled={isReadOnly}
              title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Add 1,000 steps'}
            >
              +1k
            </button>
            <button
              type="button"
              className={`step-btn ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAddSteps(2500)}
              disabled={isReadOnly}
              title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Add 2,500 steps'}
            >
              +2.5k
            </button>
          </div>
        </div>

        {/* Custom Step Input Form */}
        <form onSubmit={handleSetExactSteps} className="step-manual-form">
          <div className="step-input-wrap">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="Custom steps..."
              value={stepInputVal}
              onChange={(e) => handleStepInputChange(e.target.value)}
              disabled={isReadOnly}
              title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : undefined}
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                  e.preventDefault();
                }
              }}
              className={`step-input ${stepInputError ? 'input-invalid' : ''} ${
                isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Custom daily steps"
              aria-invalid={Boolean(stepInputError)}
            />
            {stepInputError && (
              <span className="field-error-text step-field-error">⚠️ {stepInputError}</span>
            )}
          </div>
          <button
            type="submit"
            className={`step-set-btn ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isReadOnly || !stepInputVal.trim() || Boolean(stepInputError)}
            title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : undefined}
          >
            Set
          </button>
        </form>
      </section>

      {/* Week Header & Action Bar */}
      <section className="weekly-header-row">
        <div>
          <h2 className="weekly-title">Weekly Fitness Plan</h2>
          <span className="weekly-subtitle">7-Day Executive Overview</span>
        </div>

        <div className="weekly-header-actions">
          <button
            type="button"
            className={`btn-log-run-header ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleOpenRunLogger()}
            disabled={isReadOnly}
            title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Manually log a run or cardio session'}
          >
            🏃 + Log Run
          </button>
        </div>
      </section>

        {/* 7-Day Day Selector Bar */}
        <section className="week-day-tabs">
          {enhancedDays.map((day) => {
            const isSelected = day.dayNumber === selectedDayNumber;
            return (
              <button
                key={day.dayNumber}
                type="button"
                className={`day-tab-pill ${isSelected ? 'day-tab-pill-active' : ''} ${
                  day.isFullyComplete ? 'day-tab-pill-complete' : ''
                } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => handleSelectDayTab(day.dayNumber)}
                disabled={isReadOnly}
                title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : `Select Day ${day.dayNumber}`}
              >
                <span className="day-tab-num">D{day.dayNumber}</span>
                <span className="day-tab-dot" />
              </button>
            );
          })}
        </section>

        {/* Divider Bar between D1 through D7 and the workout cards */}
        <div className="dashboard-divider-bar" aria-hidden="true" />
      </div>

      {/* Scrollable Bottom Section: 7-Day Schedule Cards */}
      <section className="weekly-cards-list" ref={cardsListRef}>
        {enhancedDays.map((day) => {
          const isSelected = day.dayNumber === selectedDayNumber;
          const isWorkout = day.activityType === 'workout';
          const isRun = day.activityType === 'run';
          const isRest = day.activityType === 'rest';

          return (
            <article
              key={day.dayNumber}
              ref={(el) => {
                if (cardRefs.current) cardRefs.current[day.dayNumber] = el;
              }}
              className={`weekly-day-card ${
                day.isFullyComplete ? 'day-card-fully-complete' : ''
              } ${isSelected ? 'day-card-selected' : ''}`}
            >
              <div
                className="day-card-clickable-area"
                onClick={() => handleCardClick(day, day.dateMeta)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCardClick(day, day.dateMeta);
                }}
              >
                <header className="day-card-header">
                  <div className="day-card-title-group">
                    <span className="day-number-label">
                      Day {day.dayNumber} • {day.dateMeta.formattedDate}
                    </span>
                    {day.dateMeta.isToday && (
                      <span className="today-badge">TODAY</span>
                    )}
                  </div>

                  {/* Activity Badge (Blue = Workout, Green = Run, Gray = Rest) */}
                  <span
                    className={`activity-badge ${
                      isWorkout
                        ? 'badge-workout'
                        : isRun
                        ? 'badge-run'
                        : 'badge-rest'
                    }`}
                  >
                    {day.badgeLabel || day.title}
                  </span>
                </header>

                <h3 className="day-workout-title">{day.title}</h3>

                {/* Quick-Glance Volume / Intensity / PR Metric Sub-Label */}
                {day.isWorkoutDone && day.perfMetric && (
                  <div className="quick-perf-snippet">
                    <span className="quick-perf-icon">{isRun ? '🏃' : '⚡'}</span>
                    <span className="quick-perf-text">{day.perfMetric}</span>
                  </div>
                )}

                <p className="day-description">{day.description}</p>

                {/* Rest Day Value Add: Interactive Recovery Checkpoints */}
                {isRest && (
                  <div
                    className="rest-habits-box"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="rest-habits-header">Recovery Checks:</span>
                    <div className="rest-habits-buttons">
                      <button
                        type="button"
                        className={`rest-habit-btn ${
                          day.restHabits?.mobilityDone ? 'rest-habit-btn-active' : ''
                        } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => handleToggleRestHabit(day.dayNumber, 'mobilityDone')}
                        disabled={isReadOnly}
                        title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : undefined}
                        aria-label="Toggle mobility done"
                      >
                        <span className="rest-habit-icon">🧘</span>
                        <span>Mobility Done</span>
                        <span className="rest-habit-status">
                          {day.restHabits?.mobilityDone ? '✓' : '○'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`rest-habit-btn ${
                          day.restHabits?.hydrationDone ? 'rest-habit-btn-active' : ''
                        } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => handleToggleRestHabit(day.dayNumber, 'hydrationDone')}
                        disabled={isReadOnly}
                        title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : undefined}
                        aria-label="Toggle hydration check"
                      >
                        <span className="rest-habit-icon">💧</span>
                        <span>Hydration Check</span>
                        <span className="rest-habit-status">
                          {day.restHabits?.hydrationDone ? '✓' : '○'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Multi-Tier Completion Status Row */}
                <div className="tier-status-row">
                  <div className="tier-pill">
                    <span className="tier-dot">
                      {day.isWorkoutDone ? '✓' : '○'}
                    </span>
                    <span>
                      {isRest
                        ? 'Rest Day'
                        : day.isWorkoutDone
                        ? 'Session Logged'
                        : 'Session Pending'}
                    </span>
                  </div>

                  <div className="tier-pill">
                    <span className="tier-dot">
                      {day.isStepGoalMet ? '✓' : '○'}
                    </span>
                    <span>
                      {day.daySteps.toLocaleString()} / 10k steps
                    </span>
                  </div>
                </div>

                {/* Day Complete Milestone Banner */}
                {day.isFullyComplete && (
                  <div className="milestone-banner">
                    ★ DAY COMPLETE — Workout & Step Goals Met
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="day-card-actions">
                {isWorkout && (
                  <button
                    type="button"
                    className={`day-action-btn btn-open-workout ${
                      isReadOnly && day.dayNumber !== activePlanDayNumber
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    onClick={() => handleCardClick(day, day.dateMeta)}
                    disabled={isReadOnly && day.dayNumber !== activePlanDayNumber}
                    title={
                      isReadOnly && day.dayNumber !== activePlanDayNumber
                        ? ACTIVE_WORKOUT_GUARD_MESSAGE
                        : isReadOnly && day.dayNumber === activePlanDayNumber
                        ? 'Resume active workout session'
                        : undefined
                    }
                  >
                    {isReadOnly && day.dayNumber === activePlanDayNumber
                      ? 'Resume Workout →'
                      : day.isWorkoutDone
                      ? 'View Session'
                      : 'Start Workout →'}
                  </button>
                )}

                {isRun && (
                  <>
                    <button
                      type="button"
                      className="day-action-btn btn-open-run"
                      onClick={() => handleCardClick(day, day.dateMeta)}
                    >
                      Run Details
                    </button>
                    {!day.isWorkoutDone && (
                      <button
                        type="button"
                        className={`day-action-btn btn-card-log-run ${
                          isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRunLogger(day);
                        }}
                        disabled={isReadOnly}
                        title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Manually log run for this day'}
                      >
                        🏃 + Log Run
                      </button>
                    )}
                  </>
                )}

                {isRest && (
                  <button
                    type="button"
                    className="day-action-btn btn-open-rest"
                    onClick={() => handleCardClick(day, day.dateMeta)}
                  >
                    Recovery Guide
                  </button>
                )}

                <button
                  type="button"
                  className={`day-action-btn btn-check-toggle ${
                    day.isWorkoutDone ? 'btn-check-toggle-done' : ''
                  } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => handleToggleDayComplete(day.dayNumber)}
                  disabled={isReadOnly}
                  title={isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Toggle day completion status'}
                  aria-label={`Toggle Day ${day.dayNumber} status`}
                >
                  {day.isWorkoutDone ? '✓ Completed' : 'Mark Done'}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* Activity Details Modal (for Run & Rest Days) */}
      {activeModalItem && activeModalItem.day.activityType === 'run' ? (
        <RunDetailsModal
          isOpen={Boolean(activeModalItem)}
          session={{
            workoutName: activeModalItem.day.title,
            date: activeModalItem.date?.dateString || '',
            durationSec: 1458,
            distanceMiles: 3.11,
            avgPace: '7:48 /mi',
            avgHeartRate: 142,
            terrain: activeModalItem.day.title.includes('Hill') ? 'Hills' : 'Road',
            splits: 'M1: 8:02 | M2: 7:51 | M3: 7:38 | Rem (0.11m): 7:15/mi',
            shoeName: 'Nike Pegasus 40',
            notes: activeModalItem.day.description,
          }}
          onClose={() => setActiveModalItem(null)}
        />
      ) : activeModalItem ? (
        <div
          className="modal-backdrop"
          onClick={() => setActiveModalItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <span
                className={`activity-badge ${
                  activeModalItem.day.activityType === 'run'
                    ? 'badge-run'
                    : 'badge-rest'
                }`}
              >
                {activeModalItem.day.badgeLabel || activeModalItem.day.title}
              </span>
              <button
                type="button"
                className="icon-btn-danger"
                onClick={() => setActiveModalItem(null)}
              >
                ✕
              </button>
            </div>

            <h3 className="modal-title">{activeModalItem.day.title}</h3>
            <p className="modal-message">{activeModalItem.day.description}</p>

            <div className="modal-details-box">
              <p>
                <strong>Date:</strong> {activeModalItem.date?.formattedDate}
              </p>
              <p>
                <strong>Daily Steps:</strong>{' '}
                {currentDaySteps.toLocaleString()} / 10,000
              </p>
              <p>
                <strong>Milestone Status:</strong>{' '}
                {activeModalItem.day.isFullyComplete
                  ? 'Day Complete ★'
                  : 'In Progress'}
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-primary"
                onClick={() => {
                  handleToggleDayComplete(activeModalItem.day.dayNumber);
                  setActiveModalItem(null);
                }}
              >
                {activeModalItem.day.status === 'Completed'
                  ? 'Mark as Incomplete'
                  : 'Mark as Completed'}
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                onClick={() => setActiveModalItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Manual Run Logger Modal */}
      <ManualRunLogger
        isOpen={isRunLoggerOpen}
        onClose={handleCloseRunLogger}
        onSuccess={handleRunLoggedSuccess}
        initialDayItem={runLoggerDayItem}
      />

      {/* Completed Workout Session Inspection & Edit Review Modal */}
      {selectedWorkoutForReview && (
        <SessionReviewModal
          isOpen={Boolean(selectedWorkoutForReview)}
          session={selectedWorkoutForReview}
          onClose={handleCloseWorkoutReview}
          onSave={handleSaveWorkoutReview}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Floating Success Toast */}
      {runLogToastMsg && (
        <div className="run-log-toast" role="status">
          {runLogToastMsg}
        </div>
      )}
    </div>
  );
}
