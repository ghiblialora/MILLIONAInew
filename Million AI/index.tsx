
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- Types ---
type Theme = 'hacker' | 'modern';

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'code' | 'text';
  mimeType: string;
  data: string; // Base64 for binary, string for text
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// --- Utilities ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const readFile = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const isText = file.type.startsWith('text/') || 
                   /\.(js|ts|tsx|jsx|py|java|c|cpp|h|json|md|css|html|xml|sql|txt|env|gitignore)$/i.test(file.name);
    
    const reader = new FileReader();
    
    reader.onload = () => {
      let data = reader.result as string;
      let type: Attachment['type'] = 'text';
      
      if (!isText) {
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type === 'application/pdf') type = 'pdf';
      } else {
        type = 'code'; 
      }

      resolve({
        id: generateId(),
        name: file.name,
        type,
        mimeType: file.type || 'text/plain',
        data
      });
    };
    
    reader.onerror = reject;
    
    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
};

// --- Theme Config ---
const getThemeStyles = (theme: Theme) => {
  if (theme === 'modern') {
    return {
      app: "bg-white text-gray-900 font-sans selection:bg-black selection:text-white",
      
      // Sidebar
      sidebar: "bg-gray-50 border-r border-gray-200",
      sidebarButton: "bg-white text-gray-700 border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all duration-200 rounded-lg px-4",
      sidebarText: "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 rounded-lg px-3",
      sidebarActive: "bg-black text-white font-medium rounded-lg px-3 shadow-md",
      searchInput: "bg-white border border-gray-200 focus:border-gray-400 focus:ring-0 text-gray-900 placeholder-gray-400 rounded-lg shadow-sm",
      
      // Header
      header: "bg-white/80 backdrop-blur-md text-gray-900 border-b border-gray-100 sticky top-0",
      
      scanlines: "hidden",
      
      // Messages
      msgUserContainer: "justify-end",
      msgUserBubble: "bg-gray-100 text-gray-900 rounded-2xl rounded-tr-sm px-4 md:px-5 py-2 md:py-3 max-w-[90%] md:max-w-[85%]",
      
      msgModelContainer: "justify-start",
      msgModelBubble: "bg-transparent text-gray-800 px-0 py-0 w-full",
      
      codeBlock: "border border-gray-200 bg-[#1e1e1e] rounded-xl my-4 overflow-hidden shadow-sm",
      codeHeader: "bg-[#2d2d2d] border-b border-[#3d3d3d] text-gray-300",
      
      // Input
      inputContainer: "bg-gradient-to-t from-white via-white to-transparent pb-4 md:pb-6",
      inputWrapper: "bg-white shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] hover:shadow-[0_0_40px_-5px_rgba(0,0,0,0.15)] transition-shadow rounded-[24px] border border-gray-200 focus-within:border-gray-300",
      inputField: "text-gray-800 placeholder-gray-400",
      
      // Buttons
      sendBtn: "text-gray-400 hover:text-gray-600 rounded-full",
      sendBtnActive: "bg-black text-white hover:bg-gray-800 hover:scale-105 shadow-lg transform transition-all duration-200",
      
      chip: "bg-white border border-gray-200 text-gray-700 shadow-sm rounded-md",
      iconBase: "text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors",
      micActive: "text-white bg-red-500 animate-pulse hover:bg-red-600 shadow-md rounded-full",
      
      fontBase: "font-sans",
      avatarUser: "bg-black text-white shadow-sm",
      avatarModel: "text-black",
      actionBtn: "text-gray-400 hover:text-black hover:bg-gray-100 p-1.5 rounded-md transition-all duration-200"
    };
  }
  
  // Hacker Defaults
  return {
    app: "bg-[#050505] text-[#00ff41] font-mono selection:bg-[#00ff41] selection:text-black",
    
    sidebar: "bg-black border-r border-[#003b00]",
    sidebarButton: "border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition-all duration-200 rounded-none px-4 shadow-[0_0_10px_rgba(0,255,65,0.2)]",
    sidebarText: "text-[#008f11] hover:text-[#00ff41] hover:bg-[#003b00] rounded-none px-3 border-l-2 border-transparent hover:border-[#00ff41]",
    sidebarActive: "bg-[#003b00] text-[#00ff41] font-bold border-l-2 border-[#00ff41] rounded-none px-3",
    searchInput: "bg-black border border-[#003b00] text-[#00ff41] placeholder-[#003b00] focus:border-[#00ff41] focus:shadow-[0_0_15px_rgba(0,255,65,0.3)] rounded-none",
    
    header: "bg-black/90 border-b border-[#003b00] backdrop-blur-sm text-[#00ff41] sticky top-0",
    
    scanlines: "block",
    
    msgUserContainer: "justify-end",
    msgUserBubble: "bg-[#001a00] border border-[#00ff41] text-[#00ff41] rounded-none px-3 md:px-4 py-2 max-w-[95%] md:max-w-[90%] shadow-[0_0_5px_rgba(0,255,65,0.2)]",
    
    msgModelContainer: "justify-start",
    msgModelBubble: "bg-transparent pl-0 w-full text-[#00ff41]",
    
    codeBlock: "border border-[#00ff41] bg-black rounded-none shadow-[0_0_10px_rgba(0,255,65,0.1)] my-4",
    codeHeader: "bg-[#001a00] border-b border-[#00ff41] text-[#00ff41]",
    
    inputContainer: "bg-black border-t border-[#003b00]",
    inputWrapper: "bg-black border border-[#003b00] focus-within:border-[#00ff41] focus-within:shadow-[0_0_20px_rgba(0,255,65,0.2)] transition-all rounded-none",
    inputField: "text-[#00ff41] placeholder-[#003b00] font-mono",
    
    sendBtn: "text-[#003b00] rounded-none",
    sendBtnActive: "bg-[#00ff41] text-black font-bold hover:bg-[#00cc33] hover:shadow-[0_0_15px_#00ff41] rounded-none transition-all",
    
    chip: "bg-[#001a00] border border-[#00ff41] text-[#00ff41] rounded-none shadow-[0_0_5px_rgba(0,255,65,0.3)]",
    iconBase: "text-[#008f11] hover:text-[#00ff41] hover:bg-[#001a00] rounded-none transition-colors",
    micActive: "text-red-500 bg-[#001a00] border border-red-500 animate-pulse rounded-none shadow-[0_0_10px_red]",
    
    fontBase: "font-mono",
    avatarUser: "bg-[#003b00] text-[#00ff41] border border-[#00ff41]",
    avatarModel: "text-[#00ff41]",
    actionBtn: "text-[#008f11] hover:text-[#00ff41] hover:bg-[#003b00] p-1 rounded-none transition-colors border border-transparent hover:border-[#00ff41]"
  };
};

