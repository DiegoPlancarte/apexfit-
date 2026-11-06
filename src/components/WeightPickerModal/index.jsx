import { useComponentLogic } from './hooks';

/**
 * WeightPickerModal Component
 * Reusable thumb-friendly stepper and quick-preset modal for dumbbells, cables, and machines.
 */
export default function WeightPickerModal(props) {
  const { isOpen, onClose, exerciseName } = props;
  const {
    weightInput,
    weightNum,
    inputError,
    activeStep,
    setActiveStep,
    equipmentType,
    presetList,
    handleAdjustWeight,
    handleSelectPreset,
    handleDirectInputChange,
    handleInputBlur,
    handleApply,
    handleBackdropClick,
  } = useComponentLogic(props);

  if (!isOpen) return null;

  const equipmentSubLabel =
    equipmentType === 'dumbbell'
      ? 'per hand'
      : equipmentType === 'cable'
      ? 'total stack'
      : equipmentType === 'machine'
      ? 'total stack'
      : 'total load';

  return (
    <div
      className="modal-backdrop weight-picker-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-picker-title"
    >
      <div className="modal-dialog weight-picker-dialog">
        {/* Modal Header */}
        <div className="weight-picker-header">
          <div>
            <h2 id="weight-picker-title" className="weight-picker-title">
              ⚖️ Set Weight
            </h2>
            {exerciseName && (
              <span className="weight-picker-exercise-sub">{exerciseName}</span>
            )}
          </div>
          <button
            type="button"
            className="plate-calc-close-btn"
            onClick={onClose}
            aria-label="Close weight picker"
          >
            ✕
          </button>
        </div>

        <div className="weight-picker-body">
          {/* Main Giant Thumb-Friendly Stepper */}
          <div className="weight-picker-main-stepper">
            <button
              type="button"
              className="giant-stepper-btn giant-stepper-minus"
              onClick={() => handleAdjustWeight(-activeStep)}
              aria-label={`Decrease weight by ${activeStep} lbs`}
            >
              −
            </button>

            <div className="giant-weight-display-wrap">
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                className={`giant-weight-input ${inputError ? 'input-invalid' : ''}`}
                value={weightInput}
                onChange={(e) => handleDirectInputChange(e.target.value)}
                onBlur={handleInputBlur}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
                placeholder="0"
                aria-label="Target weight in lbs"
                aria-invalid={Boolean(inputError)}
                autoFocus
              />
              <div className="giant-weight-sub-bar">
                <span className="giant-weight-unit">lbs</span>
                <span className="giant-weight-bullet">•</span>
                <span className="giant-weight-descriptor">{equipmentSubLabel}</span>
              </div>
              {inputError && (
                <span className="field-error-text text-center mt-1">⚠️ {inputError}</span>
              )}
            </div>

            <button
              type="button"
              className="giant-stepper-btn giant-stepper-plus"
              onClick={() => handleAdjustWeight(activeStep)}
              aria-label={`Increase weight by ${activeStep} lbs`}
            >
              +
            </button>
          </div>

          {/* Quick Step Increment Toggles & Delta Steppers */}
          <div className="weight-picker-controls-row">
            <div className="delta-stepper-group">
              <button
                type="button"
                className="delta-step-btn"
                onClick={() => handleAdjustWeight(-10)}
                title="Decrease 10 lbs"
              >
                −10
              </button>
              <button
                type="button"
                className="delta-step-btn"
                onClick={() => handleAdjustWeight(-activeStep)}
                title={`Decrease ${activeStep} lbs`}
              >
                −{activeStep}
              </button>
              <button
                type="button"
                className="delta-step-btn"
                onClick={() => handleAdjustWeight(activeStep)}
                title={`Increase ${activeStep} lbs`}
              >
                +{activeStep}
              </button>
              <button
                type="button"
                className="delta-step-btn"
                onClick={() => handleAdjustWeight(10)}
                title="Increase 10 lbs"
              >
                +10
              </button>
            </div>

            <div className="step-size-selector" title="Select stepper increment size">
              <span className="step-size-label">Step:</span>
              <button
                type="button"
                className={`step-size-chip ${activeStep === 2.5 ? 'active' : ''}`}
                onClick={() => setActiveStep(2.5)}
              >
                2.5
              </button>
              <button
                type="button"
                className={`step-size-chip ${activeStep === 5 ? 'active' : ''}`}
                onClick={() => setActiveStep(5)}
              >
                5
              </button>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="weight-picker-presets-section">
            <span className="weight-presets-title">
              Common {equipmentType === 'general' ? 'Weight' : equipmentType} Presets:
            </span>
            <div className="weight-preset-chips-grid">
              {presetList.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`weight-chip-btn ${weightNum === preset ? 'weight-chip-active' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="weight-picker-actions">
          <button type="button" className="timer-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary weight-confirm-btn"
            onClick={handleApply}
            disabled={Boolean(inputError)}
          >
            Set {weightNum} lbs
          </button>
        </div>
      </div>
    </div>
  );
}
