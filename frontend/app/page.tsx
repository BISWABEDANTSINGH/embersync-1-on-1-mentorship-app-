"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"mentor" | "student">("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Handle Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        // Handle Signup
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        // If signup is successful, create their profile in the database
        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert([
              {
                id: data.user.id,
                email,
                full_name: fullName,
                role,
              },
            ]);
          if (profileError) throw profileError;
        }
        
        // Show success or redirect
        alert("Signup successful! You can now log in.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden bg-[#050505] font-sans selection:bg-orange-500/30">
      
      {/* Background Architectural Grid & Glows (Matching Dashboard) */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* AMPLIFIED GLASSMORPHISM CARD */}
      <div className="w-full max-w-md relative z-10 bg-neutral-900/30 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl p-8 lg:p-10 flex flex-col">
        
        <div className="text-center mb-10 flex flex-col items-center">
          {/* Integrated Logo */}
          <div className="mb-8 scale-110">
            <Logo />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            {isLogin ? "Welcome Back." : "Initialize."}
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-xs">
            {isLogin
              ? "Authenticate to access your active coding sessions."
              : "Create an account to deploy secure mentoring environments."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLogin && (
            <>
              {/* Professional Input Group with Orange Focus */}
              <div className="group">
                <label htmlFor="fullName" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 transition-colors group-focus-within:text-orange-500">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-black/50 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 transition-all focus:outline-none focus:border-orange-500/50 focus:bg-black/80 shadow-inner text-sm font-medium"
                  placeholder="John Doe"
                />
              </div>
              <div className="group">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 transition-colors group-focus-within:text-orange-500">Account Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`flex-1 py-3.5 rounded-xl border text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                      role === "student"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[inset_0_1px_0_0_rgba(255,191,0,0.2)]"
                        : "bg-black/50 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300 shadow-inner"
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("mentor")}
                    className={`flex-1 py-3.5 rounded-xl border text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                      role === "mentor"
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[inset_0_1px_0_0_rgba(255,165,0,0.2)]"
                        : "bg-black/50 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300 shadow-inner"
                    }`}
                  >
                    Mentor
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="group">
            <label htmlFor="email" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 transition-colors group-focus-within:text-orange-500">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-black/50 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 transition-all focus:outline-none focus:border-orange-500/50 focus:bg-black/80 shadow-inner text-sm font-medium"
              placeholder="you@example.com"
            />
          </div>

          <div className="group">
            <label htmlFor="password" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 transition-colors group-focus-within:text-orange-500">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-black/50 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 transition-all focus:outline-none focus:border-orange-500/50 focus:bg-black/80 shadow-inner text-sm font-medium"
              placeholder="••••••••"
            />
          </div>

          {/* Premium Volcanic Button */}
          <button
            type="submit"
            disabled={loading}
            className="group/btn relative w-full mt-8 flex items-center justify-center gap-2 bg-white text-black font-bold py-4 rounded-xl transition-all hover:bg-neutral-200 disabled:opacity-50 overflow-hidden shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-orange-500/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
            {loading ? <Loader2 className="w-5 h-5 animate-spin relative z-10" /> : null}
            <span className="relative z-10">{loading ? "Authenticating..." : isLogin ? "Access Workspace" : "Initialize Account"}</span>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-neutral-800/50 text-center text-xs text-neutral-500 font-medium">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-orange-500 hover:text-orange-400 font-bold transition-colors hover:underline ml-1"
          >
            {isLogin ? "Deploy one now" : "Authenticate here"}
          </button>
        </div>
      </div>
    </main>
  );
}