// --- Icons ---
const IconPaperclip = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

const IconFile = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconSun = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IconTerminal = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17l6-6-6-6m8 14h8" />
  </svg>
);

const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconMic = ({ active }: { active: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const IconSend = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

const IconMillion = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M12 0L1.6 6v12L12 24l10.4-6V6L12 0zm0 2.3l8.4 4.9v9.6L12 21.7l-8.4-4.9V7.2L12 2.3z" opacity="0.4"/>
    <path d="M16.5 8l-4.5 2.5L7.5 8 6 8.8l6 3.4 6-3.4L16.5 8z"/>
    <path d="M12 12.5l-6 3.4v1.7l6-3.4 6 3.4v-1.7l-6-3.4z"/>
  </svg>
);

const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconThumbUp = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
);

// --- Components ---

const CodeBlock = ({ code, language, theme, styles }: { code: string, language: string, theme: Theme, styles: any }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.codeBlock}`}>
      <div className={`flex justify-between items-center px-4 py-2 ${styles.codeHeader}`}>
         <span className="text-xs font-medium font-mono opacity-80">{language || 'text'}</span>
         <button
             onClick={handleCopy}
             className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors uppercase tracking-wider`}
           >
             {copied ? (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                 </svg>
                 <span className="text-green-400">Copied</span>
               </>
             ) : (
               <>
                 <IconCopy />
                 <span>Copy</span>
               </>
             )}
           </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1.5rem',
          background: 'transparent',
          fontSize: '0.9rem',
          lineHeight: '1.6',
        }}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const FormattedText = ({ text, theme }: { text: string, theme: Theme }) => {
  const styles = getThemeStyles(theme);
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  const processInlineMarkdown = (content: string, keyPrefix: number) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
        const key = `${keyPrefix}-${idx}`;
        // Headers
        if (line.startsWith('### ')) return <h3 key={key} className="text-lg font-bold mt-4 mb-2 text-inherit">{processBold(line.slice(4))}</h3>;
        if (line.startsWith('## ')) return <h2 key={key} className="text-xl font-bold mt-6 mb-3 text-inherit">{processBold(line.slice(3))}</h2>;
        if (line.startsWith('# ')) return <h1 key={key} className="text-2xl font-bold mt-6 mb-4 text-inherit">{processBold(line.slice(2))}</h1>;
        
        // Lists
        if (line.match(/^[-*] /)) return <li key={key} className="ml-5 list-disc pl-1 my-1 opacity-90">{processBold(line.slice(2))}</li>;
        if (line.match(/^\d+\. /)) return <li key={key} className="ml-5 list-decimal pl-1 my-1 opacity-90">{processBold(line.replace(/^\d+\. /, ''))}</li>;
        
        // Empty lines (paragraph breaks)
        if (!line.trim()) return <div key={key} className="h-2"></div>;
        
        return <p key={key} className="mb-1 leading-relaxed">{processBold(line)}</p>;
    });
  };

  const processBold = (text: string) => {
    const chunks = text.split(/(\*\*.*?\*\*)/g);
    return chunks.map((chunk, i) => {
        if (chunk.startsWith('**') && chunk.endsWith('**')) {
            return <strong key={i} className="font-bold">{chunk.slice(2, -2)}</strong>;
        }
        const codeChunks = chunk.split(/(`.*?`)/g);
        if (codeChunks.length > 1) {
            return codeChunks.map((c, ci) => {
                if (c.startsWith('`') && c.endsWith('`')) {
                    return <code key={`${i}-${ci}`} className={`px-1.5 py-0.5 rounded text-sm font-mono ${theme === 'modern' ? 'bg-gray-200 text-black' : 'bg-[#003b00] text-[#00ff41] border border-[#00ff41]'}`}>{c.slice(1, -1)}</code>;
                }
                return c;
            });
        }
        return chunk;
    });
  };

  return (
    <div className={`whitespace-pre-wrap ${theme === 'hacker' ? 'font-mono text-sm' : 'font-sans text-[15px]'}`}>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const content = part.slice(3, -3).trim();
          const firstLineBreak = content.indexOf('\n');
          let code = content;
          let lang = 'text';
          if (firstLineBreak > -1) {
            const possibleLang = content.substring(0, firstLineBreak).trim();
            if (possibleLang && !possibleLang.includes(' ') && possibleLang.length < 20) {
               lang = possibleLang;
               code = content.substring(firstLineBreak + 1);
            }
          }
          return <CodeBlock key={index} code={code} language={lang} theme={theme} styles={styles} />;
        }
        return <div key={index}>{processInlineMarkdown(part, index)}</div>;
      })}
    </div>
  );
};

