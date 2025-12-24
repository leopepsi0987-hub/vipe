// =============================================
// VIPE AI APP TEMPLATES - 10 PRODUCTION-READY APPS
// =============================================

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  pattern: string;
  features: string[];
  files: Array<{
    path: string;
    action: "create";
    content: string;
  }>;
  dbSchema?: string;
}

// =============================================
// 1. FOOD DELIVERY APP (Like UberEats/DoorDash)
// =============================================
export const foodDeliveryTemplate: AppTemplate = {
  id: "food-delivery",
  name: "Food Delivery App",
  description: "Complete food ordering and delivery tracking app",
  keywords: ["food", "delivery", "restaurant", "order", "uber eats", "doordash", "grubhub", "takeout", "takeaway"],
  pattern: "E-COMMERCE + REAL-TIME",
  features: [
    "Restaurant listings with categories",
    "Menu browsing with item details",
    "Shopping cart with quantity management",
    "Order placement and tracking",
    "Delivery address management",
    "Order history",
    "Restaurant search and filters",
    "Favorites/saved restaurants"
  ],
  dbSchema: `
-- Restaurants table
CREATE TABLE public.restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cuisine_type TEXT NOT NULL,
  rating DECIMAL(2,1) DEFAULT 0,
  delivery_time TEXT DEFAULT '30-45 min',
  delivery_fee DECIMAL(10,2) DEFAULT 2.99,
  min_order DECIMAL(10,2) DEFAULT 15.00,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view restaurants" ON public.restaurants FOR SELECT USING (true);

-- Menu items table
CREATE TABLE public.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view menu items" ON public.menu_items FOR SELECT USING (true);

-- Orders table
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id),
  status TEXT DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_instructions TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own orders" ON public.orders FOR ALL USING (auth.uid() = user_id);

-- Order items table
CREATE TABLE public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  special_instructions TEXT
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT 
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));
`,
  files: [
    {
      path: "src/types/food-delivery.ts",
      action: "create",
      content: `export interface Restaurant {
  id: string;
  name: string;
  description: string;
  image_url: string;
  cuisine_type: string;
  rating: number;
  delivery_time: string;
  delivery_fee: number;
  min_order: number;
  is_open: boolean;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  is_available: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
  special_instructions?: string;
}

export interface Order {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered';
  total: number;
  delivery_address: string;
  delivery_instructions?: string;
  estimated_delivery?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  special_instructions?: string;
}`
    },
    {
      path: "src/hooks/useCart.ts",
      action: "create",
      content: `import { useState, useCallback } from 'react';
import type { CartItem, MenuItem } from '@/types/food-delivery';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const addItem = useCallback((item: MenuItem, quantity: number = 1) => {
    if (restaurantId && restaurantId !== item.restaurant_id) {
      if (!confirm('Adding items from a different restaurant will clear your cart. Continue?')) {
        return;
      }
      setItems([]);
    }
    
    setRestaurantId(item.restaurant_id);
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }, [restaurantId]);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, quantity } : i
    ));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantId(null);
  }, []);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    restaurantId,
    subtotal,
    itemCount,
    addItem,
    removeItem,
    updateQuantity,
    clearCart
  };
}`
    },
    {
      path: "src/components/RestaurantCard.tsx",
      action: "create",
      content: `import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, DollarSign } from 'lucide-react';
import type { Restaurant } from '@/types/food-delivery';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: () => void;
}

export function RestaurantCard({ restaurant, onClick }: RestaurantCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden group"
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={restaurant.image_url || '/placeholder.svg'} 
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {!restaurant.is_open && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Badge variant="secondary">Currently Closed</Badge>
          </div>
        )}
        <Badge className="absolute top-3 right-3">{restaurant.cuisine_type}</Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-foreground mb-2">{restaurant.name}</h3>
        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{restaurant.description}</p>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{restaurant.rating}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{restaurant.delivery_time}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="w-4 h-4" />
            <span>\${restaurant.delivery_fee} delivery</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}`
    },
    {
      path: "src/components/MenuItemCard.tsx",
      action: "create",
      content: `import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import type { MenuItem, CartItem } from '@/types/food-delivery';

interface MenuItemCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  onAdd: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

export function MenuItemCard({ item, cartItem, onAdd, onUpdateQuantity }: MenuItemCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        <div className="flex-1 p-4">
          <h4 className="font-medium text-foreground mb-1">{item.name}</h4>
          <p className="text-muted-foreground text-sm line-clamp-2 mb-2">{item.description}</p>
          <p className="text-primary font-semibold">\${item.price.toFixed(2)}</p>
        </div>
        <div className="relative w-32 h-32">
          <img 
            src={item.image_url || '/placeholder.svg'} 
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2">
            {cartItem ? (
              <div className="flex items-center gap-1 bg-primary rounded-full">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary/80"
                  onClick={(e) => { e.stopPropagation(); onUpdateQuantity(cartItem.quantity - 1); }}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-primary-foreground font-medium px-1">{cartItem.quantity}</span>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary/80"
                  onClick={(e) => { e.stopPropagation(); onUpdateQuantity(cartItem.quantity + 1); }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                size="icon" 
                className="rounded-full h-8 w-8"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                disabled={!item.is_available}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}`
    },
    {
      path: "src/components/CartSheet.tsx",
      action: "create",
      content: `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import type { CartItem } from '@/types/food-delivery';

interface CartSheetProps {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
}

export function CartSheet({ items, subtotal, deliveryFee, onUpdateQuantity, onRemove, onCheckout }: CartSheetProps) {
  const total = subtotal + deliveryFee;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="fixed bottom-6 right-6 gap-2 shadow-lg z-50" size="lg">
          <ShoppingCart className="w-5 h-5" />
          <span>\${subtotal.toFixed(2)}</span>
          {items.length > 0 && (
            <span className="bg-primary-foreground text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              {items.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Order</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full mt-4">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Your cart is empty
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto space-y-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <img 
                      src={item.image_url || '/placeholder.svg'} 
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      <p className="text-primary font-semibold">\${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => onRemove(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 space-y-3">
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>\${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>\${deliveryFee.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>\${total.toFixed(2)}</span>
                </div>
                <Button className="w-full" size="lg" onClick={onCheckout}>
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}`
    },
    {
      path: "src/pages/FoodDeliveryApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MapPin, User, History } from 'lucide-react';
import { RestaurantCard } from '@/components/RestaurantCard';
import { MenuItemCard } from '@/components/MenuItemCard';
import { CartSheet } from '@/components/CartSheet';
import { useCart } from '@/hooks/useCart';
import type { Restaurant, MenuItem } from '@/types/food-delivery';

// Demo data - replace with Supabase queries
const demoRestaurants: Restaurant[] = [
  { id: '1', name: 'Bella Italia', description: 'Authentic Italian cuisine with fresh pasta and wood-fired pizzas', image_url: '/placeholder.svg', cuisine_type: 'Italian', rating: 4.8, delivery_time: '25-35 min', delivery_fee: 2.99, min_order: 15, is_open: true },
  { id: '2', name: 'Sushi Master', description: 'Premium Japanese sushi and sashimi, made fresh daily', image_url: '/placeholder.svg', cuisine_type: 'Japanese', rating: 4.9, delivery_time: '30-40 min', delivery_fee: 3.99, min_order: 20, is_open: true },
  { id: '3', name: 'Taco Fiesta', description: 'Mexican street food favorites with homemade salsas', image_url: '/placeholder.svg', cuisine_type: 'Mexican', rating: 4.5, delivery_time: '20-30 min', delivery_fee: 1.99, min_order: 12, is_open: true },
  { id: '4', name: 'Dragon Wok', description: 'Chinese classics from dim sum to Szechuan specialties', image_url: '/placeholder.svg', cuisine_type: 'Chinese', rating: 4.6, delivery_time: '25-35 min', delivery_fee: 2.49, min_order: 15, is_open: false },
];

const demoMenuItems: Record<string, MenuItem[]> = {
  '1': [
    { id: 'm1', restaurant_id: '1', name: 'Margherita Pizza', description: 'Fresh tomatoes, mozzarella, basil', price: 14.99, image_url: '/placeholder.svg', category: 'Pizza', is_available: true },
    { id: 'm2', restaurant_id: '1', name: 'Spaghetti Carbonara', description: 'Creamy egg sauce with pancetta', price: 16.99, image_url: '/placeholder.svg', category: 'Pasta', is_available: true },
    { id: 'm3', restaurant_id: '1', name: 'Tiramisu', description: 'Classic Italian dessert', price: 8.99, image_url: '/placeholder.svg', category: 'Dessert', is_available: true },
  ],
};

const cuisineTypes = ['All', 'Italian', 'Japanese', 'Mexican', 'Chinese', 'Indian', 'Thai'];

export default function FoodDeliveryApp() {
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const { items, subtotal, addItem, removeItem, updateQuantity, clearCart } = useCart();

  const filteredRestaurants = demoRestaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.cuisine_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCuisine = selectedCuisine === 'All' || r.cuisine_type === selectedCuisine;
    return matchesSearch && matchesCuisine;
  });

  const menuItems = selectedRestaurant ? (demoMenuItems[selectedRestaurant.id] || []) : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">🍕</span>
              </div>
              <span className="text-xl font-bold text-foreground">FoodDash</span>
            </div>
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search restaurants or cuisines..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon"><MapPin className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon"><History className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {selectedRestaurant ? (
          <div>
            <Button variant="ghost" className="mb-4" onClick={() => setSelectedRestaurant(null)}>
              ← Back to restaurants
            </Button>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">{selectedRestaurant.name}</h1>
              <p className="text-muted-foreground">{selectedRestaurant.description}</p>
            </div>
            <div className="grid gap-4">
              {menuItems.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  cartItem={items.find(i => i.id === item.id)}
                  onAdd={() => addItem(item)}
                  onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Cuisine filters */}
            <Tabs value={selectedCuisine} onValueChange={setSelectedCuisine} className="mb-6">
              <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
                {cuisineTypes.map(cuisine => (
                  <TabsTrigger 
                    key={cuisine} 
                    value={cuisine}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4"
                  >
                    {cuisine}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Restaurant grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map(restaurant => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  onClick={() => setSelectedRestaurant(restaurant)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Cart button */}
      {items.length > 0 && (
        <CartSheet
          items={items}
          subtotal={subtotal}
          deliveryFee={selectedRestaurant?.delivery_fee || 2.99}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          onCheckout={() => alert('Checkout coming soon!')}
        />
      )}
    </div>
  );
}`
    }
  ]
};

// =============================================
// 2. SOCIAL MEDIA APP (Like Twitter/Instagram)
// =============================================
export const socialMediaTemplate: AppTemplate = {
  id: "social-media",
  name: "Social Media App",
  description: "Complete social network with posts, follows, likes, and comments",
  keywords: ["social", "twitter", "instagram", "facebook", "posts", "feed", "follow", "like", "community", "network"],
  pattern: "SOCIAL NETWORK",
  features: [
    "User profiles with bio and avatar",
    "Create posts with text and images",
    "Like and comment on posts",
    "Follow/unfollow users",
    "Personalized feed",
    "Explore/discover users",
    "Notifications",
    "Direct messages"
  ],
  dbSchema: `
CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users create own" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own" ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.likes FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) NOT NULL,
  following_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.follows FOR ALL USING (auth.uid() = follower_id);
`,
  files: [
    {
      path: "src/types/social.ts",
      action: "create",
      content: `export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  followers_count: number;
  following_count: number;
  created_at: string;
  is_following?: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profile?: Profile;
  is_liked?: boolean;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}`
    },
    {
      path: "src/components/PostCard.tsx",
      action: "create",
      content: `import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import type { Post } from '@/types/social';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onProfileClick: () => void;
}

export function PostCard({ post, onLike, onComment, onShare, onProfileClick }: PostCardProps) {
  return (
    <Card className="border-b border-border hover:bg-muted/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="w-12 h-12 cursor-pointer" onClick={onProfileClick}>
            <AvatarImage src={post.profile?.avatar_url} />
            <AvatarFallback>{post.profile?.display_name?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground cursor-pointer hover:underline" onClick={onProfileClick}>
                {post.profile?.display_name}
              </span>
              <span className="text-muted-foreground">@{post.profile?.username}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-foreground whitespace-pre-wrap mb-3">{post.content}</p>
            {post.image_url && (
              <img 
                src={post.image_url} 
                alt="Post media" 
                className="rounded-xl max-h-96 w-full object-cover mb-3 border border-border"
              />
            )}
            <div className="flex items-center gap-6">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary" onClick={onComment}>
                <MessageCircle className="w-4 h-4" />
                <span>{post.comments_count}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={\`gap-2 \${post.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}\`}
                onClick={onLike}
              >
                <Heart className={\`w-4 h-4 \${post.is_liked ? 'fill-current' : ''}\`} />
                <span>{post.likes_count}</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary" onClick={onShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}`
    },
    {
      path: "src/components/CreatePostForm.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, Smile, MapPin, CalendarDays } from 'lucide-react';

interface CreatePostFormProps {
  avatarUrl?: string;
  displayName?: string;
  onSubmit: (content: string, imageUrl?: string) => void;
}

export function CreatePostForm({ avatarUrl, displayName, onSubmit }: CreatePostFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    await onSubmit(content);
    setContent('');
    setIsSubmitting(false);
  };

  return (
    <Card className="border-b border-border">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>{displayName?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="What's happening?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="border-none resize-none text-lg placeholder:text-muted-foreground focus-visible:ring-0 min-h-[80px] p-0"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-primary h-9 w-9">
                  <Image className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-primary h-9 w-9">
                  <Smile className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-primary h-9 w-9">
                  <MapPin className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-primary h-9 w-9">
                  <CalendarDays className="w-5 h-5" />
                </Button>
              </div>
              <Button 
                onClick={handleSubmit} 
                disabled={!content.trim() || isSubmitting}
                className="rounded-full px-5"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}`
    },
    {
      path: "src/pages/SocialMediaApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, Search, Bell, Mail, User, Settings, Feather } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { CreatePostForm } from '@/components/CreatePostForm';
import type { Post, Profile } from '@/types/social';

// Demo data
const demoProfile: Profile = {
  id: '1', user_id: '1', username: 'johndoe', display_name: 'John Doe',
  bio: 'Building cool stuff', avatar_url: '/placeholder.svg',
  followers_count: 1234, following_count: 567, created_at: new Date().toISOString()
};

const demoPosts: Post[] = [
  {
    id: '1', user_id: '1', content: 'Just launched my new project! 🚀 Check it out and let me know what you think. Been working on this for months and finally ready to share.',
    likes_count: 42, comments_count: 8, created_at: new Date(Date.now() - 3600000).toISOString(),
    profile: demoProfile, is_liked: false
  },
  {
    id: '2', user_id: '2', content: 'Beautiful sunset today! 🌅', image_url: '/placeholder.svg',
    likes_count: 128, comments_count: 24, created_at: new Date(Date.now() - 7200000).toISOString(),
    profile: { ...demoProfile, id: '2', username: 'janedoe', display_name: 'Jane Doe' }, is_liked: true
  },
];

const navItems = [
  { icon: Home, label: 'Home', active: true },
  { icon: Search, label: 'Explore' },
  { icon: Bell, label: 'Notifications' },
  { icon: Mail, label: 'Messages' },
  { icon: User, label: 'Profile' },
  { icon: Settings, label: 'Settings' },
];

export default function SocialMediaApp() {
  const [posts, setPosts] = useState(demoPosts);
  const [activeTab, setActiveTab] = useState('for-you');

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p
    ));
  };

  const handlePost = (content: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
      user_id: '1',
      content,
      likes_count: 0,
      comments_count: 0,
      created_at: new Date().toISOString(),
      profile: demoProfile,
      is_liked: false
    };
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 p-4 border-r border-border">
          <div className="text-2xl font-bold text-primary mb-8 px-3">SocialApp</div>
          <nav className="flex-1 space-y-1">
            {navItems.map(({ icon: Icon, label, active }) => (
              <Button 
                key={label} 
                variant="ghost" 
                className={\`w-full justify-start gap-4 text-lg \${active ? 'font-bold' : ''}\`}
              >
                <Icon className="w-6 h-6" />
                {label}
              </Button>
            ))}
          </nav>
          <Button size="lg" className="gap-2 rounded-full">
            <Feather className="w-5 h-5" />
            Post
          </Button>
          <div className="flex items-center gap-3 mt-4 p-3 rounded-full hover:bg-muted cursor-pointer">
            <Avatar>
              <AvatarImage src={demoProfile.avatar_url} />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{demoProfile.display_name}</p>
              <p className="text-muted-foreground text-sm truncate">@{demoProfile.username}</p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 border-r border-border min-h-screen max-w-2xl">
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
            <h1 className="text-xl font-bold text-foreground mb-4">Home</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full bg-transparent p-0 h-auto">
                <TabsTrigger value="for-you" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3">
                  For you
                </TabsTrigger>
                <TabsTrigger value="following" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3">
                  Following
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </header>
          
          <CreatePostForm 
            avatarUrl={demoProfile.avatar_url}
            displayName={demoProfile.display_name}
            onSubmit={handlePost}
          />
          
          <div className="divide-y divide-border">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => handleLike(post.id)}
                onComment={() => {}}
                onShare={() => {}}
                onProfileClick={() => {}}
              />
            ))}
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="hidden xl:block w-80 p-4 sticky top-0 h-screen">
          <div className="bg-muted rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-lg mb-4">Who to follow</h3>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Avatar>
                  <AvatarFallback>U{i}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">User {i}</p>
                  <p className="text-muted-foreground text-sm">@user{i}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full">Follow</Button>
              </div>
            ))}
          </div>
          <div className="bg-muted rounded-2xl p-4">
            <h3 className="font-bold text-lg mb-4">Trending</h3>
            {['#Technology', '#Design', '#Startup'].map(tag => (
              <div key={tag} className="py-2 cursor-pointer hover:bg-background/50 rounded px-2 -mx-2">
                <p className="text-muted-foreground text-xs">Trending</p>
                <p className="font-semibold">{tag}</p>
                <p className="text-muted-foreground text-xs">12.4K posts</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 3. E-COMMERCE / SHOPPING APP
// =============================================
export const ecommerceTemplate: AppTemplate = {
  id: "ecommerce",
  name: "E-Commerce Store",
  description: "Full online shopping experience with cart, checkout, and orders",
  keywords: ["shop", "store", "ecommerce", "shopping", "buy", "sell", "products", "cart", "checkout", "amazon", "shopify"],
  pattern: "E-COMMERCE",
  features: [
    "Product catalog with categories",
    "Product details with images",
    "Shopping cart",
    "Wishlist/favorites",
    "Checkout flow",
    "Order tracking",
    "Product search and filters",
    "Reviews and ratings"
  ],
  dbSchema: `
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  image_url TEXT,
  images TEXT[],
  category TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

CREATE TABLE public.cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR ALL USING (auth.uid() = user_id);
`,
  files: [
    {
      path: "src/types/ecommerce.ts",
      action: "create",
      content: `export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  compare_at_price?: number;
  image_url: string;
  images?: string[];
  category: string;
  stock: number;
  rating: number;
  reviews_count: number;
  is_featured: boolean;
}

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shipping_address?: ShippingAddress;
  created_at: string;
}

export interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}`
    },
    {
      path: "src/components/ProductCard.tsx",
      action: "create",
      content: `import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import type { Product } from '@/types/ecommerce';

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
  onViewDetails: () => void;
  onToggleWishlist: () => void;
  isInWishlist?: boolean;
}

export function ProductCard({ product, onAddToCart, onViewDetails, onToggleWishlist, isInWishlist }: ProductCardProps) {
  const discount = product.compare_at_price 
    ? Math.round((1 - product.price / product.compare_at_price) * 100) 
    : 0;

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img 
          src={product.image_url || '/placeholder.svg'} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
          onClick={onViewDetails}
        />
        {discount > 0 && (
          <Badge className="absolute top-3 left-3 bg-destructive">{discount}% OFF</Badge>
        )}
        {product.is_featured && (
          <Badge className="absolute top-3 right-12 bg-primary">Featured</Badge>
        )}
        <Button 
          size="icon" 
          variant="secondary" 
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onToggleWishlist}
        >
          <Heart className={\`w-4 h-4 \${isInWishlist ? 'fill-red-500 text-red-500' : ''}\`} />
        </Button>
        <Button 
          className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity gap-2"
          onClick={onAddToCart}
          disabled={product.stock === 0}
        >
          <ShoppingCart className="w-4 h-4" />
          {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </div>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{product.category}</p>
        <h3 
          className="font-medium text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors mb-2"
          onClick={onViewDetails}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{product.rating}</span>
          </div>
          <span className="text-muted-foreground text-sm">({product.reviews_count})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">\${product.price.toFixed(2)}</span>
          {product.compare_at_price && (
            <span className="text-muted-foreground line-through text-sm">\${product.compare_at_price.toFixed(2)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}`
    },
    {
      path: "src/pages/EcommerceApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Search, ShoppingCart, Heart, User, Menu, Minus, Plus, Trash2 } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import type { Product, CartItem } from '@/types/ecommerce';

// Demo data
const demoProducts: Product[] = [
  { id: '1', name: 'Wireless Bluetooth Headphones', description: 'Premium sound quality with noise cancellation', price: 79.99, compare_at_price: 129.99, image_url: '/placeholder.svg', category: 'Electronics', stock: 50, rating: 4.8, reviews_count: 234, is_featured: true },
  { id: '2', name: 'Minimalist Watch', description: 'Elegant timepiece with leather strap', price: 149.00, image_url: '/placeholder.svg', category: 'Accessories', stock: 25, rating: 4.6, reviews_count: 89, is_featured: false },
  { id: '3', name: 'Running Shoes', description: 'Lightweight and comfortable for daily runs', price: 89.99, compare_at_price: 119.99, image_url: '/placeholder.svg', category: 'Footwear', stock: 100, rating: 4.7, reviews_count: 456, is_featured: true },
  { id: '4', name: 'Cotton T-Shirt', description: '100% organic cotton, available in multiple colors', price: 29.99, image_url: '/placeholder.svg', category: 'Clothing', stock: 200, rating: 4.5, reviews_count: 178, is_featured: false },
  { id: '5', name: 'Smart Fitness Tracker', description: 'Track your health and fitness goals', price: 59.99, compare_at_price: 89.99, image_url: '/placeholder.svg', category: 'Electronics', stock: 75, rating: 4.4, reviews_count: 312, is_featured: true },
  { id: '6', name: 'Leather Wallet', description: 'Genuine leather with RFID protection', price: 45.00, image_url: '/placeholder.svg', category: 'Accessories', stock: 60, rating: 4.9, reviews_count: 67, is_featured: false },
];

const categories = ['All', 'Electronics', 'Clothing', 'Footwear', 'Accessories'];

export default function EcommerceApp() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const filteredProducts = demoProducts.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now().toString(), product_id: product.id, quantity: 1, product }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : i;
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const cartTotal = cart.reduce((sum, i) => sum + (i.product?.price || 0) * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden"><Menu /></Button>
              <span className="text-2xl font-bold text-primary">ShopNow</span>
            </div>
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search products..." 
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{wishlist.length}</Badge>
                )}
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cartCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{cartCount}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Shopping Cart ({cartCount})</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col h-full mt-4">
                    {cart.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">Your cart is empty</div>
                    ) : (
                      <>
                        <div className="flex-1 overflow-auto space-y-4">
                          {cart.map(item => (
                            <div key={item.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                              <img src={item.product?.image_url || '/placeholder.svg'} alt="" className="w-20 h-20 object-cover rounded" />
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.product?.name}</h4>
                                <p className="text-primary font-semibold">\${item.product?.price.toFixed(2)}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}><Minus className="w-3 h-3" /></Button>
                                  <span className="w-8 text-center">{item.quantity}</span>
                                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}><Plus className="w-3 h-3" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive ml-auto" onClick={() => removeFromCart(item.id)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="pt-4 border-t border-border space-y-4">
                          <div className="flex justify-between text-lg font-semibold">
                            <span>Total</span>
                            <span>\${cartTotal.toFixed(2)}</span>
                          </div>
                          <Button className="w-full" size="lg">Checkout</Button>
                        </div>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Categories */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
          <TabsList className="bg-transparent p-0 h-auto flex-wrap gap-2">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Products grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={() => addToCart(product)}
              onViewDetails={() => {}}
              onToggleWishlist={() => toggleWishlist(product.id)}
              isInWishlist={wishlist.includes(product.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 4. TODO / TASK MANAGEMENT APP
// =============================================
export const todoTemplate: AppTemplate = {
  id: "todo",
  name: "Task Management App",
  description: "Complete todo app with projects, priorities, and due dates",
  keywords: ["todo", "task", "tasks", "list", "productivity", "notes", "reminder", "project management", "kanban"],
  pattern: "CRUD + ORGANIZATION",
  features: [
    "Create, edit, delete tasks",
    "Mark tasks complete/incomplete",
    "Priority levels (low, medium, high)",
    "Due dates with reminders",
    "Categories/projects",
    "Search and filter",
    "Drag and drop reordering",
    "Progress tracking"
  ],
  dbSchema: `
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  category TEXT DEFAULT 'inbox',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);
`,
  files: [
    {
      path: "src/types/todo.ts",
      action: "create",
      content: `export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  category: string;
  position: number;
  created_at: string;
  completed_at?: string;
}

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'completed';
export type TaskSort = 'created' | 'due_date' | 'priority' | 'title';`
    },
    {
      path: "src/components/TaskItem.tsx",
      action: "create",
      content: `import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flag, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Task } from '@/types/todo';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const priorityColors = {
  low: 'text-blue-500',
  medium: 'text-yellow-500',
  high: 'text-red-500'
};

export function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const getDueDateText = () => {
    if (!task.due_date) return null;
    const date = new Date(task.due_date);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !task.is_completed;

  return (
    <div className={\`group flex items-start gap-3 p-4 rounded-lg hover:bg-muted/50 transition-colors \${task.is_completed ? 'opacity-60' : ''}\`}>
      <Checkbox 
        checked={task.is_completed} 
        onCheckedChange={onToggle}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <p className={\`font-medium \${task.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}\`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          {task.due_date && (
            <div className={\`flex items-center gap-1 text-xs \${isOverdue ? 'text-destructive' : 'text-muted-foreground'}\`}>
              <Calendar className="w-3 h-3" />
              {getDueDateText()}
            </div>
          )}
          <div className={\`flex items-center gap-1 text-xs \${priorityColors[task.priority]}\`}>
            <Flag className="w-3 h-3" />
            {task.priority}
          </div>
          {task.category !== 'inbox' && (
            <Badge variant="secondary" className="text-xs">{task.category}</Badge>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}`
    },
    {
      path: "src/pages/TodoApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Plus, Inbox, Calendar, CalendarDays, CheckCircle2, Search, ListFilter } from 'lucide-react';
import { TaskItem } from '@/components/TaskItem';
import type { Task, TaskFilter } from '@/types/todo';
import { isToday, isFuture, parseISO } from 'date-fns';

// Demo data
const demoTasks: Task[] = [
  { id: '1', user_id: '1', title: 'Complete project proposal', description: 'Draft the Q1 project proposal for the marketing team', is_completed: false, priority: 'high', due_date: new Date().toISOString().split('T')[0], category: 'Work', position: 0, created_at: new Date().toISOString() },
  { id: '2', user_id: '1', title: 'Buy groceries', is_completed: false, priority: 'medium', category: 'Personal', position: 1, created_at: new Date().toISOString() },
  { id: '3', user_id: '1', title: 'Review code changes', is_completed: true, priority: 'medium', category: 'Work', position: 2, created_at: new Date().toISOString(), completed_at: new Date().toISOString() },
  { id: '4', user_id: '1', title: 'Schedule dentist appointment', is_completed: false, priority: 'low', due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], category: 'Personal', position: 3, created_at: new Date().toISOString() },
];

const filters = [
  { id: 'all', label: 'All Tasks', icon: Inbox },
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
];

export default function TodoApp() {
  const [tasks, setTasks] = useState(demoTasks);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    switch (activeFilter) {
      case 'today': return matchesSearch && task.due_date && isToday(parseISO(task.due_date)) && !task.is_completed;
      case 'upcoming': return matchesSearch && task.due_date && isFuture(parseISO(task.due_date)) && !task.is_completed;
      case 'completed': return matchesSearch && task.is_completed;
      default: return matchesSearch && !task.is_completed;
    }
  });

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      user_id: '1',
      title: newTaskTitle,
      is_completed: false,
      priority: 'medium',
      category: 'inbox',
      position: tasks.length,
      created_at: new Date().toISOString()
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, is_completed: !t.is_completed, completed_at: !t.is_completed ? new Date().toISOString() : undefined } : t
    ));
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <div className="grid lg:grid-cols-[280px,1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">TaskFlow</h1>
              <p className="text-muted-foreground text-sm">Stay organized, get more done</p>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{completedCount} of {tasks.length} completed</p>
              </CardContent>
            </Card>

            <nav className="space-y-1">
              {filters.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={activeFilter === id ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveFilter(id as TaskFilter)}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <span className="ml-auto text-muted-foreground text-sm">
                    {id === 'all' ? tasks.filter(t => !t.is_completed).length : 
                     id === 'completed' ? completedCount : 
                     tasks.filter(t => {
                       if (id === 'today') return t.due_date && isToday(parseISO(t.due_date)) && !t.is_completed;
                       if (id === 'upcoming') return t.due_date && isFuture(parseISO(t.due_date)) && !t.is_completed;
                       return false;
                     }).length}
                  </span>
                </Button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="space-y-6">
            {/* Search and add */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search tasks..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon"><ListFilter className="w-4 h-4" /></Button>
            </div>

            {/* Add task */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Input 
                    placeholder="Add a new task..." 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    className="flex-1"
                  />
                  <Button onClick={addTask} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Task list */}
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks found</p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTask(task.id)}
                      onEdit={() => {}}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 5. CHAT / MESSAGING APP
// =============================================
export const chatTemplate: AppTemplate = {
  id: "chat",
  name: "Chat / Messaging App",
  description: "Real-time messaging with conversations and contacts",
  keywords: ["chat", "messaging", "message", "inbox", "conversation", "whatsapp", "telegram", "slack", "dm", "direct message"],
  pattern: "REAL-TIME CHAT",
  features: [
    "Contact/conversation list",
    "Real-time messaging",
    "Message status (sent, delivered, read)",
    "Typing indicators",
    "File/image sharing",
    "Group chats",
    "Online status",
    "Search messages"
  ],
  dbSchema: `
CREATE TABLE public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_group BOOLEAN DEFAULT false,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own conversations" ON public.conversation_participants FOR SELECT 
  USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users send messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
`,
  files: [
    {
      path: "src/types/chat.ts",
      action: "create",
      content: `export interface Conversation {
  id: string;
  is_group: boolean;
  name?: string;
  created_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  is_read: boolean;
  created_at: string;
  sender?: UserProfile;
}`
    },
    {
      path: "src/components/ConversationItem.tsx",
      action: "create",
      content: `import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Conversation } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const otherParticipant = conversation.participants?.[0]?.profile;
  const displayName = conversation.is_group ? conversation.name : otherParticipant?.display_name || 'Unknown';
  const avatarUrl = conversation.is_group ? undefined : otherParticipant?.avatar_url;
  const isOnline = !conversation.is_group && otherParticipant?.is_online;

  return (
    <div 
      className={\`flex items-center gap-3 p-3 cursor-pointer rounded-lg transition-colors \${isActive ? 'bg-primary/10' : 'hover:bg-muted'}\`}
      onClick={onClick}
    >
      <div className="relative">
        <Avatar>
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground truncate">{displayName}</span>
          {conversation.last_message && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(conversation.last_message.created_at), { addSuffix: false })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground truncate">
            {conversation.last_message?.content || 'No messages yet'}
          </p>
          {conversation.unread_count && conversation.unread_count > 0 && (
            <Badge className="ml-2 h-5 min-w-5 p-0 flex items-center justify-center text-xs">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}`
    },
    {
      path: "src/components/MessageBubble.tsx",
      action: "create",
      content: `import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message } from '@/types/chat';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
}

export function MessageBubble({ message, isOwn, showAvatar = true }: MessageBubbleProps) {
  return (
    <div className={\`flex gap-2 \${isOwn ? 'flex-row-reverse' : ''}\`}>
      {showAvatar && !isOwn && (
        <Avatar className="w-8 h-8 mt-auto">
          <AvatarImage src={message.sender?.avatar_url} />
          <AvatarFallback>{message.sender?.display_name?.[0] || '?'}</AvatarFallback>
        </Avatar>
      )}
      {showAvatar && isOwn && <div className="w-8" />}
      <div className={\`max-w-[70%] \${isOwn ? 'items-end' : 'items-start'}\`}>
        <div className={\`px-4 py-2 rounded-2xl \${
          isOwn 
            ? 'bg-primary text-primary-foreground rounded-br-sm' 
            : 'bg-muted text-foreground rounded-bl-sm'
        }\`}>
          {message.message_type === 'image' ? (
            <img src={message.content} alt="Shared" className="rounded-lg max-w-full" />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <div className={\`flex items-center gap-1 mt-1 \${isOwn ? 'justify-end' : ''}\`}>
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          {isOwn && (
            message.is_read 
              ? <CheckCheck className="w-3 h-3 text-primary" />
              : <Check className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}`
    },
    {
      path: "src/pages/ChatApp.tsx",
      action: "create",
      content: `import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, Paperclip, Smile, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';
import { ConversationItem } from '@/components/ConversationItem';
import { MessageBubble } from '@/components/MessageBubble';
import type { Conversation, Message, UserProfile } from '@/types/chat';

// Demo data
const currentUser: UserProfile = { id: '1', user_id: '1', display_name: 'You', is_online: true };

const demoConversations: Conversation[] = [
  { id: '1', is_group: false, created_at: new Date().toISOString(), 
    participants: [{ id: '1', conversation_id: '1', user_id: '2', joined_at: new Date().toISOString(), 
      profile: { id: '2', user_id: '2', display_name: 'Alice Johnson', avatar_url: '/placeholder.svg', is_online: true } }],
    last_message: { id: '1', conversation_id: '1', sender_id: '2', content: 'Hey! How are you?', message_type: 'text', is_read: false, created_at: new Date(Date.now() - 300000).toISOString() },
    unread_count: 2 },
  { id: '2', is_group: false, created_at: new Date().toISOString(),
    participants: [{ id: '2', conversation_id: '2', user_id: '3', joined_at: new Date().toISOString(),
      profile: { id: '3', user_id: '3', display_name: 'Bob Smith', avatar_url: '/placeholder.svg', is_online: false, last_seen: new Date(Date.now() - 3600000).toISOString() } }],
    last_message: { id: '2', conversation_id: '2', sender_id: '1', content: 'See you tomorrow!', message_type: 'text', is_read: true, created_at: new Date(Date.now() - 7200000).toISOString() } },
  { id: '3', is_group: true, name: 'Team Project', created_at: new Date().toISOString(),
    last_message: { id: '3', conversation_id: '3', sender_id: '4', content: 'Meeting at 3pm', message_type: 'text', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() } },
];

const demoMessages: Record<string, Message[]> = {
  '1': [
    { id: 'm1', conversation_id: '1', sender_id: '2', content: 'Hi there! 👋', message_type: 'text', is_read: true, created_at: new Date(Date.now() - 600000).toISOString(), sender: demoConversations[0].participants?.[0].profile },
    { id: 'm2', conversation_id: '1', sender_id: '1', content: 'Hey Alice! Great to hear from you', message_type: 'text', is_read: true, created_at: new Date(Date.now() - 500000).toISOString(), sender: currentUser },
    { id: 'm3', conversation_id: '1', sender_id: '2', content: 'Hey! How are you?', message_type: 'text', is_read: false, created_at: new Date(Date.now() - 300000).toISOString(), sender: demoConversations[0].participants?.[0].profile },
  ],
};

export default function ChatApp() {
  const [conversations] = useState(demoConversations);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeConversation) {
      setMessages(demoMessages[activeConversation.id] || []);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeConversation) return;
    const message: Message = {
      id: Date.now().toString(),
      conversation_id: activeConversation.id,
      sender_id: '1',
      content: newMessage,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
      sender: currentUser
    };
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const otherParticipant = activeConversation?.participants?.[0]?.profile;

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className={\`w-full md:w-80 border-r border-border flex flex-col \${activeConversation ? 'hidden md:flex' : ''}\`}>
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search conversations..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {conversations.filter(c => {
              const name = c.is_group ? c.name : c.participants?.[0]?.profile?.display_name;
              return name?.toLowerCase().includes(searchQuery.toLowerCase());
            }).map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={activeConversation?.id === conv.id}
                onClick={() => setActiveConversation(conv)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={\`flex-1 flex flex-col \${!activeConversation ? 'hidden md:flex' : ''}\`}>
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveConversation(null)}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar>
                  <AvatarImage src={otherParticipant?.avatar_url} />
                  <AvatarFallback>{(activeConversation.name || otherParticipant?.display_name)?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{activeConversation.name || otherParticipant?.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {otherParticipant?.is_online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon"><Phone className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon"><Video className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5" /></Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.sender_id === '1'}
                    showAvatar={i === 0 || messages[i - 1]?.sender_id !== msg.sender_id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon"><Paperclip className="w-5 h-5" /></Button>
                <Input 
                  placeholder="Type a message..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon"><Smile className="w-5 h-5" /></Button>
                <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 6. FITNESS / WORKOUT TRACKER
// =============================================
export const fitnessTemplate: AppTemplate = {
  id: "fitness",
  name: "Fitness Tracker App",
  description: "Track workouts, exercises, and fitness progress",
  keywords: ["fitness", "workout", "gym", "exercise", "health", "training", "weight", "running", "calories", "tracker"],
  pattern: "TRACKING + ANALYTICS",
  features: [
    "Workout logging",
    "Exercise library",
    "Progress tracking",
    "Statistics and charts",
    "Goal setting",
    "Workout history",
    "Personal records",
    "Body measurements"
  ],
  dbSchema: `
CREATE TABLE public.workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  duration_minutes INTEGER,
  calories_burned INTEGER,
  notes TEXT,
  workout_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight DECIMAL(10,2),
  duration_seconds INTEGER,
  notes TEXT
);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own exercises" ON public.exercises FOR ALL
  USING (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()));
`,
  files: [
    {
      path: "src/types/fitness.ts",
      action: "create",
      content: `export interface Workout {
  id: string;
  user_id: string;
  name: string;
  duration_minutes?: number;
  calories_burned?: number;
  notes?: string;
  workout_date: string;
  created_at: string;
  exercises?: Exercise[];
}

export interface Exercise {
  id: string;
  workout_id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration_seconds?: number;
  notes?: string;
}

export interface WorkoutStats {
  total_workouts: number;
  total_duration: number;
  total_calories: number;
  this_week: number;
  streak: number;
}`
    },
    {
      path: "src/pages/FitnessApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Dumbbell, Flame, Clock, Trophy, Plus, Calendar, TrendingUp, Target, Zap } from 'lucide-react';
import type { Workout, WorkoutStats } from '@/types/fitness';
import { format, startOfWeek, addDays } from 'date-fns';

// Demo data
const demoWorkouts: Workout[] = [
  { id: '1', user_id: '1', name: 'Upper Body', duration_minutes: 45, calories_burned: 320, workout_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString(),
    exercises: [
      { id: 'e1', workout_id: '1', name: 'Bench Press', sets: 4, reps: 10, weight: 135 },
      { id: 'e2', workout_id: '1', name: 'Shoulder Press', sets: 3, reps: 12, weight: 95 },
      { id: 'e3', workout_id: '1', name: 'Pull-ups', sets: 3, reps: 8 },
    ]},
  { id: '2', user_id: '1', name: 'Cardio', duration_minutes: 30, calories_burned: 280, workout_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], created_at: new Date().toISOString() },
  { id: '3', user_id: '1', name: 'Leg Day', duration_minutes: 55, calories_burned: 400, workout_date: new Date(Date.now() - 172800000).toISOString().split('T')[0], created_at: new Date().toISOString() },
];

const demoStats: WorkoutStats = {
  total_workouts: 47,
  total_duration: 2115,
  total_calories: 15680,
  this_week: 4,
  streak: 5
};

const weeklyGoal = 5;

export default function FitnessApp() {
  const [workouts] = useState(demoWorkouts);
  const [stats] = useState(demoStats);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const weekProgress = (stats.this_week / weeklyGoal) * 100;
  const weekStart = startOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const workoutDates = new Set(workouts.map(w => w.workout_date));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">FitTrack</h1>
            <p className="text-muted-foreground">Your personal fitness companion</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Log Workout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log New Workout</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Workout Name</Label>
                  <Input placeholder="e.g., Upper Body, Cardio" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" placeholder="45" />
                  </div>
                  <div className="space-y-2">
                    <Label>Calories</Label>
                    <Input type="number" placeholder="300" />
                  </div>
                </div>
                <Button className="w-full">Save Workout</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Dumbbell className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Workouts</p>
                  <p className="text-2xl font-bold">{stats.total_workouts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Calories Burned</p>
                  <p className="text-2xl font-bold">{stats.total_calories.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{Math.round(stats.total_duration / 60)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-xl">
                  <Zap className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Streak</p>
                  <p className="text-2xl font-bold">{stats.streak} days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Weekly progress */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Weekly Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{stats.this_week} of {weeklyGoal} workouts</span>
                  <span className="font-medium">{Math.round(weekProgress)}%</span>
                </div>
                <Progress value={weekProgress} className="h-3" />
              </div>
              <div className="flex justify-between">
                {weekDays.map((day, i) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const hasWorkout = workoutDates.has(dateStr);
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div key={i} className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">{format(day, 'EEE')}</p>
                      <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium \${
                        hasWorkout ? 'bg-primary text-primary-foreground' : 
                        isToday ? 'border-2 border-primary text-foreground' : 
                        'bg-muted text-muted-foreground'
                      }\`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Personal Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Bench Press</span>
                <Badge variant="secondary">185 lbs</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Squat</span>
                <Badge variant="secondary">225 lbs</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Deadlift</span>
                <Badge variant="secondary">275 lbs</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">5K Run</span>
                <Badge variant="secondary">24:30</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent workouts */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workouts.map(workout => (
                <div 
                  key={workout.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedWorkout(workout)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{workout.name}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(workout.workout_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{workout.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>{workout.calories_burned} cal</span>
                    </div>
                    <Badge variant="outline">{workout.exercises?.length || 0} exercises</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 7. BLOG / CMS APP
// =============================================
export const blogTemplate: AppTemplate = {
  id: "blog",
  name: "Blog / CMS",
  description: "Content management system with articles and categories",
  keywords: ["blog", "cms", "content", "articles", "posts", "writing", "medium", "wordpress", "publishing"],
  pattern: "CONTENT MANAGEMENT",
  features: [
    "Article creation with rich text",
    "Categories and tags",
    "Featured images",
    "Draft and publish workflow",
    "Author profiles",
    "Comments",
    "Search and filtering",
    "Reading time estimate"
  ],
  dbSchema: `
CREATE TABLE public.articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  excerpt TEXT,
  cover_image TEXT,
  category TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'draft',
  reading_time INTEGER DEFAULT 5,
  views_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published" ON public.articles FOR SELECT USING (status = 'published');
CREATE POLICY "Authors CRUD own" ON public.articles FOR ALL USING (auth.uid() = user_id);
`,
  files: [
    {
      path: "src/types/blog.ts",
      action: "create",
      content: `export interface Article {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  cover_image?: string;
  category: string;
  tags: string[];
  status: 'draft' | 'published';
  reading_time: number;
  views_count: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
  author?: Author;
}

export interface Author {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
}`
    },
    {
      path: "src/pages/BlogApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Clock, Eye, ArrowRight, Bookmark, Share2, TrendingUp } from 'lucide-react';
import type { Article } from '@/types/blog';
import { format } from 'date-fns';

// Demo data
const demoArticles: Article[] = [
  {
    id: '1', user_id: '1', title: 'The Future of Web Development in 2024', slug: 'future-web-dev-2024',
    content: 'Lorem ipsum...', excerpt: 'Exploring the trends and technologies shaping the future of web development, from AI-powered tools to edge computing.',
    cover_image: '/placeholder.svg', category: 'Technology', tags: ['web', 'development', 'trends'],
    status: 'published', reading_time: 8, views_count: 1234, published_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    author: { id: '1', display_name: 'John Doe', avatar_url: '/placeholder.svg', bio: 'Tech writer & developer' }
  },
  {
    id: '2', user_id: '1', title: 'Building Scalable Applications with React', slug: 'scalable-react-apps',
    content: 'Lorem ipsum...', excerpt: 'Best practices and patterns for building large-scale React applications that are maintainable and performant.',
    cover_image: '/placeholder.svg', category: 'Development', tags: ['react', 'javascript', 'architecture'],
    status: 'published', reading_time: 12, views_count: 856, published_at: new Date(Date.now() - 172800000).toISOString(),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    author: { id: '1', display_name: 'John Doe', avatar_url: '/placeholder.svg' }
  },
  {
    id: '3', user_id: '2', title: 'A Complete Guide to TypeScript', slug: 'typescript-guide',
    content: 'Lorem ipsum...', excerpt: 'Everything you need to know to get started with TypeScript and write safer, more maintainable code.',
    cover_image: '/placeholder.svg', category: 'Development', tags: ['typescript', 'javascript', 'tutorial'],
    status: 'published', reading_time: 15, views_count: 2341, published_at: new Date(Date.now() - 259200000).toISOString(),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    author: { id: '2', display_name: 'Jane Smith', avatar_url: '/placeholder.svg' }
  },
];

const categories = ['All', 'Technology', 'Development', 'Design', 'Business'];

export default function BlogApp() {
  const [articles] = useState(demoArticles);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = articles.filter(a => {
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredArticle = articles[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-primary">BlogHub</span>
            <div className="hidden md:flex items-center gap-6">
              {['Home', 'Articles', 'About', 'Contact'].map(item => (
                <a key={item} href="#" className="text-muted-foreground hover:text-foreground transition-colors">{item}</a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-10 w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button>Subscribe</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Featured article */}
        <Card className="mb-12 overflow-hidden">
          <div className="grid md:grid-cols-2">
            <img src={featuredArticle.cover_image} alt="" className="h-64 md:h-full w-full object-cover" />
            <CardContent className="p-8 flex flex-col justify-center">
              <Badge className="w-fit mb-4">{featuredArticle.category}</Badge>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{featuredArticle.title}</h1>
              <p className="text-muted-foreground mb-6">{featuredArticle.excerpt}</p>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={featuredArticle.author?.avatar_url} />
                  <AvatarFallback>{featuredArticle.author?.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{featuredArticle.author?.display_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{format(new Date(featuredArticle.published_at!), 'MMM d, yyyy')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{featuredArticle.reading_time} min read</span>
                  </div>
                </div>
              </div>
              <Button className="gap-2 w-fit">
                Read Article <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </div>
        </Card>

        {/* Categories */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
          <TabsList className="bg-transparent p-0 h-auto flex-wrap gap-2">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Articles grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.slice(1).map(article => (
            <Card key={article.id} className="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={article.cover_image} 
                  alt="" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{article.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{article.reading_time} min
                  </span>
                </div>
                <h2 className="font-semibold text-lg text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{article.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={article.author?.avatar_url} />
                      <AvatarFallback>{article.author?.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{article.author?.display_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Bookmark className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Share2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 8. BOOKING / APPOINTMENT APP
// =============================================
export const bookingTemplate: AppTemplate = {
  id: "booking",
  name: "Booking / Appointment App",
  description: "Schedule and manage appointments and reservations",
  keywords: ["booking", "appointment", "schedule", "calendar", "reservation", "salon", "doctor", "meeting", "calendly"],
  pattern: "SCHEDULING",
  features: [
    "Calendar view",
    "Available time slots",
    "Booking form",
    "Confirmation emails",
    "Reschedule/cancel",
    "Service selection",
    "Staff selection",
    "Reminders"
  ],
  dbSchema: `
CREATE TABLE public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view services" ON public.services FOR SELECT USING (is_active = true);

CREATE TABLE public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  service_id UUID REFERENCES public.services(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id OR customer_email = auth.email());
CREATE POLICY "Anyone can book" ON public.appointments FOR INSERT WITH CHECK (true);
`,
  files: [
    {
      path: "src/types/booking.ts",
      action: "create",
      content: `export interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  user_id?: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  created_at: string;
  service?: Service;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}`
    },
    {
      path: "src/pages/BookingApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Clock, DollarSign, Check, ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import type { Service, TimeSlot } from '@/types/booking';
import { format, addDays, isSameDay } from 'date-fns';

// Demo data
const demoServices: Service[] = [
  { id: '1', name: 'Haircut', description: 'Professional haircut with styling', duration_minutes: 30, price: 35, is_active: true },
  { id: '2', name: 'Hair Coloring', description: 'Full color treatment with premium products', duration_minutes: 90, price: 120, is_active: true },
  { id: '3', name: 'Beard Trim', description: 'Precision beard shaping and trim', duration_minutes: 15, price: 20, is_active: true },
  { id: '4', name: 'Full Package', description: 'Haircut + beard trim + styling', duration_minutes: 60, price: 65, is_active: true },
];

const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 9; hour < 18; hour++) {
    slots.push({ time: \`\${hour.toString().padStart(2, '0')}:00\`, available: Math.random() > 0.3 });
    slots.push({ time: \`\${hour.toString().padStart(2, '0')}:30\`, available: Math.random() > 0.3 });
  }
  return slots;
};

type Step = 'service' | 'datetime' | 'details' | 'confirmation';

export default function BookingApp() {
  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots] = useState(generateTimeSlots());
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', notes: '' });

  const steps: { id: Step; label: string }[] = [
    { id: 'service', label: 'Service' },
    { id: 'datetime', label: 'Date & Time' },
    { id: 'details', label: 'Details' },
    { id: 'confirmation', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  const canProceed = () => {
    switch (step) {
      case 'service': return !!selectedService;
      case 'datetime': return !!selectedDate && !!selectedTime;
      case 'details': return customerInfo.name && customerInfo.email;
      default: return true;
    }
  };

  const handleConfirm = () => {
    // Here you would submit to database
    alert('Booking confirmed! Check your email for details.');
    setStep('service');
    setSelectedService(null);
    setSelectedDate(undefined);
    setSelectedTime(null);
    setCustomerInfo({ name: '', email: '', phone: '', notes: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Book an Appointment</h1>
          <p className="text-muted-foreground">Schedule your visit in just a few steps</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={\`flex items-center justify-center w-10 h-10 rounded-full font-medium text-sm \${
                i < currentStepIndex ? 'bg-primary text-primary-foreground' :
                i === currentStepIndex ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-muted text-muted-foreground'
              }\`}>
                {i < currentStepIndex ? <Check className="w-5 h-5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={\`w-16 h-1 mx-2 \${i < currentStepIndex ? 'bg-primary' : 'bg-muted'}\`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <Card>
          <CardContent className="p-6">
            {step === 'service' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Select a Service</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {demoServices.map(service => (
                    <Card 
                      key={service.id}
                      className={\`cursor-pointer transition-all \${selectedService?.id === service.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}\`}
                      onClick={() => setSelectedService(service)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{service.name}</h3>
                          {selectedService?.id === service.id && (
                            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {service.duration_minutes} min
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <DollarSign className="w-4 h-4" />
                            {service.price}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {step === 'datetime' && (
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Select Date</h2>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                    className="rounded-md border"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-4">Select Time</h2>
                  {selectedDate ? (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map(slot => (
                        <Button
                          key={slot.time}
                          variant={selectedTime === slot.time ? 'default' : 'outline'}
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className="text-sm"
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      <div className="text-center">
                        <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Select a date first</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'details' && (
              <div className="max-w-md mx-auto space-y-4">
                <h2 className="text-xl font-semibold mb-4">Your Details</h2>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" type="tel" value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" value={customerInfo.notes} onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })} />
                </div>
              </div>
            )}

            {step === 'confirmation' && (
              <div className="max-w-md mx-auto">
                <h2 className="text-xl font-semibold mb-6 text-center">Confirm Your Booking</h2>
                <Card className="bg-muted/50">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium">{selectedService?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{selectedDate && format(selectedDate, 'MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-medium">{selectedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{selectedService?.duration_minutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{customerInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{customerInfo.email}</span>
                    </div>
                    <div className="border-t border-border pt-4 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-primary text-xl">\${selectedService?.price}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={() => setStep(steps[currentStepIndex - 1].id)}
            disabled={currentStepIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {step === 'confirmation' ? (
            <Button onClick={handleConfirm} className="gap-2">
              Confirm Booking <Check className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={() => setStep(steps[currentStepIndex + 1].id)}
              disabled={!canProceed()}
              className="gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 9. DASHBOARD / ANALYTICS APP
// =============================================
export const dashboardTemplate: AppTemplate = {
  id: "dashboard",
  name: "Dashboard / Analytics",
  description: "Data visualization and analytics dashboard",
  keywords: ["dashboard", "analytics", "admin", "panel", "statistics", "charts", "metrics", "kpi", "reports"],
  pattern: "ANALYTICS",
  features: [
    "KPI cards",
    "Charts and graphs",
    "Data tables",
    "Filters and date ranges",
    "Export functionality",
    "Real-time updates",
    "User management",
    "Activity logs"
  ],
  dbSchema: `
CREATE TABLE public.analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read all" ON public.analytics_events FOR SELECT USING (true);
`,
  files: [
    {
      path: "src/types/dashboard.ts",
      action: "create",
      content: `export interface KPICard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: string;
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}`
    },
    {
      path: "src/pages/DashboardApp.tsx",
      action: "create",
      content: `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, DollarSign, ShoppingCart, TrendingUp, TrendingDown, 
  ArrowUpRight, ArrowDownRight, BarChart3, Activity, Download,
  Bell, Search, Settings, Menu
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Demo data
const revenueData = [
  { name: 'Jan', revenue: 4000, orders: 240 },
  { name: 'Feb', revenue: 3000, orders: 198 },
  { name: 'Mar', revenue: 5000, orders: 300 },
  { name: 'Apr', revenue: 4500, orders: 278 },
  { name: 'May', revenue: 6000, orders: 389 },
  { name: 'Jun', revenue: 5500, orders: 349 },
  { name: 'Jul', revenue: 7000, orders: 430 },
];

const trafficData = [
  { name: 'Direct', value: 35, color: 'hsl(var(--primary))' },
  { name: 'Organic', value: 30, color: 'hsl(var(--chart-2))' },
  { name: 'Social', value: 20, color: 'hsl(var(--chart-3))' },
  { name: 'Referral', value: 15, color: 'hsl(var(--chart-4))' },
];

const recentActivity = [
  { id: '1', user: 'John Doe', action: 'placed an order', target: '#1234', timestamp: '2 min ago' },
  { id: '2', user: 'Jane Smith', action: 'updated profile', target: '', timestamp: '15 min ago' },
  { id: '3', user: 'Bob Wilson', action: 'left a review', target: 'Product X', timestamp: '1 hour ago' },
  { id: '4', user: 'Alice Brown', action: 'subscribed to', target: 'Pro Plan', timestamp: '2 hours ago' },
];

const kpiCards = [
  { title: 'Total Revenue', value: '$45,231', change: 12.5, changeType: 'increase' as const, icon: DollarSign },
  { title: 'Active Users', value: '2,350', change: 8.2, changeType: 'increase' as const, icon: Users },
  { title: 'Orders', value: '1,234', change: -2.4, changeType: 'decrease' as const, icon: ShoppingCart },
  { title: 'Conversion Rate', value: '3.2%', change: 4.1, changeType: 'increase' as const, icon: TrendingUp },
];

export default function DashboardApp() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden"><Menu /></Button>
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon"><Search className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <Avatar className="h-9 w-9">
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Time range selector */}
        <div className="flex items-center justify-between mb-6">
          <Tabs defaultValue="7d">
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7 days</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
              <TabsTrigger value="90d">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <kpi.icon className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant={kpi.changeType === 'increase' ? 'default' : 'destructive'} className="gap-1">
                    {kpi.changeType === 'increase' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(kpi.change)}%
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Revenue Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Traffic Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={trafficData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {trafficData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {trafficData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-medium ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{item.user.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{item.user}</span>
                      <span className="text-muted-foreground"> {item.action} </span>
                      {item.target && <span className="font-medium">{item.target}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}`
    }
  ]
};

// =============================================
// 10. PORTFOLIO / LANDING PAGE
// =============================================
export const portfolioTemplate: AppTemplate = {
  id: "portfolio",
  name: "Portfolio / Landing Page",
  description: "Professional portfolio or product landing page",
  keywords: ["portfolio", "landing", "personal", "resume", "cv", "showcase", "agency", "freelancer", "website"],
  pattern: "MARKETING",
  features: [
    "Hero section",
    "About section",
    "Projects/work showcase",
    "Skills/services",
    "Testimonials",
    "Contact form",
    "Social links",
    "Responsive design"
  ],
  dbSchema: `
CREATE TABLE public.contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit" ON public.contact_submissions FOR INSERT WITH CHECK (true);
`,
  files: [
    {
      path: "src/pages/PortfolioApp.tsx",
      action: "create",
      content: `import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Github, Linkedin, Twitter, Mail, ExternalLink, 
  ArrowRight, Code2, Palette, Smartphone, Globe,
  ChevronDown, Send, Star
} from 'lucide-react';

const projects = [
  { id: 1, title: 'E-Commerce Platform', description: 'Full-stack online store with payment integration', image: '/placeholder.svg', tags: ['React', 'Node.js', 'Stripe'], link: '#' },
  { id: 2, title: 'Task Management App', description: 'Collaborative project management tool', image: '/placeholder.svg', tags: ['TypeScript', 'Next.js', 'Prisma'], link: '#' },
  { id: 3, title: 'AI Content Generator', description: 'AI-powered writing assistant', image: '/placeholder.svg', tags: ['Python', 'OpenAI', 'FastAPI'], link: '#' },
];

const skills = [
  { icon: Code2, name: 'Frontend Development', description: 'React, Vue, Angular, TypeScript' },
  { icon: Globe, name: 'Backend Development', description: 'Node.js, Python, Go, PostgreSQL' },
  { icon: Smartphone, name: 'Mobile Development', description: 'React Native, Flutter, iOS' },
  { icon: Palette, name: 'UI/UX Design', description: 'Figma, Adobe XD, Prototyping' },
];

const testimonials = [
  { name: 'Sarah Johnson', role: 'CEO at TechCorp', content: 'Exceptional work quality and communication. Delivered beyond expectations!', avatar: '/placeholder.svg' },
  { name: 'Mike Chen', role: 'Product Manager', content: 'A true professional who understands both design and development.', avatar: '/placeholder.svg' },
  { name: 'Emily Davis', role: 'Startup Founder', content: 'Helped us launch our MVP in record time. Highly recommended!', avatar: '/placeholder.svg' },
];

export default function PortfolioApp() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-primary">JD</span>
          <div className="hidden md:flex items-center gap-8">
            {['About', 'Skills', 'Projects', 'Testimonials', 'Contact'].map(item => (
              <a key={item} href={\`#\${item.toLowerCase()}\`} className="text-muted-foreground hover:text-foreground transition-colors">{item}</a>
            ))}
          </div>
          <Button>Hire Me</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <Avatar className="w-32 h-32 mx-auto border-4 border-primary">
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback className="text-4xl">JD</AvatarFallback>
            </Avatar>
          </div>
          <Badge className="mb-4">Available for Freelance</Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Hi, I'm <span className="text-primary">John Doe</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Full-stack developer crafting beautiful digital experiences. I turn ideas into reality with clean code and creative design.
          </p>
          <div className="flex items-center justify-center gap-4 mb-12">
            <Button size="lg" className="gap-2">
              View My Work <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline">Download CV</Button>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon"><Github className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon"><Linkedin className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon"><Twitter className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon"><Mail className="w-5 h-5" /></Button>
          </div>
          <div className="mt-16 animate-bounce">
            <ChevronDown className="w-8 h-8 mx-auto text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Skills */}
      <section id="skills" className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">What I Do</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Specialized in building modern web applications with cutting-edge technologies</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {skills.map(({ icon: Icon, name, description }) => (
              <Card key={name} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{name}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Featured Projects</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">A selection of my recent work and side projects</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <Card key={project.id} className="group overflow-hidden hover:shadow-xl transition-all">
                <div className="aspect-video overflow-hidden">
                  <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <CardContent className="p-5">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {project.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{project.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{project.description}</p>
                  <Button variant="ghost" className="gap-2 p-0 h-auto">
                    View Project <ExternalLink className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">What Clients Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6">"{t.content}"</p>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={t.avatar} />
                      <AvatarFallback>{t.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Let's Work Together</h2>
          <p className="text-muted-foreground mb-8">Have a project in mind? I'd love to hear about it.</p>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input placeholder="Your Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                <Input type="email" placeholder="Your Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <Textarea placeholder="Your Message" rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
              <Button className="w-full gap-2">
                Send Message <Send className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">© 2024 John Doe. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon"><Github className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><Linkedin className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><Twitter className="w-4 h-4" /></Button>
          </div>
        </div>
      </footer>
    </div>
  );
}`
    }
  ]
};

// =============================================
// EXPORT ALL TEMPLATES
// =============================================
export const allTemplates: AppTemplate[] = [
  foodDeliveryTemplate,
  socialMediaTemplate,
  ecommerceTemplate,
  todoTemplate,
  chatTemplate,
  fitnessTemplate,
  blogTemplate,
  bookingTemplate,
  dashboardTemplate,
  portfolioTemplate,
];

// Helper function to find matching template
export function findMatchingTemplate(prompt: string): AppTemplate | null {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const template of allTemplates) {
    for (const keyword of template.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        return template;
      }
    }
  }
  
  return null;
}

// Generate template context for AI
export function generateTemplateContext(): string {
  let context = "\n\n## 🎯 PRE-BUILT APP TEMPLATES\n\n";
  context += "When users ask to build these common app types, use the provided templates as a starting point:\n\n";
  
  for (const template of allTemplates) {
    context += `### ${template.name}\n`;
    context += `**Pattern:** ${template.pattern}\n`;
    context += `**Keywords:** ${template.keywords.slice(0, 5).join(', ')}\n`;
    context += `**Features:** ${template.features.slice(0, 4).join(', ')}...\n\n`;
  }
  
  return context;
}
