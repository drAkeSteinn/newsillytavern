'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronLeft,
  Settings,
  Users,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function SessionsSidebar() {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    deleteSession,
    getCharacterById,
    sidebarOpen,
    setSidebarOpen,
    setSettingsOpen,
    activeCharacterId
  } = useTavernStore();

  const handleNewChat = () => {
    if (activeCharacterId) {
      createSession(activeCharacterId);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this chat?')) {
      deleteSession(sessionId);
    }
  };

  return (
    <div className={cn(
      'w-64 border-r bg-muted/30 flex flex-col h-full transition-all duration-300 relative z-10',
      !sidebarOpen && 'w-0 overflow-hidden border-r-0'
    )}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Chats</h2>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
          disabled={!activeCharacterId}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="px-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No chats yet</p>
            </div>
          ) : (
            sessions.map((session) => {
              const character = getCharacterById(session.characterId);
              return (
                <div
                  key={session.id}
                  className={cn(
                    'group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                    activeSessionId === session.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted'
                  )}
                  onClick={() => setActiveSession(session.id)}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {character?.avatar ? (
                      <img 
                        src={character.avatar} 
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{session.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.messages.length} messages • {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t space-y-2">
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          Groups
        </Button>
      </div>
    </div>
  );
}
