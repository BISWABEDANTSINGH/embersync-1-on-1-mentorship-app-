"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Code2, Video, LogOut, Plus, Link as LinkIcon, 
  Loader2, Sparkles, ChevronRight, FileVideo, 
  Activity, ShieldCheck, Terminal, Cpu
} from "lucide-react";
import { Logo } from "@/components/Logo";

interface UserProfile {
  id: string;
  full_name: string;
  role: "mentor" | "student";
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [joinLink, setJoinLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          router.push("/");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", session.user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(data);
      } catch (err: any) {
        console.error("Error fetching profile:", err.message);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndProfile();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const createSession = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/create`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `${profile?.full_name}'s Mentoring Session` }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");

      router.push(`/session/${data.session.id}`);
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const joinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinLink.trim()) return;
    
    setActionLoading(true);
    setError(null);
    
    try {
      const sessionId = joinLink.split("/").pop(); 

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/${sessionId}/join`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join session");

      router.push(`/session/${sessionId}`);
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-neutral-500 font-mono text-sm tracking-widest uppercase animate-pulse">Initializing Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-300 font-sans selection:bg-orange-500/30 relative overflow-hidden">
      
      {/* Background Architectural Grid & Glows */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10 flex flex-col min-h-screen">
        
        {/* FLOATING GLASS NAVBAR */}
        <header className="flex items-center justify-between bg-neutral-900/40 backdrop-blur-md border border-white/5 px-6 py-4 rounded-2xl shadow-2xl mb-12">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="h-5 w-[1px] bg-neutral-800 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Network Secure</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push("/materials")}
              className="hidden sm:flex items-center justify-center gap-2 px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-orange-500/30 rounded-lg text-neutral-300 transition-all text-xs font-bold shadow-inner"
            >
              <FileVideo className="w-3.5 h-3.5 text-orange-500" />
              Resource Hub
            </button>
            <button 
              onClick={handleSignOut}
              className="flex items-center justify-center p-2 bg-neutral-950 border border-neutral-800 hover:border-red-900/50 rounded-lg text-neutral-500 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* HERO GREETING */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-900/50 border border-neutral-800 rounded-full mb-4">
            <ShieldCheck className={`w-3.5 h-3.5 ${profile?.role === "mentor" ? "text-orange-500" : "text-amber-500"}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Authenticated as {profile?.role}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">{profile?.full_name.split(" ")[0]}</span>.
          </h1>
          <p className="text-neutral-500 text-lg max-w-xl">
            Your high-performance workspace and real-time collaboration environment is standing by.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
             <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
               <LogOut className="w-4 h-4 text-red-500" />
             </div>
             {error}
          </div>
        )}

        {/* MAIN DASHBOARD GRID */}
        <div className="grid lg:grid-cols-3 gap-6 flex-1">
          
          {/* PRIMARY ACTION CARD (Spans 2 columns) */}
          <div className="lg:col-span-2 relative group rounded-3xl overflow-hidden bg-neutral-900/20 border border-white/5 flex flex-col">
            {/* Dynamic Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
            
            <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center flex-1 backdrop-blur-sm">
              {profile?.role === "mentor" ? (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-orange-600/5 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/30 shadow-[inset_0_1px_0_0_rgba(255,165,0,0.4)]">
                    <Terminal className="w-8 h-8 text-orange-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-3">Initialize Workspace</h2>
                  <p className="text-neutral-400 mb-10 leading-relaxed max-w-lg">
                    Deploy a new secure session. This generates an isolated instance with synchronized Monaco editor, multi-language sandbox, and encrypted WebRTC channels.
                  </p>
                  <button
                    onClick={createSession}
                    disabled={actionLoading}
                    className="group/btn relative w-full sm:w-auto self-start flex items-center justify-center gap-3 bg-white text-black font-bold py-4 px-8 rounded-xl transition-all hover:bg-neutral-200 disabled:opacity-50 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-orange-500/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Launch Environment
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-amber-600/5 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/30 shadow-[inset_0_1px_0_0_rgba(255,191,0,0.4)]">
                    <LinkIcon className="w-8 h-8 text-amber-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-3">Connect to Mentor</h2>
                  <p className="text-neutral-400 mb-8 leading-relaxed max-w-lg">
                    Enter the secure session ID provided by your instructor to authenticate and establish a peer-to-peer connection.
                  </p>
                  <form onSubmit={joinSession} className="max-w-lg w-full relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Code2 className="w-5 h-5 text-neutral-600" />
                    </div>
                    <input
                      type="text"
                      value={joinLink}
                      onChange={(e) => setJoinLink(e.target.value)}
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      className="w-full pl-12 pr-14 py-4 bg-black/50 border border-neutral-800 rounded-xl text-white font-mono text-sm placeholder-neutral-600 transition-all focus:outline-none focus:border-orange-500/50 focus:bg-black/80 shadow-inner"
                      required
                    />
                    <button
                      type="submit"
                      disabled={actionLoading || !joinLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-white hover:bg-neutral-200 text-black rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4 font-bold" />}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {/* SYSTEM STATUS & INFO PANEL (Spans 1 column) */}
          <div className="flex flex-col gap-6">
            
            <div className="bg-neutral-900/30 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl flex-1">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4" /> System Core
              </h3>
              
              <div className="space-y-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Monaco Engine</span>
                    <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 uppercase tracking-wider font-bold">Online</span>
                  </div>
                  <span className="text-xs text-neutral-500">Live code synchronization active.</span>
                </div>

                <div className="h-[1px] bg-neutral-800"></div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">WebRTC Relays</span>
                    <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 uppercase tracking-wider font-bold">Online</span>
                  </div>
                  <span className="text-xs text-neutral-500">P2P encrypted video routing active.</span>
                </div>

                <div className="h-[1px] bg-neutral-800"></div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Piston Sandbox</span>
                    <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 uppercase tracking-wider font-bold">Online</span>
                  </div>
                  <span className="text-xs text-neutral-500">Multi-language execution ready.</span>
                </div>
              </div>
            </div>

            {/* Quick Access to Resources Mini-card */}
            <div 
              onClick={() => router.push("/materials")}
              className="bg-gradient-to-br from-orange-950/40 to-black border border-orange-900/30 hover:border-orange-500/30 rounded-3xl p-6 cursor-pointer transition-all group flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-black/50 border border-orange-900/50 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5 group-hover:text-orange-400 transition-colors">Access Resource Hub</h4>
                <p className="text-xs text-neutral-500">View course materials and guides.</p>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-neutral-600 font-mono flex items-center justify-center gap-2">
          <span>EmberSync Platform</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700"></span>
          <span>Version 1.0.0</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700"></span>
          <span>End-to-End Encrypted</span>
        </div>

      </div>
    </div>
  );
}