const Sidebar = ({ 
  isOpen, 
  toggle, 
  theme, 
  sessions, 
  currentSessionId,
  onNewChat, 
  onSelectSession 
}: { 
  isOpen: boolean, 
  toggle: () => void, 
  theme: Theme,
  sessions: ChatSession[],
  currentSessionId: string,
  onNewChat: () => void,
  onSelectSession: (id: string) => void
}) => {
  const styles = getThemeStyles(theme);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(session => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    const titleMatch = session.title.toLowerCase().includes(query);
    const msgMatch = session.messages.some(m => m.text.toLowerCase().includes(query));
    return titleMatch || msgMatch;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggle}
      />
      
      {/* Sidebar Drawer */}
      <aside className={`
        fixed md:relative z-50 h-full
        w-[280px] 
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'}
        flex flex-col flex-shrink-0 overflow-hidden 
        ${styles.sidebar}
        ${!isOpen && 'md:border-r-0'}
      `}>
        <div className={`p-5 space-y-4 ${theme === 'modern' ? '' : 'border-b border-[#003b00]'}`}>
          <button 
            onClick={() => { onNewChat(); if(window.innerWidth < 768) toggle(); }}
            className={`flex items-center justify-center gap-3 w-full py-3 transition-all ${styles.sidebarButton}`}
          >
            <span className="text-xl leading-none mb-0.5">+</span>
            <span className="text-sm font-semibold">{theme === 'hacker' ? 'INIT_SEQUENCE' : 'New Conversation'}</span>
          </button>

          <div className="relative group">
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={theme === 'hacker' ? "GREP_LOGS..." : "Search history..."}
              className={`w-full px-4 py-2.5 text-sm transition-all outline-none ${styles.searchInput} ${theme === 'hacker' ? '' : 'pl-10'}`}
            />
            {theme === 'modern' && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <IconSearch />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
           <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'hacker' ? 'text-[#008f11]' : 'text-gray-400'}`}>
             {searchTerm ? 'Results' : 'History'}
           </div>
           {filteredSessions.length === 0 && (
               <div className={`px-4 py-8 text-center text-sm opacity-50 italic ${theme === 'hacker' ? 'text-[#008f11]' : 'text-gray-400'}`}>
                   No logs found
               </div>
           )}
           {filteredSessions.map((session) => (
             <button 
               key={session.id} 
               onClick={() => { onSelectSession(session.id); if(window.innerWidth < 768) toggle(); }}
               className={`w-full text-left px-4 py-3 text-sm cursor-pointer truncate transition-all group relative ${
                 currentSessionId === session.id ? styles.sidebarActive : styles.sidebarText
               }`}
             >
               {session.title || (theme === 'hacker' ? `LOG_${session.id.substr(0,4)}` : 'Untitled Chat')}
             </button>
           ))}
        </div>
        
        {theme === 'hacker' && (
          <div className="p-4 border-t border-[#003b00] text-[10px] flex justify-between text-[#008f11]">
            <span>SYS: ONLINE</span>
            <span>v4.0.1</span>
          </div>
        )}
        {theme === 'modern' && (
          <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                   <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${styles.avatarUser}`}>AI</div>
                   <div className="flex flex-col">
                       <span className="font-semibold text-sm text-gray-900">Admin User</span>
                       <span className="text-[11px] text-gray-500">Pro Plan</span>
                   </div>
              </div>
          </div>
        )}
      </aside>
    </>
  );
};

