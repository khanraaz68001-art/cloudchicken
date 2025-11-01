import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShoppingCart, Plus, Minus, Package, Star, Filter } from "lucide-react";
import Meta from '@/components/Meta';

interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface PricingTier {
  id: string;
  weight_kg: number;
  price_total: number;
  price_per_kg: number;
  tier_name?: string;
  is_active: boolean;
  sort_order: number;
}

interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  base_price_per_kg: number;
  image_url?: string;
  image_base64?: string | null;
  image_mime?: string | null;
  is_available: boolean;
  pricing_tiers?: PricingTier[];
  product_categories?: {
    name: string;
  };
}

interface CartItem {
  product: Product;
  quantity: number;
  weight_kg: number;
}

const EcommerceMenu = () => {
  const { userProfile, user, refreshUserProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showThankYou, setShowThankYou] = useState(false);
  
  // Order form state
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);

  const cartRef = useRef<CartItem[]>([]);

  type AddressDraft = { house_flat: string; location: string; landmark: string };

  const parseProfileAddress = (addr: any): AddressDraft => {
    try {
      if (!addr) return { house_flat: '', location: '', landmark: '' };
      if (typeof addr === 'string') {
        try {
          const parsed = JSON.parse(addr);
          if (parsed && typeof parsed === 'object') return {
            house_flat: parsed.house_flat || '',
            location: parsed.location || '',
            landmark: parsed.landmark || ''
          };
        } catch (e) {
          return { house_flat: '', location: addr, landmark: '' };
        }
      }
      if (typeof addr === 'object') {
        return {
          house_flat: addr.house_flat || '',
          location: addr.location || '',
          landmark: addr.landmark || ''
        };
      }
    } catch (e) {}
    return { house_flat: '', location: '', landmark: '' };
  };

  const formatAddressForDisplay = (d: AddressDraft) => {
    const parts: string[] = [];
    if (d.house_flat && d.house_flat.trim()) parts.push(d.house_flat.trim());
    if (d.location && d.location.trim()) parts.push(d.location.trim());
    if (d.landmark && d.landmark.trim()) parts.push(d.landmark.trim());
    return parts.join(', ');
  };

  const [addressDraft, setAddressDraft] = useState<AddressDraft>(parseProfileAddress(userProfile?.address));
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const saveAddressNow = async () => {
    if (!user?.id) return;
    try {
      await supabase.from('user_profiles').update({ address: JSON.stringify(addressDraft) }).eq('id', user.id);
      try { await refreshUserProfile(); } catch (e) { /* ignore */ }
      setSuccess('Address saved');
      window.setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.warn('Failed to save address', err);
      setError('Failed to save address');
    }
  };

  useEffect(() => {
    if (!isEditingAddress) return;
    if (!user?.id) return;
    // debounce autosave
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await supabase.from('user_profiles').update({ address: JSON.stringify(addressDraft) }).eq('id', user.id);
        try { await refreshUserProfile(); } catch (e) { /* ignore */ }
        setSuccess('Address saved');
        window.setTimeout(() => setSuccess(''), 2000);
      } catch (err) {
        console.warn('Autosave failed', err);
        setError('Failed to autosave address');
      }
    }, 800) as unknown as number;

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [addressDraft, isEditingAddress, user?.id]);

  useEffect(() => {
    if (userProfile?.address) {
      const parsed = parseProfileAddress(userProfile.address);
      setAddressDraft(parsed);
      // if delivery address empty, prefill
      if (!deliveryAddress) setDeliveryAddress(formatAddressForDisplay(parsed));
    }
  }, [userProfile]);

  // Product dialog state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDialogMode, setProductDialogMode] = useState<'cart' | 'buy'>('cart');
  const [buyItems, setBuyItems] = useState<CartItem[] | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  // users pick a weight per piece (preset or custom) and optionally set quantity
  const [selectedWeight, setSelectedWeight] = useState("0.5"); // in kg
  const [customWeight, setCustomWeight] = useState("");
  const [showProductDialog, setShowProductDialog] = useState(false);

  useEffect(() => {
    // Try to show cached products quickly while we fetch fresh data
    try {
      const cached = sessionStorage.getItem('cloudcoop_products');
      if (cached) {
        const parsed = JSON.parse(cached) as Product[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setProductsLoading(false);
        }
      }
    } catch (e) { /* ignore cache errors */ }

    fetchData();
    
    // Set up real-time subscriptions for products and categories
    const productsSubscription = supabase
      .channel('products_changes_menu')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'products'
        }, 
        () => {
          // Refresh products when they change
          fetchProducts();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'product_categories'
        }, 
        () => {
          // Refresh categories when they change
          fetchCategories();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'product_pricing_tiers'
        }, 
        () => {
          // Refresh products when pricing changes
          fetchProducts();
        }
      )
      .subscribe();
      
    // load cart from localStorage if present
    try {
      const raw = localStorage.getItem('cloudcoop_cart');
      if (raw) {
        const parsed = JSON.parse(raw);
        setCart(parsed);
        cartRef.current = parsed;
      }
    } catch (e) {
      // ignore
    }
    // open cart modal if URL requests it (redirect from /cart)
    try {
      const qs = new URLSearchParams(location.search);
      if (qs.get('openCart') === '1') setShowCartModal(true);
    } catch (e) {}

    // Cleanup function
    return () => {
      supabase.removeChannel(productsSubscription);
    };
  }, []);

  // keep cart in sync across tabs and same-tab events
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem('cloudcoop_cart');
        const parsed = raw ? JSON.parse(raw) : [];
        if (JSON.stringify(parsed) !== JSON.stringify(cartRef.current)) {
          setCart(parsed);
          cartRef.current = parsed;
        }
      } catch (e) {
        // ignore
      }
    };

    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'cloudcoop_cart') handler();
    };

    window.addEventListener('cart_updated', handler as EventListener);
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('cart_updated', handler as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  // persist cart to localStorage and notify other components/tabs — avoid dispatching when nothing changed
  useEffect(() => {
    try {
      const serialized = JSON.stringify(cart || []);
      const prev = localStorage.getItem('cloudcoop_cart');
      if (prev !== serialized) {
        localStorage.setItem('cloudcoop_cart', serialized);
        window.dispatchEvent(new Event('cart_updated'));
      }
      cartRef.current = cart;
    } catch (e) {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory]);

  // When order dialog opens, try to prefill delivery address from profile if available
  useEffect(() => {
    if (showOrderDialog) {
      try {
        if (!deliveryAddress) {
          // prefer formatted profile address when available
          const profAddr = (userProfile as any)?.address || (userProfile as any)?.delivery_address || "";
          const parsed = parseProfileAddress(profAddr);
          const formatted = formatAddressForDisplay(parsed) || String(profAddr || "");
          setDeliveryAddress(formatted);
          setAddressDraft(parsed);
        }
      } catch (e) {}
    }
  }, [showOrderDialog, userProfile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories and products
      await Promise.all([
        fetchCategories(),
        fetchProducts()
      ]);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    setCategories(data || []);
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      // Prefer the `products_with_pricing_tiers` view which includes pricing tiers and image fields
      try {
        const { data, error } = await supabase
          .from('products_with_pricing_tiers')
          .select(`*`)
          .eq('is_available', true)
          .order('sort_order', { ascending: true });

        if (!error && data) {
          setProducts(data || []);
          try { sessionStorage.setItem('cloudcoop_products', JSON.stringify(data || [])); } catch (e) {}
          return;
        }
      } catch (err) {
        // view may not exist in all environments, fall back to products_with_image view
        console.warn('products_with_pricing_tiers view not available, falling back', err);
        try {
          const { data, error } = await supabase
            .from('products_with_image')
            .select(`*`)
            .eq('is_available', true)
            .order('sort_order', { ascending: true });

          if (!error && data) {
            setProducts(data || []);
            try { sessionStorage.setItem('cloudcoop_products', JSON.stringify(data || [])); } catch (e) {}
            return;
          }
        } catch (err2) {
          // both views failed, fall back to products table
          console.warn('products_with_image view not available, falling back', err2);
        }
      }

      // fallback: ensure we request image_base64 and image_mime if available
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('products')
        .select(`*, image_base64, image_mime`)
        .eq('is_available', true)
        .order('sort_order', { ascending: true });

      if (fallbackErr) throw fallbackErr;
      setProducts(fallbackData || []);
      try { sessionStorage.setItem('cloudcoop_products', JSON.stringify(fallbackData || [])); } catch (e) {}
    } finally {
      setProductsLoading(false);
    }
  };

  const filterProducts = () => {
    if (selectedCategory === "all") {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.category_id === selectedCategory));
    }
  };

  const openProductDialog = (product: Product) => {
    setSelectedProduct(product);
    setSelectedWeight("0.5");
    setCustomWeight("");
    setShowProductDialog(true);
  };

  const addToCart = (mode?: 'cart' | 'buy') => {
    if (!selectedProduct) return;
    const weightPerPiece = customWeight ? parseFloat(customWeight) : parseFloat(selectedWeight);

    if (isNaN(weightPerPiece) || weightPerPiece <= 0) {
      setError("Please enter a valid weight");
      return;
    }

    // For dialog without quantity, each Add means one piece of the chosen weight
    const qty = 1;
    const totalWeight = weightPerPiece * qty;

    const effectiveMode = mode ?? productDialogMode;
    // If the dialog was invoked as 'buy', set buyItems and open order dialog instead of adding to the main cart
    if (effectiveMode === 'buy') {
      const item: CartItem = { product: selectedProduct, quantity: qty, weight_kg: totalWeight };
      setBuyItems([item]);
      setShowProductDialog(false);
      // if user not logged in, redirect to login; ordering requires auth
      if (!userProfile?.id) {
        navigate('/login');
        return;
      }
      // open order dialog for immediate purchase
      setShowOrderDialog(true);
      return;
    }

    // Treat items with same product id and same per-piece weight as the same cart item
    const existingItemIndex = cart.findIndex(item => item.product.id === selectedProduct.id && Math.abs((item.weight_kg / (item.quantity || 1)) - weightPerPiece) < 1e-6);

    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += qty;
      newCart[existingItemIndex].weight_kg += totalWeight;
      setCart(newCart);
    } else {
      setCart([...cart, {
        product: selectedProduct,
        quantity: qty,
        weight_kg: totalWeight
      }]);
    }

    setShowProductDialog(false);
    setSuccess(`Added ${selectedProduct.name} (${totalWeight.toFixed(2)}kg) to cart`);
  };

  // Quick add helper (adds a single piece of default weight to localStorage cart and updates state)
  const addToCartQuick = (product: Product, perPieceKg = 0.5) => {
    try {
      const raw = localStorage.getItem('cloudcoop_cart');
      const existing = raw ? JSON.parse(raw) : [] as any[];
      const idx = existing.findIndex((it: any) => it.product?.id === product.id && Math.abs(((it.weight_kg || 0) / (it.quantity || 1)) - perPieceKg) < 1e-6);
      if (idx >= 0) {
        existing[idx].quantity = (existing[idx].quantity || 1) + 1;
        existing[idx].weight_kg = (existing[idx].weight_kg || perPieceKg) + perPieceKg;
      } else {
        existing.push({ product, quantity: 1, weight_kg: perPieceKg });
      }
      localStorage.setItem('cloudcoop_cart', JSON.stringify(existing));
      window.dispatchEvent(new Event('cart_updated'));
      setCart(existing as CartItem[]);
    } catch (e) {
      console.warn('Failed to add to cart', e);
    }
  };

  // open cart modal instead of navigating to /cart
  const openCartModal = () => setShowCartModal(true);


  const updateCartQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(0, item.quantity + change);
        if (newQuantity === 0) {
          return null;
        }
        return {
          ...item,
          quantity: newQuantity,
          weight_kg: (item.weight_kg / item.quantity) * newQuantity
        };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => {
      const pricing = getPriceForWeight(item.product, item.weight_kg);
      return total + pricing.total;
    }, 0);
  };

  const getTotalWeight = () => {
    return cart.reduce((total, item) => total + item.weight_kg, 0);
  };

  // Helper function to get the correct price for a specific weight
  const getPriceForWeight = (product: Product, weightKg: number): { total: number; perKg: number } => {
    if (!product.pricing_tiers || product.pricing_tiers.length === 0) {
      return {
        total: product.base_price_per_kg * weightKg,
        perKg: product.base_price_per_kg
      };
    }

    // Find exact weight match first
    const exactMatch = product.pricing_tiers.find(tier => 
      tier.is_active && Math.abs(tier.weight_kg - weightKg) < 0.001
    );

    if (exactMatch) {
      return {
        total: exactMatch.price_total,
        perKg: exactMatch.price_per_kg
      };
    }

    // If no exact match, use base price calculation
    return {
      total: product.base_price_per_kg * weightKg,
      perKg: product.base_price_per_kg
    };
  };

  // Helper function to get all available weight options for display
  const getAvailableWeightOptions = (product: Product): PricingTier[] => {
    if (!product.pricing_tiers) return [];
    return product.pricing_tiers
      .filter(tier => tier.is_active)
      .sort((a, b) => a.sort_order - b.sort_order || a.weight_kg - b.weight_kg);
  };

  // Helper function to get common weight options (250g, 500g, 750g, 1kg, etc.) - only up to 2kg for dropdown
  const getCommonWeightOptions = (): { weight: number; label: string }[] => {
    return [
      { weight: 0.25, label: '250gm' },
      { weight: 0.5, label: '500gm' },
      { weight: 0.75, label: '750gm' },
      { weight: 1.0, label: '1kg' },
      { weight: 1.5, label: '1.5kg' },
      { weight: 2.0, label: '2kg' }
    ];
  };

  // Helper function to get available dropdown weight options (up to 2kg only)
  const getDropdownWeightOptions = (product: Product): PricingTier[] => {
    if (!product.pricing_tiers) return [];
    return product.pricing_tiers
      .filter(tier => tier.is_active && tier.weight_kg <= 2.0)
      .sort((a, b) => a.sort_order - b.sort_order || a.weight_kg - b.weight_kg);
  };

  // Helper function to get higher weight options (above 2kg) for display in placeholder
  const getHigherWeightOptions = (product: Product): PricingTier[] => {
    if (!product.pricing_tiers) return [];
    return product.pricing_tiers
      .filter(tier => tier.is_active && tier.weight_kg > 2.0)
      .sort((a, b) => a.sort_order - b.sort_order || a.weight_kg - b.weight_kg);
  };

  // Helper function to format weight display
  const formatWeightDisplay = (weightKg: number): string => {
    if (weightKg >= 1) {
      return weightKg === Math.floor(weightKg) ? `${Math.floor(weightKg)}kg` : `${weightKg}kg`;
    } else {
      return `${Math.round(weightKg * 1000)}gm`;
    }
  };

  const placeOrder = async () => {
    const itemsToPlace = (buyItems && buyItems.length) ? buyItems : cart;
    if (!itemsToPlace || itemsToPlace.length === 0) {
      setError("Cart is empty");
      return;
    }

    if (!deliveryAddress.trim()) {
      setError("Please enter delivery address");
      return;
    }

    if (!userProfile?.id) {
      setError("Please login to place order");
      return;
    }

    try {
      setOrderLoading(true);

      // Batch insert all itemsToPlace as separate order rows and request returned ids
      const rows = itemsToPlace.map((item) => ({
        user_id: userProfile.id,
        product_id: item.product.id,
        quantity: item.quantity,
        weight_kg: item.weight_kg,
        total_amount: getPriceForWeight(item.product, item.weight_kg).total,
        delivery_address: deliveryAddress,
        special_instructions: specialInstructions || null,
        status: 'pending'
      }));

      const { data: inserted, error } = await supabase.from('orders').insert(rows).select('id');
      if (error) throw error;

      const firstInsertedId = inserted && inserted.length ? inserted[0].id : null;

      // Show thank you popup and auto-hide after 3 seconds
      setShowThankYou(true);
      setTimeout(() => {
        setShowThankYou(false);
      }, 3000);

      // If the order was for the main cart, clear it. If it was an immediate buy, leave main cart intact.
      if (itemsToPlace === cart) {
        setCart([]);
        try { localStorage.removeItem('cloudcoop_cart'); window.dispatchEvent(new Event('cart_updated')); } catch (e) {}
      } else {
        // bought items only — clear buyItems
        setBuyItems(null);
      }

      setDeliveryAddress("");
      setSpecialInstructions("");
      setShowOrderDialog(false);

      // notify the rest of the app (Index listens for this to show order progress)
      try {
        if (firstInsertedId) {
          window.dispatchEvent(new CustomEvent('order_placed', { detail: { orderId: firstInsertedId } }));
        }
      } catch (e) {
        // non-fatal
        console.warn('Failed to dispatch order_placed event', e);
      }
      // ensure user sees success message
      window.scrollTo?.(0,0);
    } catch (error: any) {
      console.error('placeOrder error', error);
      setError(error?.message || 'Failed to place order. Please try again.');
    } finally {
      setOrderLoading(false);
    }
  };

  // allow browsing for everyone; ordering requires login (checked when opening order dialog / placing order)

  return (
    <div className="min-h-screen bg-gray-50">
      <Meta
        title={`Order Fresh Chicken Online — Menu | Cloud Chicken`}
        description={`Browse our menu of fresh chicken cuts and products. Fast home delivery, competitive prices, and hygienic handling.`}
        url={`https://cloudchicken.in/menu`}
        image={`https://cloudchicken.in/src/assets/hero-chicken.jpg`}
        keywords={`buy chicken online, chicken delivery, chicken breast online, whole chicken delivery`}
      />
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Top cart summary */}
        <div className="mb-6">
          <div className="p-3 bg-white rounded shadow flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Cart</div>
              <div className="text-xs text-gray-500">{cart.length} item{cart.length !== 1 ? 's' : ''}</div>
            </div>
            <div>
              <Button onClick={openCartModal}>View Cart</Button>
            </div>
          </div>
        </div>

        <div>
          {/* Products grouped by category (2-column grid with larger image above each card) */}
          {productsLoading ? (
            <div className="grid grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={`skel-${i}`} className="transition-shadow overflow-hidden p-3 animate-pulse">
                  <div className="w-full h-36 bg-gray-200" />
                  <CardContent className="p-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : categories.length > 0 ? (
            categories.map(cat => {
              const prods = products.filter(p => (p as any).category_id === cat.id);
              if (!prods || prods.length === 0) return null;
              return (
                <section key={String(cat.id)} className="mb-8">
                  <h3 className="text-xl font-semibold mb-3">{cat.name}</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {prods.map(product => (
                      <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
                        <div className="w-full h-36 bg-gray-100 overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                          ) : product.image_base64 ? (
                            <img src={`data:${product.image_mime || 'image/jpeg'};base64,${product.image_base64}`} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package className="h-12 w-12 text-gray-400" /></div>
                          )}
                        </div>
                        <CardContent className="p-2">
                          <div>
                            <h4 className="font-medium text-base">{product.name}</h4>
                            <div className="text-sm text-gray-600">View options in cart</div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="flex-1 text-sm whitespace-nowrap" onClick={() => { setSelectedProduct(product); setProductDialogMode('cart'); setShowProductDialog(true); }}>
                              <span className="truncate">Cart</span>
                            </Button>
                            <Button size="sm" className="flex-1 text-sm whitespace-nowrap" onClick={() => { setSelectedProduct(product); setProductDialogMode('buy'); setShowProductDialog(true); }}>
                              <span className="truncate">Buy</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {products.map(product => (
                <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <div className="w-full h-36 bg-gray-100 overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : product.image_base64 ? (
                      <img src={`data:${product.image_mime || 'image/jpeg'};base64,${product.image_base64}`} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="h-12 w-12 text-gray-400" /></div>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <div>
                      <h4 className="font-medium text-base">{product.name}</h4>
                      <div className="text-sm text-gray-600">View options in cart</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-sm whitespace-nowrap" onClick={() => { setSelectedProduct(product); setProductDialogMode('cart'); setShowProductDialog(true); }}>
                        <span className="truncate">Cart</span>
                      </Button>
                      <Button size="sm" className="flex-1 text-sm whitespace-nowrap" onClick={() => { setSelectedProduct(product); setProductDialogMode('buy'); setShowProductDialog(true); }}>
                        <span className="truncate">Buy</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
  </div>

        {/* Product Selection Dialog */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedProduct?.name}</DialogTitle>
              <DialogDescription>
                Choose quantity and weight for your order
              </DialogDescription>
            </DialogHeader>
                {selectedProduct && (
                  <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {selectedProduct.image_url ? (
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  ) : selectedProduct.image_base64 ? (
                    <img
                      src={`data:${selectedProduct.image_mime || 'image/jpeg'};base64,${selectedProduct.image_base64}`}
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{selectedProduct.name}</h3>
                    <p className="text-sm text-gray-600">
                      {categories.find(cat => cat.id === selectedProduct.category_id)?.name || 'Uncategorized'}
                    </p>
                    <p className="text-lg font-bold text-green-600">₹{selectedProduct.base_price_per_kg}/kg</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label>Choose weight and see pricing</Label>
                    {/* Dropdown showing actual pricing tiers up to 2kg */}
                    <select 
                      id="weightSelect" 
                      value={selectedWeight} 
                      onChange={(e) => setSelectedWeight(e.target.value)} 
                      className="mt-1 w-full border rounded p-2"
                    >
                      <option value="">Select weight</option>
                      {getDropdownWeightOptions(selectedProduct).map(tier => (
                        <option key={tier.id} value={tier.weight_kg}>
                          {tier.tier_name || formatWeightDisplay(tier.weight_kg)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3">
                      <Label htmlFor="customWeight">
                        {getHigherWeightOptions(selectedProduct).length > 0 
                          ? `For weights above 2kg (${getHigherWeightOptions(selectedProduct).map(t => formatWeightDisplay(t.weight_kg)).join(', ')}) or custom weight (up to 5kg)`
                          : 'Or enter custom weight (up to 5kg)'
                        }
                      </Label>
                      <Input 
                        id="customWeight" 
                        placeholder={
                          getHigherWeightOptions(selectedProduct).length > 0 
                            ? `Available: ${getHigherWeightOptions(selectedProduct).map(t => formatWeightDisplay(t.weight_kg)).join(', ')} or custom (e.g. 2.5)`
                            : 'e.g. 2.5'
                        }
                        value={customWeight} 
                        onChange={(e) => setCustomWeight(e.target.value)}
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5.0"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Weight:</span>
                    <span>{formatWeightDisplay((customWeight ? parseFloat(customWeight) : parseFloat(selectedWeight)) || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Price:</span>
                    <span>₹{getPriceForWeight(selectedProduct, (customWeight ? parseFloat(customWeight) : parseFloat(selectedWeight)) || 0).total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                       <Button onClick={() => { setProductDialogMode('cart'); addToCart('cart'); }} className="flex-1">
                    Add to Cart
                  </Button>
                       <Button onClick={() => { setProductDialogMode('buy'); addToCart('buy'); }} className="flex-1">
                    Buy Now
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Order / Address Dialog (opened for buy-now or from cart modal) */}
        <Dialog open={showOrderDialog} onOpenChange={(val) => { if (!val) { setBuyItems(null); } setShowOrderDialog(val); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Place Order</DialogTitle>
              <DialogDescription>Confirm delivery address and place your order</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Delivery address</Label>
                <div className="flex items-center gap-2">
                  <Input className="w-full md:w-96" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="House / Street / Landmark" />
                  <Button variant="ghost" size="sm" onClick={() => { setAddressDraft(parseProfileAddress(userProfile?.address)); setShowAddressModal(true); }}>Edit</Button>
                </div>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    if (!user?.id) return;
                    try {
                      const payload = addressDraft && (addressDraft.location || addressDraft.house_flat || addressDraft.landmark)
                        ? JSON.stringify(addressDraft)
                        : deliveryAddress;
                      const { error } = await supabase.from('user_profiles').update({ address: payload }).eq('id', user.id);
                      if (error) throw error;
                      try { await refreshUserProfile(); } catch (e) {}
                      setSuccess('Address saved');
                      setTimeout(() => setSuccess(''), 2500);
                    } catch (err) {
                      console.warn('Failed to save address', err);
                      setError('Failed to save address');
                    }
                  }}>Save</Button>
                </div>
              </div>

              <div>
                <Label>Special instructions (optional)</Label>
                <Input value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="e.g. leave at gate" />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="text-blue-600 font-semibold text-sm">💰 Payment Method</div>
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  This order is <strong>Cash on Delivery (COD)</strong>. Payment will be collected at the time of delivery.
                </div>
              </div>

              <div>
                <h4 className="font-semibold">Items</h4>
                <div className="space-y-2 mt-2">
                  {((buyItems && buyItems.length) ? buyItems : cart).map(item => (
                    <div key={item.product.id} className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-xs text-gray-500">{item.quantity} x • {formatWeightDisplay(item.weight_kg)}</div>
                      </div>
                      <div className="font-semibold">₹{(item.weight_kg * item.product.base_price_per_kg).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-bold">
                <div>Total</div>
                <div>₹{(((buyItems && buyItems.length) ? buyItems : cart).reduce((s, it) => s + getPriceForWeight(it.product, it.weight_kg).total, 0)).toFixed(2)}</div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowOrderDialog(false); setBuyItems(null); }}>Cancel</Button>
                <Button className="flex-1" onClick={() => placeOrder()} disabled={orderLoading}>{orderLoading ? 'Placing...' : 'Place Order'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Address Modal (reuse same UI as Menu) */}
        <Dialog open={showAddressModal} onOpenChange={(open) => { setShowAddressModal(open); if (!open) { if (isEditingAddress) { saveAddressNow().catch(() => {}); } setIsEditingAddress(false); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add / Use Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Saved Address (from profile)</label>
                <div className="mt-2">
                  {userProfile?.address ? (
                    (() => {
                      const saved = parseProfileAddress(userProfile.address);
                      const formatted = formatAddressForDisplay(saved);
                      return (
                        <div className="flex items-start justify-between bg-gray-50 p-2 rounded">
                          <div className="text-sm break-words">{formatted || String(userProfile.address)}</div>
                          <div className="flex items-center gap-2">
                            <button className="text-sm text-primary underline" onClick={() => { setAddressDraft(saved); setDeliveryAddress(formatAddressForDisplay(saved)); setShowAddressModal(false); }}>Use</button>
                            <button className="text-sm text-muted-foreground" onClick={() => setIsEditingAddress(true)}>Edit</button>
                            <button className="text-sm text-red-500" onClick={async () => {
                              try {
                                if (!user?.id) return;
                                await supabase.from('user_profiles').update({ address: null }).eq('id', user.id);
                                setAddressDraft({ house_flat: '', location: '', landmark: '' });
                                setDeliveryAddress('');
                                try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                              } catch (err) {
                                console.warn('Failed to remove profile address', err);
                              }
                            }}>Remove</button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-muted-foreground">No saved profile address</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm font-medium">House / Flat No.</label>
                  <Input className="w-full mt-1" value={addressDraft.house_flat} onChange={(e) => setAddressDraft({ ...addressDraft, house_flat: e.target.value })} disabled={!isEditingAddress} />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input className="w-full mt-1" value={addressDraft.location} onChange={(e) => setAddressDraft({ ...addressDraft, location: e.target.value })} disabled={!isEditingAddress} />
                </div>
                <div>
                  <label className="text-sm font-medium">Landmark</label>
                  <Input className="w-full mt-1" value={addressDraft.landmark} onChange={(e) => setAddressDraft({ ...addressDraft, landmark: e.target.value })} disabled={!isEditingAddress} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input id="saveDefault" type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
                <label htmlFor="saveDefault" className="text-sm">Save as default address (also saved to profile)</label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowAddressModal(false); if (isEditingAddress) { saveAddressNow().catch(() => {}); setIsEditingAddress(false); } }}>Cancel</Button>
                <Button onClick={async () => {
                  const formatted = formatAddressForDisplay(addressDraft);
                  setDeliveryAddress(formatted);
                  // ensure any edits are saved
                  if (isEditingAddress) {
                    await saveAddressNow();
                    setIsEditingAddress(false);
                  } else if (saveAsDefault && user?.id) {
                    // if not editing but user wants to save as default, persist
                    try {
                      await supabase.from('user_profiles').update({ address: JSON.stringify(addressDraft) }).eq('id', user.id);
                      try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                    } catch (err) {
                      console.warn('Failed to save address', err);
                    }
                  }
                  setShowAddressModal(false);
                }}>Use Address</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cart Modal */}
        <Dialog open={showCartModal} onOpenChange={setShowCartModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your Cart</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">Cart is empty</div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="flex items-center justify-between border-b py-2">
                    <div>
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-gray-600">{item.quantity}x • {formatWeightDisplay(item.weight_kg)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">₹{getPriceForWeight(item.product, item.weight_kg).total.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              )}

                  {cart.length > 0 && (
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-medium">Total</div>
                        <div className="text-lg font-bold">₹{getTotalAmount().toFixed(2)}</div>
                      </div>
                        <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => { try { localStorage.removeItem('cloudcoop_cart'); setCart([]); window.dispatchEvent(new Event('cart_updated')); } catch(e){} }}>Clear</Button>
                        <Button className="flex-1" onClick={() => { setShowCartModal(false); if (!userProfile?.id) { navigate('/login'); return; } setShowOrderDialog(true); }}>Buy Now</Button>
                      </div>
                    </div>
                  )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Thank You Popup */}
        <Dialog open={showThankYou} onOpenChange={setShowThankYou}>
          <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Order Placed Successfully</DialogTitle>
              <DialogDescription>Your order has been placed and you will receive updates</DialogDescription>
            </DialogHeader>
            <div className="relative z-10 p-8 text-center">
              {/* Success Icon */}
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center animate-scale-in">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>

              {/* Main Message */}
              <h2 className="text-2xl font-bold text-gray-800 mb-2 animate-slide-up">
                Thank You! 🎉
              </h2>
              <p className="text-gray-600 mb-4 animate-slide-up-delay">
                Your order has been placed successfully
              </p>
              
              {/* Tracking Info */}
              <div className="bg-blue-50 rounded-xl p-4 animate-fade-in">
                <p className="text-blue-800 font-medium text-sm mb-1">
                  📱 Track your order status
                </p>
                <p className="text-blue-600 text-xs">
                  • You'll receive WhatsApp updates
                </p>
                <p className="text-blue-600 text-xs">
                  • Check order tracking page for live updates
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />

      {/* Animation Styles */}
      <style>{`
        @keyframes scale-in {
          0% { transform: scale(0) rotate(-180deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        @keyframes slide-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes slide-up-delay {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes fade-in {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }

        .animate-scale-in { animation: scale-in 0.6s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out 0.1s both; }
        .animate-slide-up-delay { animation: slide-up-delay 0.5s ease-out 0.2s both; }
        .animate-fade-in { animation: fade-in 0.5s ease-out 0.3s both; }
      `}</style>
    </div>
  );
};

export default EcommerceMenu;