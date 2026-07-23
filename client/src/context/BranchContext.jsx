import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import { useAuth } from './AuthContext';

const BranchContext = createContext(null);

const storageKey = (adminId) => `branch_filter_${adminId}`;

export function BranchProvider({ children }) {
  const { user, token } = useAuth();
  const adminId = useMemo(() => {
    if (!user || !token) return null;
    if (user.role === 'Admin') return String(user._id);
    if (user.restaurantAdminId) return String(user.restaurantAdminId);
    return null;
  }, [user, token]);

  const isBranchLocked = user?.role === 'BranchAdmin';
  const lockedBranchId = isBranchLocked && user?.branchId ? String(user.branchId) : null;

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState('all');
  const [loading, setLoading] = useState(false);

  const setSelectedBranchId = useCallback((branchId) => {
    if (isBranchLocked && lockedBranchId) return;
    setSelectedBranchIdState(branchId);
    if (adminId) {
      try {
        localStorage.setItem(storageKey(adminId), branchId);
      } catch {
        /* ignore */
      }
    }
  }, [adminId, isBranchLocked, lockedBranchId]);

  const refreshBranches = useCallback(async () => {
    if (!adminId) {
      setBranches([]);
      return [];
    }
    setLoading(true);
    try {
      const res = await API.get('/branches');
      const list = res.data?.branches || [];
      setBranches(list);
      return list;
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    if (!adminId) {
      setBranches([]);
      setSelectedBranchIdState('all');
      return;
    }

    if (isBranchLocked && lockedBranchId) {
      setSelectedBranchIdState(lockedBranchId);
      refreshBranches();
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey(adminId));
      if (saved) setSelectedBranchIdState(saved);
      else setSelectedBranchIdState('all');
    } catch {
      setSelectedBranchIdState('all');
    }

    refreshBranches();
  }, [adminId, refreshBranches, isBranchLocked, lockedBranchId]);

  useEffect(() => {
    if (isBranchLocked || !adminId || selectedBranchId === 'all') return;
    const exists = branches.some((b) => String(b._id) === String(selectedBranchId));
    if (branches.length > 0 && !exists) {
      setSelectedBranchId('all');
    }
  }, [branches, selectedBranchId, adminId, setSelectedBranchId, isBranchLocked]);

  const branchQueryParams = useMemo(() => {
    if (lockedBranchId) return { branchId: lockedBranchId };
    return selectedBranchId && selectedBranchId !== 'all' ? { branchId: selectedBranchId } : {};
  }, [selectedBranchId, lockedBranchId]);

  const isAllBranches = !lockedBranchId && selectedBranchId === 'all';

  const getBranchName = useCallback(
    (branchId) => {
      if (!branchId) return '';
      if (lockedBranchId && String(branchId) === lockedBranchId && user?.branchName) {
        return user.branchName;
      }
      const match = branches.find((b) => String(b._id) === String(branchId));
      return match?.branchName || '';
    },
    [branches, lockedBranchId, user?.branchName]
  );

  const selectedBranch = useMemo(() => {
    if (lockedBranchId) {
      return branches.find((b) => String(b._id) === lockedBranchId) || {
        _id: lockedBranchId,
        branchName: user?.branchName || 'Branch'
      };
    }
    return branches.find((b) => String(b._id) === String(selectedBranchId)) || null;
  }, [branches, selectedBranchId, lockedBranchId, user?.branchName]);

  const value = useMemo(
    () => ({
      branches,
      selectedBranchId: lockedBranchId || selectedBranchId,
      selectedBranch,
      setSelectedBranchId,
      branchQueryParams,
      isAllBranches,
      loading,
      refreshBranches,
      getBranchName,
      hasMultipleBranches: branches.length > 1,
      isBranchLocked
    }),
    [
      branches,
      selectedBranchId,
      lockedBranchId,
      selectedBranch,
      setSelectedBranchId,
      branchQueryParams,
      isAllBranches,
      loading,
      refreshBranches,
      getBranchName,
      isBranchLocked
    ]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    return {
      branches: [],
      selectedBranchId: 'all',
      selectedBranch: null,
      setSelectedBranchId: () => {},
      branchQueryParams: {},
      isAllBranches: true,
      loading: false,
      refreshBranches: async () => [],
      getBranchName: () => '',
      hasMultipleBranches: false,
      isBranchLocked: false
    };
  }
  return ctx;
}
