'use client';

import { useTavernStore } from '@/store/tavern-store';
import { ChatPanel } from '@/components/tavern/chat-panel';
import { CharacterPanel } from '@/components/tavern/character-panel';
import { SessionsSidebar } from '@/components/tavern/sessions-sidebar';
import { SettingsPanel } from '@/components/tavern/settings-panel';
import { BackgroundGallery } from '@/components/tavern/background-gallery';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  Sparkles, 
  PanelLeftClose,
  PanelLeft,
  Settings,
  Loader2,
  Image as ImageIcon,
  BookOpen,
  MessageSquare
} from 'lucide-react';
import { useState } from 'react';
import { useHydration } from '@/hooks/use-hydration';
import { cn } from '@/lib/utils';

export default function TavernFlow() {
  const { sidebarOpen, setSidebarOpen, settingsOpen, setSettingsOpen, settings, updateSettings } = useTavernStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backgroundGalleryOpen, setBackgroundGalleryOpen] = useState(false);
  const hydrated = useHydration();

  const isNovelMode = settings.chatLayout.novelMode;

  const toggleNovelMode = () => {
    updateSettings({
      chatLayout: {
        ...settings.chatLayout,
        novelMode: !isNovelMode
      }
    });
  };

  const togglePanels = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              TavernFlow
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Novel Mode Toggle */}
          <Button
            variant={isNovelMode ? "default" : "ghost"}
            size="sm"
            className={cn(
              "gap-2",
              isNovelMode ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
            )}
            onClick={toggleNovelMode}
            title={isNovelMode ? "Switch to Normal Mode" : "Switch to Novel Mode"}
          >
            {isNovelMode ? (
              <MessageSquare className="w-4 h-4" />
            ) : (
              <BookOpen className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isNovelMode ? "Normal" : "Novel"}</span>
          </Button>
          
          {/* Background Gallery Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setBackgroundGalleryOpen(true)}
            title="Background Gallery"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          
          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
          
          {/* Panels Toggle */}
          {hydrated && (
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePanels}
              className="hidden md:flex"
              title={sidebarOpen ? "Hide Panels" : "Show Panels"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content - Only render after hydration */}
      <div className="flex-1 flex overflow-hidden">
        {hydrated ? (
          <>
            {/* Sessions Sidebar */}
            <SessionsSidebar />

            {/* Chat Area */}
            <ChatPanel />

            {/* Character Panel */}
            <CharacterPanel />
          </>
        ) : (
          // Placeholder during hydration
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {hydrated && <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />}

      {/* Background Gallery */}
      {hydrated && <BackgroundGallery open={backgroundGalleryOpen} onOpenChange={setBackgroundGalleryOpen} />}

      {/* Mobile Menu Overlay */}
      {hydrated && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r"
            onClick={(e) => e.stopPropagation()}
          >
            <SessionsSidebar />
          </div>
        </div>
      )}
    </div>
  );
}
