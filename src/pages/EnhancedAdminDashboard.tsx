import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAppSetting, setAppSetting } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Plus, Package, Trash2, Upload, Camera, ShoppingCart } from "lucide-react";


interface ProductCategory {
  id: string;
  name: string;
  description?: string;
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
  category_name?: string | null;
  is_available: boolean;
  // product_categories replaced by category_name from view
}

const EnhancedAdminDashboard = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("categories");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supportWhatsApp, setSupportWhatsApp] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportLocation, setSupportLocation] = useState('');
  const [supportLocationEmbed, setSupportLocationEmbed] = useState('');

  // Stock management has been removed — admin focuses on categories and products

  // Product Management State
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState({ name: '', description: '' });
  const [editingProductForm, setEditingProductForm] = useState({ name: '', base_price_per_kg: '', is_available: true, category_id: '' });
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newProduct, setNewProduct] = useState({
    category_id: "",
    name: "",
    description: "",
    base_price_per_kg: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchAllData();
    }
  }, [userProfile]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchProducts()
      ]);
      // load support whatsapp number
      try {
        const support = await getAppSetting('support_whatsapp');
        if (support) setSupportWhatsApp(support);
      } catch (e) {
        console.warn('Failed to load support_whatsapp setting', e);
      }

      try {
        const email = await getAppSetting('support_email');
        if (email) setSupportEmail(email);
      } catch (e) {
        console.warn('Failed to load support_email setting', e);
      }

      try {
        const loc = await getAppSetting('support_location');
        if (loc) setSupportLocation(loc);
      } catch (e) {
        console.warn('Failed to load support_location setting', e);
      }

      try {
        const embed = await getAppSetting('support_location_embed');
        if (embed) setSupportLocationEmbed(embed);
      } catch (e) {
        console.warn('Failed to load support_location_embed setting', e);
      }
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
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    setCategories(data || []);
  };

  const fetchProducts = async () => {
    // Try view first (products_with_image). If it fails or returns no usable image fields,
    // fall back to the base `products` table so the UI still renders.
    try {
      const { data, error } = await supabase
        .from('products_with_image')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!error && data && data.length) {
        setProducts(data || []);
        return;
      }
    } catch (err) {
      console.warn('products_with_image view unavailable, falling back to products table', err);
    }

    // fallback: read from products table (may not include base64 image)
    const { data: pData, error: pErr } = await supabase
      .from('products')
      .select('id, category_id, name, description, base_price_per_kg, image_url, is_available')
      .order('sort_order', { ascending: true });
    if (pErr) throw pErr;
    setProducts(pData || []);
  };


  const addCategory = async () => {
    if (!newCategory.name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('product_categories')
        .insert({
          name: newCategory.name,
          description: newCategory.description || null,
          sort_order: categories.length
        });

      if (error) throw error;

      setSuccess("Category added successfully");
      setNewCategory({ name: "", description: "" });
      setShowAddCategory(false);
      await fetchCategories();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit and delete helpers for categories
  const editCategory = async (category: ProductCategory) => {
    // open modal with existing values
    setEditingCategory(category);
    setEditingCategoryForm({ name: category.name, description: category.description || '' });
  };

  const deleteCategory = async (categoryId: string) => {
    if (!window.confirm('Delete this category? This will not delete products automatically.')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
      setSuccess('Category deleted');
      await fetchCategories();
      await fetchProducts();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveEditedCategory = async () => {
    if (!editingCategory) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('product_categories')
        .update({ name: editingCategoryForm.name, description: editingCategoryForm.description })
        .eq('id', editingCategory.id);
      if (error) throw error;
      setSuccess('Category updated');
      setEditingCategory(null);
      await fetchCategories();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.base_price_per_kg) {
      setError("Please fill all required fields (name and price)");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('products')
        .insert({
          category_id: newProduct.category_id || null,
          name: newProduct.name,
          description: newProduct.description || null,
          base_price_per_kg: parseFloat(newProduct.base_price_per_kg),
          sort_order: products.filter(p => p.category_id === newProduct.category_id).length
        });

      if (error) throw error;

      setSuccess("Product added successfully");
      setNewProduct({ category_id: "", name: "", description: "", base_price_per_kg: "" });
      setShowAddProduct(false);
      await fetchProducts();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const editProduct = async (product: Product) => {
    // open modal with existing values
    setEditingProduct(product);
    setEditingProductForm({
      name: product.name,
      base_price_per_kg: String(product.base_price_per_kg || ''),
      is_available: product.is_available,
      category_id: product.category_id || ''
    });
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      if (error) throw error;
      setSuccess('Product deleted');
      await fetchProducts();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveEditedProduct = async () => {
    if (!editingProduct) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('products')
        .update({
          name: editingProductForm.name,
          base_price_per_kg: parseFloat(editingProductForm.base_price_per_kg || '0'),
          is_available: editingProductForm.is_available,
          category_id: editingProductForm.category_id || null
        })
        .eq('id', editingProduct.id);
      if (error) throw error;
      setSuccess('Product updated');
      setEditingProduct(null);
      await fetchProducts();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (productId: string, file: File) => {
    try {
      setUploadingImage(true);
      // Read file as base64 and call RPC to store image in DB
      const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // result is like "data:<mime>;base64,<data>", strip prefix
          const idx = result.indexOf(',');
          resolve(result.slice(idx + 1));
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const base64 = await toBase64(file);
      const mime = file.type || 'application/octet-stream';

      const { error: rpcError } = await supabase.rpc('upload_product_image', {
        p_product_id: productId,
        p_image_base64: base64,
        p_image_mime: mime
      });

      if (rpcError) {
        throw rpcError;
      }

      setSuccess("Image uploaded successfully");
      await fetchProducts();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const saveSupportSettings = async () => {
    try {
      setLoading(true);
      const ops: Promise<void>[] = [];
      if (supportWhatsApp.trim()) ops.push(setAppSetting('support_whatsapp', supportWhatsApp.trim()));
      if (supportEmail.trim()) ops.push(setAppSetting('support_email', supportEmail.trim()));
  if (supportLocation.trim()) ops.push(setAppSetting('support_location', supportLocation.trim()));
  if (supportLocationEmbed.trim()) ops.push(setAppSetting('support_location_embed', supportLocationEmbed.trim()));

      await Promise.all(ops);
      setSuccess('Support settings saved');
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <AlertDescription>Access denied. Admin privileges required.</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Admin Dashboard</h1>
          <p className="text-gray-600">Manage products and categories</p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Support WhatsApp Number</label>
                <input
                  className="mt-1 block w-full rounded-md border-gray-200 shadow-sm px-3 py-2"
                  placeholder="e.g. 9199XXXXXXXX or +9199XXXXXXXX"
                  value={supportWhatsApp}
                  onChange={(e) => setSupportWhatsApp(e.target.value)}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Support Email</label>
                <input
                  className="mt-1 block w-full rounded-md border-gray-200 shadow-sm px-3 py-2"
                  placeholder="support@yourdomain.com"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Support Location (address)</label>
                <input
                  className="mt-1 block w-full rounded-md border-gray-200 shadow-sm px-3 py-2"
                  placeholder="e.g. 123 MG Road, Bangalore"
                  value={supportLocation}
                  onChange={(e) => setSupportLocation(e.target.value)}
                />
              </div>
            </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Support Location Embed (iframe)</label>
                <Textarea
                  placeholder="Paste Google Maps iframe embed code here"
                  value={supportLocationEmbed}
                  onChange={(e) => setSupportLocationEmbed(e.target.value)}
                  className="mt-1 w-full"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">If provided, clicking the location in the footer will open this embedded map. Admin-only field; paste the full &lt;iframe&gt; HTML from Google Maps.</p>
              </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={saveSupportSettings} disabled={loading}>Save Support Settings</Button>
            </div>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="categories" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Categories
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Products
              </TabsTrigger>
            </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Product Categories</h2>
              <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Category</DialogTitle>
                    <DialogDescription>
                      Create a new product category for organizing your products.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="categoryName">Category Name</Label>
                      <Input
                        id="categoryName"
                        placeholder="e.g., Fresh Whole Chicken"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoryDesc">Description</Label>
                      <Textarea
                        id="categoryDesc"
                        placeholder="Brief description of this category..."
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                      />
                    </div>
                    <Button onClick={addCategory} disabled={loading}>
                      Add Category
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <Card key={category.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {products.filter(p => p.category_id === category.id).length} products
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Dialog open={editingCategory?.id === category.id} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={() => editCategory(category)}>Edit</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Category</DialogTitle>
                            <DialogDescription>Edit category details</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Name</Label>
                              <Input value={editingCategoryForm.name} onChange={(e) => setEditingCategoryForm(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Textarea value={editingCategoryForm.description} onChange={(e) => setEditingCategoryForm(prev => ({ ...prev, description: e.target.value }))} />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={saveEditedCategory} disabled={loading}>Save</Button>
                              <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="destructive" onClick={() => deleteCategory(category.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Products</h2>
              <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>
                      Add a new product to your catalog. Customers will choose quantity.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="productCategory">Category</Label>
                      <Select
                        value={newProduct.category_id}
                        onValueChange={(value) => setNewProduct({ ...newProduct, category_id: value === '__uncategorized' ? '' : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Radix Select requires non-empty values. Use a sentinel and map it to empty string on change. */}
                          <SelectItem value="__uncategorized">Uncategorized</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="productName">Product Name</Label>
                      <Input
                        id="productName"
                        placeholder="e.g., Whole Chicken, Chicken Breast"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="productPrice">Price per KG (₹)</Label>
                      <Input
                        id="productPrice"
                        type="number"
                        step="0.01"
                        placeholder="450.00"
                        value={newProduct.base_price_per_kg}
                        onChange={(e) => setNewProduct({ ...newProduct, base_price_per_kg: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="productDesc">Description</Label>
                      <Textarea
                        id="productDesc"
                        placeholder="Product description..."
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      />
                    </div>
                    <Button onClick={addProduct} disabled={loading}>
                      Add Product
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product.id}>
                  <CardContent className="p-4">
                    <div className="aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                        />
                      ) : product.image_base64 ? (
                        <img
                          src={`data:${product.image_mime};base64,${product.image_base64}`}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                        />
                      ) : (
                        <img src="/placeholder.svg" alt="placeholder" className="w-12 h-12" />
                      )}
                      <label className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50">
                        <Upload className="h-4 w-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(product.id, file);
                          }}
                          disabled={uploadingImage}
                        />
                      </label>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{product.category_name}</p>
                      <p className="text-sm text-gray-700 mb-3">{product.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-green-600">
                          ₹{product.base_price_per_kg}/kg
                        </span>
                        <Badge variant={product.is_available ? "default" : "secondary"}>
                          {product.is_available ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Dialog open={editingProduct?.id === product.id} onOpenChange={(open) => { if (!open) setEditingProduct(null); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => editProduct(product)}>Edit</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Product</DialogTitle>
                              <DialogDescription>Modify product details and price</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Name</Label>
                                <Input value={editingProductForm.name} onChange={(e) => setEditingProductForm(prev => ({ ...prev, name: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Price per KG (₹)</Label>
                                <Input type="number" step="0.01" value={editingProductForm.base_price_per_kg} onChange={(e) => setEditingProductForm(prev => ({ ...prev, base_price_per_kg: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Category</Label>
                                <Select value={editingProductForm.category_id} onValueChange={(val) => setEditingProductForm(prev => ({ ...prev, category_id: val === '__uncategorized' ? '' : val }))}>
                                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                    <SelectContent>
                                      {/* Use sentinel to avoid empty-string values required by Radix Select */}
                                      <SelectItem value="__uncategorized">Uncategorized</SelectItem>
                                      {categories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={editingProductForm.is_available} onChange={(e) => setEditingProductForm(prev => ({ ...prev, is_available: e.target.checked }))} />
                                <span className="text-sm">Available</span>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={saveEditedProduct} disabled={loading}>Save</Button>
                                <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="destructive" onClick={() => deleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default EnhancedAdminDashboard;