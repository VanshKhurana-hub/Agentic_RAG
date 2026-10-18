import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Paperclip, Send, Plus, MessageSquare, User, Zap, Bot, Loader2, 
  UploadCloud, FileText, Database, ShieldCheck, CheckSquare, Square,
  Table, RefreshCw, FolderOpen, History, Layers, Play, Sparkles,
  CheckCircle2, AlertCircle, CornerDownLeft, Search, Filter, X
} from 'lucide-react';

// ============================================================================
// HELPER: CONVERT UTC TIMESTAMPS TO INDIAN STANDARD TIME (IST - UTC+5:30)
// ============================================================================
const formatToIST = (dateString) => {
  if (!dateString) return '-';

  const utcString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const dateObj = new Date(utcString);

  if (isNaN(dateObj.getTime())) return dateString;

  return dateObj.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// ============================================================================
// HELPER: EVEN = employee_1, ODD = employee_2, FUTURE/DEFAULT = employee_1
// ============================================================================
const getAssignedUser = (sessId = '') => {
  const str = String(sessId);
  if (!str || str === 'default_session') return 'employee_1';

  const digits = str.replace(/\D/g, '');
  if (digits.length > 0) {
    const lastDigit = parseInt(digits[digits.length - 1], 10);
    return lastDigit % 2 === 0 ? 'employee_1' : 'employee_2';
  }
  return 'employee_1';
};

// ============================================================================
// SUB-COMPONENT 1: CHAT WINDOW
// ============================================================================
function ChatWindow({
  isChatStarted,
  startNewChatSession,
  chatHistory,
  isLoading,
  isUploading,
  message,
  setMessage,
  handleSendMessage,
  sessionId,
  messagesEndRef,
  activeDocCount
}) {
  return (
    <div className="flex flex-col h-full bg-slate-50/70 relative z-0">
      {/* Header */}
      <header className="h-16 border-b border-slate-200/80 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md shadow-xs shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="bg-linear-to-br from-indigo-600 to-blue-600 p-2.5 rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center">
            <Bot className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-lg tracking-tight">AI HRMS Assistant</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                RAG 6.0
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeDocCount} Active RAG Document{activeDocCount !== 1 ? 's' : ''} Grounded
            </p>
          </div>
        </div>

        {isChatStarted && (
          <button
            onClick={startNewChatSession}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl transition-all border border-indigo-200/60 shadow-xs cursor-pointer active:scale-95"
          >
            <Plus size={14} />
            New Session
          </button>
        )}
      </header>

      {/* Welcome Screen vs Conversation Feed */}
      {!isChatStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
          <div className="max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
            <div className="w-16 h-16 bg-linear-to-tr from-indigo-500 to-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/25">
              <Sparkles size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2.5 tracking-tight">Welcome to AI Chat Bot</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Your enterprise HR assistant is ready. Query company policies, leave guidelines, or onboarding manuals securely grounded in your knowledge base.
            </p>
            <button
              onClick={startNewChatSession}
              className="w-full py-3.5 px-6 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-95"
            >
              <Play size={16} className="fill-white" />
              Start Chat Session
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth select-text">
            {chatHistory.map((chat, index) => (
              <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : chat.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                {chat.role === 'system' ? (
                  <div className="text-xs font-medium text-slate-600 bg-slate-200/70 px-4 py-1.5 rounded-full shadow-xs border border-slate-300/60">
                    {chat.text}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 max-w-[85%] xl:max-w-3xl">
                    {chat.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bot size={16} />
                      </div>
                    )}

                    <div className={`px-5 py-3.5 rounded-2xl shadow-sm ${
                      chat.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-indigo-500/15' 
                        : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-slate-200/40'
                    }`}>
                      {chat.cached && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 mb-2 bg-amber-50 border border-amber-200/80 w-fit px-2.5 py-0.5 rounded-full shadow-2xs">
                          <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Cached Response
                        </div>
                      )}
                      
                      <div className="whitespace-pre-wrap leading-relaxed text-[14.5px]">{chat.text}</div>

                      {chat.sources && chat.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Sources:
                          </span>
                          {chat.sources.map((fileName, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md border border-indigo-200/60 font-mono"
                            >
                              📄 {fileName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {chat.role === 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl rounded-bl-xs px-5 py-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-6 bg-white/80 backdrop-blur-md border-t border-slate-200/80 shrink-0">
            <div className="max-w-4xl mx-auto flex items-end gap-2.5 bg-slate-100/80 rounded-2xl p-2 shadow-inner border border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-3 focus-within:ring-indigo-500/10 transition-all">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask a question about HR policies..."
                className="flex-1 bg-transparent resize-none max-h-32 min-h-10 outline-none py-2 px-3 text-slate-800 placeholder-slate-400 text-sm select-text"
                rows={1}
                disabled={isLoading || isUploading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!message.trim() || isLoading || isUploading}
                className={`p-2.5 rounded-xl shrink-0 transition-all duration-200 shadow-xs cursor-pointer ${
                  message.trim()
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/25 active:scale-95' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="max-w-4xl mx-auto flex items-center justify-between px-2 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CornerDownLeft size={10} /> Enter to send, Shift + Enter for new line
              </span>
              <span>Active Session: <strong className="text-slate-600 font-mono">{sessionId}</strong></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT 2: DOCUMENT MANAGER (Knowledge Base & Checkboxes)
// ============================================================================
function DocumentManager({
  selectedCategory,
  setSelectedCategory,
  isUploading,
  isLoading,
  fileInputRef,
  handleFileChange,
  documentHistory,
  toggleDocumentSelection,
  isFetchingDocs,
  fetchDocuments,
  gridSearch,
  setGridSearch,
  gridSort,
  setGridSort,
  filteredDocHistory
}) {
  return (
    <div className="flex flex-col h-full bg-slate-50/70 overflow-y-auto p-8 select-text">
      <div className="max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-200">
        
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="text-indigo-600 w-6 h-6" />
              Document Control Panel
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload files and toggle checkboxes to filter which documents are Searchable by AI for responses.
            </p>
          </div>

          <button
            onClick={fetchDocuments}
            disabled={isFetchingDocs}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200 shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} className={isFetchingDocs ? "animate-spin text-indigo-600" : ""} />
            Refresh Documents
          </button>
        </div>

        {/* Upload Section & Active Filtering Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Upload Box */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                Upload New Document
              </h3>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Category Tag
                </label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={isUploading || isLoading}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all cursor-pointer disabled:opacity-50"
                >
                  <option value="General">General / Miscellaneous</option>
                  <option value="HR_Policy">HR Policy</option>
                  <option value="Code_of_Conduct">Code of Conduct</option>
                  <option value="Leave_Policy">Leave & Time Off</option>
                  <option value="Onboarding">Onboarding Manual</option>
                </select>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.doc,.docx,.txt"
              />

              <div 
                onClick={() => !isUploading && !isLoading && fileInputRef.current.click()}
                className={`relative group rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 overflow-hidden border-2 border-dashed ${
                  isUploading || isLoading 
                    ? 'bg-slate-50 border-slate-300 cursor-wait opacity-80' 
                    : 'bg-indigo-50/40 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-500 cursor-pointer'
                }`}
              >
                <div className="relative z-10">
                  {isUploading ? (
                    <>
                      <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-indigo-700">Uploading & Indexing...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                        <UploadCloud size={24} className="text-indigo-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1">Upload to {selectedCategory}</p>
                      <p className="text-xs text-slate-500">Supports PDF, DOCX, TXT (Max 10MB)</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Checkbox RAG Selector */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Active Document Filter
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Checked documents can be queried by the AI.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {documentHistory.filter(d => d.isSelected).length} Active
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 flex-1">
              {documentHistory.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  <FolderOpen size={24} className="mb-2 text-slate-300" />
                  No documents found in knowledge base.
                </div>
              ) : (
                documentHistory.map((doc) => (
                  <div 
                    key={doc.hash} 
                    onClick={() => toggleDocumentSelection(doc.hash)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      doc.isSelected 
                        ? 'bg-indigo-50/60 border-indigo-300 text-slate-900 shadow-2xs' 
                        : 'bg-slate-50/60 border-slate-200/80 opacity-60 text-slate-500 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {doc.isSelected ? (
                        <CheckSquare className="text-indigo-600 w-5 h-5 shrink-0" />
                      ) : (
                        <Square className="text-slate-400 w-5 h-5 shrink-0" />
                      )}
                      <span className="text-xs font-semibold truncate">
                        {doc.filename}
                      </span>
                    </div>
                    <span className="text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 font-mono shrink-0">
                      {doc.category}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Document Upload History Table */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FolderOpen size={16} className="text-indigo-600" />
              Document Upload History
            </h3>

            {/* Search & Sort Toolbar */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={gridSearch}
                  onChange={(e) => setGridSearch(e.target.value)}
                  placeholder="Search file, category..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:border-indigo-500 outline-none"
                />
              </div>
              <select
                value={gridSort}
                onChange={(e) => setGridSort(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold w-16">ID</th>
                  <th className="py-3 px-4 font-semibold w-32">Uploaded By</th>
                  <th className="py-3 px-4 font-semibold">File Name</th>
                  <th className="py-3 px-4 font-semibold w-36">Category</th>
                  <th className="py-3 px-4 font-semibold w-40 text-right">Upload Date (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDocHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No matching documents found.
                    </td>
                  </tr>
                ) : (
                  filteredDocHistory.map((doc, idx) => (
                    <tr key={doc.id || doc.hash} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">#{doc.id || idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{doc.uploaded_by || "HR_Admin"}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-xs" title={doc.filename}>{doc.filename}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {doc.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-right font-mono text-[11px] whitespace-nowrap">
                        {doc.uploaded_at ? formatToIST(doc.uploaded_at) : 'Today'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT 3: CHAT HISTORY VIEW (Fixed Split-Screen Layout)
// ============================================================================
function ChatHistoryView({
  sessionId,
  setSessionId,
  availableSessions,
  fetchSessionHistory,
  isFetchingHistory,
  gridSearch,
  setGridSearch,
  gridSort,
  setGridSort,
  filteredSessionLogs,
  previewSessionId,
  onOpenSessionPreview,
  sessionLogs
}) {
  const previewMessages = sessionLogs.filter(
    (log) => log.session_id === previewSessionId
  );

  const activeUser = getAssignedUser(previewSessionId);

  return (
    <div className="flex flex-col h-full bg-slate-50/70 overflow-hidden p-8 select-text">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 animate-in fade-in duration-200">
        
        {/* Title & Toolbar Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History className="text-indigo-600 w-6 h-6" />
                 Chat History Logs
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Select a message row on the left to inspect all messages from that session on the right.
              </p>
            </div>

            <button
              onClick={fetchSessionHistory}
              disabled={isFetchingHistory}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200 shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} className={isFetchingHistory ? "animate-spin text-indigo-600" : ""} />
              Refresh 
            </button>
          </div>

          <div className="h-px w-full bg-slate-100"></div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Search Query / Message
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={gridSearch}
                  onChange={(e) => setGridSearch(e.target.value)}
                  placeholder="Search ID, user, message..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Sort Order
              </label>
              <select
                value={gridSort}
                onChange={(e) => setGridSort(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name_asc">User (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FIXED SPLIT-SCREEN CONTAINER (Table Left | Preview Right)  */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Left Side: Database Chat Logs Grid */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
              Audit Logs ({filteredSessionLogs.length} entries)
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold w-36">Session ID</th>
                    <th className="py-2.5 px-4 font-semibold w-32">Participant</th>
                    <th className="py-2.5 px-4 font-semibold">Message</th>
                    <th className="py-2.5 px-4 font-semibold w-32 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSessionLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400">
                        No matching chat logs found in database.
                      </td>
                    </tr>
                  ) : (
                    filteredSessionLogs.map((row) => {
                      const isSelected = row.session_id === previewSessionId;
                      const assignedUser = getAssignedUser(row.session_id);
                      const participantLabel = row.role === 'user' ? assignedUser : 'ai bot';

                      return (
                        <tr 
                          key={row.id} 
                          onClick={() => onOpenSessionPreview(row.session_id)}
                          className={`transition-colors cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-50/80 font-medium' 
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-4 text-indigo-600 font-mono text-[11px] font-medium truncate max-w-[130px]" title={row.session_id}>
                            {row.session_id}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border inline-block ${
                              row.role === 'user' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200/60' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                            }`}>
                              {participantLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 truncate max-w-[200px]" title={row.message}>
                            {row.message}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-right font-mono text-[11px] whitespace-nowrap">
                            {row.created_at ? formatToIST(row.created_at) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Side: Fixed Conversation Preview Pane */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Selected Session Conversation
                </span>
                <span className="font-bold text-slate-900 font-mono text-xs">
                  {previewSessionId || "None Selected"}
                </span>
              </div>

              {previewSessionId && previewMessages.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200/60 font-mono shadow-2xs">
                    💬 {previewSessionId}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-300/60 font-mono shadow-2xs">
                    👤 {activeUser}
                  </span>
                </div>
              )}
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {!previewSessionId || previewMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                  Select a chat row on the left to inspect the full conversation.
                </div>
              ) : (
                previewMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 opacity-70 text-[10px]">
                        <span className="font-bold uppercase tracking-wider">
                          {msg.role === 'user' ? getAssignedUser(msg.session_id) : 'ai bot'}
                        </span>
                        <span className="font-mono">
                          {msg.created_at ? formatToIST(msg.created_at) : ''}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">{msg.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT: AI CHAT BOT (Sidebar Navigation Wrapper)
// ============================================================================
export default function ChatInterface() {
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'active' });
  const [previewSessionId, setPreviewSessionId] = useState('default_session');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const [gridSearch, setGridSearch] = useState('');
  const [gridSort, setGridSort] = useState('newest');
  const [availableSessions, setAvailableSessions] = useState(['default_session']);

  const [chatHistory, setChatHistory] = useState(() => {
    const savedChat = localStorage.getItem('hrms_chat_history');
    return savedChat ? JSON.parse(savedChat) : [
      { role: 'assistant', text: 'Hello! I am your HRMS assistant. Ask me a question or upload a document to the knowledge base on the right.', sources: [] }
    ];
  });

  const [documentHistory, setDocumentHistory] = useState([]);
  const [isFetchingDocs, setIsFetchingDocs] = useState(false);
  const [sessionId, setSessionId] = useState('default_session');
  const [sessionLogs, setSessionLogs] = useState([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('General');
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatStarted && activeTab === 'chat') {
      scrollToBottom();
    }
  }, [chatHistory, isLoading, isUploading, isChatStarted, activeTab]);

  useEffect(() => {
    localStorage.setItem('hrms_chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // ---------------------------------------------------------
  // Fetch All Distinct Session IDs from DB for the Dropdown
  // ---------------------------------------------------------
  const fetchSessions = async () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableSessions(data);
        if (data.length > 0 && !previewSessionId) {
          setPreviewSessionId(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load session IDs from DB:", error);
    }
  };

  // ---------------------------------------------------------
  // Auto-Fetch Test Token & Initial DB Data on Load
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchTestToken = async () => {
      try {
        const response = await fetch('http://localhost:5030/api/test-token?username=bob_dev');
        if (response.ok) {
          const data = await response.json();
          const tokenString = data.token ? data.token : data; 
          localStorage.setItem('jwt_token', tokenString);
          fetchDocuments();
          fetchSessions();
        }
      } catch (error) {
        console.error("⚠️ Could not auto-fetch token. Is the ASP.NET sandbox running?", error);
      }
    };

    if (!localStorage.getItem('jwt_token')) {
      fetchTestToken();
    } else {
      fetchDocuments();
      fetchSessions();
    }
  }, []);

  const startNewChatSession = () => {
    const freshSessionId = `session_${Date.now()}`;
    setAvailableSessions((prev) => [...new Set([...prev, freshSessionId])]);
    setSessionId(freshSessionId);
    setPreviewSessionId(freshSessionId);
    setChatHistory([
      { role: 'assistant', text: 'Hello! I am your HRMS assistant. Ask me a question or upload a document to the knowledge base on the right.', sources: [] }
    ]);
    setIsChatStarted(true);
    setActiveTab('chat');
  };

  // ---------------------------------------------------------
  // 1. UPDATED: Fetch Documents from PostgreSQL (Reads is_active)
  // ---------------------------------------------------------
  const fetchDocuments = async () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    setIsFetchingDocs(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        
        setDocumentHistory(() => {
          return data.map(doc => {
            return {
              id: doc.id,
              filename: doc.name,
              category: doc.category,
              uploaded_by: doc.uploaded_by || "HR_Admin",
              uploaded_at: doc.uploaded_at,
              hash: doc.name,
              // ---> READ PERSISTED DB STATUS (defaults to true if null)
              isSelected: doc.is_active !== undefined ? doc.is_active : true
            };
          });
        });
      }
    } catch (error) {
      console.error("Failed to load document history from DB:", error);
    } finally {
      setIsFetchingDocs(false);
    }
  };

  // ---------------------------------------------------------
  // Fetch ALL DB Messages Across All Sessions (For the Grid)
  // ---------------------------------------------------------
  const fetchSessionHistory = async () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    setIsFetchingHistory(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/history/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessionLogs(data);
      } else {
        const fbResponse = await fetch(`http://127.0.0.1:8000/api/history/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (fbResponse.ok) {
          const fbData = await fbResponse.json();
          setSessionLogs(fbData);
        }
      }
    } catch (error) {
      console.error("Failed to load session history from DB:", error);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchSessionHistory();
  }, [sessionId]);

  // ---------------------------------------------------------
  // 2. UPDATED: Toggle Document Checkbox & Persist to Postgres
  // ---------------------------------------------------------
  const toggleDocumentSelection = async (hash) => {
    const targetDoc = documentHistory.find(doc => doc.hash === hash);
    if (!targetDoc) return;

    const newStatus = !targetDoc.isSelected;

    // A. Optimistically update React UI immediately
    setDocumentHistory(prevDocs => 
      prevDocs.map(doc => 
        doc.hash === hash ? { ...doc, isSelected: newStatus } : doc
      )
    );

    showToast(
      `Document "${targetDoc.filename}" is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}`,
      newStatus ? 'active' : 'inactive'
    );

    // B. Send PATCH request to persist choice in PostgreSQL
    try {
      const token = localStorage.getItem('jwt_token') || '';
      const response = await fetch(`http://127.0.0.1:8000/api/documents/${encodeURIComponent(hash)}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status in PostgreSQL');
      }
    } catch (error) {
      console.error("⚠️ Database sync failed, reverting UI checkbox:", error);
      showToast(`Could not persist status for "${targetDoc.filename}"`, 'error');

      // Revert checkbox state if backend request fails
      setDocumentHistory(prevDocs => 
        prevDocs.map(doc => 
          doc.hash === hash ? { ...doc, isSelected: !newStatus } : doc
        )
      );
    }
  };

  // ---------------------------------------------------------
  // FILE UPLOAD LOGIC
  // ---------------------------------------------------------
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    
    const tempUploadId = Date.now();
    setChatHistory(prev => [...prev, { 
      id: tempUploadId,
      role: 'system', 
      text: `Uploading and indexing '${file.name}' under category '${selectedCategory}'...` 
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', selectedCategory); 

      const token = localStorage.getItem('jwt_token') || '';
      const response = await fetch('http://127.0.0.1:8000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData, 
      });

      if (response.status === 409) {
        showToast(`"${file.name}" is already uploaded in the knowledge base.`, 'warning');
        setChatHistory(prev => prev.map(msg => 
          msg.id === tempUploadId 
            ? { ...msg, text: `⚠️ '${file.name}' is already uploaded.` } 
            : msg
        ));
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      showToast(`Successfully uploaded "${file.name}" (${data.chunks_added || 'Multiple'} chunks indexed).`, 'success');

      setChatHistory(prev => prev.map(msg => 
        msg.id === tempUploadId 
          ? { ...msg, text: `✅ Successfully uploaded '${file.name}'! (${data.chunks_added || 'Multiple'} chunks added).` } 
          : msg
      ));

      await fetchDocuments();

    } catch (error) {
      showToast(error.message || `Failed to upload "${file.name}".`, 'error');
      setChatHistory(prev => prev.map(msg => 
        msg.id === tempUploadId 
          ? { ...msg, text: `❌ Failed to upload '${file.name}'. Make sure the backend is running.` } 
          : msg
      ));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------------------------------------------------------
  // STANDARD CHAT LOGIC (Passes active_documents to Backend)
  // ---------------------------------------------------------
  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userText = message.trim();
    
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setMessage('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('jwt_token');

      const activeDocHashes = documentHistory
        .filter(doc => doc.isSelected)
        .map(doc => doc.hash);

      const payload = {
        question: userText,
        active_documents: activeDocHashes,
        session_id: sessionId
      };

      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload), 
      });

      if (response.status === 401) {
          throw new Error("Unauthorized: Your session has expired or token is invalid. Please log in.");
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        text: data.answer,
        cached: data.cached,
        sources: data.sources || []
      }]);

      fetchSessionHistory();
      fetchDocuments(); 
      fetchSessions(); 

    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        text: `⚠️ Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------
  // FILTER & SORT LOGIC FOR CHAT SESSIONS GRID
  // ---------------------------------------------------------
  const filteredSessionLogs = sessionLogs
    .filter((row) => {
      const searchLower = gridSearch.toLowerCase();
      const sessMatch = String(row.session_id || '').toLowerCase().includes(searchLower);
      const userMatch = (row.username || '').toLowerCase().includes(searchLower);
      const msgMatch = (row.message || '').toLowerCase().includes(searchLower);
      return sessMatch || userMatch || msgMatch;
    })
    .sort((a, b) => {
      if (gridSort === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (gridSort === 'name_asc') {
        return (a.username || '').localeCompare(b.username || '');
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  // ---------------------------------------------------------
  // FILTER & SORT LOGIC FOR DOCUMENT HISTORY GRID
  // ---------------------------------------------------------
  const filteredDocHistory = documentHistory
    .filter((doc) => {
      const searchLower = gridSearch.toLowerCase();
      const idMatch = String(doc.id || '').toLowerCase().includes(searchLower);
      const nameMatch = (doc.filename || '').toLowerCase().includes(searchLower);
      const userMatch = (doc.uploaded_by || '').toLowerCase().includes(searchLower);
      const catMatch = (doc.category || '').toLowerCase().includes(searchLower);
      return idMatch || nameMatch || userMatch || catMatch;
    })
    .sort((a, b) => {
      if (gridSort === 'oldest') {
        return new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0);
      }
      if (gridSort === 'name_asc') {
        return (a.filename || '').localeCompare(b.filename || '');
      }
      return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
    });

  const handleTabSwitch = (tabName) => {
    setActiveTab(tabName);
    setGridSearch('');
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-slate-100 select-none text-slate-800">
      
      {/* ========================================================= */}
      {/* FLOATING TOAST POPUP (Bottom Right)                       */}
      {/* ========================================================= */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl transition-all duration-300 border backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success' || toast.type === 'active'
              ? 'bg-slate-900/95 border-emerald-500/30 text-white shadow-emerald-950/20'
              : toast.type === 'warning'
              ? 'bg-slate-900/95 border-amber-500/30 text-white shadow-amber-950/20'
              : 'bg-slate-900/95 border-rose-500/30 text-white shadow-rose-950/20'
          }`}
        >
          {toast.type === 'success' || toast.type === 'active' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-medium tracking-wide">{toast.message}</span>
          <button
            onClick={() => setToast({ show: false, message: '', type: '' })}
            className="text-xs opacity-60 hover:opacity-100 ml-2 font-bold cursor-pointer transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEFT SIDEBAR NAVIGATION MENU (Main Component Nav)          */}
      {/* ========================================================= */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0 border-r border-slate-800/80 justify-between z-20">
        <div>
          {/* Brand Logo & Name */}
          <div className="h-16 px-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-500/25">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base tracking-tight leading-none">
                AI Chat Bot
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-mono">
                HRMS Portal v6.0
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => handleTabSwitch('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare size={18} />
              Chat Window
            </button>

            <button
              onClick={() => handleTabSwitch('documents')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FolderOpen size={18} />
              Document
            </button>

            <button
              onClick={() => handleTabSwitch('history')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History size={18} />
              Chat History
            </button>
          </nav>
        </div>

        {/* Sidebar Footer: System Status */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            System Pipeline
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" />
                Qdrant DB
              </span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-2">
                <FileText size={14} className="text-indigo-400" />
                FastAPI Port
              </span>
              <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-full">
                8000
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN VIEWPORT (Renders Selected Sub-Component)            */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatWindow
            isChatStarted={isChatStarted}
            startNewChatSession={startNewChatSession}
            chatHistory={chatHistory}
            isLoading={isLoading}
            isUploading={isUploading}
            message={message}
            setMessage={setMessage}
            handleSendMessage={handleSendMessage}
            sessionId={sessionId}
            messagesEndRef={messagesEndRef}
            activeDocCount={documentHistory.filter(d => d.isSelected).length}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentManager
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            isUploading={isUploading}
            isLoading={isLoading}
            fileInputRef={fileInputRef}
            handleFileChange={handleFileChange}
            documentHistory={documentHistory}
            toggleDocumentSelection={toggleDocumentSelection}
            isFetchingDocs={isFetchingDocs}
            fetchDocuments={fetchDocuments}
            gridSearch={gridSearch}
            setGridSearch={setGridSearch}
            gridSort={gridSort}
            setGridSort={setGridSort}
            filteredDocHistory={filteredDocHistory}
          />
        )}

        {activeTab === 'history' && (
          <ChatHistoryView
            sessionId={sessionId}
            setSessionId={setSessionId}
            availableSessions={availableSessions}
            fetchSessionHistory={fetchSessionHistory}
            isFetchingHistory={isFetchingHistory}
            gridSearch={gridSearch}
            setGridSearch={setGridSearch}
            gridSort={gridSort}
            setGridSort={setGridSort}
            filteredSessionLogs={filteredSessionLogs}
            previewSessionId={previewSessionId}
            onOpenSessionPreview={setPreviewSessionId}
            sessionLogs={sessionLogs}
          />
        )}
      </main>
    </div>
  );
}