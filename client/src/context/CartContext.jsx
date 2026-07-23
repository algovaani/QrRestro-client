import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import {
  getSavedCustomerProfile,
  saveCustomerMobileLogin,
  clearCustomerMobileLogin
} from '../utils/customerSession';

const CartContext = createContext();

const ACTIVE_TABLE_KEY = 'customer_active_table';

const getTableSessionKey = (adminId, tNum) => `customer_session_${adminId}_${tNum}`;
const getCartStorageKey = (adminId, tNum, sessionId) => `cart_${adminId}_${tNum}_${sessionId}`;
const getCustomerStorageKey = (adminId, tNum, sessionId) => `customer_${adminId}_${tNum}_${sessionId}`;

const saveActiveTableContext = (adminId, tableNumber) => {
  if (adminId && tableNumber) {
    sessionStorage.setItem(
      ACTIVE_TABLE_KEY,
      JSON.stringify({ adminId: String(adminId), tableNumber: String(tableNumber) })
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

export const getCustomerMenuPath = (adminId, tableNumber) => {
  if (!tableNumber) return null;
  return adminId ? `/menu/${adminId}/table/${tableNumber}` : `/menu/table/${tableNumber}`;
};

export const getCustomerCartPath = (adminId, tableNumber) => {
  if (!tableNumber) return null;
  return adminId
    ? `/menu/${adminId}/table/${tableNumber}/cart`
    : '/cart';
};

export const CartProvider = ({ children }) => {
  const [tableNumber, setTableNumber] = useState('');
  const [restaurantAdminId, setRestaurantAdminId] = useState('');
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

  const loadSessionData = (adminId, tNum, sessionId) => {
    const savedCustomer = sessionStorage.getItem(getCustomerStorageKey(adminId, tNum, sessionId));
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

    const savedCart = sessionStorage.getItem(getCartStorageKey(adminId, tNum, sessionId));
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

  const startNewCustomerSession = (adminId, tNum) => {
    const sessionId = createSessionId();
    sessionStorage.setItem(getTableSessionKey(adminId, tNum), sessionId);
    setCustomerSessionId(sessionId);
    setCustomerName('');
    setCustomerMobile('');
    setCartItems([]);
    setSpecialNote('');
    return sessionId;
  };

  const initTableCart = (tNum, adminId = '') => {
    setTableNumber(tNum);
    if (adminId) {
      setRestaurantAdminId(adminId);
    }
    if (tNum && adminId) {
      saveActiveTableContext(adminId, tNum);
    }
    if (!tNum || !adminId) return;

    let sessionId = sessionStorage.getItem(getTableSessionKey(adminId, tNum));
    if (!sessionId) {
      sessionId = startNewCustomerSession(adminId, tNum);
    } else {
      setCustomerSessionId(sessionId);
      loadSessionData(adminId, tNum, sessionId);
    }

    const savedProfile = getSavedCustomerProfile(adminId);
    const savedMobile = savedProfile.mobile;
    if (savedMobile) {
      const customerKey = getCustomerStorageKey(adminId, tNum, sessionId);
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

  const bindRestaurantAdmin = (adminId) => {
    if (!adminId) return;
    setRestaurantAdminId(adminId);
    if (tableNumber) {
      initTableCart(tableNumber, adminId);
    }
  };

  const saveCustomerDetails = (mobile) => {
    const trimmedMobile = String(mobile || '').trim();
    setCustomerMobile(trimmedMobile);
    if (tableNumber && restaurantAdminId && trimmedMobile.length === 10) {
      const savedName = getSavedCustomerProfile(restaurantAdminId).name;
      if (savedName && !customerName.trim()) {
        setCustomerName(savedName);
      }
      saveCustomerMobileLogin(restaurantAdminId, trimmedMobile, savedName || customerName);
      const sessionId = customerSessionId || sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber));
      if (sessionId) {
        sessionStorage.setItem(
          getCustomerStorageKey(restaurantAdminId, tableNumber, sessionId),
          JSON.stringify({
            customerName: (savedName || customerName || '').trim(),
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
      saveCustomerMobileLogin(restaurantAdminId, customerMobile.trim(), trimmedName);
      const sessionId = customerSessionId || sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber));
      if (sessionId) {
        sessionStorage.setItem(
          getCustomerStorageKey(restaurantAdminId, tableNumber, sessionId),
          JSON.stringify({ customerName: trimmedName, customerMobile: customerMobile.trim() })
        );
      }
    }
  };

  const logoutCustomer = () => {
    if (restaurantAdminId) {
      clearCustomerMobileLogin(restaurantAdminId);
    }
    resetCustomerDetails();
  };

  const resetCustomerDetails = () => {
    if (tableNumber && restaurantAdminId) {
      const oldSessionId = sessionStorage.getItem(getTableSessionKey(restaurantAdminId, tableNumber));
      if (oldSessionId) {
        sessionStorage.removeItem(getCartStorageKey(restaurantAdminId, tableNumber, oldSessionId));
        sessionStorage.removeItem(getCustomerStorageKey(restaurantAdminId, tableNumber, oldSessionId));
      }
      startNewCustomerSession(restaurantAdminId, tableNumber);
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
      initTableCart(saved.tableNumber, saved.adminId);
    }
  }, []);

  useEffect(() => {
    if (tableNumber && restaurantAdminId && customerSessionId) {
      sessionStorage.setItem(
        getCartStorageKey(restaurantAdminId, tableNumber, customerSessionId),
        JSON.stringify(cartItems)
      );
    }
  }, [cartItems, tableNumber, restaurantAdminId, customerSessionId]);

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
      sessionStorage.removeItem(getCartStorageKey(restaurantAdminId, tableNumber, customerSessionId));
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      tableNumber,
      restaurantAdminId,
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
