import { useComponentLogic } from './hooks';
import { ACTIVE_WORKOUT_GUARD_MESSAGE } from '../../config/workoutGuard';
import RunDetailsModal from '../RunDetailsModal';
import ShoeTrackerModal from '../ShoeTrackerModal';
import SessionReviewModal from '../SessionReviewModal';
import { parseSplits, getTerrainIcon } from '../../services/runningService';

/**
 * HistoryLog Component
 * Historical records screen displaying a reverse-chronological archive of past
 * completed sessions and runs, with expandable granular set-by-set breakdowns.
 */
export default function HistoryLog(props) {
  const {
    sessions,
    allSessionsCount,
    scopedSessionsCount,
    totalWorkoutsCount,
    totalRunsCount,
    totalVolumeLifted,
    totalMiles,
    isLoading,
    activeStartDate,
    activeDateRangeLabel,
    isCurrentWeek,
    viewScope,
    setViewScope,
    handlePrevWeek,
    handleNextWeek,
    handleJumpToToday,
    handleJumpToDate,
    isSessionExpanded,
    filterType,
    setFilterType,
    selectedRunForDetails,
    selectedLiftingForReview,
    isShoeTrackerOpen,
    handleOpenRunDetails,
    handleCloseRunDetails,
    handleOpenSessionReview,
    handleCloseSessionReview,
    handleOpenShoeTracker,
    handleCloseShoeTracker,
    handleUpdateSession,
    handleToggleExpand,
    formatDuration,
    formatFriendlyDate,
  } = useComponentLogic(props);

  return (
    <div className="history-log-container">
      {/* Pinned Top Navigation / Date / Filter Block */}
      <div className="history-top-section">
        {/* 1. Date Window Navigation Header with Sync Action at Top */}
        <section className="history-pagination-card">
        <div className="history-nav-top-row">
          <div>
            <span className="history-nav-section-title">
              {viewScope === 'week' ? 'Weekly Training Block' : 'All-Time Logbook'}
            </span>
            <span className="history-nav-session-count">
              {scopedSessionsCount} {scopedSessionsCount === 1 ? 'session' : 'sessions'} in view
            </span>
          </div>
        </div>

        <div className="pagination-nav-row">
          <button
            type="button"
            className="pagination-arrow-btn"
            onClick={handlePrevWeek}
            title="Previous training week"
            aria-label="Previous week"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pagination-chevron-icon"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="pagination-center-info">
            <span className="pagination-date-label">{activeDateRangeLabel}</span>
            <span className="pagination-sublabel">
              {viewScope === 'week' ? 'Active Date Window' : `All Records (${allSessionsCount} total)`}
            </span>
          </div>

          <button
            type="button"
            className="pagination-arrow-btn"
            onClick={handleNextWeek}
            title="Next training week"
            aria-label="Next week"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pagination-chevron-icon"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="pagination-toolbar-row">
          <button
            type="button"
            className={`pagination-pill-btn ${isCurrentWeek && viewScope === 'week' ? 'active' : ''}`}
            onClick={handleJumpToToday}
            title="Jump to current week"
          >
            Today
          </button>

          <label className="pagination-picker-label" title="Jump to specific date">
            <span className="picker-icon">📅</span>
            <span className="picker-text">Pick Date</span>
            <input
              type="date"
              className="pagination-date-input"
              value={activeStartDate}
              onChange={(e) => handleJumpToDate(e.target.value)}
              aria-label="Select date"
            />
          </label>

          <button
            type="button"
            className={`pagination-pill-btn ${viewScope === 'all' ? 'active' : ''}`}
            onClick={() => setViewScope((prev) => (prev === 'week' ? 'all' : 'week'))}
            title={viewScope === 'week' ? 'Show all historical logs' : 'Switch back to weekly window'}
          >
            {viewScope === 'week' ? 'All Logs' : 'Week View'}
          </button>
        </div>
      </section>

      {/* 2. Streamlined Performance Summary Card (No redundant inner dates) */}
      <section className="history-summary-card">
        <div className="history-summary-header">
          <span className="history-summary-title">Performance Summary</span>
          <span className="history-summary-count">
            {scopedSessionsCount} {scopedSessionsCount === 1 ? 'Session Recorded' : 'Sessions Recorded'}
          </span>
        </div>

        <div className="history-stats-grid">
          <div className="stat-pill">
            <span className="stat-label">Total Volume</span>
            <span className="stat-value">
              {totalVolumeLifted.toLocaleString()} lb
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Total Miles</span>
            <span className="stat-value">
              {totalMiles.toFixed(1)} mi
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Lifting Sessions</span>
            <span className="stat-value">{totalWorkoutsCount}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Runs Logged</span>
            <span className="stat-value">{totalRunsCount}</span>
          </div>
        </div>
      </section>

      {/* Filter Chips Bar */}
      <section className="history-filters-bar">
        <button
          type="button"
          className={`filter-chip ${filterType === 'all' ? 'filter-chip-active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          All ({scopedSessionsCount})
        </button>
        <button
          type="button"
          className={`filter-chip ${filterType === 'workout' ? 'filter-chip-active' : ''}`}
          onClick={() => setFilterType('workout')}
        >
          Lifting ({totalWorkoutsCount})
        </button>
        <button
          type="button"
          className={`filter-chip ${filterType === 'run' ? 'filter-chip-active' : ''}`}
          onClick={() => setFilterType('run')}
        >
          Runs ({totalRunsCount})
        </button>
      </section>
      </div>

      {/* Independent Scroll Container for Sessions List */}
      <div className="history-cards-scrollport">
        {/* Reverse-Chronological Sessions List */}
        <section className="history-sessions-list">
        {isLoading ? (
          <div className="history-skeleton-list" aria-busy="true" aria-label="Loading historical workouts">
            <div className="history-skeleton-card" />
            <div className="history-skeleton-card" />
            <div className="history-skeleton-card" />
          </div>
        ) : (
          <>
            {sessions.map((session) => {
          const isRun = session.type === 'run';
          const isExpanded = Boolean(isSessionExpanded(session.sessionId));

          return (
            <article
              key={session.sessionId}
              className={`history-card ${isExpanded ? 'history-card-expanded' : ''}`}
            >
              {/* Summary Card Header (Click to Expand / Collapse) */}
              <div
                className="history-card-clickable"
                onClick={() => handleToggleExpand(session.sessionId)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleToggleExpand(session.sessionId);
                }}
              >
                <div className="history-card-topline">
                  <span className="history-card-date">
                    {formatFriendlyDate(session.date)}
                  </span>

                  <div className="history-badges-cluster">
                    <span
                      className={`activity-badge ${
                        isRun ? 'badge-run' : 'badge-workout'
                      }`}
                    >
                      {isRun ? 'Distance Run' : 'Lifting Session'}
                    </span>
                    {isRun && session.terrain && (
                      <span className="badge-terrain-pill">
                        {getTerrainIcon(session.terrain)} {session.terrain}
                      </span>
                    )}
                  </div>
                </div>

                <div className="history-card-title-row">
                  <h3 className="history-card-title">{session.workoutName}</h3>
                  <span className="history-card-chevron">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Performance Highlight Sub-Label */}
                {session.highlight && (
                  <div className="history-highlight-badge">
                    <span>{isRun ? '🏃' : '⚡'}</span>
                    <span>{session.highlight}</span>
                  </div>
                )}

                {/* Quick Stats Grid */}
                <div className="history-card-metrics-row">
                  <div className="history-metric">
                    <span className="history-metric-label">Duration</span>
                    <span className="history-metric-val">
                      {formatDuration(session.durationSec)}
                    </span>
                  </div>

                  {!isRun && (
                    <div className="history-metric">
                      <span className="history-metric-label">Volume</span>
                      <span className="history-metric-val">
                        {(Number(session.totalVolumeLbs) || 0).toLocaleString()} lbs
                      </span>
                    </div>
                  )}

                  {!isRun && session.avgRir !== undefined && (
                    <div className="history-metric">
                      <span className="history-metric-label">Avg RIR</span>
                      <span className="history-metric-val">
                        @{session.avgRir}
                      </span>
                    </div>
                  )}

                  {isRun && (session.distanceMiles || session.distanceKm) && (
                    <div className="history-metric">
                      <span className="history-metric-label">Distance</span>
                      <span className="history-metric-val">
                        {session.distanceMiles
                          ? `${session.distanceMiles} mi`
                          : `${(Number(session.distanceKm) * 0.621371).toFixed(2)} mi`}
                      </span>
                    </div>
                  )}

                  {isRun && session.avgPace && (
                    <div className="history-metric">
                      <span className="history-metric-label">Avg Pace</span>
                      <span className="history-metric-val">
                        {session.avgPace}
                      </span>
                    </div>
                  )}

                  {isRun && session.avgHeartRate && (
                    <div className="history-metric">
                      <span className="history-metric-label">Avg HR</span>
                      <span className="history-metric-val">
                        {session.avgHeartRate} bpm
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expandable Granular Breakdown */}
              {isExpanded && (
                <div className="history-card-breakdown">
                  {/* Session Notes if available */}
                  {session.notes && (
                    <div className="history-notes-box">
                      <span className="history-notes-label">Notes:</span>
                      <p className="history-notes-text">{session.notes}</p>
                    </div>
                  )}

                  {/* Lifting Set-by-Set Tables */}
                  {!isRun && Array.isArray(session.exercises) && (
                    <div className="history-exercises-breakdown">
                      <div className="history-lifting-actions-bar">
                        <span className="history-lifting-section-title">Exercise Breakdown</span>
                        <button
                          type="button"
                          className="btn-open-session-review-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSessionReview(session);
                          }}
                        >
                          View / Edit Session ›
                        </button>
                      </div>
                      {session.exercises.map((exercise, exIdx) => (
                        <div key={exIdx} className="history-exercise-group">
                          <h4 className="history-exercise-name">
                            {exercise.exerciseName}
                          </h4>

                          <div className="history-sets-table">
                            <div className="history-set-row history-set-header">
                              <span className="col-cell col-set">SET</span>
                              <span className="col-cell col-lbs">LBS</span>
                              <span className="col-cell col-reps">REPS</span>
                              <span className="col-cell col-rir">RIR</span>
                              <span className="col-cell col-tut" title="Active Set Duration">Active Time</span>
                            </div>

                            {exercise.sets.map((set, sIdx) => {
                              const activeDurationSec =
                                set.Active_Sec ?? set.active_sec ?? set.setActiveSec ?? set.Set_Active_Sec ?? set.tutSec ?? set.tut ?? null;
                              return (
                                <div key={sIdx} className="history-set-row">
                                  <span className="col-cell col-set">
                                    <span className="history-set-badge">
                                      {set.setNumber || sIdx + 1}
                                    </span>
                                  </span>
                                  <span className="col-cell col-lbs history-set-load">
                                    {set.weightLbs}
                                  </span>
                                  <span className="col-cell col-reps history-set-reps">
                                    {set.reps}
                                  </span>
                                  <span className="col-cell col-rir history-set-rir">
                                    {set.rir !== null && set.rir !== undefined
                                      ? `@ ${set.rir}`
                                      : '—'}
                                  </span>
                                  <span className="col-cell col-tut history-set-tut">
                                    {activeDurationSec ? `${activeDurationSec}s` : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Running Granular Breakdown: Splits Visualizer, Terrain Tag & Shoe Mileage */}
                  {isRun && (
                    <div className="history-run-expanded-block">
                      {/* Visual Splits Visualizer */}
                      {session.splits ? (
                        <div className="history-splits-wrap">
                          <div className="history-splits-header-row">
                            <span className="history-splits-title">Mile Splits</span>
                            <button
                              type="button"
                              className="btn-open-run-details-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRunDetails(session);
                              }}
                            >
                              Run Details ›
                            </button>
                          </div>

                          <div className="splits-cards-container">
                            {parseSplits(session.splits).map((split) => (
                              <div
                                key={split.id}
                                className={`split-card-row ${split.isFastest ? 'split-card-fastest' : ''}`}
                              >
                                <div className="split-card-left">
                                  <span className="split-mile-pill">{split.label}</span>
                                  {split.isFastest && (
                                    <span className="split-fastest-tag" title="Fastest Split">
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
                        </div>
                      ) : (
                        <div className="history-splits-fallback">
                          <button
                            type="button"
                            className="btn-open-run-details-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRunDetails(session);
                            }}
                          >
                            View Run Details & Route ›
                          </button>
                        </div>
                      )}

                      {/* Equipment & Shoe Mileage Row */}
                      <div className="history-run-footer-meta">
                        <div className="history-run-tags-cluster">
                          {session.terrain && (
                            <span className="badge-terrain-pill">
                              {getTerrainIcon(session.terrain)} {session.terrain}
                            </span>
                          )}
                          {session.shoeName && (
                            <span className="history-shoe-pill">
                              👟 {session.shoeName}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`btn-shoe-tracker-pill ${
                            props.isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (props.isReadOnly) {
                              if (props.onBlockedAction) props.onBlockedAction();
                              return;
                            }
                            handleOpenShoeTracker();
                          }}
                          disabled={props.isReadOnly}
                          title={props.isReadOnly ? ACTIVE_WORKOUT_GUARD_MESSAGE : 'Manage running shoes'}
                        >
                          👟 Shoe Tracker
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

            {sessions.length === 0 && (
              <div className="history-empty-card">
                <p>
                  {viewScope === 'week'
                    ? `No workouts recorded for this week (${activeDateRangeLabel}).`
                    : 'No historical workout sessions recorded yet.'}
                </p>
                <span>
                  {viewScope === 'week'
                    ? 'Use the arrows (‹ / ›) to browse past weeks, or tap "Today" to log your current session!'
                    : 'Complete a workout to log your first entry!'}
                </span>
              </div>
            )}
          </>
        )}
      </section>
      </div>

      {/* Session Inspection & Editing Review Modal */}
      {selectedLiftingForReview && (
        <SessionReviewModal
          isOpen={Boolean(selectedLiftingForReview)}
          session={selectedLiftingForReview}
          onClose={handleCloseSessionReview}
          onSave={handleUpdateSession}
          isReadOnly={props.isReadOnly}
        />
      )}

      {/* Run Details Modal with Splits Visualizer & Terrain Selector */}
      {selectedRunForDetails && (
        <RunDetailsModal
          isOpen={Boolean(selectedRunForDetails)}
          session={selectedRunForDetails}
          onClose={handleCloseRunDetails}
          onUpdateSession={handleUpdateSession}
        />
      )}

      {/* Lightweight Shoe Mileage Tracker Modal (350-mile threshold) */}
      <ShoeTrackerModal
        isOpen={isShoeTrackerOpen}
        onClose={handleCloseShoeTracker}
      />
    </div>
  );
}
