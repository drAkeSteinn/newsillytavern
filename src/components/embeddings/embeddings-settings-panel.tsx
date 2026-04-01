'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Database,
  Settings,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  FolderOpen,
  Tag,
  BarChart3,
  Globe,
  FileText,
  Layers,
  Upload,
  File,
  Eye,
  ArrowLeft,
  FileCode,
  Code,
  FileType,
  List,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTavernStore } from '@/store/tavern-store';

interface EmbeddingConfig {
  ollamaUrl: string;
  model: string;
  dimension: number;
  similarityThreshold: number;
  maxResults: number;
}

interface EmbeddingRecord {
  id: string;
  content: string;
  metadata: Record<string, any>;
  namespace: string;
  source_type?: string;
  source_id?: string;
  created_at: string;
}

interface NamespaceRecord {
  id: string;
  namespace: string;
  description?: string;
  created_at: string;
  updated_at: string;
  embedding_count?: number;
}

interface DocumentRecord {
  source_id: string;
  source_type: string;
  count: number;
  firstChunk: string;
  created_at: string;
  ids: string[];
}

interface EmbeddingStats {
  totalEmbeddings: number;
  totalNamespaces: number;
  embeddingsByNamespace: Record<string, number>;
  embeddingsBySourceType: Record<string, number>;
}

interface SearchResult {
  id: string;
  content: string;
  namespace: string;
  source_type?: string;
  similarity: number;
}

interface ChunkPreview {
  chunks: string[];
  totalChunks: number;
  totalCharacters: number;
  avgChunkSize: number;
}

const KNOWN_MODELS = [
  { name: 'nomic-embed-text', dimension: 768 },
  { name: 'nomic-embed-text:latest', dimension: 768 },
  { name: 'bge-m3', dimension: 1024 },
  { name: 'bge-m3:567m', dimension: 1024 },
  { name: 'mxbai-embed-large', dimension: 1024 },
  { name: 'all-minilm', dimension: 384 },
  { name: 'snowflake-arctic-embed', dimension: 1024 },
];

