import { useCallback } from 'react';
import { useSyncManager } from '../../services/db';

/**
 * Custom hook for the SyncStatusIndicator component.
 * Maps network status and outbox queue size into visual indicators and click handlers.
 */
export const useComponentLogic = () => {
  const { isOnline, pendingCount, isSyncing, triggerFlush } = useSyncManager();

  const handleSyncClick = useCallback(async () => {
    if (isSyncing) return;
    try {
      await triggerFlush();
    } catch (err) {
      console.warn('Manual sync flush error:', err);
    }
  }, [isSyncing, triggerFlush]);

  let statusState = 'synced';
  let statusLabel = 'Synced';
  let dotClass = 'sync-dot-synced';
  let tooltip = 'All records backed up to Google Sheets. Tap to refresh.';

  if (isSyncing) {
    statusState = 'syncing';
    statusLabel = 'Syncing...';
    dotClass = 'sync-dot-syncing';
    tooltip = 'Syncing pending mutations to Google Sheets...';
  } else if (pendingCount > 0) {
    if (isOnline) {
      statusState = 'pending';
      statusLabel = `${pendingCount} pending`;
      dotClass = 'sync-dot-pending';
      tooltip = `${pendingCount} item${pendingCount > 1 ? 's' : ''} waiting in outbox. Tap to sync now.`;
    } else {
      statusState = 'offline';
      statusLabel = `${pendingCount} pending`;
      dotClass = 'sync-dot-offline';
      tooltip = `Offline. ${pendingCount} mutation${pendingCount > 1 ? 's' : ''} will sync when online.`;
    }
  } else if (!isOnline) {
    statusState = 'offline';
    statusLabel = 'Offline';
    dotClass = 'sync-dot-offline';
    tooltip = 'Offline mode. All records saved locally to IndexedDB.';
  }

  return {
    isOnline,
    pendingCount,
    isSyncing,
    statusState,
    statusLabel,
    dotClass,
    tooltip,
    handleSyncClick,
  };
}
