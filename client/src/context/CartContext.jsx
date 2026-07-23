import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import {
  getSavedCustomerProfile,
  saveCustomerMobileLogin,
  clearCustomerMobileLogin
} from '../utils/customerSession';

const CartContext = createContext();

const ACTIVE_TABLE_KEY = 'customer_active_table';

const getTableSessionKey = (adminId, tNum, branchId) =>
  `customer_session_${adminId}_${branchId || 'legacy'}_${tNum}`;
const getCartStorageKey = (adminId, tNum, sessionId, branchId) =>
  `cart_${adminId}_${branchId || 'legacy'}_${tNum}_${sessionId}`;
const getCustomerStorageKey = (adminId, tNum, sessionId, branchId) =>
  `customer_${adminId}_${branchId || 'legacy'}_${tNum}_${sessionId}`;

const saveActiveTableContext = (adminId, tableNumber, branchId = '') => {
  if (adminId && tableNumber) {
    sessionStorage.setItem(
      ACTIVE_TABLE_KEY,
      JSON.stringify({
        adminId: String(adminId),
        tableNumber: String(tableNumber),
        branchId: branchId ? String(branchId) : ''
      })
    );
  }
};

export const loadActiveTableContext = () => {
  try {
    const raw = sessionStorage.getItem(ACTIVE_TABLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const createSessionId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`);

export const getCustomerMenuPath = (adminId, tableNumber, branchId) => {
  if (!tableNumber) return null;
  if (adminId && branchId) {
    return `/menu/${adminId}/branch/${branchId}/table/${tableNumber}`;
  }
  return adminId ? `/menu/${adminId}/table/${tableNumber}` : `/menu/table/${tableNumber}`;
};

export const getCustomerCartPath = (adminId, tableNumber, branchId) => {
  if (!tableNumber) return null;
  if (adminId && branchId) {
    return `/menu/${adminId}/branch/${branchId}/table/${tableNumber}/cart`;
  }
  return adminId
    ? `/menu/${adminId}/table/${tableNumber}/cart`
    : '/cart';
};

export const CartProvider = ({ children }) => {
  const [tableNumber, setTableNumber] = useState('');
  const [restaurantAdminId, setRestaurantAdminId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branchName, setBranchName] = useState('');
  const [customerSessionId, setCustomerSessionId] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [restaurantSettings, setRestaurantSettings] = useState({
    taxPercentage: 5,
    currency: '₹',
    restaurantName: ''
  });

  const applyRestaurantSettings = useCallback((setting = {}) => {
    setRestaurantSettings({
      taxPercentage: Number(setting.taxPercentage) || 5,
      currency: setting.currency || '₹',
      restaurantName: setting.restaurantName || ''
    });
  }, []);

  const loadSessionData = (adminId, tNum, sessionId, bId) => {
    const savedCustomer = sessionStorage.getItem(getCustomerStorageKey(adminId, tNum, sessionId, bId));
    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        setCustomerName(parsed.customerName || '');
        setCustomerMobile(parsed.customerMobile || '');
      } catch (e) {
        setCustomerName('');
        setCustomerMobile('');
      }
    } else {
      setCustomerName('');
      setCustomerMobile('');
    }

    const savedCart = sessionStorage.getItem(getCartStorageKey(adminId, tNum, sessionId, bId));
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        setCartItems([]);
      }
    } else {
      setCartItems([]);
    }
  };

  const startNewCustomerSession = (adminId, tNum, bId) => {
    const sessionId = createSessionId();
    sessionStorage.setItem(getTableSessionKey(adminId, tNum, bId), sessionId);
    setCustomerSessionId(sessionId);
    setCustomerName('');
    setCustomerMobile('');
    setCartItems([]);
    setSpecialNote('');
    return sessionId;
  };

  const initTableCart = (tNum, adminId = '', bId = '') => {
    const prevScope =
      restaurantAdminId && tableNumber
        ? `${restaurantAdminId}::${branchId || 'legacy'}::${tableNumber}`
        : '';
    const nextScope = adminId && tNum ? `${adminId}::${bId || 'legacy'}::${tNum}` : '';

    setTableNumber(tNum);
    if (adminId) {
      setRestaurantAdminId(adminId);
    }
    if (bId) {
      setBranchId(String(bId));
    }
    if (tNum && adminId) {
      saveActiveTableContext(adminId, tNum, bId);
    }
    if (!tNum || !adminId) return;

    if (prevScope && nextScope && prevScope !== nextScope) {
      setSpecialNote('');
    }

    const activeBranchId = bId || branchId || '';
    let sessionId = sessionStorage.getItem(getTableSessionKey(adminId, tNum, activeBranchId));
    if (!sessionId) {
      sessionId = startNewCustomerSession(adminId, tNum, activeBranchId);
    } else {
      setCustomerSessionId(sessionId);
      loadSessionData(adminId, tNum, sessionId, activeBranchId);
    }

    const savedProfile = getSavedCustomerProfile(adminId, tNum, activeBranchId);
    const savedMobile = savedProfile.mobile;
    if (savedMobile) {
      const customerKey = getCustomerStorageKey(adminId, tNum, sessionId, activeBranchId);
      let hasSessionMobile = false;
      let sessionName = '';
      try {
        const raw = sessionStorage.getItem(customerKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          hasSessionMobile = parsed.customerMobile?.length === 10;
          sessionName = parsed.customerName || '';
        }
      } catch {
        hasSessionMobile = false;
      }
      if (!hasSessionMobile) {
        const displayName = sessionName || savedProfile.name || '';
        setCustomerName(displayName);
        setCustomerMobile(savedMobile);
        sessionStorage.setItem(
          customerKey,
          JSON.stringify({ customerName: displayName, customerMobile: savedMobile })
        );
      }
    }
  };

  const bindRestaurantAdmin = (adminId, bId = '') => {
    if (!adminId) return;
    setRestaurantAdminId(adminId);
    if (bId) setBranchId(String(bId));
    if (tableNumber) {
      initTableCart(tableNumber, adminId, bId || branchId);
    }
  };

  const setBranchContext = (bId, name = '') => {
    if (bId) setBranchId(String(bId));
    if (name) setBranchName(name);
  };

  const saveCustomerDetails = (mobile) => {
    const trimmedMobile = String(mobile || '').trim();
    setCustomerMobile(trimmedMobile);
    if (tableNumber && restaurantAdminId && trimmedMobile.length === 10) {
      const tableProfile = getSavedCustomerProfile(restaurantAdminId, tableNumber, branchId);
      if (tableProfile.name && !customerName.trim()) {
        setCustomerName(tableProfile.name);
      }
      saveCustomerMobileLogin(
        restaurantAdminId,
        tableNumber,
        trimmedMobile,
        tableProfile.name || customerName,
        branchId
      );
      const sessionId = customerSessionId || sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber, branchId));
      if (sessionId) {
        sessionStorage.setItem(
          getCustomerStorageKey(restaurantAdminId, tableNumber, sessionId, branchId),
          JSON.stringify({
            customerName: (tableProfile.name || customerName || '').trim(),
            customerMobile: trimmedMobile
          })
        );
      }
    }
  };

  const updateCustomerName = (name) => {
    const trimmedName = String(name || '').trim();
    setCustomerName(trimmedName);
    if (tableNumber && restaurantAdminId && customerMobile.trim().length === 10) {
      saveCustomerMobileLogin(restaurantAdminId, tableNumber, customerMobile.trim(), trimmedName, branchId);
      const sessionId = customerSessionId || sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber, branchId));
      if (sessionId) {
        sessionStorage.setItem(
          getCustomerStorageKey(restaurantAdminId, tableNumber, sessionId, branchId),
          JSON.stringify({ customerName: trimmedName, customerMobile: customerMobile.trim() })
        );
      }
    }
  };

  const updateCustomerProfile = (name, mobile) => {
    const trimmedName = String(name || '').trim();
    const trimmedMobile = String(mobile || '').replace(/\D/g, '').slice(0, 10);

    if (trimmedMobile.length !== 10) {
      return { ok: false, error: 'Please enter a valid 10-digit mobile number.' };
    }
    if (!trimmedName) {
      return { ok: false, error: 'Please enter your name.' };
    }

    setCustomerName(trimmedName);
    setCustomerMobile(trimmedMobile);

    if (tableNumber && restaurantAdminId) {
      saveCustomerMobileLogin(restaurantAdminId, tableNumber, trimmedMobile, trimmedName, branchId);
      const sessionId = customerSessionId || sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber, branchId));
      if (sessionId) {
        sessionStorage.setItem(
          getCustomerStorageKey(restaurantAdminId, tableNumber, sessionId, branchId),
          JSON.stringify({ customerName: trimmedName, customerMobile: trimmedMobile })
        );
      }
    }

    return { ok: true };
  };

  const logoutCustomer = () => {
    if (restaurantAdminId && tableNumber) {
      clearCustomerMobileLogin(restaurantAdminId, tableNumber, branchId);
    }
    resetCustomerDetails();
  };

  const resetCustomerDetails = () => {
    if (tableNumber && restaurantAdminId) {
      const oldSessionId = sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber, branchId));
      if (oldSessionId) {
        sessionStorage.removeItem(getCartStorageKey(restaurantAdminId, tableNumber, oldSessionId, branchId));
        sessionStorage.removeItem(getCustomerStorageKey(restaurantAdminId, tableNumber, oldSessionId, branchId));
      }
      startNewCustomerSession(restaurantAdminId, tableNumber, branchId);
    } else {
      setCustomerName('');
      setCustomerMobile('');
      setCartItems([]);
      setSpecialNote('');
    }
  };

  const customerDetailsComplete = customerMobile.trim().length === 10;

  useEffect(() => {
    const saved = loadActiveTableContext();
    if (saved?.adminId && saved?.tableNumber && !tableNumber) {
      initTableCart(saved.tableNumber, saved.adminId, saved.branchId || '');
    }
  }, []);

  useEffect(() => {
    if (tableNumber && restaurantAdminId && customerSessionId) {
      sessionStorage.setItem(
        getCartStorageKey(restaurantAdminId, tableNumber, customerSessionId, branchId),
        JSON.stringify(cartItems)
      );
    }
  }, [cartItems, tableNumber, restaurantAdminId, customerSessionId, branchId]);

  const addToCart = (menuItem, size, qty = 1, price, instructions = '') => {
    const cartKey = `${menuItem._id}_${size}`;
    setCartItems(prev => {
      const existingIndex = prev.findIndex(i => i.cartKey === cartKey);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += qty;
        if (instructions) {
          updated[existingIndex].instructions = instructions;
        }
        return updated;
      }
      return [
        ...prev,
        {
          cartKey,
          menuItemId: menuItem._id,
          itemName: menuItem.name,
          size,
          price: Number(price),
          quantity: Number(qty),
          instructions: instructions || '',
          image: menuItem.image,
          foodType: menuItem.foodType
        }
      ];
    });
  };

  const updateQuantity = (cartKey, newQty) => {
    if (newQty <= 0) {
      removeFromCart(cartKey);
      return;
    }
    setCartItems(prev => prev.map(item =>
      item.cartKey === cartKey ? { ...item, quantity: newQty } : item
    ));
  };

  const removeFromCart = (cartKey) => {
    setCartItems(prev => prev.filter(item => item.cartKey !== cartKey));
  };

  const clearCart = () => {
    setCartItems([]);
    if (tableNumber && restaurantAdminId && customerSessionId) {
      sessionStorage.removeItem(getCartStorageKey(restaurantAdminId, tableNumber, customerSessionId, branchId));
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      tableNumber,
      restaurantAdminId,
      branchId,
      branchName,
      setBranchContext,
      bindRestaurantAdmin,
      restaurantSettings,
      applyRestaurantSettings,
      customerSessionId,
      initTableCart,
      cartItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      subtotal,
      totalItemsCount,
      customerName,
      setCustomerName,
      updateCustomerName,
      updateCustomerProfile,
      customerMobile,
      setCustomerMobile,
      saveCustomerDetails,
      resetCustomerDetails,
      logoutCustomer,
      customerDetailsComplete,
      specialNote,
      setSpecialNote
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
