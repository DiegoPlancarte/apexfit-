import { useComponentLogic } from './hooks';
import { getTerrainIcon } from '../../services/runningService';

/**
 * ShoeTrackerModal Component
 * Manages running shoe odometer, tracking cumulative miles against the 350-mile retirement threshold.
 */
export default function ShoeTrackerModal(props) {
  const { isOpen, onClose } = props;
  const {
    shoes,
    activeShoe,
    isLoading,
    isAddingNew,
    newShoeForm,
    terrainOptions,
    retirementThreshold,
    getShoeHealth,
    handleSelectActive,
    handleToggleAddForm,
    handleFormChange,
    handleAddShoeSubmit,
    handleDeleteShoe,
    handleBackdropClick,
  } = useComponentLogic(props);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop shoe-tracker-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shoe-tracker-title"
    >
      <div className="modal-dialog shoe-tracker-dialog">
        {/* Header */}
        <div className="shoe-tracker-header">
          <div>
            <h2 id="shoe-tracker-title" className="shoe-tracker-title">
              👟 Shoe Mileage Tracker
            </h2>
            <span className="shoe-tracker-subtitle">
              Longevity tracking against a {retirementThreshold}-mile retirement threshold
            </span>
          </div>
          <button
            type="button"
            className="plate-calc-close-btn"
            onClick={onClose}
            aria-label="Close shoe tracker"
          >
            ✕
          </button>
        </div>

        <div className="shoe-tracker-body">
          {/* Active Shoe Hero Card */}
          {activeShoe && (
            <div className="active-shoe-hero">
              <div className="active-shoe-header">
                <div>
                  <span className="active-shoe-badge">Active Pair</span>
                  <h3 className="active-shoe-name">{activeShoe.name}</h3>
                  {activeShoe.brand && (
                    <span className="active-shoe-brand">
                      {activeShoe.brand} · {getTerrainIcon(activeShoe.terrain)} {activeShoe.terrain}
                    </span>
                  )}
                </div>
                {(() => {
                  const health = getShoeHealth(activeShoe.currentMiles, activeShoe.maxMiles);
                  return (
                    <span className={`shoe-health-pill ${health.colorClass}`}>
                      {health.status === 'retired' ? '⚠️ Retire' : `${health.percentage}% Used`}
                    </span>
                  );
                })()}
              </div>

              {/* Progress Bar & Mileage Numbers */}
              {(() => {
                const health = getShoeHealth(activeShoe.currentMiles, activeShoe.maxMiles);
                return (
                  <div className="shoe-progress-section">
                    <div className="shoe-progress-meta">
                      <span className="shoe-miles-current">
                        <strong>{activeShoe.currentMiles}</strong> mi
                      </span>
                      <span className="shoe-miles-limit">
                        of {activeShoe.maxMiles || retirementThreshold} mi threshold
                      </span>
                    </div>
                    <div className="shoe-progress-bar-track">
                      <div
                        className={`shoe-progress-bar-fill ${health.colorClass}`}
                        style={{ width: `${health.percentage}%` }}
                      />
                    </div>
                    <span className="shoe-health-desc">{health.statusLabel}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Shoe Fleet List Header */}
          <div className="shoe-fleet-header-row">
            <span className="shoe-fleet-title">Your Shoe Rotation ({shoes.length})</span>
            <button
              type="button"
              className="btn-add-shoe-toggle"
              onClick={handleToggleAddForm}
            >
              {isAddingNew ? 'Cancel' : '+ Add Shoes'}
            </button>
          </div>

          {/* Add New Shoe Collapsible Form */}
          {isAddingNew && (
            <form onSubmit={handleAddShoeSubmit} className="add-shoe-form">
              <div className="form-row">
                <input
                  type="text"
                  className="gym-input form-input"
                  placeholder="Shoe Name (e.g. Asics Novablast 4)..."
                  value={newShoeForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-row form-row-multi">
                <input
                  type="text"
                  className="gym-input form-input"
                  placeholder="Brand (e.g. Asics)"
                  value={newShoeForm.brand}
                  onChange={(e) => handleFormChange('brand', e.target.value)}
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className={`gym-input form-input ${
                    newShoeForm.startingMiles !== '' && Number(newShoeForm.startingMiles) < 0
                      ? 'input-invalid'
                      : ''
                  }`}
                  placeholder="Starting Miles (0)"
                  value={newShoeForm.startingMiles}
                  onChange={(e) => {
                    if (e.target.value.includes('-')) return;
                    handleFormChange('startingMiles', e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                />
                <select
                  className="gym-select form-input"
                  value={newShoeForm.terrain}
                  onChange={(e) => handleFormChange('terrain', e.target.value)}
                >
                  {terrainOptions.map((t) => (
                    <option key={t} value={t}>
                      {getTerrainIcon(t)} {t}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary btn-save-shoe">
                Save to Rotation
              </button>
            </form>
          )}

          {/* Shoe Fleet List */}
          <div className="shoe-fleet-list">
            {isLoading ? (
              <div className="shoe-skeleton-list" aria-busy="true">
                <div className="history-skeleton-card" />
                <div className="history-skeleton-card" />
              </div>
            ) : (
              shoes.map((shoe) => {
              const health = getShoeHealth(shoe.currentMiles, shoe.maxMiles);
              const isActive = Boolean(shoe.isActive);

              return (
                <div
                  key={shoe.id}
                  className={`shoe-card-item ${isActive ? 'shoe-card-active' : ''}`}
                >
                  <div className="shoe-card-info">
                    <div className="shoe-card-name-row">
                      <span className="shoe-name">{shoe.name}</span>
                      {isActive && <span className="active-tag">Active</span>}
                    </div>
                    <span className="shoe-sub-meta">
                      {getTerrainIcon(shoe.terrain)} {shoe.terrain} · {shoe.currentMiles} / {shoe.maxMiles || retirementThreshold} mi ({health.percentage}%)
                    </span>
                    <div className="shoe-mini-progress">
                      <div
                        className={`shoe-mini-bar ${health.colorClass}`}
                        style={{ width: `${health.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="shoe-card-actions">
                    {!isActive ? (
                      <button
                        type="button"
                        className="btn-set-active"
                        onClick={() => handleSelectActive(shoe.id)}
                      >
                        Set Active
                      </button>
                    ) : (
                      <span className="active-indicator">✓ Selected</span>
                    )}

                    {shoes.length > 1 && !isActive && (
                      <button
                        type="button"
                        className="btn-delete-shoe"
                        onClick={() => handleDeleteShoe(shoe.id)}
                        title="Remove shoe"
                        aria-label={`Remove ${shoe.name}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shoe-tracker-footer">
          <button type="button" className="timer-btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
