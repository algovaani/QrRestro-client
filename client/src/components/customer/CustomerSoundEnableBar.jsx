import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing } from 'lucide-react';
import {
  enableOrderChimeWithTestSound,
  isMobileBrowser,
  orderChimeNeedsPrompt,
  subscribeOrderChimeState
} from '../../utils/orderChime';

export default function CustomerSoundEnableBar({ aboveNav = true }) {
  const [visible, setVisible] = useState(
    () => isMobileBrowser() && orderChimeNeedsPrompt()
  );
  const [enabling, setEnabling] = useState(false);

  useEffect(() => subscribeOrderChimeState((primed, needsPrompt) => {
    if (!isMobileBrowser()) {
      setVisible(false);
      return;
    }
    setVisible(needsPrompt || !primed);
  }), []);

  if (!visible) return null;

  const handleEnable = async () => {
    setEnabling(true);
    const ok = await enableOrderChimeWithTestSound();
    setEnabling(false);
    if (ok) setVisible(false);
  };

  return createPortal(
    <div className={`customer-sound-bar${aboveNav ? ' customer-sound-bar--above-nav' : ''}`}>
      <button type="button" className="customer-sound-bar__btn" onClick={handleEnable} disabled={enabling}>
        <BellRing size={18} className="customer-sound-bar__icon" />
        <span>{enabling ? 'Enabling…' : 'Tap to enable order sound alerts'}</span>
      </button>
    </div>,
    document.body
  );
}
