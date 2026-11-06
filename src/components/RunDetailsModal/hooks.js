import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  parseSplits,
  getAverageSplitPace,
  TERRAIN_TYPES,
  getTerrainIcon,
  getStoredShoes,
  getActiveShoe,
  getShoeHealth,
  RETIREMENT_THRESHOLD_MILES,
} from '../../services/runningService';
import { STORAGE_KEY_HISTORY_LOG } from '../../services/api';

/**
 * Custom hook managing Run Details view: splits visualizer, route/terrain tagging, and shoe assignment.
 */
export const useComponentLogic = ({
  isOpen,
  onClose,
  session,
  onUpdateSession,
}) => {
  const [selectedTerrain, setSelectedTerrain] = useState(() => {
    return session?.terrain || 'Road';
  });

  const [isShoeModalOpen, setIsShoeModalOpen] = useState(false);
  const [currentShoe, setCurrentShoe] = useState(() => {
    if (session?.shoeName) {
      const shoes = getStoredShoes();
      return shoes.find((s) => s.name === session.shoeName) || {
        id: 'shoe_custom',
        name: session.shoeName,
        currentMiles: 145,
        maxMiles: RETIREMENT_THRESHOLD_MILES,
      };
    }
    return getActiveShoe();
  });

  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    if (session) {
      setSelectedTerrain(session.terrain || 'Road');
      if (session.shoeName) {
        const shoes = getStoredShoes();
        const match = shoes.find((s) => s.name === session.shoeName);
        setCurrentShoe(
          match || {
            id: 'shoe_custom',
            name: session.shoeName,
            currentMiles: 145,
            maxMiles: RETIREMENT_THRESHOLD_MILES,
          }
        );
      } else {
        setCurrentShoe(getActiveShoe());
      }
    }
  }

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Parse splits from session splits string
  const rawSplitsString = session?.splits;
  const parsedSplits = useMemo(() => {
    return parseSplits(rawSplitsString);
  }, [rawSplitsString]);

  const handleSelectTerrain = useCallback(
    (terrain) => {
      setSelectedTerrain(terrain);
      if (session) {
        const updatedSession = { ...session, terrain };
        if (onUpdateSession) {
          onUpdateSession(updatedSession);
        }
        // Persist update into local history log if present
        try {
          const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) {
              const updatedList = list.map((s) =>
                s.sessionId === session.sessionId ? { ...s, terrain } : s
              );
              localStorage.setItem(STORAGE_KEY_HISTORY_LOG, JSON.stringify(updatedList));
            }
          }
        } catch {
          // ignore cache write error
        }
      }
    },
    [session, onUpdateSession]
  );

  const handleShoeSelected = useCallback(
    (newShoe) => {
      setCurrentShoe(newShoe);
      if (session) {
        const updatedSession = { ...session, shoeName: newShoe.name, shoeId: newShoe.id };
        if (onUpdateSession) {
          onUpdateSession(updatedSession);
        }
        try {
          const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) {
              const updatedList = list.map((s) =>
                s.sessionId === session.sessionId
                  ? { ...s, shoeName: newShoe.name, shoeId: newShoe.id }
                  : s
              );
              localStorage.setItem(STORAGE_KEY_HISTORY_LOG, JSON.stringify(updatedList));
            }
          }
        } catch {
          // ignore cache write error
        }
      }
      setIsShoeModalOpen(false);
    },
    [session, onUpdateSession]
  );

  const handleOpenShoeModal = useCallback(() => {
    setIsShoeModalOpen(true);
  }, []);

  const handleCloseShoeModal = useCallback(() => {
    setIsShoeModalOpen(false);
  }, []);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  const shoeHealth = useMemo(() => {
    if (!currentShoe) return null;
    return getShoeHealth(currentShoe.currentMiles, currentShoe.maxMiles);
  }, [currentShoe]);

  const averageSplitPace = useMemo(() => {
    return getAverageSplitPace(parsedSplits);
  }, [parsedSplits]);

  return {
    parsedSplits,
    averageSplitPace,
    selectedTerrain,
    terrainOptions: TERRAIN_TYPES,
    getTerrainIcon,
    currentShoe,
    shoeHealth,
    isShoeModalOpen,
    handleSelectTerrain,
    handleShoeSelected,
    handleOpenShoeModal,
    handleCloseShoeModal,
    handleBackdropClick,
  };
}
