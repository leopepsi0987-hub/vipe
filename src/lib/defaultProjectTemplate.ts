// Default Standard App Template - Multi-file React Project
// This template is used when creating new projects

export interface DefaultProjectFile {
  path: string;
  content: string;
}

export const DEFAULT_PROJECT_FILES: DefaultProjectFile[] = [
  // ============= TYPES =============
  {
    path: "src/types/index.ts",
    content: `export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  gender?: 'male' | 'female' | 'other';
  location?: string;
  bio?: string;
  isOnboarded: boolean;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  message: string;
  read: boolean;
  createdAt: string;
}
`
  },
  // ============= HOOKS =============
  {
    path: "src/hooks/useAuth.ts",
    content: `import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
  completeOnboarding: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user
    const stored = localStorage.getItem('app_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Demo: simulate login
    const demoUser: User = {
      id: '1',
      name: email.split('@')[0],
      email,
      isOnboarded: localStorage.getItem('onboarded_' + email) === 'true',
    };
    setUser(demoUser);
    localStorage.setItem('app_user', JSON.stringify(demoUser));
  };

  const signUp = async (email: string, password: string, name: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      isOnboarded: false,
    };
    setUser(newUser);
    localStorage.setItem('app_user', JSON.stringify(newUser));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('app_user');
  };

  const completeOnboarding = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data, isOnboarded: true };
      setUser(updated);
      localStorage.setItem('app_user', JSON.stringify(updated));
      localStorage.setItem('onboarded_' + user.email, 'true');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
`
  },
  // ============= COMPONENTS =============
  {
    path: "src/components/Navbar.tsx",
    content: `import { Home, Compass, User, Settings, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onSignOut: () => void;
}

export function Navbar({ currentPage, onNavigate, onSignOut }: NavbarProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-14">
          {/* Logo - Desktop only */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-foreground">AppName</span>
          </div>

          {/* Nav Items */}
          <div className="flex items-center justify-around w-full md:w-auto md:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-xl transition-all duration-200",
                    currentPage === item.id
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs md:text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sign Out - Desktop only */}
          <button
            onClick={onSignOut}
            className="hidden md:flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
`
  },
  {
    path: "src/components/FeatureCard.tsx",
    content: `import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
}

export function FeatureCard({ icon: Icon, title, description, gradient = "from-primary/20 to-accent/20" }: FeatureCardProps) {
  return (
    <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
      <div className={\`w-12 h-12 rounded-xl bg-gradient-to-br \${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300\`}>
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
`
  },
  {
    path: "src/components/PostCard.tsx",
    content: `import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import type { Post } from '../types';

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
}

export function PostCard({ post, onLike }: PostCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 hover:border-border/80 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            {post.userAvatar ? (
              <img src={post.userAvatar} alt={post.userName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-primary-foreground font-semibold text-sm">
                {post.userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{post.userName}</p>
            <p className="text-muted-foreground text-xs">{post.createdAt}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-muted rounded-lg transition-colors">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <p className="text-foreground mb-3 leading-relaxed">{post.content}</p>

      {/* Image */}
      {post.image && (
        <div className="rounded-xl overflow-hidden mb-3">
          <img src={post.image} alt="Post" className="w-full h-48 object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <button 
          onClick={() => onLike(post.id)}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <Heart className="w-5 h-5" />
          <span className="text-sm">{post.likes}</span>
        </button>
        <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">{post.comments}</span>
        </button>
        <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors ml-auto">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
`
  },
  {
    path: "src/components/StatCard.tsx",
    content: `interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
}

export function StatCard({ label, value, change, positive }: StatCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-muted-foreground text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {change && (
        <p className={\`text-xs mt-1 \${positive ? 'text-green-500' : 'text-red-500'}\`}>
          {positive ? '↑' : '↓'} {change}
        </p>
      )}
    </div>
  );
}
`
  },
  // ============= PAGES =============
  {
    path: "src/pages/LandingPage.tsx",
    content: `import { useState } from 'react';
import { ArrowRight, Sparkles, Shield, Zap, Users, Star, ChevronRight } from 'lucide-react';
import { FeatureCard } from '../components/FeatureCard';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const [isHovered, setIsHovered] = useState(false);

  const features = [
    { icon: Sparkles, title: 'Beautiful Design', description: 'Stunning visuals crafted with attention to every pixel and detail.' },
    { icon: Shield, title: 'Secure & Private', description: 'Your data is encrypted and protected with enterprise-grade security.' },
    { icon: Zap, title: 'Lightning Fast', description: 'Optimized performance ensures smooth experience on any device.' },
    { icon: Users, title: 'Community Driven', description: 'Join thousands of users sharing ideas and building together.' },
  ];

  const testimonials = [
    { name: 'Sarah M.', role: 'Designer', text: 'This app completely transformed how I work. Absolutely love it!' },
    { name: 'John D.', role: 'Developer', text: 'The best experience I\'ve had with any platform. Highly recommend!' },
    { name: 'Emily K.', role: 'Product Manager', text: 'Simple, intuitive, and powerful. Everything I needed.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-700" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-32">
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-primary-foreground font-bold">A</span>
              </div>
              <span className="text-xl font-bold text-foreground">AppName</span>
            </div>
            <button 
              onClick={onSignIn}
              className="px-5 py-2.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Sign In
            </button>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Star className="w-4 h-4" />
              <span>Trusted by 10,000+ users worldwide</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight animate-fade-in">
              Build Something
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Amazing</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed animate-fade-in delay-100">
              Create, connect, and grow with our powerful platform. 
              Everything you need to bring your ideas to life.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in delay-200">
              <button
                onClick={onGetStarted}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group relative px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Free
                  <ArrowRight className={\`w-5 h-5 transition-transform duration-300 \${isHovered ? 'translate-x-1' : ''}\`} />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
              
              <button className="px-8 py-4 text-foreground font-semibold text-lg hover:text-primary transition-colors flex items-center gap-2">
                Watch Demo
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to help you succeed
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Loved by Thousands
            </h2>
            <p className="text-lg text-muted-foreground">
              See what our users are saying
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item, index) => (
              <div 
                key={index}
                className="p-6 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground mb-4 leading-relaxed">"{item.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold text-sm">
                      {item.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.name}</p>
                    <p className="text-muted-foreground text-xs">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join our community and start building today. It's free!
          </p>
          <button
            onClick={onGetStarted}
            className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-lg hover:opacity-90 transition-all duration-300 hover:shadow-xl hover:shadow-primary/25"
          >
            Create Your Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 AppName. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
`
  },
  {
    path: "src/pages/AuthPage.tsx",
    content: `import { useState } from 'react';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';

interface AuthPageProps {
  mode: 'signin' | 'signup';
  onSubmit: (email: string, password: string, name?: string) => Promise<void>;
  onToggleMode: () => void;
  onBack: () => void;
}

export function AuthPage({ mode, onSubmit, onToggleMode, onBack }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (mode === 'signup') {
        await onSubmit(email, password, name);
      } else {
        await onSubmit(email, password);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16">
        <div className="max-w-md w-full mx-auto">
          {/* Back Button */}
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">A</span>
            </div>
            <span className="text-2xl font-bold text-foreground">AppName</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {mode === 'signin' 
              ? 'Sign in to continue to your account' 
              : 'Sign up to get started with AppName'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-12 pr-12 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <p className="text-center text-muted-foreground mt-8">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button 
              onClick={onToggleMode}
              className="text-primary font-semibold hover:underline"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/10 via-background to-accent/10 items-center justify-center relative overflow-hidden">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-700" />
        
        <div className="relative text-center px-12">
          <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
            <span className="text-primary-foreground font-bold text-4xl">A</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            {mode === 'signin' ? 'Welcome Back!' : 'Join Our Community'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-sm">
            {mode === 'signin' 
              ? 'We missed you! Sign in to continue where you left off.'
              : 'Create an account and start your journey with us today.'}
          </p>
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    path: "src/pages/OnboardingPage.tsx",
    content: `import { useState } from 'react';
import { ArrowRight, ArrowLeft, Camera, MapPin, User as UserIcon, Loader2 } from 'lucide-react';
import type { User } from '../types';

interface OnboardingPageProps {
  user: User;
  onComplete: (data: Partial<User>) => void;
}

type Step = 'name' | 'gender' | 'location' | 'photo';

export function OnboardingPage({ user, onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(user.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const steps: Step[] = ['name', 'gender', 'location', 'photo'];
  const currentIndex = steps.indexOf(step);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const goPrev = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    onComplete({ name, gender: gender || undefined, location: location || undefined, avatar: avatar || undefined });
    setIsLoading(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const genderOptions = [
    { value: 'male', label: 'Male', emoji: '👨' },
    { value: 'female', label: 'Female', emoji: '👩' },
    { value: 'other', label: 'Other', emoji: '🧑' },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Step {currentIndex + 1} of {steps.length}</span>
            <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
              style={{ width: \`\${progress}%\` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-xl">
          {/* Step: Name */}
          {step === 'name' && (
            <div className="animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <UserIcon className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">What's your name?</h2>
              <p className="text-muted-foreground mb-6">Let's personalize your experience</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-lg"
                autoFocus
              />
            </div>
          )}

          {/* Step: Gender */}
          {step === 'gender' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-foreground mb-2">How do you identify?</h2>
              <p className="text-muted-foreground mb-6">This helps us personalize your experience</p>
              <div className="grid grid-cols-3 gap-3">
                {genderOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setGender(option.value as 'male' | 'female' | 'other')}
                    className={\`p-4 rounded-xl border-2 transition-all duration-200 \${
                      gender === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }\`}
                  >
                    <div className="text-3xl mb-2">{option.emoji}</div>
                    <div className="text-sm font-medium text-foreground">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Location */}
          {step === 'location' && (
            <div className="animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Where are you from?</h2>
              <p className="text-muted-foreground mb-6">Help us connect you with people nearby</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                className="w-full px-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-lg"
                autoFocus
              />
            </div>
          )}

          {/* Step: Photo */}
          {step === 'photo' && (
            <div className="animate-fade-in">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">Add a profile photo</h2>
                <p className="text-muted-foreground mb-6">Help others recognize you</p>
                
                <label className="block cursor-pointer">
                  <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-dashed border-primary/50 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-10 h-10 text-primary" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-muted-foreground mt-4">Click to upload (optional)</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {step === 'photo' ? (
              <button
                onClick={handleComplete}
                disabled={isLoading || !name.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Finishing...</span>
                  </>
                ) : (
                  <>
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={step === 'name' && !name.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    path: "src/pages/HomePage.tsx",
    content: `import { useState } from 'react';
import { Plus, Bell, Search, TrendingUp, Flame, Clock } from 'lucide-react';
import { PostCard } from '../components/PostCard';
import { StatCard } from '../components/StatCard';
import type { Post, User } from '../types';

interface HomePageProps {
  user: User;
}

export function HomePage({ user }: HomePageProps) {
  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      userId: '2',
      userName: 'Alex Chen',
      content: 'Just launched my new project! 🚀 It\'s been months in the making and I\'m so excited to share it with everyone. Check it out and let me know what you think!',
      image: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600',
      likes: 42,
      comments: 8,
      createdAt: '2 hours ago',
    },
    {
      id: '2',
      userId: '3',
      userName: 'Sarah Miller',
      content: 'Beautiful morning for a coffee and some coding ☕️ Working on something exciting that I can\'t wait to share!',
      likes: 28,
      comments: 5,
      createdAt: '4 hours ago',
    },
    {
      id: '3',
      userId: '4',
      userName: 'Mike Johnson',
      content: 'The sunset today was absolutely incredible. Sometimes you just need to take a break and appreciate the little things in life. 🌅',
      image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600',
      likes: 89,
      comments: 12,
      createdAt: '6 hours ago',
    },
  ]);

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId ? { ...post, likes: post.likes + 1 } : post
    ));
  };

  const trendingTopics = ['#coding', '#startup', '#design', '#ai', '#webdev'];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pt-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {user.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-muted-foreground">Here's what's happening today</p>
          </div>
          <button className="relative p-2.5 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Views" value="2.4K" change="+12%" positive />
          <StatCard label="Followers" value="847" change="+5%" positive />
          <StatCard label="Posts" value="23" />
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search posts, people, or topics..."
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* Trending Topics */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Trending</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {trendingTopics.map((topic) => (
              <button
                key={topic}
                className="px-4 py-2 bg-card border border-border rounded-full text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all whitespace-nowrap"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-6">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-5 h-5" />
            <span>Create Post</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground hover:border-primary/50 transition-colors">
            <Flame className="w-5 h-5 text-orange-500" />
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground hover:border-primary/50 transition-colors">
            <Clock className="w-5 h-5" />
          </button>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your Feed</h2>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))}
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    path: "src/pages/ExplorePage.tsx",
    content: `import { useState } from 'react';
import { Search, Filter, Grid, List, Compass, Users, Bookmark, TrendingUp } from 'lucide-react';
import { FeatureCard } from '../components/FeatureCard';

export function ExplorePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All', icon: Compass },
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'people', label: 'People', icon: Users },
    { id: 'saved', label: 'Saved', icon: Bookmark },
  ];

  const exploreItems = [
    { id: 1, title: 'Design Systems', description: 'Learn how to build scalable design systems', category: 'design', image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400' },
    { id: 2, title: 'React Patterns', description: 'Advanced React patterns for better code', category: 'code', image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400' },
    { id: 3, title: 'UI Animation', description: 'Create beautiful micro-interactions', category: 'design', image: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400' },
    { id: 4, title: 'API Design', description: 'Best practices for RESTful APIs', category: 'code', image: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400' },
    { id: 5, title: 'Color Theory', description: 'Master the art of color in design', category: 'design', image: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400' },
    { id: 6, title: 'TypeScript Tips', description: 'Level up your TypeScript skills', category: 'code', image: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400' },
  ];

  const suggestedUsers = [
    { id: 1, name: 'Emma Wilson', role: 'Product Designer', followers: '12.5K' },
    { id: 2, name: 'David Park', role: 'Frontend Dev', followers: '8.2K' },
    { id: 3, name: 'Lisa Chen', role: 'UX Researcher', followers: '6.8K' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pt-16">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Explore</h1>
          <p className="text-muted-foreground">Discover new content, people, and ideas</p>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anything..."
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <button className="px-4 py-3 bg-card border border-border rounded-xl text-foreground hover:border-primary/50 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
          <div className="flex bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={\`px-3 py-3 transition-colors \${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}\`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={\`px-3 py-3 transition-colors \${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}\`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-4 px-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={\`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all \${
                  activeCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground hover:border-primary/50'
                }\`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Suggested Users */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">People to Follow</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
            {suggestedUsers.map((person) => (
              <div
                key={person.id}
                className="flex-shrink-0 w-48 p-4 bg-card border border-border rounded-2xl text-center hover:border-primary/50 transition-colors"
              >
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xl">
                    {person.name.charAt(0)}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">{person.name}</h3>
                <p className="text-muted-foreground text-xs mb-2">{person.role}</p>
                <p className="text-xs text-muted-foreground mb-3">{person.followers} followers</p>
                <button className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Explore Grid */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Discover</h2>
          <div className={\`grid gap-4 \${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}\`}>
            {exploreItems.map((item) => (
              <div
                key={item.id}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
              >
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-xs line-clamp-2">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    path: "src/pages/ProfilePage.tsx",
    content: `import { Camera, MapPin, Link as LinkIcon, Calendar, Edit, Settings } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type { User } from '../types';

interface ProfilePageProps {
  user: User;
  onEdit: () => void;
}

export function ProfilePage({ user, onEdit }: ProfilePageProps) {
  const stats = [
    { label: 'Posts', value: 47 },
    { label: 'Followers', value: '2.1K' },
    { label: 'Following', value: 384 },
  ];

  const recentActivity = [
    { id: 1, type: 'post', text: 'Shared a new project update', time: '2 hours ago' },
    { id: 2, type: 'like', text: 'Liked Sarah\'s post', time: '4 hours ago' },
    { id: 3, type: 'comment', text: 'Commented on Design Systems', time: 'Yesterday' },
    { id: 4, type: 'follow', text: 'Started following Alex Chen', time: '2 days ago' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pt-16">
      {/* Cover Image */}
      <div className="h-48 bg-gradient-to-br from-primary via-primary/80 to-accent relative">
        <button className="absolute bottom-4 right-4 p-2 bg-background/20 backdrop-blur-sm rounded-lg text-white hover:bg-background/30 transition-colors">
          <Camera className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Profile Header */}
        <div className="relative -mt-16 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary to-accent p-1 shadow-xl">
                <div className="w-full h-full rounded-xl bg-card flex items-center justify-center overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-primary">
                      {user.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <button className="absolute -bottom-2 -right-2 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:opacity-90 transition-opacity">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Name & Actions */}
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
                <p className="text-muted-foreground">@{user.email?.split('@')[0]}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={onEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
                <button className="p-2 bg-card border border-border rounded-xl text-foreground hover:border-primary/50 transition-colors">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bio & Info */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <p className="text-foreground mb-4">
            {user.bio || 'No bio yet. Click Edit Profile to add one!'}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {user.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{user.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4" />
              <span className="text-primary">yourwebsite.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>Joined December 2024</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="text-foreground text-sm">{activity.text}</p>
                  <p className="text-muted-foreground text-xs">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    path: "src/pages/SettingsPage.tsx",
    content: `import { useState } from 'react';
import { 
  User, Bell, Shield, Palette, Globe, HelpCircle, LogOut, 
  ChevronRight, Moon, Sun, Smartphone, Mail, Lock, Eye
} from 'lucide-react';
import type { User as UserType } from '../types';

interface SettingsPageProps {
  user: UserType;
  onSignOut: () => void;
}

export function SettingsPage({ user, onSignOut }: SettingsPageProps) {
  const [isDark, setIsDark] = useState(true);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    marketing: false,
  });

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Profile Settings', description: 'Update your personal information' },
        { icon: Mail, label: 'Email Preferences', description: 'Manage your email settings' },
        { icon: Lock, label: 'Password & Security', description: 'Keep your account secure' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: Bell, label: 'Notifications', description: 'Choose what alerts you receive' },
        { icon: Palette, label: 'Appearance', description: 'Customize how the app looks' },
        { icon: Globe, label: 'Language', description: 'English (US)', value: 'English' },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { icon: Shield, label: 'Privacy Settings', description: 'Control your data and visibility' },
        { icon: Eye, label: 'Activity Status', description: 'Show when you\'re active' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', description: 'Get help and find answers' },
        { icon: Smartphone, label: 'About', description: 'Version 1.0.0' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pt-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* User Card */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <span className="text-primary-foreground font-bold text-xl">
                {user.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Theme Toggle */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
              </div>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className={\`w-12 h-7 rounded-full transition-colors relative \${isDark ? 'bg-primary' : 'bg-muted'}\`}
            >
              <div className={\`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform \${isDark ? 'translate-x-6' : 'translate-x-1'}\`} />
            </button>
          </div>
        </div>

        {/* Notification Toggles */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <h3 className="font-semibold text-foreground mb-4">Notifications</h3>
          <div className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-foreground capitalize">{key} Notifications</span>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
                  className={\`w-12 h-7 rounded-full transition-colors relative \${value ? 'bg-primary' : 'bg-muted'}\`}
                >
                  <div className={\`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform \${value ? 'translate-x-6' : 'translate-x-1'}\`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{section.title}</h3>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {section.items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      className={\`w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left \${
                        index !== section.items.length - 1 ? 'border-b border-border' : ''
                      }\`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{item.label}</p>
                        <p className="text-muted-foreground text-xs">{item.description}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className="w-full mt-6 flex items-center justify-center gap-2 p-4 bg-destructive/10 text-destructive rounded-2xl font-medium hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>

        {/* Version */}
        <p className="text-center text-muted-foreground text-sm mt-6">
          Version 1.0.0 • Made with ❤️
        </p>
      </div>
    </div>
  );
}
`
  },
  // ============= MAIN APP =============
  {
    path: "src/App.tsx",
    content: `import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { Navbar } from './components/Navbar';
import './App.css';

type Page = 'landing' | 'signin' | 'signup' | 'onboarding' | 'home' | 'explore' | 'profile' | 'settings';

function AppContent() {
  const { user, isLoading, signIn, signUp, signOut, completeOnboarding } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent animate-pulse" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    if (currentPage === 'signin') {
      return (
        <AuthPage
          mode="signin"
          onSubmit={async (email, password) => {
            await signIn(email, password);
            setCurrentPage('home');
          }}
          onToggleMode={() => setCurrentPage('signup')}
          onBack={() => setCurrentPage('landing')}
        />
      );
    }

    if (currentPage === 'signup') {
      return (
        <AuthPage
          mode="signup"
          onSubmit={async (email, password, name) => {
            await signUp(email, password, name || '');
            setCurrentPage('onboarding');
          }}
          onToggleMode={() => setCurrentPage('signin')}
          onBack={() => setCurrentPage('landing')}
        />
      );
    }

    return (
      <LandingPage
        onGetStarted={() => setCurrentPage('signup')}
        onSignIn={() => setCurrentPage('signin')}
      />
    );
  }

  // Logged in but not onboarded
  if (!user.isOnboarded) {
    return (
      <OnboardingPage
        user={user}
        onComplete={(data) => {
          completeOnboarding(data);
          setCurrentPage('home');
        }}
      />
    );
  }

  // Logged in and onboarded
  const handleSignOut = () => {
    signOut();
    setCurrentPage('landing');
  };

  const mainPages = ['home', 'explore', 'profile', 'settings'];
  if (!mainPages.includes(currentPage)) {
    setCurrentPage('home');
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page as Page)}
        onSignOut={handleSignOut}
      />

      {currentPage === 'home' && <HomePage user={user} />}
      {currentPage === 'explore' && <ExplorePage />}
      {currentPage === 'profile' && <ProfilePage user={user} onEdit={() => {}} />}
      {currentPage === 'settings' && <SettingsPage user={user} onSignOut={handleSignOut} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
`
  },
  {
    path: "src/App.css",
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 5%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 5%;
  --popover-foreground: 0 0% 98%;
  --primary: 160 84% 39%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 270 60% 50%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 50.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 160 84% 39%;
  --radius: 0.75rem;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Utility Classes */
.bg-background { background-color: hsl(var(--background)); }
.bg-foreground { background-color: hsl(var(--foreground)); }
.bg-card { background-color: hsl(var(--card)); }
.bg-primary { background-color: hsl(var(--primary)); }
.bg-secondary { background-color: hsl(var(--secondary)); }
.bg-muted { background-color: hsl(var(--muted)); }
.bg-accent { background-color: hsl(var(--accent)); }
.bg-destructive { background-color: hsl(var(--destructive)); }

.text-foreground { color: hsl(var(--foreground)); }
.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.text-primary { color: hsl(var(--primary)); }
.text-primary-foreground { color: hsl(var(--primary-foreground)); }
.text-destructive { color: hsl(var(--destructive)); }

.border-border { border-color: hsl(var(--border)); }
.border-primary { border-color: hsl(var(--primary)); }

/* Animations */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out forwards;
}

.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-700 { animation-delay: 0.7s; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Gradients */
.bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
.bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
.from-primary { --tw-gradient-from: hsl(var(--primary)); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, transparent); }
.to-accent { --tw-gradient-to: hsl(var(--accent)); }
.via-background { --tw-gradient-via: hsl(var(--background)); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-via), var(--tw-gradient-to, transparent); }

/* Line clamp */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Safe area padding */
.safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }
`
  },
  {
    path: "src/lib/utils.ts",
    content: `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`
  },
  {
    path: "src/main.tsx",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  },
];

// Get the default files as a Record<string, string> for easy access
export function getDefaultProjectFilesMap(): Record<string, string> {
  const fileMap: Record<string, string> = {};
  DEFAULT_PROJECT_FILES.forEach((file) => {
    fileMap[file.path] = file.content;
  });
  return fileMap;
}
