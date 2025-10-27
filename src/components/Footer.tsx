import { Youtube, Instagram, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAppSetting } from "@/lib/settings";

export const Footer = () => {
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [locationEmbed, setLocationEmbed] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await getAppSetting('support_whatsapp');
        const e = await getAppSetting('support_email');
  const l = await getAppSetting('support_location');
  const le = await getAppSetting('support_location_embed');
        if (!mounted) return;
        if (p) setPhone(p);
        if (e) setEmail(e);
  if (l) setLocation(l);
  if (le) setLocationEmbed(le);
      } catch (err) {
        console.warn('Failed to load footer settings', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const mapsUrl = (addr?: string) => {
    if (!addr) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  };

  const telUrl = (phoneStr?: string) => phoneStr ? `tel:${phoneStr.replace(/^\+/, '')}` : '#';
  const mailUrl = (emailStr?: string) => emailStr ? `mailto:${emailStr}` : '#';

  const sanitizePhoneForWa = (p?: string) => {
    if (!p) return null;
    const digits = p.replace(/[^0-9+]/g, '');
    return digits.replace(/^\+/, '');
  };

  // render embedded dialog if requested
  const waNumber = sanitizePhoneForWa(phone) || '919999999999';
  const waMessage = encodeURIComponent('Hi Cloud Chicken, I need help with my order.');
  const waHref = `https://wa.me/${waNumber}?text=${waMessage}`;
  return (
    <>
      <footer className="bg-secondary/30 border-t mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                CLOUD CHICKEN
              </h3>
              <p className="text-sm text-muted-foreground">
                Fresh chicken delivered to your doorstep in under 2 hours. Quality you can trust.
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/menu" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Menu
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    About Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Location / small contact info kept in footer */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-start space-x-2">
                  <Phone className="h-4 w-4 text-primary mt-0.5" />
                  {phone ? (
                    <a href={telUrl(phone)} className="text-sm text-muted-foreground hover:text-primary">
                      {phone}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">+91 XXXXX XXXXX</span>
                  )}
                </li>
                <li className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5" />
                  {location ? (
                    locationEmbed ? (
                      <button onClick={() => setShowEmbed(true)} className="text-sm text-muted-foreground hover:text-primary text-left">
                        {location}
                      </button>
                    ) : (
                      <a href={mapsUrl(location)} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary">
                        {location}
                      </a>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">Bangalore, India</span>
                  )}
                </li>
              </ul>
            </div>
          </div>

          {/* Social Media & Copyright */}
          <div className="mt-8 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex space-x-4 items-center order-first md:order-none">
              <a href="https://youtube.com/@cloud_chicken?si=4hFLT66pdiImVBg9" target="_blank" rel="noreferrer" className="rounded-full p-2 flex items-center justify-center shadow-sm" style={{ background: '#FF0000', color: '#fff' }}>
                <Youtube className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/cloudchicken.in?igsh=MWRheWJrb2owbDgzbw==" target="_blank" rel="noreferrer" className="rounded-full p-2 flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', color: '#fff' }}>
                <Instagram className="h-4 w-4" />
              </a>
              <a href={waHref} target="_blank" rel="noreferrer" className="rounded-full p-2 flex items-center justify-center shadow-sm" style={{ background: '#25D366', color: '#fff' }}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.52 3.48A11.94 11.94 0 0012 0C5.372 0 .12 4.85.12 11.2c0 1.97.52 3.86 1.5 5.52L0 24l7.56-1.98A11.98 11.98 0 0012 22.4c6.63 0 11.88-4.85 11.88-11.2 0-1.98-.52-3.86-1.36-5.72z" fill="currentColor" />
                  <path d="M17.2 14.1c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15s-.78.98-.96 1.18c-.18.2-.36.22-.66.07-.3-.15-1.26-.46-2.4-1.48-.89-.78-1.48-1.74-1.66-2.04-.18-.3-.02-.46.13-.61.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2 0-.38-.02-.53-.02-.15-.68-1.64-.94-2.25-.25-.58-.5-.5-.68-.51-.18-.01-.38-.01-.58-.01s-.53.07-.8.38c-.27.3-1.04 1.02-1.04 2.48 0 1.45 1.06 2.85 1.2 3.05.14.2 2.06 3.12 5 4.37 2.94 1.25 2.94.83 3.47.78.53-.05 1.72-.7 1.97-1.38.25-.68.25-1.27.18-1.38-.07-.11-.27-.18-.56-.33z" fill="white" />
                </svg>
              </a>
            </div>
            <p className="text-sm text-muted-foreground order-last md:order-none">
              © 2025 Cloud Chicken. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Embedded map dialog (admin-provided iframe) */}
      <Dialog open={showEmbed} onOpenChange={(v) => setShowEmbed(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Location</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {locationEmbed ? (
              <div className="w-full h-64 overflow-hidden" dangerouslySetInnerHTML={{ __html: locationEmbed }} />
            ) : (
              <p className="text-sm text-gray-600">No embedded map available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
