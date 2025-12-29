import { useState, useRef } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useProfile } from "@/hooks/useProfile";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Camera,
  Edit2,
  Save,
  X,
  Loader2,
  Calendar,
  FolderOpen,
  ExternalLink,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageToggle, useI18n } from "@/lib/i18n";

export default function ProfilePage() {
  const { profile, updateProfile, uploadAvatar, checkUsernameAvailable } = useProfile();
  const { projects } = useProjects();
  const { t } = useI18n();
  
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setLoading(true);
    const { url, error } = await uploadAvatar(file);
    
    if (error) {
      toast.error("Failed to upload avatar");
      setLoading(false);
      return;
    }

    const { error: updateError } = await updateProfile({ avatar_url: url });
    
    if (updateError) {
      toast.error("Failed to update avatar");
    } else {
      toast.success("Avatar updated!");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("Name is required");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (username !== profile?.username) {
      const available = await checkUsernameAvailable(username);
      if (!available) {
        toast.error("Username is already taken");
        return;
      }
    }

    setLoading(true);
    const { error } = await updateProfile({
      display_name: displayName.trim(),
      username: username.toLowerCase(),
      bio: bio.trim() || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated!");
      setEditing(false);
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setDisplayName(profile?.display_name || "");
    setUsername(profile?.username || "");
    setBio(profile?.bio || "");
    setEditing(false);
  };

  const publishedProjects = projects.filter(p => p.is_published);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="glass-card rounded-2xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-primary blur-3xl opacity-20 pointer-events-none" />
          
          {/* Language Toggle in Profile Card */}
          <div className="absolute top-4 right-4 z-10">
            <LanguageToggle />
          
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative mt-8 sm:mt-0">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {profile?.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("displayName")}</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-10 glass-input rounded-lg mt-1"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("username")}</Label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className="h-10 glass-input rounded-lg mt-1"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("bio")}</Label>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="glass-input rounded-lg mt-1 resize-none"
                      rows={3}
                      maxLength={200}
                      placeholder={t("bio")}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-foreground">{profile?.display_name}</h1>
                  <p className="text-muted-foreground">@{profile?.username}</p>
                  {profile?.bio && (
                    <p className="text-foreground/80 mt-2">{profile.bio}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {t("joined")} {new Date(profile?.created_at || "").toLocaleDateString()}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <X className="w-4 h-4 mr-1" />
                    {t("cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-gradient-primary"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        {t("save")}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="glass-button"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  {t("editProfile")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: t("projects"), value: projects.length },
            { label: t("published"), value: publishedProjects.length },
            { label: t("following"), value: 0 },
            { label: t("followers"), value: 0 },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Published Projects */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            {t("publishedProjects")}
          </h2>
          
          {publishedProjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("noPublishedProjects")}
            </p>
          ) : (
            <div className="grid gap-4">
              {publishedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {project.slug && `vipe.dz/app/${project.slug}`}
                    </p>
                  </div>
                  {project.slug && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/app/${project.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
