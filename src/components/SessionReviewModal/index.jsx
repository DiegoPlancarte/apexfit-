import { useState, useMemo, useCallback } from 'react';
import { saveAndSyncEditedSession } from '../../services/db';
import { normalizeSessionRecord } from '../../services/api';
import { formatFriendlyLocalDate } from '../../utils/date';
import { formatDuration } from '../../utils/format';

/**
 * Inner dialog component keyed by session identifier.
 * Initializes form state directly from session props without calling setState in effects.
 */
function SessionReviewDialog({
  session,
  onClose,
  onSave,
  isReadOnly = false,
}) {
  const normalized = useMemo(() => normalizeSessionRecord(session), [session]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const initialMin =
    normalized.Total_Duration_Min != null
      ? Number(normalized.Total_Duration_Min)
      : normalized.durationSec
      ? Math.max(1, Math.round(normalized.durationSec / 60))
      : 45;

  // Editable form state initialized directly from normalized session
  const [durationMin, setDurationMin] = useState(initialMin);
  const [notes, setNotes] = useState(() => normalized.notes || normalized.Notes || '');
  const [exercises, setExercises] = useState(() => {
    return Array.isArray(normalized.exercises)
      ? normalized.exercises.map((ex) => ({
          exerciseName: ex.exerciseName || ex.name || 'Exercise',
          sets: Array.isArray(ex.sets)
            ? ex.sets.map((s, sIdx) => ({
                setNumber: Number(s.setNumber ?? s.Set_Number ?? sIdx + 1),
                weightLbs: Number(s.weightLbs ?? s.Weight_Lbs ?? s.weight ?? 0),
                reps: Number(s.reps ?? s.Reps ?? 0),
                rir:
                  s.rir !== null && s.rir !== undefined && s.rir !== ''
                    ? Number(s.rir)
                    : s.RIR !== null && s.RIR !== undefined && s.RIR !== ''
                    ? Number(s.RIR)
                    : null,
                setActiveSec: s.Active_Sec ?? s.active_sec ?? s.setActiveSec ?? s.Set_Active_Sec ?? null,
                restAfterSec: s.restAfterSec ?? s.Rest_After_Sec ?? null,
                completed: s.completed !== false,
              }))
            : [],
        }))
      : [];
  });

  // Live computed metrics based on current exercises state
  const computedMetrics = useMemo(() => {
    let totalVolume = 0;
    let totalSets = 0;
    let rirSum = 0;
    let rirCount = 0;

    exercises.forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        const w = Number(s.weightLbs || 0);
        const r = Number(s.reps || 0);
        totalVolume += w * r;
        totalSets += 1;
        if (s.rir !== null && s.rir !== undefined && s.rir !== '') {
          rirSum += Number(s.rir);
          rirCount += 1;
        }
      });
    });

    const avgRir = rirCount > 0 ? (rirSum / rirCount).toFixed(1) : null;
    return { totalVolume, totalSets, avgRir };
  }, [exercises]);

  const handleToggleEditMode = () => {
    if (isReadOnly) return;
    if (isEditing) {
      // Revert edits back to session baseline
      setDurationMin(initialMin);
      setNotes(normalized.notes || normalized.Notes || '');
      const cloned = Array.isArray(normalized.exercises)
        ? normalized.exercises.map((ex) => ({
            exerciseName: ex.exerciseName || ex.name || 'Exercise',
            sets: (ex.sets || []).map((s, sIdx) => ({
              setNumber: Number(s.setNumber ?? s.Set_Number ?? sIdx + 1),
              weightLbs: Number(s.weightLbs ?? s.Weight_Lbs ?? s.weight ?? 0),
              reps: Number(s.reps ?? s.Reps ?? 0),
              rir:
                s.rir !== null && s.rir !== undefined && s.rir !== ''
                  ? Number(s.rir)
                  : s.RIR !== null && s.RIR !== undefined && s.RIR !== ''
                  ? Number(s.RIR)
                  : null,
              setActiveSec: s.Active_Sec ?? s.active_sec ?? s.setActiveSec ?? s.Set_Active_Sec ?? null,
              restAfterSec: s.restAfterSec ?? s.Rest_After_Sec ?? null,
              completed: s.completed !== false,
            })),
          }))
        : [];
      setExercises(cloned);
      setIsEditing(false);
      setFeedbackMsg('');
    } else {
      setIsEditing(true);
      setFeedbackMsg('');
    }
  };

  const handleUpdateSetField = useCallback((exIdx, sIdx, field, val) => {
    setExercises((prev) => {
      const next = [...prev];
      const targetEx = { ...next[exIdx] };
      const nextSets = [...targetEx.sets];
      nextSets[sIdx] = {
        ...nextSets[sIdx],
        [field]: field === 'rir' && val === '' ? null : Number(val),
      };
      targetEx.sets = nextSets;
      next[exIdx] = targetEx;
      return next;
    });
  }, []);

  const handleAddSet = useCallback((exIdx) => {
    setExercises((prev) => {
      const next = [...prev];
      const targetEx = { ...next[exIdx] };
      const currentSets = targetEx.sets || [];
      const lastSet = currentSets[currentSets.length - 1];
      const newSet = {
        setNumber: currentSets.length + 1,
        weightLbs: lastSet ? lastSet.weightLbs : 135,
        reps: lastSet ? lastSet.reps : 10,
        rir: lastSet ? lastSet.rir : 2,
        setActiveSec: null,
        restAfterSec: 90,
        completed: true,
      };
      targetEx.sets = [...currentSets, newSet];
      next[exIdx] = targetEx;
      return next;
    });
  }, []);

  const handleRemoveSet = useCallback((exIdx, sIdx) => {
    setExercises((prev) => {
      const next = [...prev];
      const targetEx = { ...next[exIdx] };
      const filtered = targetEx.sets.filter((_, idx) => idx !== sIdx);
      targetEx.sets = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      next[exIdx] = targetEx;
      return next;
    });
  }, []);

  const handleSaveChanges = async () => {
    if (isSaving || !session) return;
    setIsSaving(true);
    setFeedbackMsg('');

    try {
      const updatedSessionDraft = {
        ...session,
        Total_Duration_Min: Number(durationMin) || 1,
        durationSec: Math.round((Number(durationMin) || 1) * 60),
        notes: notes.trim(),
        Notes: notes.trim(),
        exercises,
      };

      const savedResult = await saveAndSyncEditedSession(updatedSessionDraft);
      setIsSaving(false);
      setIsEditing(false);
      setFeedbackMsg('Session saved & queued for sync!');

      if (onSave) {
        onSave(savedResult);
      }
    } catch (err) {
      console.error('Failed to save edited session:', err);
      setIsSaving(false);
      setFeedbackMsg('Error saving changes. Please try again.');
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  const workoutTitle = session.workoutName || session.title || 'Workout Session';
  const displayDate = formatFriendlyLocalDate(session.date) || session.date || '';
  const displayDurationSec = session.durationSec ?? Math.round((Number(durationMin) || 0) * 60);

  return (
    <div
      className="modal-backdrop session-review-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-review-title"
    >
      <div className="modal-dialog session-review-dialog">
        {/* Header Section */}
        <div className="session-review-header">
          <div className="session-review-header-left">
            <div className="session-header-badge-row">
              <span className="badge-workout-pill">⚡ Lifting Session</span>
              {isEditing ? (
                <span className="badge-editing-pill">✏️ Edit Mode</span>
              ) : (
                <span className="badge-complete-pill">✓ Completed</span>
              )}
            </div>
            <h2 id="session-review-title" className="session-review-title">
              {workoutTitle}
            </h2>
            {displayDate && (
              <span className="session-review-date">{displayDate}</span>
            )}
          </div>

          <div className="session-review-header-actions">
            {!isReadOnly && (
              <button
                type="button"
                className={`btn-session-mode-toggle ${isEditing ? 'active' : ''}`}
                onClick={handleToggleEditMode}
                title={isEditing ? 'Cancel editing' : 'Edit completed session'}
              >
                {isEditing ? 'Cancel Edit' : '✏️ Edit Session'}
              </button>
            )}
            <button
              type="button"
              className="plate-calc-close-btn"
              onClick={onClose}
              disabled={isSaving}
              aria-label="Close session review"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback Alert if available */}
        {feedbackMsg && (
          <div
            className={`session-feedback-banner ${
              feedbackMsg.includes('Error') ? 'feedback-error' : 'feedback-success'
            }`}
          >
            {feedbackMsg}
          </div>
        )}

        {/* Scrollable Modal Content */}
        <div className="session-review-body">
          {/* Key Metrics Grid */}
          <div className="session-metrics-grid">
            <div className="session-metric-pill">
              <span className="session-metric-label">Duration</span>
              {isEditing ? (
                <div className="metric-edit-wrap">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    className="metric-edit-input"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    aria-label="Session duration in minutes"
                  />
                  <span className="metric-edit-unit">min</span>
                </div>
              ) : (
                <span className="session-metric-val">
                  {formatDuration(displayDurationSec)}
                </span>
              )}
            </div>

            <div className="session-metric-pill">
              <span className="session-metric-label">Volume</span>
              <span className="session-metric-val">
                {computedMetrics.totalVolume.toLocaleString()} lbs
              </span>
            </div>

            <div className="session-metric-pill">
              <span className="session-metric-label">Total Sets</span>
              <span className="session-metric-val">{computedMetrics.totalSets}</span>
            </div>

            <div className="session-metric-pill">
              <span className="session-metric-label">Avg RIR</span>
              <span className="session-metric-val">
                {computedMetrics.avgRir !== null ? `@${computedMetrics.avgRir}` : '—'}
              </span>
            </div>
          </div>

          {/* Exercise Sets Breakdown */}
          <div className="session-review-exercises">
            {exercises.map((exercise, exIdx) => (
              <div key={exIdx} className="session-review-exercise-card">
                <div className="session-exercise-header-row">
                  <h4 className="session-exercise-name">{exercise.exerciseName}</h4>
                  {isEditing && (
                    <button
                      type="button"
                      className="btn-add-set-link"
                      onClick={() => handleAddSet(exIdx)}
                      title="Add a new set to this exercise"
                    >
                      + Add Set
                    </button>
                  )}
                </div>

                <div className="session-sets-table">
                  <div className="session-set-row session-set-header">
                    <span className="col-set">SET</span>
                    <span className="col-lbs">LBS</span>
                    <span className="col-reps">REPS</span>
                    <span className="col-rir">RIR</span>
                    {isEditing ? (
                      <span className="col-action">DEL</span>
                    ) : (
                      <span className="col-tut" title="Active Set Duration">Active Time</span>
                    )}
                  </div>

                  {exercise.sets.map((set, sIdx) => {
                    const activeSec =
                      set.Active_Sec ?? set.active_sec ?? set.setActiveSec ?? set.Set_Active_Sec ?? set.tutSec ?? null;

                    return (
                      <div key={sIdx} className="session-set-row">
                        <span className="col-set">
                          <span className="session-set-badge">{set.setNumber || sIdx + 1}</span>
                        </span>

                        <span className="col-lbs">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="2.5"
                              className="edit-set-input"
                              value={set.weightLbs}
                              onChange={(e) =>
                                handleUpdateSetField(exIdx, sIdx, 'weightLbs', e.target.value)
                              }
                              aria-label={`Weight for set ${sIdx + 1}`}
                            />
                          ) : (
                            <span className="set-val-text font-mono">{set.weightLbs}</span>
                          )}
                        </span>

                        <span className="col-reps">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="edit-set-input"
                              value={set.reps}
                              onChange={(e) =>
                                handleUpdateSetField(exIdx, sIdx, 'reps', e.target.value)
                              }
                              aria-label={`Reps for set ${sIdx + 1}`}
                            />
                          ) : (
                            <span className="set-val-text font-mono">{set.reps}</span>
                          )}
                        </span>

                        <span className="col-rir">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              className="edit-set-input edit-rir-input"
                              value={set.rir ?? ''}
                              placeholder="—"
                              onChange={(e) =>
                                handleUpdateSetField(exIdx, sIdx, 'rir', e.target.value)
                              }
                              aria-label={`RIR for set ${sIdx + 1}`}
                            />
                          ) : (
                            <span className="set-val-text font-mono">
                              {set.rir !== null && set.rir !== undefined ? `@ ${set.rir}` : '—'}
                            </span>
                          )}
                        </span>

                        {isEditing ? (
                          <span className="col-action">
                            <button
                              type="button"
                              className="btn-remove-set-icon"
                              onClick={() => handleRemoveSet(exIdx, sIdx)}
                              title="Delete this set"
                              aria-label={`Delete set ${sIdx + 1}`}
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span className="col-tut font-mono">
                            {activeSec ? `${activeSec}s` : '—'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Session Notes */}
          <div className="session-review-notes-section">
            <span className="session-notes-heading">Session Notes</span>
            {isEditing ? (
              <textarea
                className="session-notes-textarea"
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log notes about performance, energy, or equipment adjustments..."
                aria-label="Session notes"
              />
            ) : (
              <p className="session-notes-display">
                {notes || 'No notes recorded for this workout session.'}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="session-review-footer">
          {isEditing ? (
            <>
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                onClick={handleToggleEditMode}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-save"
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </>
          ) : (
            <>
              {!isReadOnly && (
                <button
                  type="button"
                  className="modal-btn modal-btn-edit-action"
                  onClick={handleToggleEditMode}
                >
                  ✏️ Edit Session
                </button>
              )}
              <button
                type="button"
                className="modal-btn modal-btn-close-action"
                onClick={onClose}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * SessionReviewModal Component
 *
 * Detailed inspection and editing modal for completed workout sessions:
 * - View mode: Displays completed exercises, sets, weights, reps, RIR, duration, and notes.
 * - Edit mode toggle: Allows inline modification of weights, reps, RIR, duration, sets, and notes.
 * - Save Changes: Updates local IndexedDB, recalculates metrics/volume, updates progressive
 *   overload reference history, and triggers an immediate outbox sync (runAllSyncs) to Google Sheets.
 */
export default function SessionReviewModal(props) {
  const { isOpen, session } = props;
  if (!isOpen || !session) return null;

  return (
    <SessionReviewDialog
      key={session.sessionId || session.Workout_ID || session.id || session.day_index || session.dayNumber || 'session_review'}
      {...props}
    />
  );
}
