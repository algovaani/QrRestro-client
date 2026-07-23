import React from 'react';
import { MapPin } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';

export default function BranchSelector() {
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    loading,
    hasMultipleBranches
  } = useBranch();

  if (loading && branches.length === 0) return null;
  if (branches.length === 0) return null;

  return (
    <div className="admin-branch-selector" title="Filter by branch">
      <MapPin size={15} aria-hidden />
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        aria-label="Select branch"
      >
        <option value="all">All Branches</option>
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id} disabled={branch.isActive === false}>
            {branch.branchName}{branch.isDefault ? ' (Default)' : ''}{branch.isActive === false ? ' — Inactive' : ''}
          </option>
        ))}
      </select>
      {hasMultipleBranches && selectedBranchId === 'all' && (
        <span className="admin-branch-selector-hint">Combined view</span>
      )}
    </div>
  );
}
