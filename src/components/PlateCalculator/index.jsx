import {
  STANDARD_BAR_OPTIONS,
  QUICK_WEIGHT_PRESETS,
  useComponentLogic,
} from './hooks';

export default function PlateCalculator(props) {
  const { isOpen, onClose, exerciseName } = props;
  const {
    targetWeightInput,
    setTargetWeightInput,
    targetWeightNum,
    inputError,
    barWeight,
    isCustomBar,
    customBarInput,
    setCustomBarInput,
    calculation,
    handleAdjustWeight,
    handleInputBlur,
    handleSelectBarOption,
    handleEnableCustomBar,
    handlePresetClick,
    handleApply,
    handleBackdropClick,
  } = useComponentLogic(props);

  if (!isOpen) return null;

  const {
    weightPerSide,
    platesNeeded,
    remainderPerSide,
    totalLoadedWeight,
    isUnderBarWeight,
  } = calculation;

  return (
    <div
      className="modal-backdrop plate-calc-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plate-calc-title"
    >
      <div className="modal-dialog plate-calc-dialog">
        {/* Modal Header */}
        <div className="plate-calc-header">
          <div>
            <h2 id="plate-calc-title" className="plate-calc-title">
              🏋️ Plate Calculator
            </h2>
            {exerciseName && (
              <span className="plate-calc-exercise-sub">{exerciseName}</span>
            )}
          </div>
          <button
            type="button"
            className="plate-calc-close-btn"
            onClick={onClose}
            aria-label="Close plate calculator"
          >
            ✕
          </button>
        </div>

        <div className="plate-calc-body">
          {/* Target Weight Input & Steppers */}
          <div className="plate-calc-section">
            <label htmlFor="target-weight-input" className="plate-calc-label">
              Target Weight (lbs)
            </label>
            <div className="plate-calc-input-row">
              <button
                type="button"
                className="plate-stepper-btn"
                onClick={() => handleAdjustWeight(-10)}
                title="Subtract 10 lbs"
              >
                −10
              </button>
              <button
                type="button"
                className="plate-stepper-btn"
                onClick={() => handleAdjustWeight(-5)}
                title="Subtract 5 lbs"
              >
                −5
              </button>

              <div className="plate-weight-field-wrap">
                <input
                  id="target-weight-input"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  className={`plate-weight-input ${inputError ? 'input-invalid' : ''}`}
                  value={targetWeightInput}
                  onChange={(e) => {
                    if (e.target.value.includes('-')) return;
                    setTargetWeightInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  onBlur={handleInputBlur}
                  placeholder="135"
                  aria-invalid={Boolean(inputError)}
                  autoFocus
                />
                <span className="plate-weight-unit">lbs</span>
              </div>

              <button
                type="button"
                className="plate-stepper-btn"
                onClick={() => handleAdjustWeight(5)}
                title="Add 5 lbs"
              >
                +5
              </button>
              <button
                type="button"
                className="plate-stepper-btn"
                onClick={() => handleAdjustWeight(10)}
                title="Add 10 lbs"
              >
                +10
              </button>
            </div>

            {/* Quick Weight Presets */}
            {inputError && (
              <div className="field-error-text text-center mt-2">⚠️ {inputError}</div>
            )}
            <div className="plate-preset-chips">
              {QUICK_WEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`plate-preset-chip ${
                    targetWeightNum === preset ? 'plate-preset-active' : ''
                  }`}
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Barbell Weight Selector */}
          <div className="plate-calc-section">
            <span className="plate-calc-label">Barbell Weight</span>
            <div className="plate-bar-options">
              {STANDARD_BAR_OPTIONS.map((opt) => (
                <button
                  key={opt.weight}
                  type="button"
                  className={`plate-bar-chip ${
                    !isCustomBar && barWeight === opt.weight
                      ? 'plate-bar-chip-active'
                      : ''
                  }`}
                  onClick={() => handleSelectBarOption(opt.weight)}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                className={`plate-bar-chip ${
                  isCustomBar ? 'plate-bar-chip-active' : ''
                }`}
                onClick={handleEnableCustomBar}
              >
                Custom
              </button>
            </div>

            {isCustomBar && (
              <div className="custom-bar-input-row">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="gym-input custom-bar-input"
                  placeholder="Enter bar weight"
                  value={customBarInput}
                  onChange={(e) => setCustomBarInput(e.target.value)}
                />
                <span className="custom-bar-unit">lbs bar</span>
              </div>
            )}
          </div>

          {/* Under-bar Warning */}
          {isUnderBarWeight && (
            <div className="plate-notice-banner plate-notice-warning">
              ⚠️ Target weight ({targetWeightNum} lbs) is less than the bar weight (
              {barWeight} lbs). Empty bar minimum is {barWeight} lbs.
            </div>
          )}

          {/* Visual Barbell Sleeve Diagram */}
          <div className="plate-calc-section">
            <span className="plate-calc-label">Barbell Sleeve Loading (Per Side)</span>
            <div className="plate-barbell-visual">
              <div className="barbell-assembly">
                {/* Barbell Center Shaft entering from inside */}
                <div className="visual-bar-shaft" title="Barbell Center Shaft" />

                {/* Inner Collar (Anchor / Stop) */}
                <div className="visual-bar-collar" title="Barbell Inner Collar (Stop)" />

                {/* Loadable Sleeve with Fixed Frame & End Cap */}
                <div className="visual-bar-sleeve">
                  {/* Steel Sleeve Core Bar */}
                  <div className="visual-sleeve-bar" />

                  {/* Plates Stack: Sequentially loaded against inner collar from left to right */}
                  <div className="visual-plates-stack">
                    {platesNeeded.map((p) =>
                      Array.from({ length: p.count }, (_, i) => (
                        <div
                          key={`${p.weight}-${i}`}
                          className={`visual-plate visual-plate-${String(p.weight).replace('.', '_')}`}
                          title={`${p.weight} lb plate`}
                        >
                          <span className="visual-plate-text">{p.weight}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Empty sleeve label if no plates */}
                  {platesNeeded.length === 0 && (
                    <span className="visual-empty-sleeve">
                      {targetWeightNum === barWeight ? 'Empty Bar' : 'No Plates'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Plates Needed Per Side Summary */}
          <div className="plate-summary-card">
            <div className="plate-summary-stats-row">
              <div className="plate-summary-stat">
                <span className="plate-stat-label">Total Load</span>
                <span className="plate-stat-val">{totalLoadedWeight} lbs</span>
              </div>
              <div className="plate-summary-stat">
                <span className="plate-stat-label">Per Side</span>
                <span className="plate-stat-val">
                  {Math.max(0, weightPerSide - remainderPerSide)} lbs
                </span>
              </div>
              <div className="plate-summary-stat">
                <span className="plate-stat-label">Bar Weight</span>
                <span className="plate-stat-val">{barWeight} lbs</span>
              </div>
            </div>

            {platesNeeded.length > 0 ? (
              <div className="plate-needed-list">
                <span className="plate-needed-heading">Plates Per Side:</span>
                <div className="plate-chips-list">
                  {platesNeeded.map((p) => (
                    <span
                      key={p.weight}
                      className={`plate-badge-pill plate-badge-${String(p.weight).replace('.', '_')}`}
                    >
                      <strong>{p.count} ×</strong> {p.weight} lb
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="plate-empty-note">
                {targetWeightNum >= barWeight
                  ? `Just the ${barWeight} lb bar — no plates needed!`
                  : `Minimum bar weight is ${barWeight} lbs.`}
              </div>
            )}

            {remainderPerSide > 0 && (
              <div className="plate-notice-banner plate-notice-info">
                ℹ️ Remainder: {(remainderPerSide * 2).toFixed(1)} lbs cannot be
                matched with available plates (closest match: {totalLoadedWeight} lbs).
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="plate-calc-actions">
          <button type="button" className="timer-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {props.onApplyWeight && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleApply}
              disabled={isUnderBarWeight || Boolean(inputError)}
            >
              Apply {targetWeightNum} lbs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