const Login = ({ onLogin }: { onLogin: () => void }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Root@2611') {
      localStorage.setItem('million_ai_auth', 'true');
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => {
        setError(false);
        setShake(false);
      }, 800);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#00ff41] font-mono flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20" style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2))',
          backgroundSize: '100% 4px'
      }}></div>
      
      <div className={`z-10 w-full max-w-md transition-transform duration-100 ${shake ? 'translate-x-2' : ''}`}>
        <div className="border border-[#00ff41] bg-[#050505] p-8 shadow-[0_0_20px_rgba(0,255,65,0.15)] relative">
           <div className="absolute top-0 left-0 w-2 h-2 bg-[#00ff41]"></div>
           <div className="absolute top-0 right-0 w-2 h-2 bg-[#00ff41]"></div>
           <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#00ff41]"></div>
           <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#00ff41]"></div>

           <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 mb-4 text-[#00ff41] animate-pulse">
                 <IconMillion />
              </div>
              <h1 className="text-2xl font-bold tracking-[0.2em] mb-2 text-center">MILLION AI</h1>
              <div className="text-xs tracking-widest opacity-70">RESTRICTED ACCESS // LEVEL 5</div>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider opacity-80 block">Security Clearance Key</label>
                <div className="relative group">
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border-b-2 border-[#003b00] focus:border-[#00ff41] text-[#00ff41] py-2 px-1 outline-none transition-colors font-mono text-lg text-center tracking-widest placeholder-gray-800"
                    placeholder="••••••••"
                    autoFocus
                  />
                  <div className="absolute bottom-0 left-0 h-[2px] bg-[#00ff41] w-0 group-focus-within:w-full transition-all duration-500"></div>
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-center text-sm font-bold animate-pulse border border-red-500 py-1 bg-red-900/20">
                   ACCESS DENIED
                </div>
              )}

              <button 
                type="submit"
                className="w-full border border-[#00ff41] text-[#00ff41] py-3 font-bold tracking-widest hover:bg-[#00ff41] hover:text-black transition-all duration-200 shadow-[0_0_10px_rgba(0,255,65,0.2)] mt-4 group relative overflow-hidden"
              >
                <span className="relative z-10">AUTHENTICATE</span>
              </button>
           </form>

           <div className="mt-8 text-[10px] text-center opacity-40">
             SECURE CONNECTION ESTABLISHED<br/>IP: {Math.floor(Math.random()*255)}.{Math.floor(Math.random()*255)}.{Math.floor(Math.random()*255)}.{Math.floor(Math.random()*255)}
           </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
      try {
        return localStorage.getItem('million_ai_auth') === 'true';
      } catch(e) { return false; }
  });
  
  const [theme, setTheme] = useState<Theme>('hacker');
  const styles = getThemeStyles(theme);

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('million_ai_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
     return localStorage.getItem('million_ai_current_id') || '';
  });

  const getInitialMessages = (): Message[] => {
     if (currentSessionId) {
       const session = sessions.find(s => s.id === currentSessionId);
       if (session) return session.messages;
     }
     return [];
  };

  const [messages, setMessages] = useState<Message[]>(getInitialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
      // Auto-open sidebar on desktop only
      if (window.innerWidth >= 768) {
          setSidebarOpen(true);
      }
  }, []);

  useEffect(() => {
    if (!messages.length && !currentSessionId) return;

    let sessionId = currentSessionId;
    if (!sessionId && messages.length > 0) {
       sessionId = generateId();
       setCurrentSessionId(sessionId);
    }

    if (sessionId) {
        setSessions(prev => {
           const existingIdx = prev.findIndex(s => s.id === sessionId);
           let newSessions = [...prev];
           
           let title = 'New Chat';
           const firstUserMsg = messages.find(m => m.role === 'user');
           if (firstUserMsg) {
              title = firstUserMsg.text.slice(0, 30);
           } else if (existingIdx >= 0) {
              title = prev[existingIdx].title;
           }

           const updatedSession: ChatSession = {
              id: sessionId,
              title,
              messages,
              updatedAt: Date.now()
           };

           if (existingIdx >= 0) {
              newSessions[existingIdx] = updatedSession;
           } else {
              newSessions = [updatedSession, ...newSessions];
           }
           newSessions.sort((a, b) => b.updatedAt - a.updatedAt);
           localStorage.setItem('million_ai_sessions', JSON.stringify(newSessions));
           return newSessions;
        });
        localStorage.setItem('million_ai_current_id', sessionId);
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Voice input not supported.");
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  const handleNewChat = () => {
     const newId = generateId();
     setCurrentSessionId(newId);
     setMessages([]);
     setAttachments([]);
     setInput('');
     if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
     const session = sessions.find(s => s.id === id);
     if (session) {
        setCurrentSessionId(id);
        setMessages(session.messages);
        setAttachments([]);
        setInput('');
        if (window.innerWidth < 768) setSidebarOpen(false);
     }
  };

  const toggleTheme = () => setTheme(prev => prev === 'hacker' ? 'modern' : 'hacker');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        try {
          const att = await readFile(e.target.files[i]);
          newAttachments.push(att);
        } catch (err) { console.error(err); }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files) {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        try {
            const att = await readFile(e.dataTransfer.files[i]);
            newAttachments.push(att);
        } catch(err) { console.error(err); }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    // Ensure API Key exists
    if (!process.env.API_KEY) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Error: API Key is missing. Please set the API_KEY environment variable in your deployment settings.", timestamp: Date.now() }]);
        return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      attachments: [...attachments],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    const currentAttachments = [...attachments];
    const currentInput = input;
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];

      for (const att of currentAttachments) {
        if (att.type === 'code' || att.type === 'text') {
          parts.push({ text: `\n\nFile: ${att.name}\n${att.data}\n\n` });
        } else {
          parts.push({
            inlineData: { mimeType: att.mimeType, data: att.data.split(',')[1] }
          });
        }
      }

      if (currentInput) parts.push({ text: currentInput });

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ parts }],
        config: {
          systemInstruction: theme === 'hacker' 
            ? "You are MILLION AI, an elite coding assistant provided by Million Corp. Output valid Markdown with code blocks. Be concise and technical." 
            : "You are MILLION AI, a helpful and expert AI assistant. Use Markdown formatted text."
        }
      });

      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '', timestamp: Date.now() }]);

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m));
        }
      }
    } catch (error) {
      console.error(error);
      let errorMessage = "Failed to generate response.";
      if (error instanceof Error) {
          errorMessage = error.message;
          if (errorMessage.includes("Unexpected token")) {
             errorMessage = "Error: The API response was invalid (likely a network or auth error). Check your API Key.";
          }
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: errorMessage, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = (text: string) => navigator.clipboard.writeText(text);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div 
      className={`flex h-screen w-full text-base overflow-hidden transition-colors duration-500 ${styles.app}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={`scanlines pointer-events-none fixed inset-0 z-50 opacity-20 ${styles.scanlines}`}></div>
      
      {/* Mobile Header / Menu Button */}
      <button 
        className={`absolute top-3 left-3 z-40 md:hidden p-2 rounded ${theme === 'modern' ? 'bg-white/80 backdrop-blur shadow-sm' : 'text-[#00ff41] border border-[#00ff41] bg-black'} ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={() => setSidebarOpen(true)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      <Sidebar 
        isOpen={sidebarOpen} 
        toggle={() => setSidebarOpen(!sidebarOpen)} 
        theme={theme}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      <div className={`flex-1 flex flex-col relative min-w-0 ${theme === 'modern' ? 'bg-white' : 'bg-[#050505]'}`}>
        {/* Header */}
        <header className={`px-4 md:px-6 py-4 flex justify-between items-center z-20 ${styles.header}`}>
          <div className="ml-10 md:ml-0 flex items-center gap-2 select-none cursor-pointer" onClick={toggleTheme}>
            <div className={`flex items-center justify-center ${theme === 'modern' ? 'text-black' : 'text-[#00ff41]'}`}>
                <div className="w-6 h-6 mr-2">
                    <IconMillion />
                </div>
                {theme === 'modern' ? <span className="text-xl font-bold tracking-tight">MILLION<span className="font-light">AI</span></span> : <span className="text-xl tracking-widest font-bold">MILLION_AI_TERM</span>}
                {theme === 'modern' && <span className="text-xs bg-black text-white px-1.5 py-0.5 rounded ml-2 font-medium">PRO</span>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={toggleTheme}
               className={`p-2.5 rounded-full transition-all ${theme === 'hacker' ? 'hover:bg-[#003b00] text-[#00ff41] hover:shadow-[0_0_10px_#00ff41]' : 'hover:bg-gray-100 text-gray-600'}`}
               title="Toggle Theme"
             >
               {theme === 'hacker' ? <IconSun /> : <IconTerminal /> }
             </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto scroll-smooth" ref={chatContainerRef}>
          <div className="max-w-[850px] mx-auto px-4 md:px-6 pb-6 pt-8 flex flex-col gap-8">
            
            {/* Empty State */}
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center mt-24 opacity-40 select-none animate-fade-in-up">
                 <div className={`w-20 h-20 mb-6 rounded-2xl flex items-center justify-center ${theme === 'hacker' ? 'bg-[#001a00] text-[#00ff41] border border-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.2)]' : 'bg-gray-100 text-black'}`}>
                   <div className="w-10 h-10">
                     <IconMillion />
                   </div>
                 </div>
                 <h2 className="text-3xl font-semibold mb-3 tracking-tight text-center">{theme === 'hacker' ? 'SYSTEM READY' : 'Million AI'}</h2>
                 <p className="text-sm text-center">{theme === 'hacker' ? 'AWAITING INPUT...' : 'How can I help you today?'}</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? styles.msgUserContainer : styles.msgModelContainer}`}>
                
                {/* Avatar for Model */}
                {msg.role === 'model' && (
                   <div className={`hidden md:flex flex-shrink-0 mr-4 mt-1 w-8 h-8 rounded-full items-center justify-center ${styles.avatarModel} ${theme === 'hacker' ? 'border border-[#00ff41] bg-[#001a00]' : ''}`}>
                      <div className="w-6 h-6"><IconMillion /></div>
                   </div>
                )}

                <div className={`relative flex flex-col max-w-full ${msg.role === 'user' ? 'items-end' : 'items-start w-full min-w-0'}`}>
                  
                   {/* Name Label for Model */}
                   {msg.role === 'model' && theme === 'modern' && (
                       <span className="text-sm font-semibold mb-1 ml-1 text-gray-900">Million AI</span>
                   )}
                   {msg.role === 'model' && theme === 'hacker' && (
                       <span className="text-xs font-bold mb-1 text-[#008f11]">CORE_AI</span>
                   )}

                   {/* Bubble / Content */}
                   <div className={`${msg.role === 'user' ? styles.msgUserBubble : styles.msgModelBubble}`}>
                      
                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.attachments.map((att, idx) => (
                            att.type === 'image' ? (
                              <img key={idx} src={att.data} className={`max-w-xs max-h-64 object-cover ${theme === 'modern' ? 'rounded-xl shadow-sm' : 'border border-[#00ff41]'}`} />
                            ) : (
                              <div key={idx} className={`flex items-center gap-2 p-2 ${theme === 'modern' ? 'bg-white rounded-lg shadow-sm' : 'bg-[#001a00] border border-[#00ff41]'}`}>
                                <IconFile /> <span className="text-xs font-medium truncate max-w-[150px]">{att.name}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      
                      <FormattedText text={msg.text} theme={theme} />
                   </div>

                   {/* Model Footer Actions */}
                   {msg.role === 'model' && !isLoading && msg.text && !msg.text.startsWith('Error:') && (
                       <div className={`flex items-center gap-1 mt-2 ml-0 select-none opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${theme === 'hacker' ? 'text-[#008f11]' : 'text-gray-400'}`}>
                           <button onClick={() => copyMessage(msg.text)} className={styles.actionBtn} title="Copy full response">
                               <IconCopy />
                           </button>
                           <button className={styles.actionBtn} title="Good response">
                               <IconThumbUp />
                           </button>
                           <button className={styles.actionBtn} title="Regenerate">
                               <IconRefresh />
                           </button>
                       </div>
                   )}
                </div>
              </div>
            ))}
            
            {isLoading && (
               <div className="flex w-full justify-start animate-pulse">
                  <div className={`flex-shrink-0 mr-4 mt-1 w-8 h-8 rounded-full flex items-center justify-center ${styles.avatarModel}`}>
                      <div className="w-5 h-5"><IconMillion /></div>
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                     <span className={`w-2 h-2 rounded-full animate-bounce ${theme === 'modern' ? 'bg-black' : 'bg-[#00ff41]'}`}></span>
                     <span className={`w-2 h-2 rounded-full animate-bounce delay-75 ${theme === 'modern' ? 'bg-black' : 'bg-[#00ff41]'}`}></span>
                     <span className={`w-2 h-2 rounded-full animate-bounce delay-150 ${theme === 'modern' ? 'bg-black' : 'bg-[#00ff41]'}`}></span>
                  </div>
               </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Input Area */}
        <footer className={`px-4 md:px-6 z-30 ${styles.inputContainer}`}>
           <div className="max-w-[850px] mx-auto">
               {/* Attachment Chips */}
               {attachments.length > 0 && (
                 <div className="flex flex-wrap gap-2 mb-3 pl-2 animate-in slide-in-from-bottom-2 fade-in">
                   {attachments.map(att => (
                     <div key={att.id} className={`relative flex items-center gap-2 pl-2 pr-8 py-1.5 rounded-lg text-xs font-medium ${styles.chip}`}>
                        {att.type === 'image' ? <img src={att.data} className="w-5 h-5 rounded object-cover" /> : <IconFile />}
                        <span className="max-w-[120px] truncate">{att.name}</span>
                        <button onClick={() => removeAttachment(att.id)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full">
                          <IconTrash />
                        </button>
                     </div>
                   ))}
                 </div>
               )}

               <form 
                 onSubmit={handleSubmit}
                 className={`relative flex items-center gap-1 md:gap-2 p-1 md:p-2 pl-2 md:pl-3 ${styles.inputWrapper}`}
               >
                 <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.txt,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.json,.md,.css,.html" />
                 
                 <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-2 md:p-2.5 flex-shrink-0 ${styles.iconBase}`} title="Attach">
                   <IconPaperclip />
                 </button>

                 <button type="button" onClick={toggleListening} className={`p-2 md:p-2.5 flex-shrink-0 transition-all ${isListening ? styles.micActive : styles.iconBase}`} title="Voice">
                   <IconMic active={isListening} />
                 </button>

                 <input
                   className={`flex-1 bg-transparent border-none focus:ring-0 p-2 md:p-2.5 text-sm md:text-[16px] ${styles.inputField} outline-none min-w-0`}
                   placeholder={isListening ? "Listening..." : (theme === 'hacker' ? "ENTER_COMMAND..." : "Ask Million AI...")}
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   autoComplete="off"
                 />

                 <button type="submit" disabled={(!input.trim() && attachments.length === 0) || isLoading} className={`p-2.5 md:p-3 rounded-full flex-shrink-0 flex items-center justify-center ${(!input.trim() && attachments.length === 0) || isLoading ? 'opacity-30 cursor-not-allowed' : styles.sendBtnActive} ${styles.sendBtn} transition-all duration-300 ease-out`}>
                   <IconSend />
                 </button>
               </form>
               <div className={`text-[10px] md:text-[11px] text-center mt-3 opacity-70 ${theme === 'hacker' ? 'text-[#008f11]' : 'text-gray-400'}`}>
                 {theme === 'hacker' ? 'MILLION_AI_V4 // ENCRYPTED_CONNECTION' : 'Million AI can make mistakes. Please double-check important information.'}
               </div>
           </div>
        </footer>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
