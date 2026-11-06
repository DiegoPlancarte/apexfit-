import { useComponentLogic } from './hooks';
import ShoeTrackerModal from '../ShoeTrackerModal';

/**
 * RunDetailsModal Component
 * Comprehensive visual inspection for running and cardio sessions:
 * - Dynamic Splits Visualizer (mile pace bars & fastest split highlights)
 * - Route / Terrain tagging (Road, Treadmill, Trail, Hills, Track)
 * - Running Shoe Mileage Tracker (miles vs 350-mile retirement threshold)
 */
export default function RunDetailsModal(props) {
  const { isOpen, onClose, session } = props;
  const {
    parsedSplits,
    averageSplitPace,
    selectedTerrain,
    terrainOptions,
    getTerrainIcon,
    currentShoe,
    shoeHealth,
    isShoeModalOpen,
    handleSelectTerrain,
    handleShoeSelected,
    handleOpenShoeModal,
    handleCloseShoeModal,
    handleBackdropClick,
  } = useComponentLogic(props);

  if (!isOpen || !session) return null;

  const title = session.workoutName || session.title || 'Running Session';
  const dateStr = session.date || (session.startedAt ? session.startedAt.split('T')[0] : '');
  const distanceMiles =
    session.distanceMiles != null
      ? session.distanceMiles
      : session.distanceKm != null
      ? (Number(session.distanceKm) * 0.621371).toFixed(2)
      : null;

  const durationMin = session.durationSec ? Math.round(session.durationSec / 60) : null;

  return (
    <div
      className="modal-backdrop run-details-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-details-title"
    >
      <div className="modal-dialog run-details-dialog">
        {/* Modal Header */}
        <div className="run-details-header">
          <div>
            <div className="run-header-badge-row">
              <span className="badge-run-pill">🏃 Run Session</span>
              {selectedTerrain && (
                <span className="badge-terrain-pill">
                  {getTerrainIcon(selectedTerrain)} {selectedTerrain}
                </span>
              )}
            </div>
            <h2 id="run-details-title" className="run-details-title">
              {title}
            </h2>
            {dateStr && <span className="run-details-date">{dateStr}</span>}
          </div>
          <button
            type="button"
            className="plate-calc-close-btn"
            onClick={onClose}
            aria-label="Close run details"
          >
            ✕
          </button>
        </div>

        <div className="run-details-body">
          {/* Top Key Metrics Pills */}
          <div className="run-metrics-grid">
            {distanceMiles && (
              <div className="run-metric-pill">
                <span className="run-metric-label">Distance</span>
                <span className="run-metric-val">{distanceMiles} mi</span>
              </div>
            )}
            {durationMin && (
              <div className="run-metric-pill">
                <span className="run-metric-label">Duration</span>
                <span className="run-metric-val">{durationMin} min</span>
              </div>
            )}
            {session.avgPace && (
              <div className="run-metric-pill">
                <span className="run-metric-label">Avg Pace</span>
                <span className="run-metric-val">{session.avgPace}</span>
              </div>
            )}
            {session.avgHeartRate && (
              <div className="run-metric-pill">
                <span className="run-metric-label">Avg Heart Rate</span>
                <span className="run-metric-val">{session.avgHeartRate} bpm</span>
              </div>
            )}
          </div>

          {/* Route / Terrain Selector Section */}
          <div className="run-section">
            <span className="run-section-title">Route & Terrain Tag</span>
            <div className="terrain-chips-row">
              {terrainOptions.map((terrain) => (
                <button
                  key={terrain}
                  type="button"
                  className={`terrain-chip-btn ${selectedTerrain === terrain ? 'terrain-chip-active' : ''}`}
                  onClick={() => handleSelectTerrain(terrain)}
                >
                  <span className="terrain-chip-icon">{getTerrainIcon(terrain)}</span>
                  <span>{terrain}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Shoe Mileage Tracker Card */}
          <div className="run-section">
            <div className="run-section-header-row">
              <span className="run-section-title">Running Shoes (350 mi threshold)</span>
              <button
                type="button"
                className="btn-text-action"
                onClick={handleOpenShoeModal}
              >
                Change Pair
              </button>
            </div>

            {currentShoe ? (
              <div className="run-shoe-card" onClick={handleOpenShoeModal}>
                <div className="run-shoe-info">
                  <span className="run-shoe-icon">👟</span>
                  <div>
                    <span className="run-shoe-name">{currentShoe.name}</span>
                    <span className="run-shoe-meta">
                      {currentShoe.currentMiles} / {currentShoe.maxMiles || 350} mi ({shoeHealth?.percentage}%)
                    </span>
                  </div>
                </div>

                <div className="run-shoe-status-wrap">
                  {shoeHealth && (
                    <span className={`shoe-health-pill ${shoeHealth.colorClass}`}>
                      {shoeHealth.statusLabel}
                    </span>
                  )}
                  <span className="run-shoe-arrow">›</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-select-shoe-empty"
                onClick={handleOpenShoeModal}
              >
                + Assign Running Shoes
              </button>
            )}
          </div>

          {/* Clean Splits Breakdown (No Progress Bars) */}
          <div className="run-section">
            <div className="run-section-header-row">
              <span className="run-section-title">
                Splits Breakdown {parsedSplits.length > 0 && `(${parsedSplits.length})`}
              </span>
              {averageSplitPace && (
                <span className="splits-avg-badge">Avg {averageSplitPace}</span>
              )}
            </div>

            {parsedSplits.length > 0 ? (
              <div className="splits-cards-container">
                {parsedSplits.map((split) => (
                  <div
                    key={split.id}
                    className={`split-card-row ${split.isFastest ? 'split-card-fastest' : ''}`}
                  >
                    <div className="split-card-left">
                      <span className="split-mile-pill">{split.label}</span>
                      {split.isFastest && (
                        <span className="split-fastest-tag" title="Fastest Mile Split">
                          ⚡ Fastest
                        </span>
                      )}
                    </div>

                    <div className="split-card-right">
                      {split.deltaFormatted && (
                        <span
                          className={`split-delta-badge split-delta-${split.deltaType}`}
                          title={`${Math.abs(split.deltaSeconds)}s ${split.deltaType === 'faster' ? 'faster' : 'slower'} than average`}
                        >
                          {split.deltaFormatted}
                        </span>
                      )}
                      <span className="split-pace-value">{split.pace}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="splits-empty-card">
                <span>No split breakdown recorded for this session.</span>
              </div>
            )}
          </div>

          {/* Session Notes if any */}
          {session.notes && (
            <div className="run-section">
              <span className="run-section-title">Session Notes</span>
              <p className="run-notes-content">{session.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="run-details-footer">
          <button type="button" className="timer-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Nested Shoe Tracker Modal */}
      <ShoeTrackerModal
        isOpen={isShoeModalOpen}
        onClose={handleCloseShoeModal}
        onSelectShoe={handleShoeSelected}
      />
    </div>
  );
}
