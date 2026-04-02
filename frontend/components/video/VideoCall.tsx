"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { Mic, MicOff, Video, VideoOff, Loader2, AlertCircle } from "lucide-react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VideoCall({ sessionId }: { sessionId: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // 1. Initialize User Media & WebRTC Connection with Fallbacks
  const startCall = async () => {
    setHasStarted(true);
    setDeviceError(null);
    
    let stream: MediaStream | null = null;

    try {
      // Attempt 1: Try getting both Video and Audio
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (error: any) {
      console.warn("Camera/Mic access failed, attempting fallback...", error);
      
      try {
        // Attempt 2: Camera might be locked or missing. Try getting JUST Audio.
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setDeviceError("Camera in use/missing. Joined with Mic only.");
        setIsVideoOn(false);
      } catch (fallbackError: any) {
        // Attempt 3: They have no mic or camera permissions at all. 
        setDeviceError("No media access. Joining as viewer only.");
        setIsVideoOn(false);
        setIsMicOn(false);
      }
    }

    // If we managed to get at least a mic or camera, attach it to the local video element
    if (stream) {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }

    // CRITICAL: ALWAYS tell the room we are ready to connect! 
    // Even if we don't have a camera, we still want to receive the other person's video.
    socket.emit("user-ready-for-video", sessionId);
  };

  // 2. Setup the RTCPeerConnection logic
  useEffect(() => {
    const createPeerConnection = () => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", { sessionId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      return pc;
    };

    // --- SOCKET LISTENERS FOR SIGNALING ---
    socket.on("peer-ready", async () => {
      peerConnectionRef.current = createPeerConnection();
      const pc = peerConnectionRef.current;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { sessionId, offer });
    });

    socket.on("webrtc-offer", async (offer) => {
      peerConnectionRef.current = createPeerConnection();
      const pc = peerConnectionRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { sessionId, answer });
    });

    socket.on("webrtc-answer", async (answer) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("webrtc-ice-candidate", async (candidate) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    return () => {
      socket.off("peer-ready");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
    };
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // Media Controls
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  // UI rendering
  if (!hasStarted) {
    return (
      <div className="h-64 border-b border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center shrink-0 p-4 text-center">
        <Video className="w-8 h-8 text-neutral-700 mb-3" />
        
        {deviceError && (
          <div className="mb-4 flex items-center gap-2 text-xs text-red-400 bg-red-950/30 px-3 py-1.5 rounded-lg border border-red-900/50">
            <AlertCircle className="w-3.5 h-3.5" />
            {deviceError}
          </div>
        )}

        <button
          onClick={startCall}
          className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40"
        >
          {deviceError ? "Retry Connection" : "Join Video Call"}
        </button>
      </div>
    );
  }

  return (
    <div className="h-64 border-b border-neutral-800 bg-black relative shrink-0 overflow-hidden group">
      {/* Remote Video */}
      {!isConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-0 bg-neutral-950">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-2" />
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Waiting for peer...</span>
        </div>
      )}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover z-10 relative transition-opacity duration-500 ${isConnected ? "opacity-100" : "opacity-0"}`}
      />

      {/* Local Video */}
      <div className="absolute top-3 right-3 w-24 h-32 bg-neutral-900 border-2 border-neutral-800 rounded-lg overflow-hidden z-20 shadow-2xl shadow-black/50">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
        {!isVideoOn && (
          <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
            <VideoOff className="w-5 h-5 text-neutral-600" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 p-1.5 rounded-2xl flex items-center gap-1 shadow-2xl">
          <button
            onClick={toggleMic}
            className={`p-2.5 rounded-xl transition-all ${
              isMicOn ? "bg-neutral-800 text-white hover:bg-neutral-700" : "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
            }`}
          >
            {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-2.5 rounded-xl transition-all ${
              isVideoOn ? "bg-neutral-800 text-white hover:bg-neutral-700" : "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
            }`}
          >
            {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}