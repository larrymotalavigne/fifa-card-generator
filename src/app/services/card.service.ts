import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PlayerData, PlayerStats, CardTemplate, ITPosition, CardTheme, ExportOptions } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class CardService {
  private currentPlayerSubject = new BehaviorSubject<PlayerData>(this.createDefaultPlayer());
  private availableTemplatesSubject = new BehaviorSubject<CardTemplate[]>(this.getDefaultTemplates());

  public currentPlayer$ = this.currentPlayerSubject.asObservable();
  public availableTemplates$ = this.availableTemplatesSubject.asObservable();

  constructor() {}

  // Player management
  getCurrentPlayer(): PlayerData {
    return this.currentPlayerSubject.value;
  }

  updatePlayer(player: Partial<PlayerData>): void {
    const currentPlayer = this.getCurrentPlayer();
    const updatedPlayer = {
      ...currentPlayer,
      ...player,
      updatedAt: new Date()
    };

    // Auto-calculate rating if not manually overridden
    if (!player.manualRating && player.stats) {
      updatedPlayer.rating = this.calculateOverallRating(updatedPlayer.stats);
    }

    this.currentPlayerSubject.next(updatedPlayer);
  }

  // Stats calculation
  calculateOverallRating(stats: PlayerStats): number {
    const values = Object.values(stats);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(average);
  }

  // Randomize stats with realistic distributions
  randomizeStats(seed?: string): PlayerStats {
    const rng = seed ? this.seededRandom(seed) : Math.random;

    // Generate realistic stats (60-98 range with normal distribution)
    const generateStat = () => {
      // Use Box-Muller transform for normal distribution
      const u1 = rng();
      const u2 = rng();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      // Scale to 60-98 range with mean around 78
      const mean = 78;
      const stdDev = 8;
      const value = Math.round(z0 * stdDev + mean);

      return Math.max(60, Math.min(98, value));
    };

    return {
      technical: generateStat(),
      leadership: generateStat(),
      creativity: generateStat(),
      reliability: generateStat(),
      collaboration: generateStat(),
      adaptability: generateStat()
    };
  }

  // Seeded random number generator for reproducible results
  private seededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return () => {
      hash = hash * 16807 % 2147483647;
      return (hash - 1) / 2147483646;
    };
  }

  // Template management
  getAvailableTemplates(): CardTemplate[] {
    return this.availableTemplatesSubject.value;
  }

  getTemplateById(id: string): CardTemplate | undefined {
    return this.getAvailableTemplates().find(template => template.id === id);
  }

  // Input validation and sanitization
  sanitizeInput(input: string, maxLength: number = 50): string {
    // Remove blocked words and inappropriate content
    const blockedWords = ['test', 'dummy', 'fake']; // Add more as needed
    let sanitized = input.trim();

    // Check for blocked words (case insensitive)
    blockedWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      sanitized = sanitized.replace(regex, '***');
    });

    // Truncate with ellipsis if too long
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }

    return sanitized;
  }

  validateStats(stats: Partial<PlayerStats>): boolean {
    const values = Object.values(stats);
    return values.every(value =>
      typeof value === 'number' && value >= 1 && value <= 99
    );
  }

  // Default data
  private createDefaultPlayer(): PlayerData {
    return {
      id: this.generateId(),
      name: 'Larry Mota',
      position: 'DEV',
      nationality: 'FR',
      rating: 85,
      manualRating: false,
      stats: {
        technical: 88,
        leadership: 82,
        creativity: 90,
        reliability: 85,
        collaboration: 83,
        adaptability: 87
      },
      backgroundTheme: 'gold-classic',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private getDefaultTemplates(): CardTemplate[] {
    return [
      {
        id: 'gold-classic',
        name: 'gold-classic',
        displayName: 'Gold Classic',
        description: 'Traditional FIFA gold card',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZmQ3MDAiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNmZmIzMDAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgZmlsbD0idXJsKCNnb2xkKSIgcng9IjEwIi8+PHRleHQgeD0iNTAiIHk9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMDAwIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiPkdvbGQ8L3RleHQ+PC9zdmc+',
        backgroundGradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 25%, #ffd700 50%, #ffb300 75%, #ffd700 100%)',
        backgroundImage: 'assets/gold.png',
        shadowEffect: '0 0 20px rgba(255, 215, 0, 0.3)',
        noiseOverlay: true,
        maskShape: 'shield',
        fontFamily: 'Roboto Condensed',
        colorScheme: {
          primary: '#ffd700',
          secondary: '#ffb300',
          text: '#000000',
          accent: '#ffffff'
        },
        metallic: true,
        glowEffect: true
      },
      {
        id: 'dark-mode-it',
        name: 'dark-mode-it',
        displayName: 'Dark Mode IT',
        description: 'Modern dark theme with blue accents',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImRhcmsiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxYTFhMWEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMyZDJkMmQiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgZmlsbD0idXJsKCNkYXJrKSIgcng9IjEwIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwIiB5PSI3MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIxMiIgZm9udC1mYW1pbHk9IkFyaWFsIj5EYXJrPC90ZXh0Pjwvc3ZnPg==',
        backgroundGradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 25%, #1a1a1a 50%, #0f0f0f 75%, #1a1a1a 100%)',
        borderStyle: '2px solid #3b82f6',
        shadowEffect: '0 0 20px rgba(59, 130, 246, 0.3)',
        maskShape: 'circle',
        fontFamily: 'Inter',
        colorScheme: {
          primary: '#1a1a1a',
          secondary: '#3b82f6',
          text: '#ffffff',
          accent: '#60a5fa'
        },
        patternOverlay: 'linear-gradient(45deg, transparent 49%, rgba(59, 130, 246, 0.1) 50%, transparent 51%)'
      },
      {
        id: 'silver-modern',
        name: 'silver-modern',
        displayName: 'Silver Modern',
        description: 'Sleek silver card design',
        thumbnail: '',
        backgroundGradient: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 25%, #c0c0c0 50%, #a0a0a0 75%, #c0c0c0 100%)',
        backgroundImage: 'assets/silver.png',
        shadowEffect: '0 0 20px rgba(192, 192, 192, 0.3)',
        noiseOverlay: true,
        maskShape: 'shield',
        fontFamily: 'Roboto Condensed',
        colorScheme: {
          primary: '#c0c0c0',
          secondary: '#a0a0a0',
          text: '#1a1a2e',
          accent: '#ffffff'
        },
        metallic: true,
        glowEffect: true
      },
      {
        id: 'bronze-vintage',
        name: 'bronze-vintage',
        displayName: 'Bronze Vintage',
        description: 'Classic warm bronze card',
        thumbnail: '',
        backgroundGradient: 'linear-gradient(135deg, #cd7f32 0%, #daa06d 25%, #cd7f32 50%, #a0522d 75%, #cd7f32 100%)',
        backgroundImage: 'assets/bronze.png',
        shadowEffect: '0 0 20px rgba(205, 127, 50, 0.3)',
        noiseOverlay: true,
        maskShape: 'shield',
        fontFamily: 'Roboto Condensed',
        colorScheme: {
          primary: '#cd7f32',
          secondary: '#a0522d',
          text: '#2d1810',
          accent: '#fff8e7'
        },
        metallic: true,
        glowEffect: true
      },
      {
        id: 'totw',
        name: 'totw',
        displayName: 'TOTW',
        description: 'Team of the Week special',
        thumbnail: '',
        backgroundGradient: 'linear-gradient(135deg, #1a3a5c 0%, #0d2137 50%, #1a3a5c 100%)',
        backgroundImage: 'assets/totw.png',
        shadowEffect: '0 0 20px rgba(255, 215, 0, 0.4)',
        noiseOverlay: false,
        maskShape: 'shield',
        fontFamily: 'Roboto Condensed',
        colorScheme: {
          primary: '#1a3a5c',
          secondary: '#ffd700',
          text: '#ffd700',
          accent: '#ffffff'
        },
        metallic: false,
        glowEffect: true
      }
    ];
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
