import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ShieldCheck, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import heroImage from "@/assets/hero-chicken.jpg";
import Meta from '@/components/Meta';
import { useEffect, useState } from 'react';
import OrderProgress from '@/components/OrderProgress';
import { getAppSetting, getMetric } from '@/lib/settings';

const Index = () => {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [locationEmbed, setLocationEmbed] = useState<string | null>(null);
  // happy customers counter (persisted). starts from 5 and increments by 1 on each delivery
  const [happyCount, setHappyCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem('happy_customers_count');
      return v ? parseInt(v, 10) : 5;
    } catch (e) {
      return 5;
    }
  });

  useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.orderId;
      if (id) setOrderId(id);
    };
    window.addEventListener('order_placed', handler as EventListener);
    return () => window.removeEventListener('order_placed', handler as EventListener);
  }, []);

  // Listen for deliveries and refresh the authoritative server-backed counter.
  useEffect(() => {
    const onDelivered = async (e: any) => {
      try {
        const serverVal = await getMetric('happy_customers');
        if (serverVal !== null && serverVal !== undefined) {
          localStorage.setItem('happy_customers_count', String(serverVal));
          setHappyCount(serverVal);
        }
      } catch (err) {
        // If server fetch fails, we do not increment client-side to avoid double-counting.
        console.warn('Failed to refresh happy_customers metric after delivery', err);
      }
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'happy_customers_count') {
        try {
          const v = parseInt(String(ev.newValue || ''), 10);
          if (!Number.isNaN(v)) setHappyCount(v);
        } catch (e) { /* ignore */ }
      }
    };

    window.addEventListener('order_delivered', onDelivered as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('order_delivered', onDelivered as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const embed = await getAppSetting('support_location_embed');
        if (!mounted) return;
        if (embed) setLocationEmbed(embed);
      } catch (err) {
        console.warn('Failed to load location embed for homepage', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) navigate('/menu');
    else navigate('/signup');
  };

  // On mount, fetch authoritative happy customers count from server (if available)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const server = await getMetric('happy_customers');
        if (!mounted) return;
        if (server !== null && server !== undefined) {
          localStorage.setItem('happy_customers_count', String(server));
          setHappyCount(server);
        }
      } catch (e) {
        // ignore; keep local value
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Meta
        title={`Fresh Chicken Delivery in India — Cloud Chicken`}
        description={`Order fresh chicken online for fast home delivery. Affordable prices for whole chicken, breasts, and butchered cuts. Delivery in under 2 hours.`}
        url={`https://cloudchicken.in/`}
        image={`https://cloudchicken.in/src/assets/hero-chicken.jpg`}
        keywords={`chicken near me, fresh chicken delivery, cheap chicken near me, buy chicken online, chicken delivery`}
      />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden min-h-[85vh] flex items-center">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src={heroImage} 
              alt="Fresh Chicken" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/60"></div>
          </div>
          
          {/* Content */}
          <div className="container mx-auto px-4 py-20 relative z-10">
            <div className="max-w-2xl space-y-8 animate-fade-in">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Fresh Chicken in Dibrugarh —
                <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-2">
                  Delivered Fast to Your Doorstep
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-foreground/80 leading-relaxed">
                Premium quality chicken delivered across Dibrugarh in under 2 hours. Fresh, affordable, and ready to cook — order online for home delivery.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link to="/menu">
                  <Button size="lg" className="w-full sm:w-auto text-lg px-10 py-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all hover-scale">
                    Order Now
                  </Button>
                </Link>
                <Link to="/menu">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-10 py-6 hover-scale bg-card/50 backdrop-blur-sm">
                    View Menu
                  </Button>
                </Link>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-8 pt-8">
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">2 Hours</div>
                  <div className="text-sm text-muted-foreground">Fast Delivery</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">100%</div>
                  <div className="text-sm text-muted-foreground">Fresh Quality</div>
                </div>
                <div className="space-y-1">
                  {/* show exact for small counts (<10), else show nearest 10s like 10+, 20+ */}
                  <div className="text-3xl font-bold text-primary">{happyCount < 10 ? `${happyCount}+` : `${Math.floor(happyCount / 10) * 10}+`}</div>
                  <div className="text-sm text-muted-foreground">Happy Customers</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 bg-secondary/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Why Choose Cloud Chicken?</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center space-y-4 p-6 rounded-xl bg-card hover:shadow-[var(--shadow-card)] transition-all">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">100% Fresh</h3>
                <p className="text-muted-foreground">
                  Direct from farm to your table. No frozen meat, guaranteed freshness.
                </p>
              </div>

              <div className="text-center space-y-4 p-6 rounded-xl bg-card hover:shadow-[var(--shadow-card)] transition-all">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">2-Hour Delivery</h3>
                <p className="text-muted-foreground">
                  Lightning-fast delivery. Order now and get it within 2 hours.
                </p>
              </div>

              <div className="text-center space-y-4 p-6 rounded-xl bg-card hover:shadow-[var(--shadow-card)] transition-all">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Hygiene First</h3>
                <p className="text-muted-foreground">
                  Cleaned and packed in hygienic conditions following strict standards.
                </p>
              </div>

              <div className="text-center space-y-4 p-6 rounded-xl bg-card hover:shadow-[var(--shadow-card)] transition-all">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Track Orders</h3>
                <p className="text-muted-foreground">
                  Real-time order tracking from kitchen to your doorstep.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  1
                </div>
                <h3 className="font-semibold text-xl">Browse & Select</h3>
                <p className="text-muted-foreground">
                  Choose from our wide range of fresh chicken cuts and products
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  2
                </div>
                <h3 className="font-semibold text-xl">Place Order</h3>
                <p className="text-muted-foreground">
                  Add items to cart and complete your order in just a few clicks
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  3
                </div>
                <h3 className="font-semibold text-xl">Receive Fresh</h3>
                <p className="text-muted-foreground">
                  Get your order delivered fresh within 2 hours at your doorstep
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-br from-primary to-accent">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Experience Fresh Chicken Delivery?
            </h2>
            <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers who trust Cloud Chicken for their daily fresh chicken needs
            </p>
            <Button onClick={handleGetStarted} size="lg" variant="secondary" className="text-lg px-8">
              Get Started Today
            </Button>
          </div>
        </section>

        {/* Embedded Location (homepage only) */}
        {locationEmbed && (
          <section className="py-16 bg-card">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-4">Our Location</h2>
              <div className="w-full h-80 overflow-hidden rounded-lg" dangerouslySetInnerHTML={{ __html: locationEmbed }} />
            </div>
          </section>
        )}
      </main>
      {orderId && <OrderProgress orderId={orderId} onClose={() => setOrderId(null)} />}

      <Footer />
    </div>
  );
};

export default Index;
