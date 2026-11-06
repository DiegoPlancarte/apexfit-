import { useComponentLogic } from './hooks';

/**
 * ManualRunLogger Component
 * Standalone manual entry modal for logging outdoor/treadmill runs without smartwatch sync.
 * Automatically computes average pace, attributes mileage to active shoe odometer,
 * and syncs structured run payload to Google Apps Script backend.
 */
export default function ManualRunLogger(props) {
  const { isOpen, onClose } = props;
  const {
    title,
    setTitle,
    date,
    setDate,
    time,
    setTime,
    distance,
    setDistance,
    durationMinutes,
    setDurationMinutes,
    durationSeconds,
    setDurationSeconds,
    terrain,
    terrainOptions,
    getTerrainIcon,
    shoeId,
    setShoeId,
    shoes,
    selectedShoe,
    avgHeartRate,
    setAvgHeartRate,
    notes,
    setNotes,
    distancePresets,
    distanceNum,
    averagePaceStr,
    kmDistanceStr,
    kmPaceStr,
    isSubmitting,
    errorMsg,
    fieldErrors,
    isFormValid,
    touchedFields,
    handleBlur,
    handlePresetDistance,
    handleSelectTerrain,
    handleBackdropClick,
    handleSubmit,
  } = useComponentLogic(props);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop manual-run-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-run-modal-title"
    >
      <div className="modal-dialog manual-run-dialog">
        {/* Modal Header */}
        <div className="manual-run-header">
          <div>
            <div className="manual-run-badge-row">
              <span className="badge-run-pill">🏃 Manual Entry</span>
              <span className="badge-terrain-pill">
                {getTerrainIcon(terrain)} {terrain}
              </span>
            </div>
            <h2 id="manual-run-modal-title" className="manual-run-title">
              Log Cardio Session
            </h2>
            <span className="manual-run-subtitle">
              Record distance, duration, and shoe mileage without smartwatch sync
            </span>
          </div>

          <button
            type="button"
            className="plate-calc-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close run logger"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSubmit} className="manual-run-body">
          {/* Real-time Computed Pace Banner */}
          <div className="run-live-pace-banner rounded-2xl">
            <div className="live-pace-stat">
              <span className="live-pace-label">Distance</span>
              <span className="live-pace-val">
                {distanceNum > 0 ? `${distanceNum} mi` : '—'}
              </span>
              {kmDistanceStr && (
                <span className="live-pace-sub">{kmDistanceStr} km</span>
              )}
            </div>

            <div className="live-pace-divider" />

            <div className="live-pace-stat">
              <span className="live-pace-label">Est. Avg Pace</span>
              <span className="live-pace-val live-pace-highlight">
                {averagePaceStr}
              </span>
              {kmPaceStr && <span className="live-pace-sub">{kmPaceStr}</span>}
            </div>

            <div className="live-pace-divider" />

            <div className="live-pace-stat">
              <span className="live-pace-label">Duration</span>
              <span className="live-pace-val">
                {durationMinutes || '0'}m {durationSeconds || '00'}s
              </span>
              <span className="live-pace-sub">Total Time</span>
            </div>
          </div>

          {errorMsg && (
            <div className="manual-run-error" role="alert">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Activity Title */}
          <div className="form-group">
            <label htmlFor="run-title-input" className="form-label">
              Activity Name / Workout Title <span className="required-star">*</span>
            </label>
            <input
              id="run-title-input"
              type="text"
              className={`run-form-input ${touchedFields.title && fieldErrors.title ? 'input-invalid' : ''}`}
              placeholder="e.g. Zone 2 Recovery Run, Morning 5K"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => handleBlur('title')}
              disabled={isSubmitting}
            />
            {touchedFields.title && fieldErrors.title && (
              <span className="field-error-text">⚠️ {fieldErrors.title}</span>
            )}
          </div>

          {/* Date & Time Picker */}
          <div className="form-row-dual">
            <div className="form-group">
              <label htmlFor="run-date-input" className="form-label">
                Date <span className="required-star">*</span>
              </label>
              <input
                id="run-date-input"
                type="date"
                className={`run-form-input ${touchedFields.date && fieldErrors.date ? 'input-invalid' : ''}`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => handleBlur('date')}
                disabled={isSubmitting}
                required
              />
              {touchedFields.date && fieldErrors.date && (
                <span className="field-error-text">⚠️ {fieldErrors.date}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="run-time-input" className="form-label">
                Start Time
              </label>
              <input
                id="run-time-input"
                type="time"
                className="run-form-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Distance Input & Quick Presets */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="run-distance-input" className="form-label">
                Distance (miles) <span className="required-star">*</span>
              </label>
              <span className="form-label-sub">miles</span>
            </div>
            <input
              id="run-distance-input"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className={`run-form-input run-distance-input ${
                touchedFields.distance && fieldErrors.distance ? 'input-invalid' : ''
              }`}
              placeholder="3.11"
              value={distance}
              onChange={(e) => {
                if (e.target.value.includes('-')) return;
                setDistance(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                  e.preventDefault();
                }
              }}
              onBlur={() => handleBlur('distance')}
              disabled={isSubmitting}
              required
            />
            {touchedFields.distance && fieldErrors.distance && (
              <span className="field-error-text">⚠️ {fieldErrors.distance}</span>
            )}

            {/* Quick Distance Presets */}
            <div className="run-presets-chips">
              {distancePresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`run-preset-chip ${
                    distance === preset.value ? 'run-preset-chip-active' : ''
                  }`}
                  onClick={() => handlePresetDistance(preset.value)}
                  disabled={isSubmitting}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Inputs (Minutes & Seconds) */}
          <div className="form-group">
            <label className="form-label">
              Duration <span className="required-star">*</span>
            </label>
            <div className="duration-inputs-wrap">
              <div className="duration-input-box">
                <input
                  type="number"
                  min="0"
                  max="999"
                  inputMode="numeric"
                  className={`run-form-input duration-number-input ${
                    touchedFields.duration && fieldErrors.duration ? 'input-invalid' : ''
                  }`}
                  placeholder="25"
                  value={durationMinutes}
                  onChange={(e) => {
                    if (e.target.value.includes('-')) return;
                    setDurationMinutes(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                      e.preventDefault();
                    }
                  }}
                  onBlur={() => handleBlur('duration')}
                  disabled={isSubmitting}
                  required
                />
                <span className="duration-unit-label">Minutes</span>
              </div>

              <span className="duration-colon">:</span>

              <div className="duration-input-box">
                <input
                  type="number"
                  min="0"
                  max="59"
                  inputMode="numeric"
                  className={`run-form-input duration-number-input ${
                    touchedFields.duration && fieldErrors.duration ? 'input-invalid' : ''
                  }`}
                  placeholder="00"
                  value={durationSeconds}
                  onChange={(e) => {
                    if (e.target.value.includes('-')) return;
                    setDurationSeconds(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                      e.preventDefault();
                    }
                  }}
                  onBlur={() => handleBlur('duration')}
                  disabled={isSubmitting}
                />
                <span className="duration-unit-label">Seconds</span>
              </div>
            </div>
            {touchedFields.duration && fieldErrors.duration && (
              <span className="field-error-text">⚠️ {fieldErrors.duration}</span>
            )}
          </div>

          {/* Route & Terrain Tag Selector */}
          <div className="form-group">
            <label className="form-label">Route & Terrain Tag</label>
            <div className="terrain-chips-row">
              {terrainOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`terrain-chip-btn ${
                    terrain === t ? 'terrain-chip-active' : ''
                  }`}
                  onClick={() => handleSelectTerrain(t)}
                  disabled={isSubmitting}
                >
                  <span className="terrain-chip-icon">{getTerrainIcon(t)}</span>
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Shoe Selection Dropdown */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="run-shoe-select" className="form-label">
                Running Shoes (Odometer Attribution)
              </label>
              {selectedShoe && (
                <span className="shoe-mileage-badge">
                  {selectedShoe.currentMiles} / {selectedShoe.maxMiles || 350} mi
                </span>
              )}
            </div>

            <select
              id="run-shoe-select"
              className="run-form-select"
              value={shoeId}
              onChange={(e) => setShoeId(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">No Shoe Selected / Unassigned</option>
              {shoes.map((shoe) => (
                <option key={shoe.id} value={shoe.id}>
                  {shoe.name} ({shoe.currentMiles} / {shoe.maxMiles || 350} mi)
                  {shoe.isActive ? ' — [Active Pair]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Heart Rate & Perceived Effort */}
          <div className="form-group">
            <label htmlFor="run-hr-input" className="form-label">
              Average Heart Rate (optional)
            </label>
            <div className="input-with-addon">
              <input
                id="run-hr-input"
                type="number"
                min="0"
                max="250"
                inputMode="numeric"
                className="run-form-input"
                placeholder="e.g. 142"
                value={avgHeartRate}
                onChange={(e) => {
                  if (e.target.value.includes('-')) return;
                  setAvgHeartRate(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                    e.preventDefault();
                  }
                }}
                disabled={isSubmitting}
              />
              <span className="input-addon-text">bpm</span>
            </div>
          </div>

          {/* Notes & Effort */}
          <div className="form-group">
            <label htmlFor="run-notes-input" className="form-label">
              Session Notes & Perceived Exertion (optional)
            </label>
            <textarea
              id="run-notes-input"
              rows={2}
              className="run-form-textarea"
              placeholder="Felt easy, kept heart rate in Zone 2, good breathing rhythm..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Modal Footer / Actions */}
          <div className="manual-run-footer rounded-2xl">
            <button
              type="button"
              className="timer-btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-submit-run"
              disabled={isSubmitting || !isFormValid}
              title={
                !isFormValid
                  ? 'Please fill in valid required fields before submitting'
                  : 'Log run and persist to database'
              }
            >
              {isSubmitting ? 'Saving Session...' : '✓ Log Run Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
