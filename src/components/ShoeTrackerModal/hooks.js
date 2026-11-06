import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getShoeHealth,
  RETIREMENT_THRESHOLD_MILES,
  TERRAIN_TYPES,
} from '../../services/runningService';
import {
  getShoeRotation,
  saveShoe as dbSaveShoe,
  saveAllShoes as dbSaveAllShoes,
  queueSyncAction,
  flushSyncOutbox,
  ensureDatabaseSeeded,
} from '../../services/db';
import { getLocalDateString } from '../../utils/date';

/**
 * Custom hook managing the Shoe Mileage Tracker modal state and shoe fleet,
 * backed by IndexedDB and the offline sync outbox.
 */
export const useComponentLogic = ({ isOpen, onClose, onSelectShoe }) => {
  const [shoes, setShoes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newShoeForm, setNewShoeForm] = useState({
    name: '',
    brand: '',
    startingMiles: '',
    terrain: 'Road',
  });

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsLoading(true);
      setIsAddingNew(false);
    }
  }

  // Hydrate on open from IndexedDB
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    ensureDatabaseSeeded()
      .then(() => getShoeRotation())
      .then((loaded) => {
        if (isMounted) {
          setShoes(loaded);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Shoe hydration error:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeShoe = useMemo(() => {
    return shoes.find((s) => s.isActive) || shoes[0] || null;
  }, [shoes]);

  const handleSelectActive = useCallback(
    async (shoeId) => {
      const updated = shoes.map((shoe) => ({
        ...shoe,
        isActive: shoe.id === shoeId,
      }));

      // 1. Write to IndexedDB first
      await dbSaveAllShoes(updated);

      // 2. Queue in outbox
      await queueSyncAction('updateShoeFleet', { activeShoeId: shoeId, actionType: 'setActive' });

      // 3. Flush if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      setShoes(updated);
      const selected = updated.find((s) => s.id === shoeId);
      if (onSelectShoe && selected) {
        onSelectShoe(selected);
      }
    },
    [shoes, onSelectShoe]
  );

  const handleToggleAddForm = useCallback(() => {
    setIsAddingNew((prev) => !prev);
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setNewShoeForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddShoeSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newShoeForm.name.trim()) return;

      const newShoe = {
        id: `shoe_${Date.now()}`,
        name: newShoeForm.name.trim(),
        brand: newShoeForm.brand.trim(),
        currentMiles: Math.max(0, Number(newShoeForm.startingMiles) || 0),
        maxMiles: RETIREMENT_THRESHOLD_MILES,
        isActive: shoes.length === 0,
        terrain: newShoeForm.terrain,
        purchasedDate: getLocalDateString(),
      };

      // 1. Write to IndexedDB first
      await dbSaveShoe(newShoe);

      // 2. Queue in outbox
      await queueSyncAction('updateShoeFleet', { shoe: newShoe, actionType: 'add' });

      // 3. Flush if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      setShoes((prev) => [newShoe, ...prev]);
      setNewShoeForm({
        name: '',
        brand: '',
        startingMiles: '',
        terrain: 'Road',
      });
      setIsAddingNew(false);
    },
    [newShoeForm, shoes.length]
  );

  const handleDeleteShoe = useCallback(
    async (shoeId) => {
      const remaining = shoes.filter((s) => s.id !== shoeId);
      if (remaining.length > 0 && !remaining.some((s) => s.isActive)) {
        remaining[0].isActive = true;
      }

      // 1. Write to IndexedDB first
      await dbSaveAllShoes(remaining);

      // 2. Queue in outbox
      await queueSyncAction('updateShoeFleet', { shoeId, actionType: 'delete' });

      // 3. Flush if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      setShoes(remaining);
    },
    [shoes]
  );

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  return {
    shoes,
    activeShoe,
    isLoading,
    isAddingNew,
    newShoeForm,
    terrainOptions: TERRAIN_TYPES,
    retirementThreshold: RETIREMENT_THRESHOLD_MILES,
    getShoeHealth,
    handleSelectActive,
    handleToggleAddForm,
    handleFormChange,
    handleAddShoeSubmit,
    handleDeleteShoe,
    handleBackdropClick,
  };
}
