function resolveImageUrl(src) {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
}

export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

export function getWhatsAppLink(phone) {
  const clean = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  if (isMobileDevice()) {
    return clean ? `https://wa.me/91${clean}` : 'https://wa.me/';
  }
  return 'https://web.whatsapp.com/';
}

/** Mobile par WhatsApp app kholo */
export function openWhatsAppMobile(phone, text) {
  const clean = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  const waBase = clean ? `https://wa.me/91${clean}` : 'https://wa.me/';
  const waUrl = text ? `${waBase}?text=${encodeURIComponent(text)}` : waBase;

  if (isAndroid()) {
    const intentText = text ? `?text=${encodeURIComponent(text)}` : '';
    const intentPhone = clean ? `?phone=91${clean}${text ? `&text=${encodeURIComponent(text)}` : ''}` : intentText;
    const intent = clean
      ? `intent://send${intentPhone}#Intent;scheme=whatsapp;package=com.whatsapp;end`
      : `intent://send${intentText}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    window.location.href = intent;
    setTimeout(() => {
      window.location.href = waUrl;
    }, 800);
    return;
  }

  window.location.href = waUrl;
}

/** Open any wa.me / WhatsApp URL — works inside modals on mobile */
export function openWhatsAppUrl(url) {
  if (!url) return;
  if (isMobileDevice()) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function openWhatsApp(phone, text) {
  const clean = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  const waBase = clean ? `https://wa.me/91${clean}` : 'https://wa.me/';
  const waUrl = text ? `${waBase}?text=${encodeURIComponent(text)}` : waBase;
  openWhatsAppUrl(waUrl);
}

/** Open WhatsApp chat without pre-filled message (for PDF attach flow) */
export function openWhatsAppChat(phone) {
  openWhatsApp(phone, '');
}

function dataUrlToPngFile(dataUrl, filename = 'qr-code.png') {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1] || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

function imageSrcToPngFile(src, filename = 'qr-code.png') {
  if (src.startsWith('data:')) {
    return Promise.resolve(dataUrlToPngFile(src, filename));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 400;
      canvas.height = img.naturalHeight || img.height || 400;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('QR PNG ban nahi paya'));
            return;
          }
          resolve(new File([blob], filename, { type: 'image/png' }));
        },
        'image/png',
        1
      );
    };
    img.onerror = () => reject(new Error('QR image load failed'));
    img.src = resolveImageUrl(src);
  });
}

async function urlToFile(src, filename = 'qr-code.png') {
  if (src.startsWith('data:')) {
    return dataUrlToPngFile(src, filename);
  }
  try {
    return await imageSrcToPngFile(src, filename);
  } catch {
    const url = resolveImageUrl(src);
    const res = await fetch(url);
    if (!res.ok) throw new Error('QR image load failed');
    const blob = await res.blob();
    return new File([blob], filename, { type: 'image/png' });
  }
}

