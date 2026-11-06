/**
 * useShoeTracker Hook
 *
 * Asynchronously manages the running shoe fleet, odometer mileage tracking,
 * and shoe retirement thresholds backed by IndexedDB and the sync outbox.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getShoeRotation,
  saveShoe as dbSaveShoe,
  saveAllShoes as dbSaveAllShoes,
  queueSyncAction,
  flushSyncOutbox,
  ensureDatabaseSeeded,
} from '../services/db';
import { RETIREMENT_THRESHOLD_MILES } from '../services/runningService';
import { getLocalDateString } from '../utils/date';

export const useShoeTracker = () => {
  const [shoes, setShoes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshShoes = useCallback(async () => {
    try {
      await ensureDatabaseSeeded();
      const loaded = await getShoeRotation();
      setShoes(loaded);
    } catch (err) {
      console.warn('useShoeTracker failed to load shoes from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
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
        console.warn('useShoeTracker mount hydration error:', err);
        if (isMounted) setIsLoading(false);
      });

    const handleFlushed = () => {
      refreshShoes();
    };

    window.addEventListener('apexfit:sync-flushed', handleFlushed);
    return () => {
      isMounted = false;
      window.removeEventListener('apexfit:sync-flushed', handleFlushed);
    };
  }, [refreshShoes]);

  const activeShoe = useMemo(() => {
    return shoes.find((s) => s.isActive) || shoes[0] || null;
  }, [shoes]);

  /**
   * Adds a new shoe: writes to IndexedDB first, queues sync action.
   */
  const addShoe = useCallback(
    async ({ name, brand = '', startingMiles = 0, terrain = 'Road', maxMiles = 350 }) => {
      const newShoe = {
        id: `shoe_${Date.now()}`,
        name: name.trim(),
        brand: brand.trim(),
        currentMiles: Math.max(0, Number(startingMiles) || 0),
        maxMiles: Number(maxMiles) || RETIREMENT_THRESHOLD_MILES,
        isActive: shoes.length === 0,
        terrain,
        purchasedDate: getLocalDateString(),
      };

      await dbSaveShoe(newShoe);
      await queueSyncAction('updateShoeFleet', { shoe: newShoe, actionType: 'add' });

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      setShoes((prev) => [newShoe, ...prev]);
      return newShoe;
    },
    [shoes.length]
  );

  /**
   * Selects active shoe: updates IndexedDB first, queues sync action.
   */
  const selectActiveShoe = useCallback(
    async (shoeId) => {
      const updated = shoes.map((shoe) => ({
        ...shoe,
        isActive: shoe.id === shoeId,
      }));

      await dbSaveAllShoes(updated);
      await queueSyncAction('updateShoeFleet', { activeShoeId: shoeId, actionType: 'setActive' });

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      setShoes(updated);
      return updated;
    },
    [shoes]
  );

  /**
   * Records miles to shoe odometer: updates IndexedDB first, queues sync action.
   */
  const recordMiles = useCallback(
    async (shoeId, miles) => {
      const numMiles = Number(miles);
      if (!Number.isFinite(numMiles) || numMiles <= 0) return shoes;

      const targetShoe = shoes.find((s) => s.id === shoeId);
      if (!targetShoe) return shoes;

      const newTotal = Math.round((targetShoe.currentMiles + numMiles) * 10) / 10;
      const updatedShoe = { ...targetShoe, currentMiles: newTotal };

      await dbSaveShoe(updatedShoe);
      await queueSyncAction('updateShoeFleet', {
        shoeId,
        milesAdded: numMiles,
        newTotalMiles: newTotal,
        actionType: 'addMiles',
      });

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      setShoes((prev) => prev.map((s) => (s.id === shoeId ? updatedShoe : s)));
      return updatedShoe;
    },
    [shoes]
  );

  return {
    shoes,
    activeShoe,
    isLoading,
    addShoe,
    selectActiveShoe,
    recordMiles,
    refreshShoes,
  };
}
