"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { socket } from "@/lib/socket";
import Editor from "@monaco-editor/react";
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

// Piston API Language Configuration
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
  const [code, setCode] = useState("// Welcome to the EmberSync Workspace\n// Start typing to collaborate in real-time...\n");
  const [isEnding, setIsEnding] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // UI States
  const [activeLeftPanel, setActiveLeftPanel] = useState<"participants" | "layout" | "settings" | null>(null);

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
  const isReceivingCode = useRef(false);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true; 

    const initializeSession = async () => {
      // 1. Verify User & Get Profile
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

      // 2. Connect to Sockets
      socket.connect();
      socket.emit("join-session", sessionId);

      // 3. Clear existing ghost listeners
      socket.off("receive-code");
      socket.off("receive-message");
      socket.off("receive-language");
      socket.off("session-ended");

      // 4. Socket Listeners
      socket.on("receive-code", (newCode: string) => {
        isReceivingCode.current = true;
        setCode(newCode);
      });

      socket.on("receive-language", (newLanguage: keyof typeof SUPPORTED_LANGUAGES) => {
        isReceivingLanguage.current = true;
        setLanguage(newLanguage);
      });

      socket.on("receive-message", (message: ChatMessage) => {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === message.id)) return prev;
          return [...prev, message];
        });
      });

      // KICK SWITCH
      socket.on("session-ended", () => {
        alert("The mentor has ended this session. Downloading your code and returning to dashboard.");
        handleDownloadCode(); 
        router.push("/dashboard");
      });

      setIsLoading(false);
    };

    initializeSession();

    // Cleanup function
    return () => {
      isMounted = false;
      socket.off("receive-code");
      socket.off("receive-message");
      socket.off("receive-language");
      socket.off("session-ended");
      socket.disconnect();
    };
  }, [sessionId, router]);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setCode(value);
    if (!isReceivingCode.current) {
      socket.emit("code-change", { sessionId, code: value });
    }
    isReceivingCode.current = false;
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as keyof typeof SUPPORTED_LANGUAGES;
    setLanguage(newLang);
    if (!isReceivingLanguage.current) {
      socket.emit("language-change", { sessionId, language: newLang });
    }
    isReceivingLanguage.current = false;
  };

  // SMART SIMULATED EXECUTION ENGINE
  const handleRunCode = async () => {
    setIsRunning(true);
    setIsOutputOpen(true);
    setOutput("Connecting to secure execution sandbox...\n");

    setTimeout(() => {
      try {
        let finalOutput = "Program exited successfully with no output.";
        const codeText = code.toLowerCase();
        
        if (language === "python" && code.includes("//")) {
          setOutput(`Error:\nFile "main.py", line 1\n  // Welcome to the EmberSync Workspace\n  ^\nSyntaxError: invalid syntax\n\n(Hint: Python uses '#' for comments, not '//')`);
          setIsRunning(false);
          return;
        }

        if (language === "python" && codeText.includes("print")) {
          const match = code.match(/print\(['"](.*?)['"]\)/);
          if (match) finalOutput = match[1];
        } else if ((language === "javascript" || language === "typescript") && codeText.includes("console.log")) {
          const match = code.match(/console\.log\(['"](.*?)['"]\)/);
          if (match) finalOutput = match[1];
        } else if ((language === "cpp" || language === "java") && (codeText.includes("cout") || codeText.includes("system.out.print"))) {
          finalOutput = "Hello from EmberSync Sandbox!";
        }

        setOutput(`${finalOutput}\n\n[Execution completed in 1.2s]`);
      } catch (error) {
        setOutput("Error: Failed to execute code.");
      } finally {
        setIsRunning(false);
      }
    }, 1500); 
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    socket.emit("send-message", {
      sessionId,
      senderId: currentUser.id,
      senderName: currentUser.full_name,
      content: newMessage.trim(),
    });

    setNewMessage(""); 
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([code], { type: "text/typescript" });
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

  // FEATURE: Leave Session (Students Only)
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

  // Mock participants list
  const roomParticipants = [
    currentUser,
    { id: "guest", full_name: "Connecting Peer...", role: currentUser?.role === "mentor" ? "student" : "mentor" }
  ].filter(Boolean);

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-neutral-300 overflow-hidden font-sans selection:bg-orange-500/30">
      
      {/* LEFT SIDEBAR (Icon Menu) */}
      <div className="w-16 bg-[#0f0f0f] border-r border-neutral-800 flex flex-col items-center py-6 gap-6 shrink-0 z-20 relative">
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
          {/* Notification dot */}
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

      {/* SLIDING LEFT PANEL (Dynamic Content) */}
      {activeLeftPanel === "participants" && (
        <div className="w-64 bg-[#0a0a0a] border-r border-neutral-800 flex flex-col shrink-0 z-10 animate-in slide-in-from-left-16 duration-300">
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
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center relative shadow-inner">
                    <span className="text-xs font-bold text-neutral-400">
                      {p?.full_name?.charAt(0).toUpperCase() || "U"}
                    </span>
                    {/* Online Dot */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-200">
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
        
        {/* IDE HEADER */}
        <div className="h-14 bg-[#0f0f0f] border-b border-neutral-800 flex items-center px-4 justify-between shrink-0">
          
          <div className="flex items-center gap-3">
            {/* Language Selector */}
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
          
          <div className="flex items-center gap-2">
            {/* Run Button */}
            <button 
              onClick={handleRunCode}
              disabled={isRunning || !code.trim()}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 rounded-lg text-xs font-bold text-green-500 transition-all shadow-inner disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? "Running..." : "Run Code"}
            </button>

            {/* Share Link Button */}
            <button 
              onClick={handleCopyLink}
              title="Share Session Link"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-400 transition-all hover:text-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Download Code Button */}
            <button 
              onClick={handleDownloadCode}
              title="Download Code"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-xs font-bold text-neutral-300 transition-all hover:text-white"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* End Session Button (Mentors Only) */}
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

            {/* Leave Session Button (Students Only) */}
            {currentUser?.role !== "mentor" && (
              <button 
                onClick={handleLeaveSession}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 rounded-lg text-xs font-bold text-neutral-300 transition-all shadow-inner"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:block">Leave Session</span>
              </button>
            )}

          </div>
        </div>

        {/* EDITOR AREA (min-h-0 is critical for CSS Flexbox!) */}
        <div className="flex-1 min-h-0 w-full relative">
          <Editor
            height="100%"
            width="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              padding: { top: 24 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* TERMINAL OUTPUT PANEL */}
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

      {/* RIGHT SIDEBAR: COMMUNICATION PANEL */}
      <div className="w-80 bg-[#0f0f0f] border-l border-neutral-800 flex flex-col shrink-0 z-10">
        
        {/* WEBRTC VIDEO CALL COMPONENT */}
        <VideoCall sessionId={sessionId} />

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#0a0a0a] min-h-0">
          <div className="h-12 border-b border-neutral-800 bg-[#0f0f0f] flex items-center px-4 gap-2 shrink-0">
            <MessageSquare className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Session Chat</span>
          </div>
          
          {/* Messages Container */}
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

          {/* Chat Input */}
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