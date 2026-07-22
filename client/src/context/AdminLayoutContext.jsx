import React, { createContext, useCallback, useContext, useState } from 'react';

const AdminLayoutContext = createContext(null);

export function AdminLayoutProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  return (
    <AdminLayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, closeSidebar, toggleSidebar }}>
      {children}
    </AdminLayoutContext.Provider>
  );
}

export function useAdminLayout() {
  return useContext(AdminLayoutContext) || {
    sidebarOpen: false,
    setSidebarOpen: () => {},
    closeSidebar: () => {},
    toggleSidebar: () => {}
  };
}
