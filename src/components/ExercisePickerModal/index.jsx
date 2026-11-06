import { useComponentLogic } from './hooks';

/**
 * ExercisePickerModal Component
 * Searchable exercise library modal categorized by muscle group and equipment type,
 * with seamless on-the-fly custom exercise creation fallback.
 */
export default function ExercisePickerModal(props) {
  const { isOpen, onClose } = props;
  const {
    searchQuery,
    setSearchQuery,
    selectedMuscle,
    setSelectedMuscle,
    selectedEquipment,
    setSelectedEquipment,
    muscleGroups,
    equipmentTypes,
    filteredExercises,
    isExactMatch,
    handleSelect,
    handleAddCustom,
    handleClearSearch,
    handleResetFilters,
    handleBackdropClick,
  } = useComponentLogic(props);

  if (!isOpen) return null;

  const trimmedQuery = searchQuery.trim();
  const hasCustomQuery = trimmedQuery.length > 0 && !isExactMatch;

  return (
    <div
      className="modal-backdrop exercise-picker-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-picker-title"
    >
      <div className="modal-dialog exercise-picker-dialog">
        {/* Header */}
        <div className="exercise-picker-header">
          <div>
            <h2 id="exercise-picker-title" className="exercise-picker-title">
              📚 Exercise Library
            </h2>
            <span className="exercise-picker-subtitle">
              Standardized names for clean Google Sheets data
            </span>
          </div>
          <button
            type="button"
            className="plate-calc-close-btn"
            onClick={onClose}
            aria-label="Close exercise library"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="exercise-picker-search-wrap">
          <div className="exercise-search-box">
            <span className="exercise-search-icon">🔍</span>
            <input
              type="text"
              className="exercise-search-input"
              placeholder="Search exercise, muscle, or equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredExercises.length === 1) {
                    handleSelect(filteredExercises[0].name);
                  } else if (hasCustomQuery) {
                    handleAddCustom();
                  }
                }
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="exercise-search-clear"
                onClick={handleClearSearch}
                aria-label="Clear search query"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills: Muscle Groups */}
        <div className="exercise-picker-filter-section">
          <div className="filter-pill-scroll-row">
            <span className="filter-group-tag">Muscle:</span>
            {muscleGroups.map((group) => (
              <button
                key={group}
                type="button"
                className={`filter-pill-btn ${selectedMuscle === group ? 'filter-pill-active' : ''}`}
                onClick={() => setSelectedMuscle(group)}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Filter Pills: Equipment Types */}
          <div className="filter-pill-scroll-row">
            <span className="filter-group-tag">Equip:</span>
            {equipmentTypes.map((equip) => (
              <button
                key={equip}
                type="button"
                className={`filter-pill-btn ${selectedEquipment === equip ? 'filter-pill-active' : ''}`}
                onClick={() => setSelectedEquipment(equip)}
              >
                {equip}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Exercise Banner (if typed query isn't in library) */}
        {hasCustomQuery && (
          <div className="custom-exercise-banner">
            <div className="custom-exercise-info">
              <span className="custom-badge">Custom</span>
              <span className="custom-name">"{trimmedQuery}"</span>
            </div>
            <button
              type="button"
              className="btn-add-custom-pill"
              onClick={handleAddCustom}
            >
              + Add Custom
            </button>
          </div>
        )}

        {/* Exercise Results List */}
        <div className="exercise-results-list" role="list">
          {filteredExercises.length > 0 ? (
            filteredExercises.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="exercise-result-item"
                onClick={() => handleSelect(ex.name)}
                role="listitem"
              >
                <div className="exercise-result-main">
                  <span className="exercise-result-name">{ex.name}</span>
                  <div className="exercise-result-tags">
                    <span className="badge-muscle">{ex.muscleGroup}</span>
                    <span className="badge-equip">{ex.equipment}</span>
                  </div>
                </div>
                <span className="exercise-result-add-icon" aria-hidden="true">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </button>
            ))
          ) : (
            <div className="exercise-empty-results">
              <p className="empty-text">No standardized movements match your search.</p>
              {trimmedQuery ? (
                <button
                  type="button"
                  className="btn-primary empty-add-btn"
                  onClick={handleAddCustom}
                >
                  + Add "{trimmedQuery}" as Custom Exercise
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-ghost-reset"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer / Results Count */}
        <div className="exercise-picker-footer">
          <span className="results-counter">
            Showing {filteredExercises.length} movements
            {(selectedMuscle !== 'All' || selectedEquipment !== 'All') && ' (Filtered)'}
          </span>
          <button type="button" className="timer-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
