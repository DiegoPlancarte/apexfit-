import { useComponentLogic } from './hooks';
import SyncStatusIndicator from '../SyncStatusIndicator';

export default function SettingsModal({
  isOpen,
  onClose,
  gasUrlInput,
  setGasUrlInput,
  onSaveSettings,
  currentPayload,
}) {
  const {
    showPayload,
    setShowPayload,
    copiedPayload,
    saveSuccessMsg,
    isExporting,
    exportSuccessMsg,
    isImporting,
    importMsg,
    importError,
    pendingOutboxItems,
    inspectTab,
    setInspectTab,
    activeDisplayedPayload,
    fileInputRef,
    handleCopyPayload,
    handleSubmitForm,
    handleExportBackup,
    handleTriggerFileInput,
    handleFileChange,
  } = useComponentLogic({
    isOpen,
    onClose,
    currentPayload,
    onSaveGasUrl: onSaveSettings,
  });

  if (!isOpen) return null;

  const setsCount = currentPayload?.sets?.length || 0;

  return (
    <div
      className="settings-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-modal-card">
        {/* Modal Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title-wrap">
            <span className="settings-modal-icon">⚙</span>
            <h2 id="settings-modal-title" className="settings-modal-title">
              Settings & Integrations
            </h2>
          </div>
          <div className="settings-modal-header-actions">
            <SyncStatusIndicator variant="full" />
            <button
              type="button"
              className="settings-modal-close-btn"
              onClick={onClose}
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="settings-modal-body">
          {/* Section 1: Google Apps Script Web App URL */}
          <div className="settings-section">
            <h3 className="settings-section-title">Google Sheets Sync Endpoint</h3>
            <p className="settings-section-desc">
              Connect to your deployed Google Apps Script Web App (<code>doPost</code>) to sync
              completed workouts and plan statuses.
            </p>

            <form onSubmit={handleSubmitForm} className="settings-form">
              <label htmlFor="modal-gas-url-input" className="settings-label">
                Web App URL
              </label>
              <input
                id="modal-gas-url-input"
                type="url"
                className="settings-input"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={gasUrlInput}
                onChange={(e) => setGasUrlInput(e.target.value)}
                autoComplete="off"
              />
              <div className="settings-actions">
                <button type="submit" className="btn-primary">
                  Save Endpoint
                </button>
                {saveSuccessMsg && (
                  <span className="settings-saved-badge">✓ {saveSuccessMsg}</span>
                )}
              </div>
            </form>
          </div>

          {/* Section 2: Google Sheets Payload Inspector */}
          <div className="settings-section">
            <div className="settings-section-header-row">
              <div>
                <h3 className="settings-section-title">Google Sheets Payload</h3>
                <p className="settings-section-desc">
                  Inspect the structured <code>Sessions</code> &amp; <code>Sets</code> payload
                  ready for sync.
                </p>
              </div>
              <button
                type="button"
                className="settings-toggle-btn"
                onClick={() => setShowPayload((v) => !v)}
                aria-expanded={showPayload}
              >
                {showPayload ? 'Hide' : 'Inspect'} ({setsCount} {setsCount === 1 ? 'set' : 'sets'})
              </button>
            </div>

            {showPayload && (
              <div className="settings-payload-card">
                {pendingOutboxItems.length > 0 && (
                  <div className="settings-inspect-tabs">
                    <button
                      type="button"
                      className={`inspect-tab-btn ${inspectTab === 'active' ? 'active' : ''}`}
                      onClick={() => setInspectTab('active')}
                    >
                      Active Session Schema
                    </button>
                    <button
                      type="button"
                      className={`inspect-tab-btn ${inspectTab === 'outbox' ? 'active' : ''}`}
                      onClick={() => setInspectTab('outbox')}
                    >
                      Queued Outbox ({pendingOutboxItems.length})
                    </button>
                  </div>
                )}

                <div className="settings-payload-meta-summary">
                  <div className="payload-meta-pill">
                    <span className="meta-pill-label">Workout_ID</span>
                    <span className="meta-pill-val">
                      {inspectTab === 'outbox'
                        ? `${pendingOutboxItems.length} queued items`
                        : activeDisplayedPayload?.session?.Workout_ID || 'Ready'}
                    </span>
                  </div>
                  <div className="payload-meta-pill">
                    <span className="meta-pill-label">Workout_Type</span>
                    <span className="meta-pill-val">
                      {inspectTab === 'outbox'
                        ? 'Multiple Actions'
                        : activeDisplayedPayload?.session?.Workout_Type || 'Strength'}
                    </span>
                  </div>
                  <div className="payload-meta-pill">
                    <span className="meta-pill-label">Total_Duration_Min</span>
                    <span className="meta-pill-val">
                      {activeDisplayedPayload?.session?.Total_Duration_Min ?? 0}m
                    </span>
                  </div>
                  <div className="payload-meta-pill">
                    <span className="meta-pill-label">Distance_Miles</span>
                    <span className="meta-pill-val">
                      {activeDisplayedPayload?.session?.Distance_Miles ?? 0} mi
                    </span>
                  </div>
                </div>

                <div className="settings-payload-actions">
                  <span className="settings-payload-stats">
                    {inspectTab === 'outbox'
                      ? `${pendingOutboxItems.length} queued mutation${pendingOutboxItems.length === 1 ? '' : 's'}`
                      : `${setsCount} completed ${setsCount === 1 ? 'set' : 'sets'}`}
                  </span>
                  <button
                    type="button"
                    className="settings-copy-btn"
                    onClick={handleCopyPayload}
                  >
                    {copiedPayload ? '✓ Copied!' : '📋 Copy JSON'}
                  </button>
                </div>
                <pre className="payload-json">
                  {JSON.stringify(activeDisplayedPayload, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Section 3: Data Backup & Migration */}
          <div className="settings-section">
            <h3 className="settings-section-title">Data Backup &amp; Migration</h3>
            <p className="settings-section-desc">
              Export your local IndexedDB database (workouts, runs, shoe mileage, body metrics) to a timestamped JSON file, or restore from a previous backup.
            </p>

            <div className="backup-actions-row">
              <button
                type="button"
                className="btn-backup-action"
                onClick={handleExportBackup}
                disabled={isExporting}
                title="Download complete local database as JSON"
              >
                {isExporting ? '⏳ Packaging...' : '⬇ Export Local Backup'}
              </button>

              <button
                type="button"
                className="btn-backup-action btn-backup-import"
                onClick={handleTriggerFileInput}
                disabled={isImporting}
                title="Restore workouts and fleet from JSON backup"
              >
                {isImporting ? '⏳ Restoring...' : '⬆ Import Backup'}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {exportSuccessMsg && (
              <span className="settings-saved-badge">✓ {exportSuccessMsg}</span>
            )}

            {importMsg && (
              <div className="backup-status-msg backup-status-success">
                {importMsg}
              </div>
            )}

            {importError && (
              <div className="backup-status-msg backup-status-error">
                ⚠️ {importError}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <button type="button" className="timer-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
