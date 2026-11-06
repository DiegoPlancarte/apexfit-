import PlateCalculator from '../PlateCalculator';
import WeightPickerModal from '../WeightPickerModal';
import { useComponentLogic } from './hooks';

/**
 * ExerciseCard Component
 * Displays an individual exercise, its exercise-level rest timer setting,
 * interactive set rows, and a collapsible slide-down drawer for previous session history.
 */
export default function ExerciseCard(props) {
  const { exercise, previousHistory = [], onRemoveExercise } = props;
  const {
    editingSets,
    isHistoryOpen,
    hasHistory,
    isBarbell,
    openMenuSetId,
    swipedSetId,
    plateCalcState,
    handleOpenPlateCalc,
    handleClosePlateCalc,
    handleApplyPlateWeight,
    weightPickerState,
    handleOpenWeightPicker,
    handleCloseWeightPicker,
    handleApplyWeightPicker,
    rirOptions,
    currentRestSec,
    restOptions,
    handleToggleHistory,
    handleStartEdit,
    handleSaveEdit,
    handleDeleteSet,
    handleToggleSetMenu,
    handleTouchStart,
    handleTouchEnd,
    handleCompleteClick,
    handleExerciseRestChange,
    handleWeightChange,
    handleWeightBlur,
    handleRepsChange,
    handleRirChange,
    handleAddSetClick,
    handleRemoveExerciseClick,
  } = useComponentLogic(props);

  return (
    <article className="exercise-card">
      <header className="exercise-card-header">
        <div className="exercise-header-main">
          <h2 className="exercise-title">{exercise.exerciseName}</h2>
          <button
            type="button"
            className={`history-toggle-pill ${isHistoryOpen ? 'history-toggle-pill-active' : ''}`}
            onClick={handleToggleHistory}
            aria-expanded={isHistoryOpen}
            title="Toggle previous session history drawer"
          >
            <span className="history-toggle-dot" />
            <span className="history-toggle-text">Last session</span>
            <span className="history-toggle-chevron">{isHistoryOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        <div className="exercise-header-actions">
          <label
            className="exercise-rest-control"
            title="Rest duration for all sets of this exercise"
          >
            <span className="exercise-rest-label">Rest</span>
            <select
              className="exercise-rest-select"
              value={currentRestSec}
              onChange={(e) => handleExerciseRestChange(e.target.value)}
              aria-label={`Rest duration for ${exercise.exerciseName}`}
            >
              {restOptions.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}s
                </option>
              ))}
            </select>
          </label>

          {onRemoveExercise && (
            <button
              type="button"
              className="icon-btn-danger"
              onClick={handleRemoveExerciseClick}
              title="Remove exercise"
              aria-label={`Remove ${exercise.exerciseName}`}
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Slide-Down Drawer: Previous Session History */}
      {isHistoryOpen && (
        <div className="history-drawer">
          <div className="history-drawer-header">
            <span className="history-drawer-title">Previous Session Log</span>
            <span className="history-drawer-badge">
              {hasHistory ? `${previousHistory.length} sets logged` : 'No prior logs'}
            </span>
          </div>

          {hasHistory ? (
            <div className="history-sets-table">
              {previousHistory.map((h, i) => (
                <div key={i} className="history-set-line">
                  <span className="history-line-num">Set {h.setNumber || i + 1}</span>
                  <span className="history-line-load">{h.weightLbs} lbs</span>
                  <span className="history-line-reps">{h.reps} reps</span>
                  <span className="history-line-rir">
                    {h.rir !== null && h.rir !== undefined ? `@ ${h.rir} RIR` : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-empty-message">No previous session recorded</div>
          )}
        </div>
      )}

      <div className="sets-table-header">
        <span>SET</span>
        <span>LBS</span>
        <span>REPS</span>
        <span>RIR</span>
        <span>ACTION</span>
      </div>

      <div className="sets-list">
        {exercise.sets.map((set, index) => {
          const prevSet = previousHistory[index];
          const isCompleted = Boolean(set.completed);
          const isEditing = Boolean(editingSets[set.id]);
          const isReadOnly = isCompleted && !isEditing;
          const isSwiped = swipedSetId === set.id;

          return (
            <div key={set.id} className={`set-row-wrapper ${isSwiped ? 'is-swiped' : ''}`}>
              {/* Slide-to-Reveal Danger Action (Revealed on Swipe Left) */}
              <div className="set-row-underlay">
                <button
                  type="button"
                  className="set-row-swipe-delete-btn"
                  onClick={() => handleDeleteSet(set.id, set, index)}
                  aria-label={`Delete set ${set.setNumber}`}
                  tabIndex={isSwiped ? 0 : -1}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>

              {/* Foreground Interactive Set Row */}
              <div
                className={`set-row ${isCompleted ? 'set-row-completed' : ''} ${
                  isEditing ? 'set-row-editing' : ''
                } ${isSwiped ? 'set-row-swiped' : ''}`}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, set.id)}
              >
                <div className="set-number-cell">
                  <span className="set-badge">{set.setNumber}</span>
                </div>

                <div className="set-input-cell set-weight-cell">
                  <div className="weight-input-wrapper">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      readOnly={isReadOnly}
                      tabIndex={isReadOnly ? -1 : 0}
                      className={`gym-input ${isReadOnly ? 'gym-input-readonly' : ''} ${
                        !isBarbell && !isReadOnly ? 'gym-input-stepper-trigger' : ''
                      } ${set.weightLbs !== '' && Number(set.weightLbs) < 0 ? 'input-invalid' : ''}`}
                      placeholder={prevSet ? String(prevSet.weightLbs) : '0'}
                      value={set.weightLbs}
                      onChange={(e) => handleWeightChange(set.id, e.target.value)}
                      onBlur={(e) => handleWeightBlur(set.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                          e.preventDefault();
                        }
                      }}
                      onClick={() => {
                        if (!isReadOnly && !isBarbell) {
                          handleOpenWeightPicker(set.weightLbs, set.id);
                        }
                      }}
                      aria-label={`Set ${set.setNumber} weight in lbs`}
                    />
                    {isBarbell ? (
                      <button
                        type="button"
                        className="plate-calc-btn"
                        onClick={() => handleOpenPlateCalc(set.weightLbs, set.id)}
                        title="Calculate barbell plates"
                        aria-label={`Calculate barbell plates for set ${set.setNumber}`}
                      >
                        ⚖️
                      </button>
                    ) : !isReadOnly ? (
                      <button
                        type="button"
                        className="plate-calc-btn weight-stepper-trigger-btn"
                        onClick={() => handleOpenWeightPicker(set.weightLbs, set.id)}
                        title="Open weight stepper & presets"
                        aria-label={`Open weight stepper for set ${set.setNumber}`}
                      >
                        ⚡
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="set-input-cell">
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    readOnly={isReadOnly}
                    tabIndex={isReadOnly ? -1 : 0}
                    className={`gym-input ${isReadOnly ? 'gym-input-readonly' : ''} ${
                      set.reps !== '' && Number(set.reps) < 0 ? 'input-invalid' : ''
                    }`}
                    placeholder={prevSet ? String(prevSet.reps) : '0'}
                    value={set.reps}
                    onChange={(e) => handleRepsChange(set.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                        e.preventDefault();
                      }
                    }}
                    aria-label={`Set ${set.setNumber} reps`}
                  />
                </div>

                <div className="set-input-cell">
                  <select
                    disabled={isReadOnly}
                    tabIndex={isReadOnly ? -1 : 0}
                    className={`gym-select ${isReadOnly ? 'gym-select-readonly' : ''}`}
                    value={set.rir ?? 2}
                    onChange={(e) => handleRirChange(set.id, e.target.value)}
                    aria-label={`Set ${set.setNumber} RIR`}
                  >
                    {rirOptions.map((rirVal) => (
                      <option key={rirVal} value={rirVal}>
                        {rirVal}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="set-action-cell">
                  {!isCompleted && (
                    <div className="action-cell-btns">
                      <button
                        type="button"
                        className="log-set-btn"
                        onClick={() => handleCompleteClick(set)}
                        aria-label={`Mark set ${set.setNumber} complete`}
                        title="Complete set"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`set-menu-btn ${openMenuSetId === set.id ? 'set-menu-btn-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSetMenu(set.id);
                        }}
                        aria-label={`Options for set ${set.setNumber}`}
                        title="Set options"
                      >
                        ⋮
                      </button>
                    </div>
                  )}

                  {isCompleted && !isEditing && (
                    <div className="action-cell-btns">
                      <button
                        type="button"
                        className="icon-action-btn edit-btn"
                        onClick={() => handleStartEdit(set.id)}
                        aria-label={`Edit set ${set.setNumber}`}
                        title="Edit completed set"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="15"
                          height="15"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`set-menu-btn ${openMenuSetId === set.id ? 'set-menu-btn-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSetMenu(set.id);
                        }}
                        aria-label={`Options for set ${set.setNumber}`}
                        title="Set options"
                      >
                        ⋮
                      </button>
                    </div>
                  )}

                  {isCompleted && isEditing && (
                    <div className="editing-actions-group">
                      <button
                        type="button"
                        className="icon-action-btn save-btn"
                        onClick={() => handleSaveEdit(set.id)}
                        aria-label={`Save changes to set ${set.setNumber}`}
                        title="Save changes"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="icon-action-btn delete-btn"
                        onClick={() => handleDeleteSet(set.id, set, index)}
                        aria-label={`Delete set ${set.setNumber}`}
                        title="Delete set"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* 3-Dot Options Popover Menu */}
                  {openMenuSetId === set.id && (
                    <div className="set-popover-menu" role="menu">
                      <button
                        type="button"
                        className="set-popover-item danger"
                        onClick={() => handleDeleteSet(set.id, set, index)}
                        role="menuitem"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Delete Set</span>
                      </button>
                    </div>
                  )}
                </div>

                {isCompleted && (
                  <div className="set-meta-footer">
                    <span>Rest: {set.restAfterSec || 0}s</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="exercise-card-footer">
        <button
          type="button"
          className="add-set-btn"
          onClick={handleAddSetClick}
        >
          + Add Set
        </button>
      </footer>

      {/* Barbell Plate Calculator Modal */}
      <PlateCalculator
        isOpen={plateCalcState.isOpen}
        onClose={handleClosePlateCalc}
        initialWeight={plateCalcState.initialWeight}
        exerciseName={exercise.exerciseName}
        onApplyWeight={handleApplyPlateWeight}
      />

      {/* Dumbbell, Cable & Machine Weight Stepper / Preset Picker Modal */}
      <WeightPickerModal
        isOpen={weightPickerState.isOpen}
        onClose={handleCloseWeightPicker}
        defaultValue={weightPickerState.defaultValue}
        exerciseName={exercise.exerciseName}
        onApplyWeight={handleApplyWeightPicker}
      />
    </article>
  );
}
