import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Project from "./pages/Project";
import OAuthCallback from "./pages/OAuthCallback";
import PublishedApp from "./pages/PublishedApp";
import ProfilePage from "./pages/ProfilePage";
import BuilderPage from "./pages/BuilderPage";
import MessagesPage from "./pages/MessagesPage";
import NewsPage from "./pages/NewsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/project/:projectId" element={<Project />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/app/:slug" element={<PublishedApp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
