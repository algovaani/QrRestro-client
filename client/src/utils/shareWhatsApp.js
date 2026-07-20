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
export function openWhatsAppMobile(phone) {
  const clean = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  if (isAndroid()) {
    const intent = clean
      ? `intent://send?phone=91${clean}#Intent;scheme=whatsapp;package=com.whatsapp;end`
      : 'intent://send#Intent;scheme=whatsapp;package=com.whatsapp;end';
    window.location.href = intent;
    setTimeout(() => {
      window.location.href = clean ? `https://wa.me/91${clean}` : 'https://wa.me/';
    }, 1200);
    return;
  }

  window.location.href = clean ? `https://wa.me/91${clean}` : 'https://wa.me/';
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

async function tryNativeShare(file) {
  if (!navigator.share) return null;

  const payloads = [{ files: [file] }, { files: [file], title: 'QR Code' }];

  for (const payload of payloads) {
    try {
      if (navigator.canShare && !navigator.canShare({ files: [file] })) continue;
      await navigator.share(payload);
      return 'share-file';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  // iOS / kuch browsers me canShare nahi — phir bhi try karo
  if (!navigator.canShare) {
    try {
      await navigator.share({ files: [file] });
      return 'share-file';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  return null;
}

/**
 * Mobile: pehle share sheet (WhatsApp + QR image), fail hone par download + WhatsApp app kholo
 * Desktop: clipboard/download + web.whatsapp.com link se khulega
 */
export async function prepareQrForWhatsApp({ qrDataUrl, filename = 'qr-code.png', phone }) {
  if (!qrDataUrl) {
    return { method: 'error', error: 'QR available nahi hai' };
  }

  let file;
  try {
    file = await urlToFile(qrDataUrl, filename);
  } catch {
    return { method: 'error', error: 'QR image load nahi ho payi' };
  }

  // MOBILE — native share sheet → WhatsApp select → QR image attach
  if (isMobileDevice()) {
    const shared = await tryNativeShare(file);
    if (shared === 'share-file') return { method: 'share-file' };
    if (shared === 'cancelled') return { method: 'cancelled' };

    downloadBlob(file, filename);
    openWhatsAppMobile(phone);
    return { method: 'download', mobileAttach: true };
  }

  // DESKTOP — copy ya download (WhatsApp <a href> se khulega)
  const copied = await copyImageBlob(file);
  if (!copied) downloadBlob(file, filename);

  return { method: copied ? 'clipboard' : 'download' };
}

export async function shareQrOnWhatsApp(opts) {
  return prepareQrForWhatsApp(opts);
}

export function getShareQrHint(result) {
  if (result?.error) return result.error;

  switch (result?.method) {
    case 'share-file':
      return 'WhatsApp choose karein — QR image attach ho jayegi. Send dabayein.';
    case 'download':
      return isMobileDevice()
        ? 'WhatsApp khul raha hai — Attach 📎 dabao, Gallery/Downloads se QR PNG select karo.'
        : 'QR download ho gayi! WhatsApp me Attach 📎 se PNG bhejein.';
    case 'clipboard':
      return 'QR copy ho gayi! WhatsApp chat me Ctrl+V (paste) dabayein.';
    case 'cancelled':
      return '';
    default:
      return '';
  }
}
