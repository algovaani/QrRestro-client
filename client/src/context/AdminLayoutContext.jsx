import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AdminLayoutContext = createContext(null);

export function AdminLayoutProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    document.body.classList.toggle('admin-sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('admin-sidebar-open');
  }, [sidebarOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
