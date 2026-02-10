import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PlayerData, StoredCard } from '../models/player.model';

interface ProjectFile {
  version: string;
  name: string;
  description?: string;
  cards: PlayerData[];
  settings: {
    defaultTemplate: string;
    customBranding?: string;
    exportOptions: any;
  };
  createdAt: Date;
  exportedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STORAGE_KEY = 'fifa_card_history';
  private readonly PROJECT_KEY = 'fifa_card_projects';
  private readonly SETTINGS_KEY = 'fifa_card_settings';
  private readonly MAX_HISTORY = 20;

  private historySubject = new BehaviorSubject<StoredCard[]>([]);
  private settingsSubject = new BehaviorSubject<any>({});

  public history$ = this.historySubject.asObservable();
  public settings$ = this.settingsSubject.asObservable();

  constructor() {
    this.loadHistory();
    this.loadSettings();
  }

  // Card History Management
  async saveCardToHistory(playerData: PlayerData, cardElement?: HTMLElement): Promise<void> {
    try {
      let thumbnail = '';
      
      // Generate thumbnail if card element is provided
      if (cardElement) {
        thumbnail = await this.generateThumbnail(cardElement);
      }

      const storedCard: StoredCard = {
        id: playerData.id || this.generateId(),
        playerData: { ...playerData, id: playerData.id || this.generateId() },
        thumbnail,
        createdAt: playerData.createdAt || new Date(),
        updatedAt: new Date()
      };

      const currentHistory = this.getHistory();
      
      // Remove existing card with same ID if it exists
      const filteredHistory = currentHistory.filter(card => card.id !== storedCard.id);
      
      // Add new card to beginning
      const updatedHistory = [storedCard, ...filteredHistory].slice(0, this.MAX_HISTORY);

      this.saveHistory(updatedHistory);
      this.historySubject.next(updatedHistory);
    } catch (error) {
      console.error('Failed to save card to history:', error);
    }
  }

  getHistory(): StoredCard[] {
    return this.historySubject.value;
  }

  getCardFromHistory(id: string): StoredCard | undefined {
    return this.getHistory().find(card => card.id === id);
  }

  removeFromHistory(id: string): void {
    const currentHistory = this.getHistory();
    const updatedHistory = currentHistory.filter(card => card.id !== id);
    this.saveHistory(updatedHistory);
    this.historySubject.next(updatedHistory);
  }

  clearHistory(): void {
    this.saveHistory([]);
    this.historySubject.next([]);
  }

  // Project File Management
  async exportProject(
    cards: PlayerData[], 
    projectName: string, 
    settings: any = {}
  ): Promise<Blob> {
    const projectFile: ProjectFile = {
      version: '1.0',
      name: projectName,
      description: `FIFA IT Cards project exported on ${new Date().toLocaleDateString()}`,
      cards,
      settings: {
        defaultTemplate: settings.defaultTemplate || 'gold-classic',
        customBranding: settings.customBranding,
        exportOptions: settings.exportOptions || {}
      },
      createdAt: new Date(),
      exportedAt: new Date()
    };

    const jsonContent = JSON.stringify(projectFile, null, 2);
    return new Blob([jsonContent], { type: 'application/json' });
  }

  async importProject(file: File): Promise<{ cards: PlayerData[]; settings: any } | null> {
    try {
      const text = await file.text();
      const projectData: ProjectFile = JSON.parse(text);

      if (!projectData.version || !projectData.cards) {
        throw new Error('Invalid project file format');
      }

      // Validate and sanitize card data
      const validCards: PlayerData[] = [];
      for (const cardData of projectData.cards) {
        if (this.validateCardData(cardData)) {
          validCards.push({
            ...cardData,
            id: cardData.id || this.generateId(),
            createdAt: new Date(cardData.createdAt || Date.now()),
            updatedAt: new Date()
          });
        }
      }

      return {
        cards: validCards,
        settings: projectData.settings || {}
      };
    } catch (error) {
      console.error('Failed to import project:', error);
      return null;
    }
  }

