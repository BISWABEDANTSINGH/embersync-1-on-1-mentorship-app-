"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { 
  Loader2, LogOut, ArrowLeft, UploadCloud, 
  FileVideo, FileText, Link as LinkIcon, 
  Play, Download, Trash2, Plus, X
} from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  role: "mentor" | "student";
}

interface Material {
  id: string;
  title: string;
  type: "video" | "pdf" | "link";
  file_url: string;
  size: string;
  created_at: string;
  uploader_id: string;
}

export default function MaterialsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchProfileAndMaterials = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
          router.push("/");
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", session.user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(userProfile);

        // Fetch Materials from backend
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/materials`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        
        const data = await res.json();
        if (res.ok) {
          setMaterials(data.materials);
        }
      } catch (err: any) {
        console.error("Initialization error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndMaterials();
  }, [router]);

  // Format file size helper
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Upload to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('course-materials')
        .getPublicUrl(fileName);

      // Determine Type
      let type = "link";
      if (uploadFile.type.includes("video")) type = "video";
      else if (uploadFile.type.includes("pdf")) type = "pdf";

      // 3. Save to Backend DB
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/materials/create`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: uploadTitle,
          file_url: publicUrl,
          type: type,
          size: formatBytes(uploadFile.size)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 4. Update UI
      setMaterials([data.material, ...materials]);
      setIsModalOpen(false);
      setUploadTitle("");
      setUploadFile(null);
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (materialId: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/materials/${materialId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session?.access_token}` }
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Remove from UI
      setMaterials(materials.filter(m => m.id !== materialId));
    } catch (error) {
      console.error(error);
      alert("Error deleting material");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-neutral-500 font-medium animate-pulse">Loading Resource Hub...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Premium Volcanic Background Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-600/5 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Top Navigation */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 bg-neutral-900/40 backdrop-blur-2xl border border-neutral-800 border-t-white/10 p-6 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.push("/dashboard")}
              className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-600 transition-all shadow-inner"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-4 mb-1">
                <Logo />
                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border shadow-inner ${
                  profile?.role === "mentor" 
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400" 
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}>
                  {profile?.role} Hub
                </span>
              </div>
              <p className="text-neutral-400 text-sm">Course materials, video lectures, and study resources.</p>
            </div>
          </div>
        </header>

        {/* Mentor Upload Trigger */}
        {profile?.role === "mentor" && (
          <div className="mb-10 bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 border-dashed rounded-3xl p-8 text-center shadow-lg relative group transition-all hover:border-orange-500/50">
            <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-center mb-4 shadow-inner group-hover:border-orange-500/30 transition-colors">
                <UploadCloud className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Upload New Material</h2>
              <p className="text-neutral-500 text-sm max-w-md mx-auto mb-6">
                Drag and drop video lectures (MP4) or study guides (PDF) for your students.
              </p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-neutral-200 font-bold rounded-xl transition-all shadow-lg hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Select Files
              </button>
            </div>
          </div>
        )}

        {/* Materials Library Grid */}
        <div>
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-6 px-2">
            {profile?.role === "mentor" ? "Manage Uploads" : "Available Resources"}
          </h3>
          
          {materials.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-3xl bg-neutral-900/20">
              No materials have been uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.map((material) => (
                <div key={material.id} className="bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 hover:border-neutral-700 rounded-2xl overflow-hidden transition-all hover:shadow-2xl hover:shadow-black/50 group flex flex-col">
                  
                  {/* Thumbnail Area */}
                  <div className="h-32 bg-neutral-950 border-b border-neutral-800 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 to-transparent z-10"></div>
                    {material.type === "video" && <FileVideo className="w-12 h-12 text-orange-500 opacity-50 group-hover:scale-110 transition-transform duration-500" />}
                    {material.type === "pdf" && <FileText className="w-12 h-12 text-amber-500 opacity-50 group-hover:scale-110 transition-transform duration-500" />}
                    {material.type === "link" && <LinkIcon className="w-12 h-12 text-blue-500 opacity-50 group-hover:scale-110 transition-transform duration-500" />}
                    
                    {/* Quick Action Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 z-20 transition-opacity bg-black/40 backdrop-blur-sm">
                      <a 
                        href={material.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-orange-500 hover:scale-105 transition-all"
                      >
                        {material.type === "video" ? <Play className="w-5 h-5 ml-1" /> : <Download className="w-5 h-5" />}
                      </a>
                    </div>
                  </div>

                  {/* Details Area */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        material.type === "video" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                        material.type === "pdf" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      }`}>
                        {material.type}
                      </span>
                      <span className="text-xs text-neutral-600 font-medium">{material.size}</span>
                    </div>
                    
                    <h4 className="text-white font-bold leading-tight mb-4 flex-1">{material.title}</h4>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-neutral-800">
                      <span className="text-xs text-neutral-500">
                        {new Date(material.created_at).toLocaleDateString()}
                      </span>
                      {profile?.role === "mentor" && (
                        <button 
                          onClick={() => handleDelete(material.id)}
                          className="text-neutral-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-950/50">
              <h3 className="text-lg font-bold text-white">Upload Material</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Resource Title</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. React Fundamentals Part 1"
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Select File</label>
                <input
                  type="file"
                  required
                  accept="video/mp4,video/x-m4v,video/*,application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-neutral-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-500/10 file:text-orange-500 hover:file:bg-orange-500/20 file:transition-colors cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !uploadFile || !uploadTitle.trim()}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                {isUploading ? "Uploading to Cloud..." : "Upload Resource"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}