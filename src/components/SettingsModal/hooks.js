import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  downloadBackupFile,
  importBackupData,
  getPendingSyncActions,
  normalizeOutboxPayload,
  flushSyncOutbox,
} from '../../services/db';
import { pullLatestBackendData } from '../../services/api';

/**
 * Custom hook managing the Settings Modal logic:
 * - Collapsible payload preview toggle
 * - Copying payload JSON to clipboard with temporary feedback
 * - Closing on Escape key press
 * - Exporting local IndexedDB backup as JSON download
 * - Importing backup JSON file and upserting records
 * - Inspecting normalized Google Sheets schema keys (Sessions, Sets, Outbox)
 */
export const useComponentLogic = ({ isOpen, onClose, currentPayload, onSaveGasUrl }) => {
  const [showPayload, setShowPayload] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const [pendingOutboxItems, setPendingOutboxItems] = useState([]);
  const [inspectTab, setInspectTab] = useState('active'); // 'active' | 'outbox'
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [manualSyncMsg, setManualSyncMsg] = useState('');
  const [manualSyncError, setManualSyncError] = useState('');

  const fileInputRef = useRef(null);

  // Load pending outbox actions when modal is opened
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    getPendingSyncActions()
      .then((items) => {
        if (isMounted) {
          setPendingOutboxItems(items || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to load pending outbox items in settings:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute normalized active workout payload
  const normalizedActivePayload = useMemo(() => {
    return normalizeOutboxPayload('logWorkoutSession', currentPayload);
  }, [currentPayload]);

  // Compute normalized queued outbox payloads
  const normalizedOutboxPayload = useMemo(() => {
    return pendingOutboxItems.map((item) => ({
      outboxId: item.id,
      action: item.action,
      timestamp: item.timestamp,
      payload: normalizeOutboxPayload(item.action, item.payload),
    }));
  }, [pendingOutboxItems]);

  const activeDisplayedPayload = useMemo(() => {
    if (inspectTab === 'outbox' && pendingOutboxItems.length > 0) {
      return normalizedOutboxPayload;
    }
    return normalizedActivePayload;
  }, [inspectTab, pendingOutboxItems.length, normalizedOutboxPayload, normalizedActivePayload]);

  // Copy JSON payload to clipboard
  const handleCopyPayload = useCallback(async () => {
    try {
      const jsonText = JSON.stringify(activeDisplayedPayload, null, 2);
      await navigator.clipboard.writeText(jsonText);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (err) {
      console.warn('Failed to copy payload:', err);
    }
  }, [activeDisplayedPayload]);

  // Handle save form submission with visual feedback
  const handleSubmitForm = useCallback(
    (e) => {
      e?.preventDefault();
      if (onSaveGasUrl) {
        onSaveGasUrl(e);
      }
      setSaveSuccessMsg('Endpoint saved!');
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    },
    [onSaveGasUrl]
  );

  // Export local backup file download
  const handleExportBackup = useCallback(async () => {
    setIsExporting(true);
    setExportSuccessMsg('');
    try {
      await downloadBackupFile();
      setExportSuccessMsg('Backup downloaded!');
      setTimeout(() => setExportSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to export backup:', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Trigger file picker
  const handleTriggerFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  // Import backup file
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportMsg('');
    setImportError('');
    try {
      const text = await file.text();
      const res = await importBackupData(text);
      setImportMsg(
        `✓ Restored ${res.imported.sessions} sessions, ${res.imported.shoes} shoes, ${res.imported.metrics} metrics!`
      );
      setTimeout(() => setImportMsg(''), 5000);
    } catch (err) {
      console.error('Import backup error:', err);
      setImportError(err.message || 'Invalid backup JSON file.');
      setTimeout(() => setImportError(''), 4000);
    } finally {
      setIsImporting(false);
    }
  }, []);

  // On-demand user action via manual sync button in Settings (Condition c)
  const handleManualSync = useCallback(async () => {
    setIsManualSyncing(true);
    setManualSyncMsg('');
    setManualSyncError('');
    try {
      const flushRes = await flushSyncOutbox().catch(() => ({ flushed: 0 }));
      const pullRes = await pullLatestBackendData();

      const flushedCount = flushRes?.flushed || 0;
      const sessionsCount = pullRes?.sessions?.length || 0;

      let msg = '✓ Cloud sync complete!';
      if (flushedCount > 0 || sessionsCount > 0) {
        const parts = [];
        if (flushedCount > 0) parts.push(`uploaded ${flushedCount} pending`);
        if (sessionsCount > 0) parts.push(`synced ${sessionsCount} sessions`);
        msg = `✓ Cloud sync complete (${parts.join(', ')})!`;
      }
      setManualSyncMsg(msg);

      const pending = await getPendingSyncActions().catch(() => []);
      setPendingOutboxItems(pending || []);
      setTimeout(() => setManualSyncMsg(''), 4500);
    } catch (err) {
      console.error('Manual sync error:', err);
      setManualSyncError(err?.message || 'Failed to sync with Google Sheets.');
      setTimeout(() => setManualSyncError(''), 4500);
    } finally {
      setIsManualSyncing(false);
    }
  }, []);

  return {
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
    normalizedActivePayload,
    fileInputRef,
    handleCopyPayload,
    handleSubmitForm,
    handleExportBackup,
    handleTriggerFileInput,
    handleFileChange,
    isManualSyncing,
    manualSyncMsg,
    manualSyncError,
    handleManualSync,
  };
}
