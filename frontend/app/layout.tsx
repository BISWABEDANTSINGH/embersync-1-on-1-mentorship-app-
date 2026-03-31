import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Configure premium fonts
const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: "--font-jetbrains-mono",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "EmberSync | Pro Mentorship",
  description: "High-performance 1-on-1 collaborative coding environment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      {/* antialiased: Makes text render smoother on Mac/High-DPI screens
        selection: Changes the color when a user highlights text with their mouse
      */}
      <body className="bg-[#0a0a0a] text-neutral-300 font-sans antialiased selection:bg-orange-500/30 selection:text-orange-200">
        {children}
      </body>
    </html>
  );
}