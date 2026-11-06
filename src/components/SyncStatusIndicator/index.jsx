import { useComponentLogic } from './hooks';

/**
 * SyncStatusIndicator Component
 * Supports two presentation variants:
 * - 'compact' (default): Streamlined ~32px cloud icon with status badge for crowded topbars.
 * - 'full': Expanded pill with descriptive label for modals and settings headers.
 */
export default function SyncStatusIndicator({ variant = 'compact' }) {
  const {
    statusState,
    statusLabel,
    dotClass,
    tooltip,
    pendingCount,
    isSyncing,
    handleSyncClick,
  } = useComponentLogic();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        className={`sync-status-compact-btn sync-status-${statusState}`}
        onClick={handleSyncClick}
        title={tooltip}
        aria-label={`Cloud sync status: ${statusLabel}. Tap to sync.`}
        disabled={isSyncing}
      >
        <span className="sync-compact-icon-wrap">
          {isSyncing ? (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              stroke="currentColor"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sync-icon-spin"
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sync-cloud-icon"
              aria-hidden="true"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          )}
          <span className={`sync-status-dot ${dotClass}`} />
        </span>
        {pendingCount > 0 && !isSyncing && (
          <span className="sync-compact-count" aria-hidden="true">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`sync-status-indicator sync-status-${statusState}`}
      onClick={handleSyncClick}
      title={tooltip}
      aria-label={`Cloud sync status: ${statusLabel}`}
      disabled={isSyncing}
    >
      <span className={`sync-status-dot ${dotClass}`} />
      <span className="sync-status-label">{statusLabel}</span>
    </button>
  );
}