  // Settings Management
  saveSettings(settings: any): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      this.settingsSubject.next(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getSettings(): any {
    return this.settingsSubject.value;
  }

  getSetting(key: string, defaultValue?: any): any {
    const settings = this.getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  updateSetting(key: string, value: any): void {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, [key]: value };
    this.saveSettings(updatedSettings);
  }

  // IndexedDB Support (for larger data)
  async saveToIndexedDB(key: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FIFA_Card_Generator', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        
        const putRequest = store.put({ id: key, data, timestamp: Date.now() });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards', { keyPath: 'id' });
        }
      };
    });
  }

  async loadFromIndexedDB(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FIFA_Card_Generator', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['cards'], 'readonly');
        const store = transaction.objectStore('cards');
        
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.data : null);
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards', { keyPath: 'id' });
        }
      };
    });
  }

  // Data Migration
  async migrateData(): Promise<void> {
    try {
      // Check if migration is needed
      const version = localStorage.getItem('fifa_card_version') || '0.1.0';
      if (version === '1.0.0') return;

      // Migrate old format data if exists
      const oldData = localStorage.getItem('playerCards');
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);
          if (Array.isArray(parsed)) {
            // Convert old format to new format
            const migratedCards: StoredCard[] = parsed.map((card: any, index: number) => ({
              id: card.id || `migrated_${index}_${Date.now()}`,
              playerData: this.migrateCardFormat(card),
              thumbnail: '',
              createdAt: new Date(card.createdAt || Date.now()),
              updatedAt: new Date()
            }));

            this.saveHistory(migratedCards);
            localStorage.removeItem('playerCards'); // Clean up old data
          }
        } catch (error) {
          console.warn('Failed to migrate old data:', error);
        }
      }

      localStorage.setItem('fifa_card_version', '1.0.0');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  // Backup and Restore
  createBackup(): Blob {
    const backupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      history: this.getHistory(),
      settings: this.getSettings()
    };

    return new Blob([JSON.stringify(backupData, null, 2)], { 
      type: 'application/json' 
    });
  }

  async restoreFromBackup(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.version || !backupData.history) {
        throw new Error('Invalid backup file format');
      }

      // Restore history
      if (Array.isArray(backupData.history)) {
        this.saveHistory(backupData.history);
        this.historySubject.next(backupData.history);
      }

      // Restore settings
      if (backupData.settings) {
        this.saveSettings(backupData.settings);
      }

      return true;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return false;
    }
  }

  // Storage Usage Analytics
  getStorageUsage(): { used: number; available: number; percentage: number } {
    let used = 0;
    let available = 0;

    try {
      // Estimate localStorage usage
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // localStorage typically has a 5-10MB limit
      available = 5 * 1024 * 1024; // 5MB estimate
      
      return {
        used,
        available,
        percentage: (used / available) * 100
      };
    } catch (error) {
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  // Private helper methods
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const history: StoredCard[] = JSON.parse(stored);
        this.historySubject.next(history);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      this.historySubject.next([]);
    }
  }

  private saveHistory(history: StoredCard[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history:', error);
      
      // If localStorage is full, remove oldest items and retry
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const reducedHistory = history.slice(0, this.MAX_HISTORY / 2);
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reducedHistory));
          this.historySubject.next(reducedHistory);
        } catch (retryError) {
          console.error('Failed to save reduced history:', retryError);
        }
      }
    }
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        this.settingsSubject.next(settings);
      } else {
        // Default settings
        const defaultSettings = {
          defaultTemplate: 'gold-classic',
          language: 'en',
          theme: 'dark',
          autoSave: true,
          compressionQuality: 0.9
        };
        this.settingsSubject.next(defaultSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settingsSubject.next({});
    }
  }

  private async generateThumbnail(cardElement: HTMLElement): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 200;
      canvas.height = 280;
      
      // Create a simple thumbnail representation
      if (ctx) {
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Simple card outline
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Player name placeholder
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Card Preview', canvas.width / 2, canvas.height / 2);
      }
      
      return canvas.toDataURL('image/png', 0.5);
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return '';
    }
  }

  private validateCardData(cardData: any): boolean {
    return !!(
      cardData &&
      typeof cardData.name === 'string' &&
      typeof cardData.position === 'string' &&
      typeof cardData.nationality === 'string' &&
      typeof cardData.rating === 'number' &&
      cardData.stats &&
      typeof cardData.stats.technical === 'number'
    );
  }

  private migrateCardFormat(oldCard: any): PlayerData {
    // Convert old card format to new PlayerData format
    return {
      id: oldCard.id || this.generateId(),
      name: oldCard.name || 'Unknown Player',
      position: oldCard.position || 'DEV',
      nationality: oldCard.country || oldCard.nationality || 'US',
      rating: oldCard.rating || 75,
      manualRating: false,
      stats: {
        technical: oldCard.pace || oldCard.technical || 75,
        leadership: oldCard.shooting || oldCard.leadership || 75,
        creativity: oldCard.passing || oldCard.creativity || 75,
        reliability: oldCard.dribbling || oldCard.reliability || 75,
        collaboration: oldCard.defending || oldCard.collaboration || 75,
        adaptability: oldCard.physical || oldCard.adaptability || 75
      },
      backgroundTheme: oldCard.cardType === 'gold' ? 'gold-classic' : 'dark-mode-it',
      profilePhoto: oldCard.imageUrl || oldCard.profilePhoto,
      createdAt: new Date(oldCard.createdAt || Date.now()),
      updatedAt: new Date()
    };
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}