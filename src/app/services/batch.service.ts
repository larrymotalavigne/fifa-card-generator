import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as JSZip from 'jszip';
import { PlayerData, PlayerStats, ITPosition } from '../models/player.model';
import { CardService } from './card.service';

interface BatchImportResult {
  success: PlayerData[];
  errors: { row: number; message: string; data?: any }[];
  warnings: { row: number; message: string; data?: any }[];
}

interface BatchProgress {
  current: number;
  total: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  private batchProgressSubject = new BehaviorSubject<BatchProgress>({
    current: 0,
    total: 0,
    status: 'idle',
    message: ''
  });

  private batchCardsSubject = new BehaviorSubject<PlayerData[]>([]);
  private photoLibrarySubject = new BehaviorSubject<Map<string, string>>(new Map());

  public batchProgress$ = this.batchProgressSubject.asObservable();
  public batchCards$ = this.batchCardsSubject.asObservable();
  public photoLibrary$ = this.photoLibrarySubject.asObservable();

  constructor(private cardService: CardService) {}

  // CSV Import
  async importFromCSV(file: File): Promise<BatchImportResult> {
    this.updateProgress(0, 0, 'processing', 'Reading CSV file...');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('Empty CSV file');
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredFields = ['name', 'position', 'nationality'];
      const statFields = ['technical', 'leadership', 'creativity', 'reliability', 'collaboration', 'adaptability'];
      
      // Validate headers
      const missingRequired = requiredFields.filter(field => !headers.includes(field));
      if (missingRequired.length > 0) {
        throw new Error(`Missing required columns: ${missingRequired.join(', ')}`);
      }

      const result: BatchImportResult = {
        success: [],
        errors: [],
        warnings: []
      };

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        this.updateProgress(i, lines.length - 1, 'processing', `Processing row ${i}...`);
        
        try {
          const values = this.parseCSVLine(lines[i]);
          if (values.length === 0) continue; // Skip empty lines

          const playerData = this.parsePlayerDataFromCSV(headers, values, i);
          
          // Validate the player data
          const validation = this.validatePlayerData(playerData);
          if (!validation.isValid) {
            result.errors.push({
              row: i,
              message: validation.errors.join(', '),
              data: values
            });
            continue;
          }

          // Add warnings if any
          if (validation.warnings.length > 0) {
            result.warnings.push({
              row: i,
              message: validation.warnings.join(', '),
              data: playerData
            });
          }

          result.success.push(playerData);
        } catch (error) {
          result.errors.push({
            row: i,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: lines[i]
          });
        }
      }

      // Update batch cards
      this.batchCardsSubject.next(result.success);
      this.updateProgress(result.success.length, result.success.length, 'completed', 
        `Imported ${result.success.length} cards successfully`);

