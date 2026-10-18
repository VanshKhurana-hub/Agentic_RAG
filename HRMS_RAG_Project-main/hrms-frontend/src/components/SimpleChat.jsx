import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Menu, X, UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SimpleChat() {
  // Chat State
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your AI HRMS Assistant. How can I help you today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Upload Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('General');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); 
  const fileInputRef = useRef(null);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch mock JWT token for local development
  useEffect(() => {
    const fetchTestToken = async () => {
      try {
        const response = await fetch('http://localhost:5030/api/test-token?username=bob_dev');
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('jwt_token', data.token ? data.token : data);
        }
      } catch (error) {
        console.error("Could not fetch test token.", error);
      }
    };
    if (!localStorage.getItem('jwt_token')) fetchTestToken();
  }, []);

  // --- Chat Logic ---
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setInputText('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('jwt_token') || 'mock_token';
      const sessionId = 'default_session';

      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          message: userText,
          active_documents: [], 
          session_id: sessionId
        }),
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data = await response.json();

      let responseText = data.reply || data.answer || "No response received.";
      if (typeof responseText === 'object' && responseText !== null) {
        responseText = responseText.reply || responseText.text || JSON.stringify(responseText);
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: responseText }]);

    } catch (error) {
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        text: `⚠️ Connection Error: ${error.message}. Make sure your FastAPI backend is running.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Document Upload Logic ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const token = localStorage.getItem('jwt_token') || 'mock_token';
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', uploadCategory);

      const response = await fetch('http://127.0.0.1:8000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      
      const data = await response.json();
      setUploadStatus({ 
        type: 'success', 
        text: `Successfully uploaded ${selectedFile.name}!` 
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setMessages(prev => [...prev, {
        role: 'system',
        text: `System: Document "${data.filename}" uploaded to ${data.category}.`
      }]);

    } catch (error) {
      setUploadStatus({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* Side Document Upload Panel (MOVED TO LEFT) */}
      <aside 
        className={`bg-white border-r border-slate-200 shadow-xl transition-all duration-300 ease-in-out shrink-0 overflow-y-auto ${
          isPanelOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full border-none'
        }`}
      >
        <div className="p-6 w-80">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <FileText className="text-indigo-600" size={20} />
            <h2 className="font-bold text-lg">Document Upload</h2>
          </div>

          <div className="space-y-5">
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Knowledge Base Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                disabled={isUploading}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 outline-none"
              >
                <option value="General">General / Miscellaneous</option>
                <option value="HR_Policy">HR Policy</option>
                <option value="Leave_Policy">Leave & Time Off</option>
                <option value="Onboarding">Onboarding Manual</option>
              </select>
            </div>

            {/* File Dropzone / Selector */}
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.doc,.docx,.txt"
              />
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                  selectedFile 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <UploadCloud size={28} className={selectedFile ? 'text-indigo-600 mb-2' : 'text-slate-400 mb-2'} />
                {selectedFile ? (
                  <p className="text-sm font-semibold text-indigo-700 break-all">{selectedFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-700">Click to select file</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT</p>
                  </>
                )}
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleFileUpload}
              disabled={!selectedFile || isUploading}
              className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${
                selectedFile && !isUploading
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isUploading ? (
                <><Loader2 size={18} className="animate-spin" /> Indexing...</>
              ) : (
                <>Upload Document</>
              )}
            </button>

            {/* Status Messages */}
            {uploadStatus && (
              <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                uploadStatus.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {uploadStatus.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                <span>{uploadStatus.text}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative transition-all duration-300">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
          
          <div className="flex items-center gap-4">
            {/* Toggle Panel Button (MOVED TO LEFT SIDE) */}
            <button 
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={`p-2.5 rounded-xl transition-all ${isPanelOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
              title="Upload Document"
            >
              {isPanelOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md">
                <Bot size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">HRMS Agent</h1>
                <p className="text-xs font-medium text-slate-500">Connected to LangGraph Backend</p>
              </div>
            </div>
          </div>

        </header>

        {/* Chat Messages Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                
                {msg.role === 'system' ? (
                   <div className="text-xs font-medium text-slate-500 bg-slate-200/50 px-4 py-1.5 rounded-full">
                     {msg.text}
                   </div>
                ) : (
                  <div className="flex items-end gap-3 max-w-[85%]">
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mb-1">
                        <Bot size={18} />
                      </div>
                    )}

                    <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mb-1">
                        <User size={18} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-end gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mb-1">
                    <Bot size={18} />
                  </div>
                  <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area */}
        <footer className="bg-white border-t border-slate-200 p-4 shrink-0">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1 bg-slate-100 rounded-2xl p-2 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex items-center">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Message the HR Assistant..."
                className="w-full bg-transparent resize-none max-h-32 min-h-10 py-2 px-3 outline-none text-slate-800 placeholder-slate-400 text-base"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className={`p-3.5 rounded-xl shrink-0 transition-all ${
                inputText.trim() && !isLoading
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>
        </footer>
      </div>

    </div>
  );
}