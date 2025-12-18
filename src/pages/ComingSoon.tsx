import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, ShieldCheck, Truck, Lock } from 'lucide-react';
import heroImage from '@/assets/hero-chicken.jpg';

const ComingSoon: React.FC<{ targetIso?: string; message?: string }> = ({ targetIso, message }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = targetIso ? new Date(targetIso).getTime() : null;
  const diff = target ? Math.max(0, target - now) : null;

  const timeParts = () => {
    if (!diff) return { d: '--', h: '--', m: '--', s: '--' };
    const s = Math.floor(diff / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60
    };
  };

  const t = timeParts();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Admin Icon (top-left, subtle) */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Admin Login"
          onClick={() => navigate('/login')}
          className="opacity-70 hover:opacity-100"
        >
          <Lock className="h-5 w-5" />
        </Button>
      </div>

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Fresh Chicken"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/90 to-background/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in">

          {/* Heading */}
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Fresh Chicken Delivery
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-2">
              Coming Soon to Dibrugarh 
            </span>
          </h1>

          <p className="text-xl text-foreground/80 max-w-xl mx-auto">
            We’re preparing something fresh, fast, and hygienic for you.
          </p>

          {message && (
            <p className="text-muted-foreground">{message}</p>
          )}

          {/* Countdown */}
          {diff && (
            <div className="flex justify-center gap-4">
              {[
                { label: 'Days', value: t.d },
                { label: 'Hours', value: t.h },
                { label: 'Mins', value: t.m },
                { label: 'Secs', value: t.s }
              ].map((x) => (
                <div
                  key={x.label}
                  className="bg-card/80 backdrop-blur rounded-lg px-4 py-3 w-20 shadow"
                >
                  <div className="text-2xl font-bold text-primary">{x.value}</div>
                  <div className="text-xs text-muted-foreground">{x.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stay Tuned */}
          <div className="pt-4">
            <span className="inline-block text-lg font-semibold tracking-wide text-primary/90">
              Stay Tuned ✨
            </span>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" /> 100% Fresh
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> 2-Hour Delivery
            </span>
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> FREE Delivery
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Hygiene Guaranteed
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
