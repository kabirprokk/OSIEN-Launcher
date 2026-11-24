import {
  KineticPure,
  RadialHalo,
  LiquidRise,
  PulseCore,
  NothingDot,
  Monolith,
  OledWhisper,
  Horizon,
  Editorial,
  BraunDial,
  Matrix100,
  Capsule,
} from './OsienTemplates';

export const TEMPLATES = [
  { id: 'kinetic', name: 'Kinetic Pure', component: KineticPure, light: false },
  { id: 'halo', name: 'Radial Halo', component: RadialHalo, light: false },
  { id: 'liquid', name: 'Liquid Rise', component: LiquidRise, light: false },
  { id: 'pulse', name: 'Pulse Core', component: PulseCore, light: false },
  { id: 'nothing', name: 'Nothing Dot', component: NothingDot, light: false },
  { id: 'monolith', name: 'Monolith', component: Monolith, light: false },
  { id: 'oled', name: 'OLED Whisper', component: OledWhisper, light: false },
  { id: 'horizon', name: 'Horizon', component: Horizon, light: false },
  { id: 'editorial', name: 'Editorial', component: Editorial, light: true },
  { id: 'braun', name: 'Braun Dial', component: BraunDial, light: false },
  { id: 'matrix', name: 'Matrix 100', component: Matrix100, light: false },
  { id: 'capsule', name: 'Capsule', component: Capsule, light: false },
];

export const ACCENT_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'White', value: '#ffffff' },
  { name: 'Cyan', value: '#38bdf8' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Crimson', value: '#ef4444' },
  { name: 'Violet', value: '#a78bfa' },
  { name: 'Lime', value: '#84cc16' },
];

export const FONT_PRESETS = [
  { id: 'display', label: 'Grotesk', family: 'var(--font-display)', weight: 400 },
  { id: 'thin', label: 'UltraLight', family: 'var(--font-sans)', weight: 200 },
  { id: 'mono', label: 'Mono', family: 'var(--font-mono)', weight: 400 },
  { id: 'serif', label: 'Serif', family: 'var(--font-serif)', weight: 400 },
];
