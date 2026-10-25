import React, { useState } from 'react';
import { X, Download, Upload, Copy, Check, FileText } from 'lucide-react';
import { MusicSnippet, SnippetPlaylist } from '../types';
import { StorageService } from '../services/storage';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: MusicSnippet[];
  playlists: SnippetPlaylist[];
  onImportSuccess: (data: { snippets: MusicSnippet[]; playlists: SnippetPlaylist[] }) => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  snippets,
  playlists,
  onImportSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const exportData = StorageService.exportJSON(snippets, playlists);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitstream-snippets-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setImportError(null);
    if (!importText.trim()) return;
    const result = StorageService.importJSON(importText);
    if (result) {
      onImportSuccess(result);
      onClose();
    } else {
      setImportError('Invalid JSON format. Please verify the snippet backup data.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Backup & Restore Snippets</h2>
              <p className="text-xs text-slate-400">Export or import your curated music bits</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto text-sm text-slate-300">
          {/* Export Section */}
          <div className="space-y-3">
            <span className="font-semibold text-white block">Export Snippets Library</span>
            <p className="text-xs text-slate-400">
              Download your collection of {snippets.length} bits across {playlists.length} playlists:
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadFile}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" /> Download JSON Backup
              </button>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied to Clipboard' : 'Copy JSON'}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Import Section */}
          <div className="space-y-3">
            <span className="font-semibold text-white block">Import Snippets</span>
            <p className="text-xs text-slate-400">Paste backup JSON or upload a JSON backup file:</p>

            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
            />

            <textarea
              rows={4}
              placeholder="Paste JSON content here..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />

            {importError && <p className="text-xs text-rose-400">{importError}</p>}

            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> Import and Replace Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
