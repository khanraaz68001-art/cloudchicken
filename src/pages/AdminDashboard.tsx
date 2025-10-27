import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import TrashManagement from "@/components/TrashManagement";

interface Category {
  id: string;
  name: string;
  weight_kg: number;
  rate_per_kg: number;
  is_active: boolean;
}

interface Stock {
  id: string;
  total_weight_kg: number;
  rate_per_kg: number;
  updated_at: string;
}

interface ButcheredMeat {
  id: string;
  category_id: string;
  weight_kg: number;
  status: string;
  butchered_at: string;
  categories: Category;
}

const AdminDashboard = () => {
  const { userProfile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stock, setStock] = useState<Stock | null>(null);
  const [butcheredMeat, setButcheredMeat] = useState<ButcheredMeat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    weight_kg: "",
    rate_per_kg: ""
  });

  // Stock form
  const [stockForm, setStockForm] = useState({
    total_weight_kg: "",
    rate_per_kg: ""
  });

  // Butcher form
  const [butcherForm, setButcherForm] = useState({
    category_id: "",
    weight_kg: ""
  });

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchData();
    }
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch stock
      const { data: stockData } = await supabase
        .from('stock')
        .select('*')
        .single();

      // Fetch butchered meat
      const { data: butcheredData } = await supabase
        .from('butchered_meat')
        .select(`
          *,
          categories (*)
        `)
        .order('butchered_at', { ascending: false });

      setCategories(categoriesData || []);
      setStock(stockData);
      setButcheredMeat(butcheredData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: categoryForm.name,
          weight_kg: parseFloat(categoryForm.weight_kg),
          rate_per_kg: categoryForm.rate_per_kg ? parseFloat(categoryForm.rate_per_kg) : null
        });

      if (error) throw error;

      setCategoryForm({ name: "", weight_kg: "", rate_per_kg: "" });
      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase
        .from('stock')
        .update({
          total_weight_kg: parseFloat(stockForm.total_weight_kg),
          rate_per_kg: parseFloat(stockForm.rate_per_kg)
        })
        .eq('id', stock?.id);

      if (error) throw error;

      setStockForm({ total_weight_kg: "", rate_per_kg: "" });
      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleButcherMeat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase
        .from('butchered_meat')
        .insert({
          category_id: butcherForm.category_id,
          weight_kg: parseFloat(butcherForm.weight_kg)
        });

      if (error) throw error;

      setButcherForm({ category_id: "", weight_kg: "" });
      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Alert variant="destructive">
            <AlertDescription>Access denied. Admin privileges required.</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage stock, categories, and butchered meat</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="stock" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stock">Stock Management</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="butcher">Butcher Meat</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="trash">Waste Management</TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Current Stock</CardTitle>
                  <CardDescription>View current stock levels</CardDescription>
                </CardHeader>
                <CardContent>
                  {stock && (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold">{stock.total_weight_kg} kg</p>
                      <p className="text-sm text-gray-600">Rate: ₹{stock.rate_per_kg}/kg</p>
                      <p className="text-xs text-gray-500">
                        Last updated: {new Date(stock.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Update Stock</CardTitle>
                  <CardDescription>Add new stock or update rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateStock} className="space-y-4">
                    <div>
                      <Label htmlFor="total_weight">Total Weight (kg)</Label>
                      <Input
                        id="total_weight"
                        type="number"
                        step="0.01"
                        value={stockForm.total_weight_kg}
                        onChange={(e) => setStockForm({ ...stockForm, total_weight_kg: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="rate_per_kg">Rate per kg (₹)</Label>
                      <Input
                        id="rate_per_kg"
                        type="number"
                        step="0.01"
                        value={stockForm.rate_per_kg}
                        onChange={(e) => setStockForm({ ...stockForm, rate_per_kg: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Updating..." : "Update Stock"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Category</CardTitle>
                  <CardDescription>Create chicken weight categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateCategory} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Category Name</Label>
                      <Input
                        id="name"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="e.g., Large Chicken (2kg)"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        value={categoryForm.weight_kg}
                        onChange={(e) => setCategoryForm({ ...categoryForm, weight_kg: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="rate">Rate per kg (₹) - Optional</Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.01"
                        value={categoryForm.rate_per_kg}
                        onChange={(e) => setCategoryForm({ ...categoryForm, rate_per_kg: e.target.value })}
                        placeholder="Leave empty to use stock rate"
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Creating..." : "Create Category"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Existing Categories</CardTitle>
                  <CardDescription>Manage chicken categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-gray-600">
                            {category.weight_kg}kg • ₹{category.rate_per_kg || 'Stock rate'}/kg
                          </p>
                        </div>
                        <Badge variant={category.is_active ? "default" : "secondary"}>
                          {category.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="butcher">
            <Card>
              <CardHeader>
                <CardTitle>Butcher Meat</CardTitle>
                <CardDescription>Record butchered chicken from stock</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleButcherMeat} className="space-y-4">
                  <div>
                    <Label htmlFor="category">Select Category</Label>
                    <select
                      id="category"
                      value={butcherForm.category_id}
                      onChange={(e) => setButcherForm({ ...butcherForm, category_id: e.target.value })}
                      className="w-full p-2 border rounded"
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.filter(cat => cat.is_active).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.weight_kg}kg)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="butcher_weight">Weight (kg)</Label>
                    <Input
                      id="butcher_weight"
                      type="number"
                      step="0.01"
                      value={butcherForm.weight_kg}
                      onChange={(e) => setButcherForm({ ...butcherForm, weight_kg: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Recording..." : "Record Butchered Meat"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Butchered Meat Inventory</CardTitle>
                <CardDescription>View all butchered meat items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {butcheredMeat.map((meat) => (
                    <div key={meat.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{meat.categories.name}</p>
                        <p className="text-sm text-gray-600">
                          {meat.weight_kg}kg • Butchered: {new Date(meat.butchered_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={
                          meat.status === 'available' ? 'default' :
                          meat.status === 'packed' ? 'secondary' :
                          meat.status === 'delivered' ? 'outline' : 'destructive'
                        }
                      >
                        {meat.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trash">
            <TrashManagement />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;