async function copyImageBlob(blob) {
  if (!navigator.clipboard?.write || !window.ClipboardItem) return false;
  try {
    const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function tryNativeShare(file, text) {
  if (!navigator.share) return null;

  const payloads = [
    { files: [file], text: text || '', title: 'UPI Payment QR' },
    { files: [file], text: text || '' },
    { files: [file], title: 'UPI Payment QR' },
    { files: [file] }
  ];

  for (const payload of payloads) {
    try {
      if (navigator.canShare && !navigator.canShare(payload)) continue;
      await navigator.share(payload);
      return 'share-file';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  if (!navigator.canShare) {
    for (const payload of [{ files: [file], text: text || '' }, { files: [file] }]) {
      try {
        await navigator.share(payload);
        return 'share-file';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
      }
    }
  }

  return null;
}

/** QR + payment details ek hi image mein — WhatsApp par sirf image bhejne par bhi data dikhe */
async function buildQrImageWithDetails(qrDataUrl, message, filename = 'qr-code.png') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const pad = 20;
      const qrSize = 320;
      const lines = String(message || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const lineHeight = 20;
      const textBlockHeight = lines.length * lineHeight + pad;
      const canvas = document.createElement('canvas');
      canvas.width = qrSize + pad * 2;
      canvas.height = qrSize + textBlockHeight + pad;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 3;
      ctx.strokeRect(pad - 2, pad - 2, qrSize + 4, qrSize + 4);
      ctx.drawImage(img, pad, pad, qrSize, qrSize);

      let y = qrSize + pad + 18;
      lines.forEach((line, idx) => {
        const isAmount =
          line.includes('₹') ||
          line.toLowerCase().includes('amount') ||
          line.toLowerCase().includes('total');
        ctx.fillStyle = isAmount ? '#c2410c' : '#0f172a';
        ctx.font = isAmount
          ? 'bold 17px system-ui, -apple-system, Segoe UI, sans-serif'
          : idx === 0
            ? 'bold 15px system-ui, -apple-system, Segoe UI, sans-serif'
            : '13px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(line, canvas.width / 2, y);
        y += lineHeight;
      });

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('QR PNG ban nahi paya'));
            return;
          }
          resolve(new File([blob], filename, { type: 'image/png' }));
        },
        'image/png',
        1
      );
    };
    img.onerror = () => reject(new Error('QR image load failed'));
    img.src = qrDataUrl.startsWith('data:') ? qrDataUrl : resolveImageUrl(qrDataUrl);
  });
}

/** UPI QR share ke liye payment message */
export function buildPaymentQrShareMessage(data = {}) {
  const lines = [
    `🧾 ${data.restaurantName || 'Restaurant'}`,
    `Order #: ${data.orderNumber || '—'}`,
    `Table #: ${data.tableNumber ?? '—'}`,
    `Payment Amount: ₹${data.grandTotal ?? '—'}`,
    data.upiId ? `UPI ID: ${data.upiId}` : '',
    '',
    'QR scan karke UPI payment karein 📱'
  ];
  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Mobile: share sheet (QR image + text) ya download + WhatsApp with message
 * Desktop: clipboard/download + WhatsApp with pre-filled text
 */
export async function prepareQrForWhatsApp({ qrDataUrl, filename = 'qr-code.png', phone, message }) {
  if (!qrDataUrl) {
    return { method: 'error', error: 'QR available nahi hai' };
  }

  let file;
  try {
    file = message
      ? await buildQrImageWithDetails(qrDataUrl, message, filename)
      : await urlToFile(qrDataUrl, filename);
  } catch {
    return { method: 'error', error: 'QR image load nahi ho payi' };
  }

  // MOBILE — native share (image mein details + optional text caption)
  if (isMobileDevice()) {
    const shared = await tryNativeShare(file, message);
    if (shared === 'share-file') return { method: 'share-file', message };
    if (shared === 'cancelled') return { method: 'cancelled' };

    downloadBlob(file, filename);
    setTimeout(() => openWhatsAppMobile(phone, message), 400);
    return { method: 'download', mobileAttach: true, message };
  }

  // DESKTOP — copy/download image + message clipboard
  const copied = await copyImageBlob(file);
  if (!copied) downloadBlob(file, filename);

  if (message && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      /* ignore */
    }
  }

  return { method: copied ? 'clipboard' : 'download', message };
}

export async function shareQrOnWhatsApp(opts) {
  return prepareQrForWhatsApp(opts);
}

export function getShareQrHint(result) {
  if (result?.error) return result.error;

  switch (result?.method) {
    case 'share-file':
      return 'WhatsApp choose karein — QR image ke saath payment details bhi jayengi. Send dabayein.';
    case 'download':
      return isMobileDevice()
        ? 'WhatsApp khul raha hai — payment message ready hai. QR image attach karke send karein.'
        : 'QR download ho gayi aur payment details copy ho gayi! WhatsApp me paste karein + image attach karein.';
    case 'clipboard':
      return 'QR copy ho gayi aur payment details bhi copy ho gayi! WhatsApp me pehle text paste karein, phir image attach karein.';
    case 'cancelled':
      return '';
    default:
      return '';
  }
}
