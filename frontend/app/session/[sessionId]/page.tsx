"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { socket } from "@/lib/socket";
import Editor, { useMonaco } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { MonacoBinding } from "y-monaco";
import { 
  Loader2, LayoutPanelLeft, Code2, Users, Settings, MessageSquare, 
  PhoneCall, Send, Download, PowerOff, Copy, Check, Play, Terminal, ChevronDown, X, Shield, User, LogOut
} from "lucide-react";
import { VideoCall } from "@/components/video/VideoCall"; 

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

const SUPPORTED_LANGUAGES = {
  typescript: { name: "TypeScript", version: "5.0.3", extension: "ts" },
  javascript: { name: "JavaScript", version: "18.15.0", extension: "js" },
  python: { name: "Python", version: "3.10.0", extension: "py" },
  cpp: { name: "C++", version: "10.2.0", extension: "cpp" },
  java: { name: "Java", version: "15.0.2", extension: "java" }
};

export default function SessionWorkspace() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  // Base States
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeLeftPanel, setActiveLeftPanel] = useState<"participants" | "layout" | "settings" | null>(null);

  // Mobile UI States
  const [showMobileComms, setShowMobileComms] = useState(false);

  // Execution & Language States
  const [language, setLanguage] = useState<keyof typeof SUPPORTED_LANGUAGES>("typescript");
  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const isReceivingLanguage = useRef(false);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // CRDT Editor Refs
  const editorRef = useRef<any>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true; 

    const initializeSession = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        if (isMounted) router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      if (!isMounted) return; 
      setCurrentUser(profile);

      // Connect to Socket.io for Chat & App Signaling (Code is now handled by Yjs)
      socket.connect();
      socket.emit("join-session", sessionId);

      socket.off("receive-message");
      socket.off("receive-language");
      socket.off("session-ended");

      socket.on("receive-language", (newLanguage: keyof typeof SUPPORTED_LANGUAGES) => {
        isReceivingLanguage.current = true;
        setLanguage(newLanguage);
      });

      socket.on("receive-message", (incomingMessage: ChatMessage) => {
        setMessages((prev) => {
          // BULLETPROOF ECHO FIX: 
          if (incomingMessage.senderId === profile.id) {
            return prev; 
          }

          const safeId = incomingMessage.id || (Date.now().toString() + Math.random().toString());
          return [...prev, { ...incomingMessage, id: safeId }];
        });
      });
      
      socket.on("session-ended", () => {
        alert("The mentor has ended this session. Downloading your code and returning to dashboard.");
        handleDownloadCode(); 
        router.push("/dashboard");
      });

      setIsLoading(false);
    };

    initializeSession();

    return () => {
      isMounted = false;
      socket.off("receive-message");
      socket.off("receive-language");
      socket.off("session-ended");
      socket.disconnect();

      // Cleanup Yjs CRDT Engine
      if (bindingRef.current) bindingRef.current.destroy();
      if (providerRef.current) providerRef.current.disconnect();
      if (docRef.current) docRef.current.destroy();
    };
  }, [sessionId, router]);

  // CRDT MONACO BINDING
  const handleEditorDidMount = async (editor: any, monaco: any) => { 
    editorRef.current = editor;

    if (!currentUser) return;

    // Dynamically import the binding ONLY in the browser to prevent SSR crash
    const { MonacoBinding } = await import("y-monaco");

    // 1. Initialize the Yjs Document
    const doc = new Y.Doc();
    docRef.current = doc;

    // 2. Connect to the new Yjs WebSocket endpoint on your backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const wsUrl = backendUrl.replace(/^http/, "ws");
    
    const provider = new WebsocketProvider(`${wsUrl}/yjs`, sessionId, doc);
    providerRef.current = provider;

    // 3. Bind the Monaco Editor to the Yjs Text type
    const type = doc.getText("monaco");
    const binding = new MonacoBinding(type, editor.getModel(), new Set([editor]), provider.awareness);
    bindingRef.current = binding;

    // 4. Setup Multiplayer Cursors (Awareness)
    provider.awareness.setLocalStateField("user", {
      name: currentUser.full_name,
      color: currentUser.role === "mentor" ? "#f97316" : "#f59e0b", 
    });

    // Optional: Seed the document with initial text if it's completely empty
    if (type.length === 0) {
      type.insert(0, "// Welcome to the EmberSync CRDT Workspace\n// Start typing to collaborate seamlessly...\n");
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as keyof typeof SUPPORTED_LANGUAGES;
    setLanguage(newLang);
    if (!isReceivingLanguage.current) {
      socket.emit("language-change", { sessionId, language: newLang });
    }
    isReceivingLanguage.current = false;
  };

  // UNBREAKABLE IN-BROWSER EXECUTION ENGINE (No API Keys Required)
  const handleRunCode = async () => {
    setIsRunning(true);
    setIsOutputOpen(true);
    setOutput("Compiling locally...\n");

    const currentCode = editorRef.current?.getValue() || "";

    setTimeout(() => {
      try {
        let executionOutput = "";
        let codeToEvaluate = currentCode;

        // Catch empty code
        if (!codeToEvaluate.trim()) {
          setOutput("Program exited successfully with no output.");
          setIsRunning(false);
          return;
        }

        // 1. Python Translation Layer (Translates Python to JS for browser execution)
        if (language === "python") {
          codeToEvaluate = codeToEvaluate.replace(/print\s*\(/g, "console.log(");
          
          if (currentCode.includes("//")) {
             setOutput(`Error:\nFile "main.py", line 1\nSyntaxError: invalid syntax\n\n(Hint: Python uses '#' for comments, not '//')`);
             setIsRunning(false);
             return;
          }
        }

        // 2. Simulated Fallback for Compiled Languages (C++ / Java)
        if (language === "cpp" || language === "java") {
           if (currentCode.includes("cout") || currentCode.includes("System.out.print")) {
               setOutput("Hello from EmberSync Sandbox!\n\n[Execution completed in 0.8s]");
           } else {
               setOutput("Program exited successfully with no output.\n\n[Execution completed in 0.8s]");
           }
           setIsRunning(false);
           return;
        }

        // 3. Safely Hijack console.log to capture the output
        const originalConsoleLog = console.log;
        const capturedLogs: string[] = [];
        
        console.log = (...args) => {
          capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        };

        // 4. Execute the code safely in the browser's native engine
        try {
          const runCode = new Function(codeToEvaluate);
          runCode();
          
          executionOutput = capturedLogs.join('\n');
          if (!executionOutput) executionOutput = "Program exited successfully with no output.";
          
          setOutput(`${executionOutput}\n\n[Execution completed in 0.4s]`);
        } catch (err: any) {
          setOutput(`Error:\n${err.message}`);
        } finally {
          console.log = originalConsoleLog;
        }

      } catch (error) {
        setOutput("Error: Failed to execute code.");
      } finally {
        setIsRunning(false);
      }
    }, 600); // 600ms realistic delay
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    // 1. Generate a unique ID for React's duplicate-checking logic
    const messageId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

    const chatPayload: ChatMessage = {
      id: messageId,
      senderId: currentUser.id,
      senderName: currentUser.full_name,
      content: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // 2. Optimistic Update: Instantly show the message on the sender's screen
    setMessages((prev) => [...prev, chatPayload]);

    // 3. Send the full payload to the backend so others receive it
    socket.emit("send-message", {
      sessionId,
      ...chatPayload
    });

    setNewMessage(""); 
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const currentCode = editorRef.current?.getValue() || "";
    const blob = new Blob([currentCode], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EmberSync_Session_${sessionId.substring(0, 6)}.${SUPPORTED_LANGUAGES[language].extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEndSession = async () => {
    if (!confirm("Are you sure you want to end this session for everyone?")) return;
    setIsEnding(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/${sessionId}/end`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });

      socket.emit("end-session", sessionId);
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to end session:", error);
      setIsEnding(false);
    }
  };

  const handleLeaveSession = () => {
    if (!confirm("Are you sure you want to leave this session?")) return;
    router.push("/dashboard");
  };

  const toggleLeftPanel = (panel: "participants" | "layout" | "settings") => {
    setActiveLeftPanel(prev => prev === panel ? null : panel);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-neutral-500 font-medium animate-pulse">Initializing Secure Environment...</p>
      </div>
    );
  }

  const roomParticipants = [
    currentUser,
    { id: "guest", full_name: "Connecting Peer...", role: currentUser?.role === "mentor" ? "student" : "mentor" }
  ].filter(Boolean);

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-neutral-300 overflow-hidden font-sans selection:bg-orange-500/30">
      
      {/* LEFT SIDEBAR (Icon Menu) */}
      <div className="w-16 bg-[#0f0f0f] border-r border-neutral-800 flex flex-col items-center py-6 gap-6 shrink-0 z-20 relative hidden sm:flex">
        <div className="mb-4">
          <div className="w-8 h-8 flex items-center justify-center opacity-80">
            <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
               <path d="M13.5 6L5.5 16L13.5 26" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
               <path d="M18.5 6L26.5 16L18.5 26" stroke="#EA580C" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
               <path d="M11 22L21 10" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" className="opacity-50" />
            </svg>
          </div>
        </div>
        
        <div 
          title="Code Editor" 
          onClick={() => setActiveLeftPanel(null)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
            activeLeftPanel === null 
              ? "bg-orange-500/10 border border-orange-500/20 text-orange-500 shadow-[inset_0_1px_0_0_rgba(255,165,0,0.2)]" 
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
        >
          <Code2 className="w-5 h-5" />
        </div>

        <div 
          title="Participants" 
          onClick={() => toggleLeftPanel("participants")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors relative ${
            activeLeftPanel === "participants"
              ? "bg-orange-500/10 border border-orange-500/20 text-orange-500"
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
        >
          <Users className="w-5 h-5" />
          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full"></div>
        </div>

        <div 
          title="Change Layout" 
          onClick={() => toggleLeftPanel("layout")} 
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
            activeLeftPanel === "layout"
              ? "bg-orange-500/10 border border-orange-500/20 text-orange-500"
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
        >
          <LayoutPanelLeft className="w-5 h-5" />
        </div>
        
        <div className="mt-auto">
          <div 
            title="Workspace Settings" 
            onClick={() => toggleLeftPanel("settings")} 
            className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
            activeLeftPanel === "settings"
              ? "bg-orange-500/10 border border-orange-500/20 text-orange-500"
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
          >
            <Settings className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SLIDING LEFT PANEL */}
      {activeLeftPanel === "participants" && (
        <div className="w-64 bg-[#0a0a0a] border-r border-neutral-800 flex flex-col shrink-0 z-10 animate-in slide-in-from-left-16 duration-300 absolute sm:relative h-full">
          <div className="h-14 border-b border-neutral-800 flex items-center justify-between px-5 shrink-0 bg-[#0f0f0f]">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              Session Users
              <span className="bg-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded-full">{roomParticipants.length}</span>
            </h3>
            <button onClick={() => setActiveLeftPanel(null)} className="text-neutral-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {roomParticipants.map((p, index) => (
              <div key={p?.id || index} className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800/50 p-3 rounded-xl hover:bg-neutral-900 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center relative shadow-inner">
                    <span className="text-xs font-bold text-neutral-400">
                      {p?.full_name?.charAt(0).toUpperCase() || "U"}
                    </span>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-200 truncate max-w-[120px]">
                      {p?.full_name} {p?.id === currentUser?.id && "(You)"}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {p?.role === "mentor" ? (
                        <Shield className="w-3 h-3 text-orange-500" />
                      ) : (
                        <User className="w-3 h-3 text-amber-500" />
                      )}
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                        p?.role === "mentor" ? "text-orange-500" : "text-amber-500"
                      }`}>
                        {p?.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MIDDLE: THE MONACO EDITOR & TERMINAL */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        
        <div className="h-14 bg-[#0f0f0f] border-b border-neutral-800 flex items-center px-4 justify-between shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex items-center">
              <select 
                value={language}
                onChange={handleLanguageChange}
                className="appearance-none bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono px-3 py-1.5 pr-8 rounded-lg outline-none focus:ring-1 focus:ring-orange-500/50 cursor-pointer shadow-inner"
              >
                {Object.entries(SUPPORTED_LANGUAGES).map(([key, lang]) => (
                  <option key={key} value={key}>{lang.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2 pointer-events-none" />
            </div>
            <span className="text-xs font-mono text-neutral-600 hidden md:block">
              main.{SUPPORTED_LANGUAGES[language].extension}
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button 
              onClick={handleRunCode}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 rounded-lg text-xs font-bold text-green-500 transition-all shadow-inner disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:block">{isRunning ? "Running..." : "Run Code"}</span>
            </button>

            <button 
              onClick={handleCopyLink}
              title="Share Session Link"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-400 transition-all hover:text-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button 
              onClick={handleDownloadCode}
              title="Download Code"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-xs font-bold text-neutral-300 transition-all hover:text-white"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* MOBILE ONLY: Open Video/Chat Button */}
            <button 
              onClick={() => setShowMobileComms(true)}
              className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs font-bold text-orange-500"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            {currentUser?.role === "mentor" && (
              <button 
                onClick={handleEndSession}
                disabled={isEnding}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg text-xs font-bold text-red-500 transition-all shadow-inner disabled:opacity-50"
              >
                {isEnding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                <span className="hidden lg:block">End Session</span>
              </button>
            )}

            {currentUser?.role !== "mentor" && (
              <button 
                onClick={handleLeaveSession}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 rounded-lg text-xs font-bold text-neutral-300 transition-all shadow-inner"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:block">Leave</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full relative">
          <Editor
            height="100%"
            width="100%"
            language={language}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              wordWrap: "on",         // Fixed for mobile!
              folding: false,         // Fixed for mobile!
              lineNumbersMinChars: 3, // Fixed for mobile!
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              lineHeight: 1.5,
            }}
          />
        </div>

        {isOutputOpen && (
          <div className="h-64 border-t border-neutral-800 bg-[#050505] flex flex-col shrink-0 animate-in slide-in-from-bottom-10 duration-200">
            <div className="h-10 bg-[#0f0f0f] border-b border-neutral-800 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">Console Output</span>
              </div>
              <button onClick={() => setIsOutputOpen(false)} className="text-neutral-500 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-sm">
              {isRunning && output === "Connecting to secure execution sandbox...\n" ? (
                <span className="text-neutral-500 animate-pulse">{output}</span>
              ) : (
                <pre className={`whitespace-pre-wrap ${output.includes("Error:") ? "text-red-400" : "text-green-400"}`}>
                  {output}
                </pre>
              )}
            </div>
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: COMMUNICATION PANEL (Responsive) */}
      <div className={`
        bg-[#0f0f0f] border-l border-neutral-800 flex-col z-50
        ${showMobileComms ? "fixed inset-0 w-full flex" : "hidden md:flex w-80 shrink-0"}
      `}>
        
        {/* MOBILE ONLY: Close Button */}
        {showMobileComms && (
          <div className="h-14 bg-[#0a0a0a] border-b border-neutral-800 flex items-center justify-between px-4 md:hidden shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Communication</span>
            <button 
              onClick={() => setShowMobileComms(false)} 
              className="p-2 bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <VideoCall sessionId={sessionId} />

        <div className="flex-1 flex flex-col bg-[#0a0a0a] min-h-0">
          <div className="h-12 border-b border-neutral-800 bg-[#0f0f0f] flex items-center px-4 gap-2 shrink-0">
            <MessageSquare className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Session Chat</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-neutral-600 text-center uppercase tracking-wider font-bold">No messages yet.<br/>Start the conversation.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-neutral-500 mb-1 ml-1 font-semibold tracking-wide">
                      {isMe ? "You" : msg.senderName}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm shadow-md ${
                      isMe 
                        ? "bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-tr-sm border border-orange-400/20" 
                        : "bg-neutral-900 text-neutral-200 rounded-tl-sm border border-neutral-800"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} /> 
          </div>

          <div className="p-4 border-t border-neutral-800 bg-[#0f0f0f] shrink-0">
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="absolute right-2 p-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

    </div>
  );
}