const SPLITTER_OPTIONS = [
  {
    value: 'character',
    label: 'Character Text Splitter',
    icon: FileType,
    description: 'Simple split by character count',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  {
    value: 'recursive-character',
    label: 'Recursive Character Splitter',
    icon: List,
    description: 'Tries paragraphs, lines, words for natural breaks',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  {
    value: 'markdown',
    label: 'Markdown Text Splitter',
    icon: FileText,
    description: 'Splits by markdown headings first',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  {
    value: 'code',
    label: 'Code Text Splitter',
    icon: Code,
    description: 'Splits by code structures (classes, functions)',
    defaultChunkSize: 1500,
    defaultOverlap: 300,
  },
];

export function EmbeddingsSettingsPanel() {
  const { toast } = useToast();

  // Config state
  const [config, setConfig] = useState<EmbeddingConfig>({
    ollamaUrl: 'http://localhost:11434',
    model: 'bge-m3:567m',
    dimension: 1024,
    similarityThreshold: 0.5,
    maxResults: 5,
  });

  // Data state
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [namespaces, setNamespaces] = useState<NamespaceRecord[]>([]);
  const [embeddings, setEmbeddings] = useState<EmbeddingRecord[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Individual service status
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [ollamaError, setOllamaError] = useState<string | undefined>();
  const [lanceDBStatus, setLanceDBStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [lanceDBError, setLanceDBError] = useState<string | undefined>();
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [checkingLanceDB, setCheckingLanceDB] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [searchNamespace, setSearchNamespace] = useState<string>('all');
  const [searching, setSearching] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);

  // Dialogs
  const [createEmbeddingOpen, setCreateEmbeddingOpen] = useState(false);
  const [createNamespaceOpen, setCreateNamespaceOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [newEmbedding, setNewEmbedding] = useState({ content: '', namespace: 'default', source_type: 'custom' });
  const [newNamespace, setNewNamespace] = useState({ namespace: '', description: '' });

  // Collapsible sections
  const [configOpen, setConfigOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Namespace documents
  const [nsDocuments, setNsDocuments] = useState<DocumentRecord[]>([]);
  const [viewingNsDocuments, setViewingNsDocuments] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{
    fileName: string;
    fileSize: number;
    content: string;
    characterCount: number;
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [splitterType, setSplitterType] = useState('recursive-character');
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [previewChunks, setPreviewChunks] = useState<ChunkPreview | null>(null);
  const [previewingChunks, setPreviewingChunks] = useState(false);
  const [creatingEmbeddings, setCreatingEmbeddings] = useState(false);
  const [uploadNamespace, setUploadNamespace] = useState('default');
  const [uploadSectionOpen, setUploadSectionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/embeddings/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConfig(data.data);
          setConfigLoaded(true);
        }
      }
    } catch {
      setConfigLoaded(true);
    }
  }, []);

  const saveConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast({ title: 'Config saved', description: 'Embeddings config updated successfully.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save config.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const testConnection = async () => {
    if (!configLoaded) await fetchConfig();
    try {
      const res = await fetch('/api/embeddings/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setOllamaStatus(data.data.connections.ollama ? 'ok' : 'error');
        setOllamaError(data.data.ollamaError);
        setLanceDBStatus(data.data.connections.db ? 'ok' : 'error');
        setLanceDBError(data.data.dbError);
        setConnectionStatus(data.data.connections.db && data.data.connections.ollama ? 'connected' : 'disconnected');
        setStats(data.data.stats);
        setOllamaModels(data.data.ollamaModels || []);
        toast({
          title: 'Connection test',
          description: `Ollama: ${data.data.connections.ollama ? 'Connected' : 'Disconnected'} | LanceDB: ${data.data.connections.db ? 'Connected' : 'Disconnected'}`,
        });
      } else {
        setConnectionStatus('disconnected');
        setOllamaStatus('error');
        setLanceDBStatus('error');
        toast({ title: 'Connection failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      setConnectionStatus('disconnected');
      toast({ title: 'Error', description: 'Failed to test connections.', variant: 'destructive' });
    }
  };

  const checkOllama = async () => {
    setCheckingOllama(true);
    try {
      const res = await fetch(config.ollamaUrl + '/api/tags', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setOllamaModels(models);
        setOllamaStatus('ok');
        setOllamaError(undefined);
        toast({ title: 'Ollama connected', description: `${models.length} models available.` });
      } else {
        setOllamaStatus('error');
        setOllamaError(`HTTP ${res.status}`);
        toast({ title: 'Ollama error', description: `Server returned HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (e: any) {
      setOllamaStatus('error');
      setOllamaError(e.message || 'Cannot reach server');
      toast({ title: 'Ollama unreachable', description: e.message || 'Check that Ollama is running.', variant: 'destructive' });
    }
    setCheckingOllama(false);
  };

  const refreshModels = async () => {
    setRefreshingModels(true);
    try {
      const res = await fetch(config.ollamaUrl + '/api/tags', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setOllamaModels(models);
        setOllamaStatus('ok');
        setOllamaError(undefined);
        toast({ title: 'Models refreshed', description: `Found ${models.length} models from Ollama.` });
      } else {
        toast({ title: 'Refresh failed', description: `HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Refresh failed', description: e.message || 'Cannot reach Ollama.', variant: 'destructive' });
    }
    setRefreshingModels(false);
  };

  const checkLanceDB = async () => {
    setCheckingLanceDB(true);
    try {
      const res = await fetch('/api/embeddings/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLanceDBStatus(data.data.connections.db ? 'ok' : 'error');
        setLanceDBError(data.data.dbError);
        setStats(data.data.stats);
        if (data.data.connections.db) {
          toast({ title: 'LanceDB active', description: 'Database is connected and working.' });
        } else {
          toast({ title: 'LanceDB not available', description: data.data.dbError || 'Could not initialize.', variant: 'destructive' });
        }
      } else {
        setLanceDBStatus('error');
        setLanceDBError(data.error);
        toast({ title: 'LanceDB error', description: data.error || 'Check logs.', variant: 'destructive' });
      }
    } catch {
      setLanceDBStatus('error');
      setLanceDBError('Failed to test');
      toast({ title: 'LanceDB error', description: 'Failed to test connection.', variant: 'destructive' });
    }
    setCheckingLanceDB(false);
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/embeddings/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStats(data.data);
      }
    } catch { /* ignore */ }
    setLanceDBStatus(stats !== null ? 'ok' : 'unknown');
  };

  const loadNamespaces = async () => {
    try {
      const res = await fetch('/api/embeddings/namespaces');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNamespaces(data.data.namespaces);
          if (data.data.dbAvailable === false) {
            setLanceDBStatus('error');
            setLanceDBError(data.data.dbError);
          }
        }
      }
    } catch { /* ignore */ }
  };

  // Load config and namespaces on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchConfig();
      if (mounted) {
        await Promise.all([loadNamespaces(), loadStats()]);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const loadEmbeddings = async (namespace?: string) => {
    try {
      const params = new URLSearchParams();
      if (namespace) params.set('namespace', namespace);
      params.set('limit', '100');
      const res = await fetch(`/api/embeddings?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setEmbeddings(data.data.embeddings);
      }
    } catch { /* ignore */ }
  };

  const loadNamespaceDocuments = async (namespace: string) => {
    setLoadingDocuments(true);
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}/documents`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNsDocuments(data.data.documents);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load documents.', variant: 'destructive' });
    }
    setLoadingDocuments(false);
  };

  const handleViewNamespaceDocuments = (namespace: string) => {
    setViewingNsDocuments(namespace);
    loadNamespaceDocuments(namespace);
  };

  const handleDeleteDocument = async (namespace: string, sourceId: string) => {
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      });
      if (res.ok) {
        toast({ title: 'Document deleted', description: `Document "${sourceId}" and its embeddings removed.` });
        loadNamespaceDocuments(namespace);
        loadStats();
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' });
    }
  };

  const handleClearNamespaceDocuments = async (namespace: string) => {
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}/documents`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Cleared', description: `All documents in "${namespace}" removed.` });
        setNsDocuments([]);
        loadStats();
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to clear namespace.', variant: 'destructive' });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/embeddings/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          namespace: searchNamespace === 'all' ? undefined : searchNamespace,
          limit: config.maxResults,
          threshold: config.similarityThreshold,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.results);
        if (data.data.results.length === 0) {
          toast({ title: 'No results', description: 'No similar embeddings found above the threshold.' });
        }
      }
    } catch {
      toast({ title: 'Search error', description: 'Failed to search embeddings.', variant: 'destructive' });
    }
    setSearching(false);
  };

  const handleCreateEmbedding = async () => {
    if (!newEmbedding.content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmbedding),
      });
      if (res.ok) {
        toast({ title: 'Embedding created', description: 'New embedding stored successfully.' });
        setCreateEmbeddingOpen(false);
        setNewEmbedding({ content: '', namespace: 'default', source_type: 'custom' });
        loadStats();
        if (selectedNamespace) loadEmbeddings(selectedNamespace);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create embedding.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleCreateNamespace = async () => {
    if (!newNamespace.namespace.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings/namespaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNamespace),
      });
      if (res.ok) {
        toast({ title: 'Namespace created', description: `Namespace "${newNamespace.namespace}" created.` });
        setCreateNamespaceOpen(false);
        setNewNamespace({ namespace: '', description: '' });
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create namespace.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleDeleteEmbedding = async (id: string) => {
    try {
      const res = await fetch(`/api/embeddings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Embedding deleted.' });
        loadStats();
        if (selectedNamespace) loadEmbeddings(selectedNamespace);
      }
    } catch { /* ignore */ }
  };

  const handleDeleteNamespace = async (namespace: string) => {
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Deleted',
          description: `Namespace "${namespace}" deleted (${data.deletedEmbeddings || 0} embeddings removed).`,
        });
        setSelectedNamespace(null);
        setViewingNsDocuments(null);
        loadNamespaces();
        loadStats();
      }
    } catch { /* ignore */ }
  };

  const handleResetAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Reset complete',
          description: `Deleted ${data.data.deletedEmbeddings} embeddings and ${data.data.deletedNamespaces} namespaces.`,
        });
        setResetConfirmOpen(false);
        setStats(null);
        setNamespaces([]);
        setEmbeddings([]);
        setSearchResults([]);
        setSelectedNamespace(null);
        setViewingNsDocuments(null);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reset.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleModelChange = (modelName: string) => {
    const knownModel = KNOWN_MODELS.find(m => m.name === modelName);
    setConfig(prev => ({
      ...prev,
      model: modelName,
      dimension: knownModel?.dimension || prev.dimension,
    }));
  };

  const handleSelectNamespace = (ns: string | null) => {
    setSelectedNamespace(ns);
    if (ns) loadEmbeddings(ns);
    else { setEmbeddings([]); loadStats(); }
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'namespaces') { loadNamespaces(); setViewingNsDocuments(null); }
    if (tab === 'embeddings') { loadStats(); if (selectedNamespace) loadEmbeddings(selectedNamespace); }
  };

  // File upload handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/embeddings/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadedFile({
          fileName: data.data.fileName,
          fileSize: data.data.fileSize,
          content: data.data.content,
          characterCount: data.data.characterCount,
        });
        setPreviewChunks(null);
        toast({ title: 'File loaded', description: `${data.data.fileName} (${data.data.characterCount.toLocaleString()} chars)` });
      } else {
        toast({ title: 'Upload failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to upload file.', variant: 'destructive' });
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSplitterChange = (value: string) => {
    setSplitterType(value);
    const opt = SPLITTER_OPTIONS.find(o => o.value === value);
    if (opt) {
      setChunkSize(opt.defaultChunkSize);
      setChunkOverlap(opt.defaultOverlap);
    }
    setPreviewChunks(null);
  };

  const handlePreviewChunks = async () => {
    if (!uploadedFile?.content) return;
    setPreviewingChunks(true);
    try {
      const res = await fetch('/api/embeddings/preview-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadedFile.content,
          splitterType,
          chunkSize,
          chunkOverlap,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewChunks(data.data);
      } else {
        toast({ title: 'Preview failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to preview chunks.', variant: 'destructive' });
    }
    setPreviewingChunks(false);
  };

  const handleCreateEmbeddings = async () => {
    if (!uploadedFile?.content) return;
    setCreatingEmbeddings(true);
    try {
      const res = await fetch('/api/embeddings/create-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadedFile.content,
          namespace: uploadNamespace,
          splitterType,
          chunkSize,
          chunkOverlap,
          source_type: 'file',
          source_id: uploadedFile.fileName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Embeddings created',
          description: `${data.data.createdCount} embeddings in "${uploadNamespace}" (${data.data.errorCount} errors)`,
        });
        setUploadedFile(null);
        setPreviewChunks(null);
        loadStats();
        loadNamespaces();
      } else {
        toast({ title: 'Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create embeddings.', variant: 'destructive' });
    }
    setCreatingEmbeddings(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-purple-600 dark:text-purple-400">
              Vector Embeddings
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Semantic search powered by <strong>Ollama</strong> + <strong>LanceDB</strong>. Store text embeddings and search by meaning, not just keywords.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'disconnected' ? 'destructive' : 'outline'}>
              {connectionStatus === 'connected' ? <CheckCircle className="w-3 h-3 mr-1" /> :
               connectionStatus === 'disconnected' ? <XCircle className="w-3 h-3 mr-1" /> :
               <AlertCircle className="w-3 h-3 mr-1" />}
              {connectionStatus === 'connected' ? 'All Connected' : connectionStatus === 'disconnected' ? 'Issues Detected' : 'Not Tested'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Config Section */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Configuration</span>
          </div>
          <ChevronDown className={cn('w-4 h-4 transition-transform', configOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-3">
          <Card>
            <CardContent className="pt-4 space-y-4">

              {/* Service Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ollama Status Card */}
                <div className={cn(
                  'p-3 rounded-lg border transition-colors',
                  ollamaStatus === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  ollamaStatus === 'error' ? 'border-red-500/30 bg-red-500/5' :
                  'border-border bg-muted/20'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {ollamaStatus === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                       ollamaStatus === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                       <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">Ollama</span>
                    </div>
                    <Badge variant={ollamaStatus === 'ok' ? 'default' : ollamaStatus === 'error' ? 'destructive' : 'outline'}
                      className={cn(ollamaStatus === 'ok' && 'bg-emerald-500 border-emerald-500')}>
                      {ollamaStatus === 'ok' ? 'Connected' : ollamaStatus === 'error' ? 'Error' : 'Unknown'}
                    </Badge>
                  </div>
                  {ollamaError && (
                    <p className="text-[10px] text-red-500/80 mb-2 line-clamp-2">{ollamaError}</p>
                  )}
                  {ollamaStatus === 'ok' && ollamaModels.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mb-2">{ollamaModels.length} models available</p>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={checkOllama} disabled={checkingOllama}>
                      {checkingOllama ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Check
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={refreshModels} disabled={refreshingModels}>
                      {refreshingModels ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Refresh Models
                    </Button>
                  </div>
                </div>

                {/* LanceDB Status Card */}
                <div className={cn(
                  'p-3 rounded-lg border transition-colors',
                  lanceDBStatus === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  lanceDBStatus === 'error' ? 'border-red-500/30 bg-red-500/5' :
                  'border-border bg-muted/20'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {lanceDBStatus === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                       lanceDBStatus === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                       <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">LanceDB</span>
                    </div>
                    <Badge variant={lanceDBStatus === 'ok' ? 'default' : lanceDBStatus === 'error' ? 'destructive' : 'outline'}
                      className={cn(lanceDBStatus === 'ok' && 'bg-emerald-500 border-emerald-500')}>
                      {lanceDBStatus === 'ok' ? 'Active' : lanceDBStatus === 'error' ? 'Error' : 'Unknown'}
                    </Badge>
                  </div>
                  {lanceDBError && (
                    <p className="text-[10px] text-red-500/80 mb-2 line-clamp-2">{lanceDBError}</p>
                  )}
                  {lanceDBStatus === 'ok' && stats && (
                    <p className="text-[10px] text-muted-foreground mb-2">{stats.totalEmbeddings} embeddings, {stats.totalNamespaces} namespaces</p>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={checkLanceDB} disabled={checkingLanceDB}>
                    {checkingLanceDB ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Database className="w-3 h-3 mr-1" />}
                    Check Database
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Ollama URL */}
              <div className="space-y-2">
                <Label className="text-xs">Ollama URL</Label>
                <Input
                  value={config.ollamaUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, ollamaUrl: e.target.value }))}
                  placeholder="http://localhost:11434"
                  className="h-8 text-sm"
                />
              </div>

              {/* Embedding Model */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Embedding Model</Label>
                  {ollamaModels.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground"
                      onClick={refreshModels} disabled={refreshingModels}>
                      {refreshingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </Button>
                  )}
                </div>
                <Select value={config.model} onValueChange={handleModelChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_MODELS.map(m => (
                      <SelectItem key={m.name} value={m.name}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{m.name}</span>
                          <span className="text-[10px] text-muted-foreground">{m.dimension}D</span>
                        </div>
                      </SelectItem>
                    ))}
                    {ollamaModels.filter(m => !KNOWN_MODELS.find(k => k.name === m)).length > 0 && (
                      <>
                        <SelectItem value="__separator__" disabled>
                          <Separator className="my-1" />
                        </SelectItem>
                        {ollamaModels.filter(m => !KNOWN_MODELS.find(k => k.name === m)).map(m => (
                          <SelectItem key={m} value={m}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="truncate">{m}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">Ollama</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {ollamaModels.length === 0 && (
                      <SelectItem value="no-models" disabled>
                        <span className="text-muted-foreground">No models scanned — click "Refresh Models"</span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Similarity Threshold + Max Results (moved here from Advanced) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Umbral de Similitud: {(config.similarityThreshold * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[config.similarityThreshold]}
                    min={0} max={1} step={0.05}
                    onValueChange={([v]) => setConfig(prev => ({ ...prev, similarityThreshold: v }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {config.similarityThreshold === 0 ? 'Cualquier resultado' :
                     config.similarityThreshold >= 0.9 ? 'Solo coincidencias muy cercanas' :
                     config.similarityThreshold >= 0.7 ? 'Coincidencias moderadas' :
                     'Resultados más amplios'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Máx. Resultados: {config.maxResults}</Label>
                  <Slider
                    value={[config.maxResults]}
                    min={1} max={50} step={1}
                    onValueChange={([v]) => setConfig(prev => ({ ...prev, maxResults: v }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Número máximo de embeddings retornados por búsqueda
                  </p>
                </div>
              </div>

              {/* Advanced Settings */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={cn('w-3 h-3 transition-transform', advancedOpen && 'rotate-180')} />
                  Advanced Settings
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Vector Dimension: {config.dimension}</Label>
                    <Input
                      type="number"
                      value={config.dimension}
                      onChange={(e) => setConfig(prev => ({ ...prev, dimension: parseInt(e.target.value) || 1024 }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Save Config Button */}
              <div className="flex gap-2 pt-2">
                <Button onClick={saveConfig} disabled={loading} size="sm" className="flex-1 sm:flex-none">
                  {loading ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Save Config
                </Button>
                <Button onClick={testConnection} size="sm" variant="outline" className="flex-1 sm:flex-none">
                  Test All
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Chat Integration Section */}
      <EmbeddingsChatIntegration />

      {/* File Upload Section */}
      <Collapsible open={uploadSectionOpen} onOpenChange={setUploadSectionOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Upload & Create Embeddings</span>
            {uploadedFile && (
              <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-blue-500">
                {uploadedFile.fileName}
              </Badge>
            )}
          </div>
          <ChevronDown className={cn('w-4 h-4 transition-transform', uploadSectionOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-xs">Upload File</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.json,.csv,.html,.py,.js,.ts,.java,.c,.cpp,.rb,.go,.rs,.xml,.yaml,.yml,.log"
                    onChange={handleFileUpload}
                    className="h-9 text-sm"
                    disabled={uploadingFile}
                  />
                  {uploadingFile && (
                    <Button size="sm" disabled>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Loading...
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Supported: .txt, .md, .json, .csv, .html, code files (.py, .js, .ts, .java, etc.) — Max 10MB
                </p>
              </div>

              {uploadedFile && (
                <>
                  <Separator />

                  {/* File Info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <File className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFile.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(uploadedFile.fileSize)} · {uploadedFile.characterCount.toLocaleString()} characters
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setUploadedFile(null); setPreviewChunks(null); }}>
                      Remove
                    </Button>
                  </div>

                  {/* Namespace Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Target Namespace</Label>
                    <Select value={uploadNamespace} onValueChange={setUploadNamespace}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {namespaces.map(ns => (
                          <SelectItem key={ns.namespace} value={ns.namespace}>{ns.namespace}</SelectItem>
                        ))}
                        <SelectItem value="default">default</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Text Splitter Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Text Splitter</Label>
                    <Select value={splitterType} onValueChange={handleSplitterChange}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPLITTER_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="w-3.5 h-3.5" />
                              <div>
                                <span className="text-sm">{opt.label}</span>
                                <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chunk Size + Overlap */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Chunk Size: {chunkSize} chars</Label>
                      <Slider
                        value={[chunkSize]}
                        min={100} max={4000} step={50}
                        onValueChange={([v]) => { setChunkSize(v); setPreviewChunks(null); }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Overlap: {chunkOverlap} chars</Label>
                      <Slider
                        value={[chunkOverlap]}
                        min={0} max={Math.min(chunkSize, 1000)} step={10}
                        onValueChange={([v]) => { setChunkOverlap(v); setPreviewChunks(null); }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePreviewChunks}
                      disabled={previewingChunks || !uploadedFile}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      {previewingChunks ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                      Preview Chunks
                    </Button>
                    <Button
                      onClick={handleCreateEmbeddings}
                      disabled={creatingEmbeddings || !uploadedFile}
                      size="sm"
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {creatingEmbeddings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Layers className="w-4 h-4 mr-1" />}
                      Create Embeddings
                    </Button>
                  </div>

                  {/* Preview Chunks - Fixed height scrollable */}
                  {previewChunks && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-500" />
                          Chunk Preview
                        </h4>
                        <Badge variant="outline">
                          {previewChunks.totalChunks} chunks · avg {previewChunks.avgChunkSize} chars
                        </Badge>
                      </div>
                      <ScrollArea className="h-48 rounded-lg border">
                        <div className="p-3 space-y-2">
                          {previewChunks.chunks.map((chunk, i) => (
                            <div key={i} className="p-2 rounded bg-muted/50 text-xs font-mono">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1">#{i + 1}</Badge>
                                <span className="text-[10px] text-muted-foreground">{chunk.length} chars</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-3">{chunk}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}

              {!uploadedFile && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Upload a file to create embeddings</p>
                  <p className="text-xs mt-1">Text, markdown, code, and more supported</p>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Main Tabs */}
      <Tabs defaultValue="search" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" className="text-xs">
            <Search className="w-3 h-3 mr-1" />Search
          </TabsTrigger>
          <TabsTrigger value="namespaces" className="text-xs">
            <FolderOpen className="w-3 h-3 mr-1" />Namespaces
          </TabsTrigger>
          <TabsTrigger value="embeddings" className="text-xs">
            <Database className="w-3 h-3 mr-1" />Browse
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-3 mt-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by meaning... (e.g., 'magic sword', 'ancient forest')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 h-9 text-sm"
            />
            <Select value={searchNamespace} onValueChange={setSearchNamespace}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Namespaces</SelectItem>
                {namespaces.map(ns => (
                  <SelectItem key={ns.namespace} value={ns.namespace}>{ns.namespace}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()} size="sm">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {searchResults.length} results found
              </p>
              <div className="max-h-80 overflow-y-auto space-y-1.5">
                {searchResults.map((result, i) => (
                  <div key={result.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{result.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {(result.similarity * 100).toFixed(1)}% match
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{result.namespace}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">#{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No results found. Try a different query or lower the threshold.</p>
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Type a query to search embeddings by semantic similarity.</p>
              <p className="text-xs mt-1">Results are ranked by cosine similarity.</p>
            </div>
          )}
        </TabsContent>

        {/* Namespaces Tab */}
        <TabsContent value="namespaces" className="space-y-3 mt-3">
          {viewingNsDocuments ? (
            /* Documents View for selected namespace */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewingNsDocuments(null)}>
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back to Namespaces
                </Button>
                <h3 className="text-sm font-medium">Documents in "{viewingNsDocuments}"</h3>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {loadingDocuments ? 'Loading...' : `${nsDocuments.length} documents`}
                </span>
                {nsDocuments.length > 0 && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleClearNamespaceDocuments(viewingNsDocuments)}>
                    <Trash2 className="w-3 h-3 mr-1" />Clear All
                  </Button>
                )}
              </div>

              {loadingDocuments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : nsDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No documents in this namespace</p>
                </div>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="space-y-1.5">
                    {nsDocuments.map(doc => (
                      <div key={doc.source_id} className="p-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-sm font-medium truncate">{doc.source_id}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {doc.count} chunks
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {doc.source_type}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 ml-5">
                              {doc.firstChunk}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1 ml-5">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleDeleteDocument(viewingNsDocuments, doc.source_id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            /* Namespace List View */
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{namespaces.length} namespaces</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { loadNamespaces(); loadStats(); }}>
                    <RefreshCw className="w-3 h-3 mr-1" />Refresh
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => setCreateNamespaceOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" />New
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-80">
                {namespaces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No namespaces yet. Create one to organize embeddings.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {namespaces.map(ns => (
                      <div
                        key={ns.id}
                        className={cn(
                          'p-3 rounded-lg border transition-colors',
                          selectedNamespace === ns.namespace
                            ? 'border-primary bg-primary/5'
                            : 'border-border/40 hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{ns.namespace}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {ns.embedding_count || 0} embeddings
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleViewNamespaceDocuments(ns.namespace)}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Docs
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteNamespace(ns.namespace)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {ns.description && (
                          <p className="text-xs text-muted-foreground mt-1 ml-5">{ns.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* Browse Embeddings Tab */}
        <TabsContent value="embeddings" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedNamespace ? `${embeddings.length} in "${selectedNamespace}"` : `${stats?.totalEmbeddings || 0} total`}
              </span>
              {selectedNamespace && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleSelectNamespace(null)}>
                  Show all
                </Button>
              )}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { loadStats(); loadNamespaces(); loadEmbeddings(selectedNamespace || undefined); }}>
                <RefreshCw className="w-3 h-3 mr-1" />Refresh
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => setCreateEmbeddingOpen(true)}>
                <Plus className="w-3 h-3 mr-1" />Add
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-80">
            {embeddings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No embeddings stored yet.</p>
                <p className="text-xs mt-1">Add embeddings manually or import from files above.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {embeddings.map(emb => (
                  <div key={emb.id} className="p-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{emb.content}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            <Tag className="w-2.5 h-2.5 mr-0.5" />
                            {emb.namespace}
                          </Badge>
                          {emb.source_type && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Globe className="w-2.5 h-2.5 mr-0.5" />
                              {emb.source_type}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(emb.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleDeleteEmbedding(emb.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Danger Zone */}
          {stats && stats.totalEmbeddings > 0 && (
            <div className="pt-3">
              <Separator className="mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-destructive">Danger: Reset all data</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setResetConfirmOpen(true)}>
                  <Trash2 className="w-3 h-3 mr-1" />Reset All
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Embedding Dialog */}
      <Dialog open={createEmbeddingOpen} onOpenChange={setCreateEmbeddingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Embedding</DialogTitle>
            <DialogDescription>Store a new text embedding for semantic search.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={newEmbedding.content}
                onChange={(e) => setNewEmbedding(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter the text to embed..."
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Namespace</Label>
                <Select value={newEmbedding.namespace} onValueChange={(v) => setNewEmbedding(prev => ({ ...prev, namespace: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">default</SelectItem>
                    {namespaces.map(ns => (
                      <SelectItem key={ns.namespace} value={ns.namespace}>{ns.namespace}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select value={newEmbedding.source_type} onValueChange={(v) => setNewEmbedding(prev => ({ ...prev, source_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="world">World</SelectItem>
                    <SelectItem value="lorebook">Lorebook</SelectItem>
                    <SelectItem value="session">Session</SelectItem>
                    <SelectItem value="memory">Memory</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEmbeddingOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEmbedding} disabled={loading || !newEmbedding.content.trim()}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Namespace Dialog */}
      <Dialog open={createNamespaceOpen} onOpenChange={setCreateNamespaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Namespace</DialogTitle>
            <DialogDescription>Namespaces organize embeddings into logical groups.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newNamespace.namespace}
                onChange={(e) => setNewNamespace(prev => ({ ...prev, namespace: e.target.value }))}
                placeholder="e.g., character-lore, world-history"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={newNamespace.description}
                onChange={(e) => setNewNamespace(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this namespace"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateNamespaceOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateNamespace} disabled={loading || !newNamespace.namespace.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirm Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset All Embeddings</DialogTitle>
            <DialogDescription>
              This will permanently delete all {stats?.totalEmbeddings || 0} embeddings and {stats?.totalNamespaces || 0} namespaces. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleResetAll} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmbeddingsSettingsPanel;

// ============================================
// Chat Integration Sub-component
// ============================================

const DEFAULT_EMBEDDINGS_CHAT = {
  enabled: false,
  maxTokenBudget: 1024,
  namespaceStrategy: 'character' as const,
  showInPromptViewer: true,
};

function EmbeddingsChatIntegration() {
  const [isOpen, setIsOpen] = useState(false);
  const embeddingsChat = useTavernStore((state) => state.settings.embeddingsChat) ?? DEFAULT_EMBEDDINGS_CHAT;
  const updateSettings = useTavernStore((state) => state.updateSettings);

  const handleToggleEnabled = (enabled: boolean) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, enabled },
    });
  };

  const handleStrategyChange = (strategy: 'global' | 'character' | 'session') => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, namespaceStrategy: strategy },
    });
  };

  const handleBudgetChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, maxTokenBudget: value },
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium">Chat Integration</span>
          {embeddingsChat.enabled && (
            <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-violet-500">Active</Badge>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Automatically retrieve relevant embeddings when chatting and inject them as context into the AI prompt.
              Works in both normal and group chats.
            </p>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Enable in Chat</Label>
                <p className="text-[10px] text-muted-foreground">
                  Search embeddings on every message and add context to the prompt
                </p>
              </div>
              <Switch
                checked={embeddingsChat.enabled}
                onCheckedChange={handleToggleEnabled}
              />
            </div>

            {embeddingsChat.enabled && (
              <>
                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs">Namespace Search Strategy</Label>
                  <Select value={embeddingsChat.namespaceStrategy} onValueChange={(v) => handleStrategyChange(v as 'global' | 'character' | 'session')}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="character">
                        <div className="flex flex-col">
                          <span>Per-Character</span>
                          <span className="text-[10px] text-muted-foreground">Search character-specific + default + world namespaces</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="session">
                        <div className="flex flex-col">
                          <span>Per-Session</span>
                          <span className="text-[10px] text-muted-foreground">Search session-specific + character + default namespaces</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="global">
                        <div className="flex flex-col">
                          <span>Global (All)</span>
                          <span className="text-[10px] text-muted-foreground">Search all namespaces regardless of character or session</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Context Token Budget: ~{embeddingsChat.maxTokenBudget} tokens</Label>
                  <Slider
                    value={[embeddingsChat.maxTokenBudget]}
                    min={128}
                    max={4096}
                    step={128}
                    onValueChange={([v]) => handleBudgetChange(v)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Limits how many tokens of embeddings context are added to the prompt. Higher values give more context but use more of the context window.
                  </p>
                </div>

                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Brain className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-violet-600 dark:text-violet-400">How it works</p>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>When you send a message, the system generates a vector embedding of your text</li>
                        <li>It searches the selected namespaces for similar embeddings</li>
                        <li>Top results are injected into the AI prompt as context</li>
                        <li>The AI uses this context to generate more informed responses</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
