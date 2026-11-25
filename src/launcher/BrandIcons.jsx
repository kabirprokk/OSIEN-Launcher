import React from 'react';
import {
  Phone, MessageCircle, Camera, Compass, Play, Gamepad2, ShoppingBag,
  Mail, Calendar, Clock, Calculator, MapPin, Shield, Sparkles, Folder,
  Settings, Terminal, AppWindow, Music, Image, FileText, CreditCard,
  BookOpen, Video, Tv,
} from 'lucide-react';

// Crisp monochrome brand SVG paths (24x24 viewBox) — zero colorful bitmaps, 0ms render
const BRAND_SVGS = {
  instagram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 5L2 12.5l7 1.5M21 5l-2.5 15L9 14M21 5L9 14m0 0v5.5l3.2-3.2" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <path d="M7.5 7.5c3.5-1 5.5-1 9 0M7 16.5c3.5 1 6.5 1 10 0M15.5 17c0 1 1.5 3 2 3 1.5 0 2.833-1.667 3.5-3 .667-1.667.5-5.833-1.5-11.5-1.457-1.015-3-1.34-4.5-1.5l-1 2.5M8.5 17c0 1-1.356 3-1.832 3-1.429 0-2.698-1.667-3.333-3-.635-1.667-.476-5.833 1.428-11.5C6.151 4.485 7.545 4.16 9 4l1 2.5" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <polygon points="10,9 15.5,12 10,15" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  ),
  spotify: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 9.5c3-1 6.5-.8 9 .5M8 12.8c2.5-.8 5.5-.6 7.8.5M8.8 16c2-.5 4.3-.4 6.2.4" />
    </svg>
  ),
  chrome: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5h8.8M8.9 13.7L4.5 6.2M15.1 13.7l-4.4 7.5" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  ),
};

export function MonochromeAppIcon({ app }) {
  const s = `${app.packageName || ''} ${app.label || ''}`.toLowerCase();

  if (/instagram/.test(s)) return BRAND_SVGS.instagram;
  if (/whatsapp/.test(s)) return BRAND_SVGS.whatsapp;
  if (/telegram/.test(s)) return BRAND_SVGS.telegram;
  if (/discord/.test(s)) return BRAND_SVGS.discord;
  if (/youtube/.test(s)) return BRAND_SVGS.youtube;
  if (/twitter|\bx\b/.test(s)) return BRAND_SVGS.x;
  if (/spotify/.test(s)) return BRAND_SVGS.spotify;
  if (/chrome/.test(s)) return BRAND_SVGS.chrome;
  if (/github/.test(s)) return BRAND_SVGS.github;

  if (/phone|dialer|call/.test(s)) return <Phone size={15} strokeWidth={1.9} />;
  if (/message|sms|signal|chat/.test(s)) return <MessageCircle size={15} strokeWidth={1.9} />;
  if (/camera|edits/.test(s)) return <Camera size={15} strokeWidth={1.9} />;
  if (/photo|gallery/.test(s)) return <Image size={15} strokeWidth={1.9} />;
  if (/brave|browser|firefox|edge|opera/.test(s)) return <Compass size={15} strokeWidth={1.9} />;
  if (/music|audio|podcast/.test(s)) return <Music size={15} strokeWidth={1.9} />;
  if (/vlc|video|netflix|prime|hotstar/.test(s)) return <Tv size={15} strokeWidth={1.9} />;
  if (/game|chess|pubg|bgmi|clash|minecraft|roblox|cod/.test(s)) return <Gamepad2 size={15} strokeWidth={1.9} />;
  if (/amazon|flipkart|blinkit|instamart|shop|myntra|swiggy|zomato/.test(s)) return <ShoppingBag size={15} strokeWidth={1.9} />;
  if (/gmail|mail|outlook/.test(s)) return <Mail size={15} strokeWidth={1.9} />;
  if (/calendar/.test(s)) return <Calendar size={15} strokeWidth={1.9} />;
  if (/clock|alarm|timer/.test(s)) return <Clock size={15} strokeWidth={1.9} />;
  if (/calc/.test(s)) return <Calculator size={15} strokeWidth={1.9} />;
  if (/map|uber|ola|chalo|nav/.test(s)) return <MapPin size={15} strokeWidth={1.9} />;
  if (/pay|fam|gpay|phonepe|paytm|bank|wallet/.test(s)) return <CreditCard size={15} strokeWidth={1.9} />;
  if (/auth|shield|security|vpn/.test(s)) return <Shield size={15} strokeWidth={1.9} />;
  if (/gpt|ai|gemini|claude|assistant|perplexity/.test(s)) return <Sparkles size={15} strokeWidth={1.9} />;
  if (/duolingo|book|kindle|read/.test(s)) return <BookOpen size={15} strokeWidth={1.9} />;
  if (/note|doc|pdf/.test(s)) return <FileText size={15} strokeWidth={1.9} />;
  if (/drive|file/.test(s)) return <Folder size={15} strokeWidth={1.9} />;
  if (/setting|aod|osien/.test(s)) return <Settings size={15} strokeWidth={1.9} />;
  if (/term|code|dev/.test(s)) return <Terminal size={15} strokeWidth={1.9} />;
  if (/meet|zoom|facetime/.test(s)) return <Video size={15} strokeWidth={1.9} />;
  if (/play/.test(s)) return <Play size={15} strokeWidth={1.9} />;
  return <AppWindow size={15} strokeWidth={1.9} />;
}
