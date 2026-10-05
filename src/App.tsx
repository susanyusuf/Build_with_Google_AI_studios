import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Check, 
  Plus, 
  LogOut,
  ChevronRight,
  Loader2,
  Sparkles,
  ShoppingBag,
  Clock,
  Star,
  X,
  Soup,
  Pizza,
  Coffee,
  Salad,
  IceCream,
  Box,
  ChevronLeft,
  Utensils,
  ChefHat,
  Flame,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Firebase ---
import { auth, db, signInWithGoogle, loginWithEmail, registerWithEmail, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  address?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface Restaurant {
  id: string;
  name: string;
  type: string;
  rating: number;
  deliveryTime: string;
  image: string;
  menu: MenuItem[];
}

interface CartItem extends MenuItem {
  restaurantId: string;
  restaurantName: string;
  quantity: number;
}

interface Order {
  id?: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'preparing' | 'delivering' | 'completed';
  mood?: string;
  createdAt: any;
}

interface Recommendation {
  title: string;
  why: string;
  icon: string;
}

// --- Helpers ---
const iconMap: Record<string, React.ReactNode> = {
  Soup: <Soup className="w-5 h-5" />,
  Pizza: <Pizza className="w-5 h-5" />,
  Coffee: <Coffee className="w-5 h-5" />,
  Salad: <Salad className="w-5 h-5" />,
  IceCream: <IceCream className="w-5 h-5" />,
  Bento: <Box className="w-5 h-5" />,
  Utensils: <Utensils className="w-5 h-5" />,
};

const MOODS = [
  { id: 'exhausted', label: 'Exhausted', emoji: '🥱' },
  { id: 'anxious', label: 'Anxious', emoji: '😰' },
  { id: 'celebratory', label: 'Happy', emoji: '🥳' },
  { id: 'lonely', label: 'Lonely', emoji: '🥺' },
  { id: 'focused', label: 'Focused', emoji: '🧠' },
];

// --- Main App ---
export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecLoading, setIsRecLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'restaurant' | 'checkout' | 'tracking'>('home');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [recipeDish, setRecipeDish] = useState<string | null>(null);
  const [currentRecipe, setCurrentRecipe] = useState<any | null>(null);
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ ingredients: true, method: true });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Load Auth & Restaurants
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);

      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const pSnap = await getDoc(profileRef);
        if (!pSnap.exists()) {
          const newProfile = { uid: firebaseUser.uid, name: firebaseUser.displayName || 'Guest', email: firebaseUser.email || '' };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(pSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
    });

    fetch('/api/restaurants').then(res => res.json()).then(setRestaurants);

    return () => unsub();
  }, []);

  // Listen for active orders
  useEffect(() => {
    if (!user) {
      setActiveOrder(null);
      return;
    }

    const q = query(
      collection(db, 'orders'), 
      where('userId', '==', user.uid),
      where('status', 'in', ['pending', 'preparing', 'delivering']),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveOrder({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Order);
        setCurrentView('tracking');
      } else {
        setActiveOrder(null);
      }
    }, (err) => {
      // Check if we are still authenticated to avoid reporting false errors during logout transition
      if (auth.currentUser) {
        handleFirestoreError(err, OperationType.GET, 'orders');
      }
    });

    return () => unsub();
  }, [user]);

  const handleFetchRecipe = async (dishName: string) => {
    setRecipeDish(dishName);
    setIsRecipeLoading(true);
    setCurrentRecipe(null);
    try {
      const res = await fetch('/api/food/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishName })
      });
      const data = await res.json();
      setCurrentRecipe(data);
    } catch (err) {
      console.error("Recipe error:", err);
    } finally {
      setIsRecipeLoading(false);
    }
  };

  // Mood-based recommendations
  const handleMoodSelect = async (mood: string) => {
    setSelectedMood(mood);
    setIsRecLoading(true);
    setRecommendations([]); 
    try {
      const res = await fetch('/api/food/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood })
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecommendations(data);
      } else {
        console.error("Recommendations expected array, got:", data);
        setRecommendations([]);
      }
    } catch (err) {
      console.error("Mood recommendation error:", err);
      setRecommendations([]);
    } finally {
      setIsRecLoading(false);
    }
  };

  const addToCart = (item: MenuItem, restaurant: Restaurant) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, restaurantId: restaurant.id, restaurantName: restaurant.name, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (!user || cart.length === 0) return;
    const orderData: any = {
      userId: user.uid,
      items: cart,
      total: cartTotal,
      status: 'pending',
      mood: selectedMood || null,
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, 'orders'), orderData);
      setCart([]);
      setCurrentView('tracking');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    }
  };

  if (isAuthLoading) return <LoadingScreen />;
  if (!user) return <LandingPage />;

  return (
    <div className="min-h-screen bg-paper gentle-gradient selection:bg-olive/20 pb-20">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/40 backdrop-blur-md border-b border-olive/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2" onClick={() => setCurrentView('home')}>
          <div className="w-8 h-8 bg-olive rounded-full flex items-center justify-center cursor-pointer">
            <Utensils className="w-4 h-4 text-paper" />
          </div>
          <span className="font-serif text-xl font-bold italic text-olive cursor-pointer">Hearth & Spice</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentView('checkout')}
            className="relative p-2 hover:bg-olive/5 rounded-full transition-colors"
          >
            <ShoppingBag className="w-5 h-5 text-olive" />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {cart.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => logout()} 
            className="flex items-center gap-2 p-2 hover:bg-olive/5 rounded-full transition-colors px-3"
            title="Sign Out"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-sage hidden sm:block">Sign Out</span>
            <LogOut className="w-4 h-4 text-sage" />
          </button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div 
              key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <section className="space-y-2">
                <h1 className="text-4xl font-serif italic text-ink">Hello, {profile?.name.split(' ')[0]}</h1>
                <p className="text-sage font-medium tracking-widest text-[10px] uppercase italic">How's your spirit today?</p>
              </section>

              {/* Mood Selector */}
              <section className="bg-white rounded-[32px] p-8 shadow-xl shadow-sage/5 border border-olive/5">
                <div className="grid grid-cols-5 gap-2">
                  {MOODS.map(mood => (
                    <button
                      key={mood.id}
                      onClick={() => handleMoodSelect(mood.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 ${selectedMood === mood.id ? 'bg-olive text-white shadow-lg' : 'hover:bg-paper'}`}
                    >
                      <span className="text-2xl">{mood.emoji}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${selectedMood === mood.id ? 'text-white' : 'text-sage'}`}>{mood.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Recommendations */}
              <AnimatePresence>
                {selectedMood && (
                  <motion.section 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-2 text-sage">
                      <Sparkles className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-widest">Soul Suggestions</h3>
                    </div>
                    {isRecLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sage" /></div>
                    ) : (
                      <div className="grid gap-4">
                        {Array.isArray(recommendations) && recommendations.map((rec, i) => (
                          <motion.div 
                            key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4 p-5 bg-white border border-olive/5 rounded-3xl"
                          >
                            <div className="w-12 h-12 bg-paper rounded-2xl flex items-center justify-center text-olive">
                              {iconMap[rec?.icon || 'Utensils'] || <Utensils className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-serif text-lg leading-tight italic">{rec?.title}</h4>
                              <p className="text-xs text-sage leading-tight">{rec?.why}</p>
                            </div>
                            <button 
                              onClick={() => handleFetchRecipe(rec?.title || '')}
                              className="p-2 hover:bg-olive/10 rounded-full text-olive transition-colors group"
                              title="Cook at home"
                            >
                              <ChefHat className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Restaurants */}
              <section className="space-y-6">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-sage">Nearby Comfort</h3>
                 <div className="space-y-6">
                    {restaurants.map(res => (
                      <motion.div 
                        key={res.id} 
                        onClick={() => { setSelectedRestaurant(res); setCurrentView('restaurant'); }}
                        className="group relative overflow-hidden bg-white rounded-[32px] shadow-sm border border-olive/5 cursor-pointer"
                      >
                         <div className="h-48 overflow-hidden">
                            <img src={res.image} alt={res.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                         </div>
                         <div className="p-6 space-y-2">
                            <div className="flex justify-between items-start">
                               <h4 className="font-serif text-2xl italic text-ink">{res.name}</h4>
                               <div className="flex items-center gap-1 text-sm bg-paper px-2 py-1 rounded-full">
                                  <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                                  <span className="font-bold">{res.rating}</span>
                               </div>
                            </div>
                            <div className="flex gap-4 text-xs text-sage">
                               <div className="flex items-center gap-1"><Utensils className="w-3 h-3" /> {res.type}</div>
                               <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {res.deliveryTime}</div>
                            </div>
                         </div>
                      </motion.div>
                    ))}
                 </div>
              </section>
            </motion.div>
          )}

          {currentView === 'restaurant' && selectedRestaurant && (
             <motion.div 
               key="restaurant" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="space-y-8 pb-12"
             >
                <div className="flex items-center gap-4">
                   <button onClick={() => setCurrentView('home')} className="p-3 bg-white border border-olive/5 rounded-full shadow-sm">
                      <ChevronLeft className="w-5 h-5 text-olive" />
                   </button>
                   <h2 className="font-serif text-3xl italic text-ink">{selectedRestaurant.name}</h2>
                </div>

                <div className="space-y-4">
                   {selectedRestaurant.menu.map(item => (
                      <div key={item.id} className="bg-white p-6 rounded-[32px] border border-olive/5 flex justify-between items-center group">
                         <div className="flex-1 space-y-1">
                            <h4 className="font-serif text-xl italic">{item.name}</h4>
                            <p className="text-xs text-sage leading-relaxed max-w-[200px]">{item.description}</p>
                            <div className="flex items-center gap-4 pt-2">
                               <p className="text-sm font-bold text-olive">${item.price}</p>
                               <button 
                                  onClick={(e) => { e.stopPropagation(); handleFetchRecipe(item.name); }}
                                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sage hover:text-olive transition-colors"
                               >
                                  <ChefHat className="w-3 h-3" />
                                  Cook it
                               </button>
                            </div>
                         </div>
                         <button 
                            onClick={() => addToCart(item, selectedRestaurant)}
                            className="w-12 h-12 bg-paper hover:bg-olive hover:text-white rounded-2xl flex items-center justify-center transition-all group-active:scale-95"
                         >
                            <Plus className="w-6 h-6" />
                         </button>
                      </div>
                   ))}
                </div>
             </motion.div>
          )}

          {currentView === 'checkout' && (
             <motion.div 
               key="checkout" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
               className="space-y-8"
             >
                <div className="flex items-center gap-4">
                   <button onClick={() => setCurrentView('home')} className="p-3 bg-white border border-olive/5 rounded-full shadow-sm">
                      <ChevronLeft className="w-5 h-5 text-olive" />
                   </button>
                   <h2 className="font-serif text-3xl italic text-ink">My Bag</h2>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                     <ShoppingBag className="w-12 h-12 text-sage/20 mx-auto" />
                     <p className="text-sage italic">Your bag is empty, soul.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                       {cart.map(item => (
                          <div key={item.id} className="bg-white p-6 rounded-[32px] border border-olive/5 flex justify-between items-center">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-paper rounded-full flex items-center justify-center font-bold text-olive">{item.quantity}x</div>
                                <div>
                                   <h4 className="font-serif text-lg italic">{item.name}</h4>
                                   <p className="text-[10px] text-sage uppercase font-bold tracking-widest">{item.restaurantName}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-6">
                                <span className="font-bold text-olive">${(item.price * item.quantity).toFixed(2)}</span>
                                <button onClick={() => removeFromCart(item.id)} className="text-sage hover:text-red-500"><X className="w-4 h-4" /></button>
                             </div>
                          </div>
                       ))}
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-sage/5 border border-olive/5 space-y-6">
                       <div className="flex justify-between items-center text-xs text-sage uppercase font-bold tracking-widest border-b border-olive/5 pb-4">
                          <span>Subtotal</span>
                          <span>${cartTotal.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs text-sage uppercase font-bold tracking-widest border-b border-olive/5 pb-4">
                          <span>Delivery Fee</span>
                          <span>$0.00</span>
                       </div>
                       <div className="flex justify-between items-center font-serif text-2xl italic">
                          <span>Total</span>
                          <span>${cartTotal.toFixed(2)}</span>
                       </div>
                       <button 
                          onClick={placeOrder}
                          className="w-full py-6 bg-olive text-white rounded-[32px] font-serif text-xl italic hover:opacity-90 transition-opacity active:scale-95"
                       >
                          Place SoulOrder
                       </button>
                    </div>
                  </>
                )}
             </motion.div>
          )}

          {currentView === 'tracking' && activeOrder && (
             <motion.div 
               key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               className="space-y-12 text-center"
             >
                <div className="space-y-4">
                   <div className="w-24 h-24 bg-olive/10 mx-auto rounded-full flex items-center justify-center relative">
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity }}
                        className="absolute inset-0 bg-olive/5 rounded-full"
                      />
                      <Utensils className="w-10 h-10 text-olive" />
                   </div>
                   <h2 className="text-4xl font-serif italic text-ink">Nourishment is on its way</h2>
                   <p className="text-sage italic">Relax, take a breath. We'll handle everything.</p>
                </div>

                <div className="max-w-xs mx-auto space-y-8">
                   <div className="flex items-center gap-6">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${['pending', 'preparing', 'delivering', 'completed'].includes(activeOrder.status) ? 'bg-olive text-white' : 'bg-paper text-sage'}`}>
                         <Check className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                         <p className="text-xs uppercase font-bold tracking-widest text-olive">Order Placed</p>
                         <p className="text-[10px] text-sage italic">Preparing your spirit...</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${['preparing', 'delivering', 'completed'].includes(activeOrder.status) ? 'bg-olive text-white' : 'bg-paper text-sage'}`}>
                         {activeOrder.status === 'preparing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                         <p className="text-xs uppercase font-bold tracking-widest text-olive">Cooking</p>
                         <p className="text-[10px] text-sage italic">Curating your comfort...</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${['delivering', 'completed'].includes(activeOrder.status) ? 'bg-olive text-white' : 'bg-paper text-sage'}`}>
                         {activeOrder.status === 'delivering' ? <Clock className="w-5 h-5 animate-pulse" /> : <Check className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                         <p className="text-xs uppercase font-bold tracking-widest text-olive">On the way</p>
                         <p className="text-[10px] text-sage italic">Almost there, friend.</p>
                      </div>
                   </div>
                </div>

                <button 
                  onClick={() => setCurrentView('home')}
                  className="px-8 py-4 bg-white border border-olive/5 rounded-full text-sage text-sm font-medium hover:bg-paper transition-colors"
                >
                  Back to Spirit
                </button>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {recipeDish && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
            onClick={() => setRecipeDish(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-paper w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 pb-4 flex justify-between items-start border-b border-olive/5">
                 <div className="space-y-1">
                   <h2 className="font-serif text-4xl italic text-ink">{recipeDish}</h2>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-sage">Kitchen Blueprint</p>
                 </div>
                 <button onClick={() => setRecipeDish(null)} className="p-2 hover:bg-olive/5 rounded-full transition-colors">
                    <X className="w-6 h-6 text-sage" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                 {isRecipeLoading ? (
                   <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <div className="relative">
                        <motion.div 
                          animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="w-16 h-16 border-2 border-dashed border-olive rounded-full"
                        />
                        <ChefHat className="w-8 h-8 text-olive absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="font-serif italic text-sage">Consulting the soul chefs...</p>
                   </div>
                 ) : currentRecipe ? (
                   <div className="space-y-8">
                      <div className="flex gap-8">
                         <div className="flex items-center gap-2 text-olive font-bold">
                            <Clock className="w-4 h-4" />
                            <span className="text-[10px] uppercase tracking-widest">{currentRecipe.prepTime} Prep</span>
                         </div>
                         <div className="flex items-center gap-2 text-olive font-bold">
                            <Flame className="w-4 h-4" />
                            <span className="text-[10px] uppercase tracking-widest">{currentRecipe.cookTime} Cook</span>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <button 
                           onClick={() => toggleSection('ingredients')}
                           className="flex items-center justify-between w-full p-4 bg-olive/5 rounded-2xl hover:bg-olive/10 transition-colors"
                         >
                           <h3 className="text-xs font-bold uppercase tracking-widest text-sage">Ingredients</h3>
                           <motion.div
                             animate={{ rotate: expandedSections.ingredients ? 0 : -90 }}
                             transition={{ duration: 0.2 }}
                           >
                             <ChevronDown className="w-4 h-4 text-sage" />
                           </motion.div>
                         </button>
                         <AnimatePresence>
                           {expandedSections.ingredients && (
                             <motion.div
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: "auto", opacity: 1 }}
                               exit={{ height: 0, opacity: 0 }}
                               className="overflow-hidden"
                             >
                               <ul className="grid gap-3 pt-2 px-2">
                                  {currentRecipe?.ingredients?.map((ing: string, i: number) => (
                                    <li key={i} className="flex gap-3 text-sm italic items-start text-ink/80">
                                       <span className="w-1.5 h-1.5 rounded-full bg-olive/30 mt-1.5 flex-shrink-0" />
                                       {ing}
                                    </li>
                                  ))}
                               </ul>
                             </motion.div>
                           )}
                         </AnimatePresence>
                      </div>

                      <div className="space-y-4">
                         <button 
                           onClick={() => toggleSection('method')}
                           className="flex items-center justify-between w-full p-4 bg-olive/5 rounded-2xl hover:bg-olive/10 transition-colors"
                         >
                           <h3 className="text-xs font-bold uppercase tracking-widest text-sage">Method</h3>
                           <motion.div
                             animate={{ rotate: expandedSections.method ? 0 : -90 }}
                             transition={{ duration: 0.2 }}
                           >
                             <ChevronDown className="w-4 h-4 text-sage" />
                           </motion.div>
                         </button>
                         <AnimatePresence>
                           {expandedSections.method && (
                             <motion.div
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: "auto", opacity: 1 }}
                               exit={{ height: 0, opacity: 0 }}
                               className="overflow-hidden"
                             >
                               <ol className="space-y-8 pt-4 px-2">
                                  {currentRecipe?.instructions?.map((step: string, i: number) => (
                                    <li key={i} className="flex gap-8 relative">
                                       {i < currentRecipe.instructions.length - 1 && (
                                         <div className="absolute left-4 top-10 bottom-[-32px] w-[1px] bg-olive/10" />
                                       )}
                                       <div className="w-8 h-8 rounded-full bg-olive/5 flex items-center justify-center flex-shrink-0 border border-olive/10">
                                         <span className="font-serif italic text-olive text-lg">{i+1}</span>
                                       </div>
                                       <p className="text-sm italic leading-relaxed text-ink/80 pt-1">{step}</p>
                                    </li>
                                  ))}
                               </ol>
                             </motion.div>
                           )}
                         </AnimatePresence>
                      </div>

                      <div className="p-6 bg-olive/5 rounded-3xl border border-olive/10 space-y-2">
                         <div className="flex items-center gap-2 text-olive">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Soul Tip</span>
                         </div>
                         <p className="text-sm italic text-sage leading-relaxed">{currentRecipe.tip}</p>
                      </div>
                   </div>
                 ) : (
                   <div className="text-center py-20">
                      <p className="text-sage italic">Failed to gather the recipe. Try again, friend.</p>
                   </div>
                 )}
              </div>

              <div className="p-8 pt-4 border-t border-olive/5 bg-paper/50 backdrop-blur-sm">
                 <p className="text-[10px] text-center text-sage uppercase font-bold tracking-[0.2em]">Nourish your own space.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Status (Quick Cart) */}
      {cart.length > 0 && currentView !== 'checkout' && (
        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-8 left-6 right-6 z-50"
        >
           <button 
             onClick={() => setCurrentView('checkout')}
             className="w-full bg-ink text-white p-6 rounded-[32px] flex justify-between items-center shadow-2xl"
           >
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                 </div>
                 <div className="text-left">
                    <p className="text-xs uppercase font-bold tracking-widest opacity-60">My Bag</p>
                    <p className="font-serif italic text-lg">{cart.length} items collected</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <span className="font-serif text-2xl italic">${cartTotal.toFixed(2)}</span>
                 <ChevronRight className="w-6 h-6 opacity-40" />
              </div>
           </button>
        </motion.div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-12 text-center">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 4, repeat: Infinity }}
        className="w-16 h-16 bg-olive/10 rounded-full flex items-center justify-center mb-8"
      >
        <Utensils className="w-8 h-8 text-olive" />
      </motion.div>
      <p className="font-serif tracking-widest text-sage italic">Preparing the spirit...</p>
    </div>
  );
}

function LandingPage() {
  const [view, setView] = useState<'choice' | 'email'>('choice');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await registerWithEmail(email, password);
        // Profile will be created by the onAuthStateChanged effect in App
        if (name) {
          // Temporarily set profile in firestore if name is provided
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cred.user.email,
            name: name,
            createdAt: serverTimestamp()
          });
        }
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2">
       <div className="p-8 md:p-20 flex flex-col justify-center space-y-12 bg-white relative overflow-hidden">
          <div className="w-12 h-12 bg-olive rounded-full flex items-center justify-center">
            <Utensils className="w-6 h-6 text-paper" />
          </div>

          <AnimatePresence mode="wait">
            {view === 'choice' ? (
              <motion.div 
                key="choice" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="space-y-12"
              >
                <div className="space-y-6">
                  <h1 className="text-7xl font-serif leading-[0.9] tracking-tighter text-ink italic">Less Stress.<br/>More Soul.</h1>
                  <p className="text-sage text-xl max-w-md font-medium leading-relaxed">Food delivery curated for your mood. No endless scrolling, no decision fatigue—just nourishment.</p>
                </div>
                
                <div className="space-y-4">
                  <button 
                    onClick={() => { setMode('signup'); setView('email'); }}
                    className="group flex items-center justify-between w-full max-w-md px-10 py-8 bg-olive rounded-[40px] shadow-2xl shadow-olive/20 hover:scale-[1.02] transition-all duration-500"
                  >
                    <span className="font-serif text-3xl italic text-white">Join Hearth & Spice</span>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center transition-colors shadow-lg">
                       <ChevronRight className="w-8 h-8 text-olive" />
                    </div>
                  </button>

                  <div className="flex items-center gap-4 max-w-md py-4">
                    <div className="flex-1 h-[1px] bg-olive/10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-sage">or</span>
                    <div className="flex-1 h-[1px] bg-olive/10" />
                  </div>

                  <button 
                    onClick={() => { setMode('login'); setView('email'); }}
                    className="w-full max-w-md py-6 text-olive font-bold hover:bg-olive hover:text-white border border-olive/20 rounded-[32px] transition-all text-sm uppercase tracking-widest"
                  >
                    Welcome Back (Login)
                  </button>

                  <button 
                    onClick={() => signInWithGoogle()}
                    className="w-full max-w-md py-4 text-sage hover:text-olive transition-colors text-[10px] uppercase font-bold tracking-[0.2em]"
                  >
                    Continue with Google
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-8 max-w-md w-full"
              >
                <button onClick={() => setView('choice')} className="flex items-center gap-2 text-sage hover:text-olive transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Back</span>
                </button>

                <div className="space-y-2">
                  <h2 className="text-4xl font-serif italic text-ink">{mode === 'signup' ? 'Join us' : 'Welcome back'}</h2>
                  <p className="text-sage text-sm italic">{mode === 'signup' ? 'Create a soul account.' : 'Sign in to your nourish list.'}</p>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {mode === 'signup' && (
                    <input 
                      type="text" value={name} onChange={e => setName(e.target.value)} required
                      placeholder="Your Name"
                      className="w-full p-6 bg-paper border border-olive/5 rounded-3xl outline-none focus:border-olive/20 transition-all font-serif italic"
                    />
                  )}
                  <input 
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="Email Address"
                    className="w-full p-6 bg-paper border border-olive/5 rounded-3xl outline-none focus:border-olive/20 transition-all font-serif italic"
                  />
                  <input 
                    type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="Password"
                    className="w-full p-6 bg-paper border border-olive/5 rounded-3xl outline-none focus:border-olive/20 transition-all font-serif italic"
                  />

                  {error && <p className="text-xs text-red-500 italic px-2">{error}</p>}

                  <button 
                    disabled={isLoading}
                    className="w-full py-6 bg-olive text-white rounded-[32px] font-serif text-xl italic hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {mode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>
                </form>

                <p className="text-center text-sage text-xs">
                  {mode === 'signup' ? 'Already have an account?' : 'New to Hearth & Spice?'} {' '}
                  <button 
                    onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                    className="text-olive font-bold hover:underline"
                  >
                    {mode === 'signup' ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="pt-20 flex gap-12">
            <div className="space-y-1">
              <p className="font-serif text-2xl italic leading-none">3min</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sage">To Decision</p>
            </div>
            <div className="space-y-1 border-l border-olive/10 pl-12">
              <p className="font-serif text-2xl italic leading-none">100%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sage">Comfort</p>
            </div>
          </footer>
       </div>

       <div className="hidden lg:flex items-center justify-center bg-paper relative overflow-hidden">
          <div className="absolute inset-0 Atmosphere" style={{ 
            background: 'radial-gradient(circle at 10% 20%, rgba(130, 142, 125, 0.4) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(90, 90, 64, 0.4) 0%, transparent 50%)',
            filter: 'blur(100px)', 
            opacity: 0.6 
          }} />
          <div className="relative z-10 space-y-6 max-w-sm text-center">
             <div className="w-24 h-24 bg-olive rounded-full flex items-center justify-center mx-auto shadow-2xl mb-4">
               <ChefHat className="w-12 h-12 text-white" />
             </div>
             <h2 className="font-serif text-5xl italic text-ink leading-tight">Food That Speaks To Your Soul.</h2>
             <p className="text-sage italic leading-relaxed">Relax, your kitchen is a place for rhythm and flavor. Discover recipes and meals that match your heartbeat.</p>
          </div>
       </div>
    </div>
  );
}
