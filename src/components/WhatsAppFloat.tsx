import React, { useEffect, useState } from 'react';
import { getAppSetting } from '@/lib/settings';

function sanitizePhone(p?: string) {
  if (!p) return null;
  // Remove non-digits and leading zeros; keep country code if present
  const digits = p.replace(/[^0-9+]/g, '');
  // Remove leading + for wa.me links
  return digits.replace(/^\+/, '');
}

export default function WhatsAppFloat() {
  const [phone, setPhone] = useState<string | null>(null);
  const [bottomOffset, setBottomOffset] = useState<number>(16);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await getAppSetting('support_whatsapp');
        if (!mounted) return;
        if (p) setPhone(sanitizePhone(p));
      } catch (e) {
        console.warn('Failed to load support_whatsapp setting', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Adjust position when PersistentOrderBar is present or resized
  useEffect(() => {
    const update = () => {
      const bar = document.getElementById('persistent-order-bar');
      // Only treat the bar as present if it exists and is actually visible (data-visible)
      if (!bar || bar.dataset.visible !== 'true') {
        setBottomOffset(16);
        return;
      }
      const h = Math.ceil(bar.getBoundingClientRect().height || 0);
      setBottomOffset(h + 12);
    };

    update();

    const roTarget = document.getElementById('persistent-order-bar');
    let ro: ResizeObserver | null = null;
    if (roTarget && (window as any).ResizeObserver) {
      ro = new (window as any).ResizeObserver(() => update());
      ro.observe(roTarget);
    }

    window.addEventListener('resize', update);
    const mo = new MutationObserver(() => update());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (ro && roTarget) ro.unobserve(roTarget);
      mo.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const openWhatsApp = () => {
    const fallback = '918099747830'; // Updated to match your business number
    const target = phone || fallback;
    const url = `https://wa.me/${encodeURIComponent(target)}`;
    window.open(url, '_blank');
  };

  return (
    <button
      aria-label="Contact us on WhatsApp"
      onClick={openWhatsApp}
      style={{ right: 16, bottom: bottomOffset, transition: 'bottom 200ms ease' }}
      className="fixed z-50 w-12 h-12 bg-[#25D366] rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.52 3.48A11.94 11.94 0 0012 0C5.372 0 .12 4.85.12 11.2c0 1.97.52 3.86 1.5 5.52L0 24l7.56-1.98A11.98 11.98 0 0012 22.4c6.63 0 11.88-4.85 11.88-11.2 0-1.98-.52-3.86-1.36-5.72z" fill="#fff"/>
        <path d="M17.2 14.1c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15s-.78.98-.96 1.18c-.18.2-.36.22-.66.07-.3-.15-1.26-.46-2.4-1.48-.89-.78-1.48-1.74-1.66-2.04-.18-.3-.02-.46.13-.61.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2 0-.38-.02-.53-.02-.15-.68-1.64-.94-2.25-.25-.58-.5-.5-.68-.51-.18-.01-.38-.01-.58-.01s-.53.07-.8.38c-.27.3-1.04 1.02-1.04 2.48 0 1.45 1.06 2.85 1.2 3.05.14.2 2.06 3.12 5 4.37 2.94 1.25 2.94.83 3.47.78.53-.05 1.72-.7 1.97-1.38.25-.68.25-1.27.18-1.38-.07-.11-.27-.18-.56-.33z" fill="#25D366"/>
      </svg>
    </button>
  );
}