      return result;
    } catch (error) {
      this.updateProgress(0, 0, 'error', error instanceof Error ? error.message : 'Import failed');
      throw error;
    }
  }

  // JSON Import
  async importFromJSON(file: File): Promise<BatchImportResult> {
    this.updateProgress(0, 0, 'processing', 'Reading JSON file...');

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      let playersArray: any[];
      
      // Handle different JSON structures
      if (Array.isArray(jsonData)) {
        playersArray = jsonData;
      } else if (jsonData.cards && Array.isArray(jsonData.cards)) {
        playersArray = jsonData.cards;
      } else if (jsonData.players && Array.isArray(jsonData.players)) {
        playersArray = jsonData.players;
      } else {
        throw new Error('Invalid JSON structure. Expected array or object with "cards"/"players" property');
      }

      const result: BatchImportResult = {
        success: [],
        errors: [],
        warnings: []
      };

      // Process each player
      for (let i = 0; i < playersArray.length; i++) {
        this.updateProgress(i, playersArray.length, 'processing', `Processing item ${i + 1}...`);

        try {
          const playerData = this.parsePlayerDataFromJSON(playersArray[i], i);
          
          const validation = this.validatePlayerData(playerData);
          if (!validation.isValid) {
            result.errors.push({
              row: i + 1,
              message: validation.errors.join(', '),
              data: playersArray[i]
            });
            continue;
          }

          if (validation.warnings.length > 0) {
            result.warnings.push({
              row: i + 1,
              message: validation.warnings.join(', '),
              data: playerData
            });
          }

          result.success.push(playerData);
        } catch (error) {
          result.errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: playersArray[i]
          });
        }
      }

      this.batchCardsSubject.next(result.success);
      this.updateProgress(result.success.length, result.success.length, 'completed',
        `Imported ${result.success.length} cards successfully`);

      return result;
    } catch (error) {
      this.updateProgress(0, 0, 'error', error instanceof Error ? error.message : 'Import failed');
      throw error;
    }
  }

  // Photo ZIP Import
  async importPhotoLibrary(file: File): Promise<Map<string, string>> {
    this.updateProgress(0, 0, 'processing', 'Extracting photos from ZIP...');

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const photoMap = new Map<string, string>();

      const imageFiles = Object.keys(zipContent.files).filter(filename => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) && !zipContent.files[filename].dir
      );

      for (let i = 0; i < imageFiles.length; i++) {
        this.updateProgress(i, imageFiles.length, 'processing', `Processing ${imageFiles[i]}...`);

        const filename = imageFiles[i];
        const file = zipContent.files[filename];
        
        try {
          const blob = await file.async('blob');
          const base64 = await this.blobToBase64(blob);
          
          // Use filename without extension as key
          const key = filename.replace(/\.[^/.]+$/, '').toLowerCase();
          photoMap.set(key, base64);
        } catch (error) {
          console.warn(`Failed to process photo ${filename}:`, error);
        }
      }

      this.photoLibrarySubject.next(photoMap);
      this.updateProgress(photoMap.size, photoMap.size, 'completed',
        `Loaded ${photoMap.size} photos`);

      return photoMap;
    } catch (error) {
      this.updateProgress(0, 0, 'error', error instanceof Error ? error.message : 'Photo import failed');
      throw error;
    }
  }

  // Match photos to players by name
  matchPhotosToPlayers(): void {
    const cards = this.batchCardsSubject.value;
    const photos = this.photoLibrarySubject.value;

    const updatedCards = cards.map(card => {
      if (!card.profilePhoto) {
        const key = card.name.toLowerCase().replace(/\s+/g, '_');
        const photo = photos.get(key);
        if (photo) {
          return { ...card, profilePhoto: photo };
        }
      }
      return card;
    });

    this.batchCardsSubject.next(updatedCards);
  }

  // Generate example CSV template
  generateCSVTemplate(): string {
    const headers = [
      'name', 'position', 'nationality', 'rating', 'theme',
      'technical', 'leadership', 'creativity', 'reliability', 'collaboration', 'adaptability'
    ];

    const examples = [
      ['Larry Mota', 'DEV', 'FR', '85', 'gold-classic', '88', '82', '90', '85', '83', '87'],
      ['Sarah Chen', 'DATA', 'US', '', 'dark-mode-it', '92', '78', '88', '90', '85', '82'],
      ['Mike Johnson', 'OPS', 'GB', '', 'gold-classic', '85', '88', '75', '92', '80', '85']
    ];

    const csvContent = [
      headers.join(','),
      ...examples.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  // Clear batch data
  clearBatch(): void {
    this.batchCardsSubject.next([]);
    this.photoLibrarySubject.next(new Map());
    this.updateProgress(0, 0, 'idle', '');
  }

  // Get current batch state
  getCurrentBatch(): PlayerData[] {
    return this.batchCardsSubject.value;
  }

  getCurrentPhotoLibrary(): Map<string, string> {
    return this.photoLibrarySubject.value;
  }

  // Private helper methods
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private parsePlayerDataFromCSV(headers: string[], values: string[], rowIndex: number): PlayerData {
    const getValue = (field: string): string => {
      const index = headers.indexOf(field);
      return index >= 0 ? values[index]?.trim() || '' : '';
    };

    const getNumericValue = (field: string, defaultValue: number): number => {
      const value = getValue(field);
      const parsed = parseInt(value, 10);
      return !isNaN(parsed) ? Math.max(1, Math.min(99, parsed)) : defaultValue;
    };

    // Build stats object
    const stats: PlayerStats = {
      technical: getNumericValue('technical', 75),
      leadership: getNumericValue('leadership', 75),
      creativity: getNumericValue('creativity', 75),
      reliability: getNumericValue('reliability', 75),
      collaboration: getNumericValue('collaboration', 75),
      adaptability: getNumericValue('adaptability', 75)
    };

    const playerData: PlayerData = {
      id: `batch_${rowIndex}_${Date.now()}`,
      name: this.cardService.sanitizeInput(getValue('name'), 30),
      position: this.validatePosition(getValue('position')),
      nationality: getValue('nationality').toUpperCase().substring(0, 3),
      rating: getNumericValue('rating', this.cardService.calculateOverallRating(stats)),
      manualRating: getValue('rating') !== '',
      stats,
      backgroundTheme: this.validateTheme(getValue('theme')),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return playerData;
  }

  private parsePlayerDataFromJSON(jsonItem: any, index: number): PlayerData {
    const stats: PlayerStats = {
      technical: this.clampStat(jsonItem.technical || jsonItem.stats?.technical || 75),
      leadership: this.clampStat(jsonItem.leadership || jsonItem.stats?.leadership || 75),
      creativity: this.clampStat(jsonItem.creativity || jsonItem.stats?.creativity || 75),
      reliability: this.clampStat(jsonItem.reliability || jsonItem.stats?.reliability || 75),
      collaboration: this.clampStat(jsonItem.collaboration || jsonItem.stats?.collaboration || 75),
      adaptability: this.clampStat(jsonItem.adaptability || jsonItem.stats?.adaptability || 75)
    };

    const playerData: PlayerData = {
      id: jsonItem.id || `batch_json_${index}_${Date.now()}`,
      name: this.cardService.sanitizeInput(jsonItem.name || '', 30),
      position: this.validatePosition(jsonItem.position),
      nationality: (jsonItem.nationality || '').toUpperCase().substring(0, 3),
      rating: jsonItem.rating ? this.clampStat(jsonItem.rating) : this.cardService.calculateOverallRating(stats),
      manualRating: !!jsonItem.rating,
      stats,
      backgroundTheme: this.validateTheme(jsonItem.theme || jsonItem.backgroundTheme),
      profilePhoto: jsonItem.profilePhoto || jsonItem.photo,
      customLogo: jsonItem.customLogo || jsonItem.logo,
      createdAt: new Date(jsonItem.createdAt || Date.now()),
      updatedAt: new Date()
    };

    return playerData;
  }

  private validatePlayerData(playerData: PlayerData): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!playerData.name || playerData.name.length === 0) {
      errors.push('Name is required');
    }
    if (!playerData.position) {
      errors.push('Position is required');
    }
    if (!playerData.nationality || playerData.nationality.length < 2) {
      errors.push('Valid nationality code is required');
    }

    // Warnings for potentially incorrect data
    if (playerData.name.length > 25) {
      warnings.push('Name is quite long and may not display well');
    }
    if (playerData.rating < 50) {
      warnings.push('Rating seems unusually low');
    }
    if (playerData.rating > 95) {
      warnings.push('Rating seems unusually high');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validatePosition(position: string): ITPosition {
    const validPositions: ITPosition[] = ['DEV', 'OPS', 'DATA', 'PM', 'QA', 'UX', 'SEC', 'ARCH'];
    const upperPosition = position?.toUpperCase() as ITPosition;
    return validPositions.includes(upperPosition) ? upperPosition : 'DEV';
  }

  private validateTheme(theme: string): any {
    const validThemes = ['gold-classic', 'dark-mode-it', 'silver-modern', 'bronze-vintage'];
    return validThemes.includes(theme) ? theme : 'gold-classic';
  }

  private clampStat(value: any): number {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) ? Math.max(1, Math.min(99, parsed)) : 75;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private updateProgress(current: number, total: number, status: BatchProgress['status'], message: string): void {
    this.batchProgressSubject.next({ current, total, status, message });
  }
}