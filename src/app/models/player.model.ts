export interface PlayerData {
  id?: string;
  name: string;
  position: ITPosition;
  nationality: string; // ISO code like 'FR', 'US', 'DE'
  rating: number; // 1-99, auto-computed or manual override
  manualRating?: boolean; // true if rating was manually set

  // Six core stats (1-99)
  stats: PlayerStats;

  // Visual data
  profilePhoto?: string; // base64 or URL
  backgroundTheme: CardTheme;
  customLogo?: string; // base64 or URL

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlayerStats {
  technical: number; // Technical skills (coding, architecture)
  leadership: number; // Team leadership and communication
  creativity: number; // Problem-solving and innovation
  reliability: number; // Consistency and dependability
  collaboration: number; // Teamwork and interpersonal skills
  adaptability: number; // Learning and flexibility
}

export type ITPosition =
  | 'DEV' // Developer
  | 'OPS' // Operations/DevOps
  | 'DATA' // Data Engineer/Scientist
  | 'PM' // Project Manager
  | 'QA' // Quality Assurance
  | 'UX' // UX/UI Designer
  | 'SEC' // Security Engineer
  | 'ARCH'; // Solutions Architect

export type CardTheme =
  | 'gold-classic'
  | 'dark-mode-it'
  | 'silver-modern'
  | 'bronze-vintage'
  | 'totw'
  | 'custom-gradient';

export interface CardTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  thumbnail: string;

  // Styling
  backgroundGradient: string;
  backgroundImage?: string; // Path to PNG template asset
  borderStyle?: string;
  shadowEffect?: string;
  noiseOverlay?: boolean;

  // Layout
  maskShape: 'shield' | 'circle' | 'hexagon';
  fontFamily: string;
  colorScheme: {
    primary: string;
    secondary: string;
    text: string;
    accent: string;
  };

  // Effects
  metallic?: boolean;
  glowEffect?: boolean;
  patternOverlay?: string;
}

export interface ExportOptions {
  format: 'png' | 'pdf' | 'zip';
  size?: 'transparent' | 'web' | 'social' | 'print';
  quality?: number;
  includeWatermark?: boolean;
  customBranding?: string;
}

export interface StoredCard {
  id: string;
  playerData: PlayerData;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
}

// Predefined stat labels for IT positions
export const STAT_LABELS: Record<string, string> = {
  technical: 'TEC',
  leadership: 'LEA',
  creativity: 'CRE',
  reliability: 'REL',
  collaboration: 'COL',
  adaptability: 'ADA'
};

// Position display names
export const POSITION_NAMES: Record<ITPosition, string> = {
  'DEV': 'Developer',
  'OPS': 'DevOps Engineer',
  'DATA': 'Data Engineer',
  'PM': 'Project Manager',
  'QA': 'QA Engineer',
  'UX': 'UX Designer',
  'SEC': 'Security Engineer',
  'ARCH': 'Solutions Architect'
};
