import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as htmlToImage from 'html-to-image';
import { CardService } from './services/card.service';
import { ExportService } from './services/export.service';
import { BatchService } from './services/batch.service';
import { StorageService } from './services/storage.service';
import { PlayerData, PlayerStats, CardTemplate, ITPosition, CardTheme, StoredCard, STAT_LABELS, POSITION_NAMES } from './models/player.model';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  exiting?: boolean;
}

interface BatchProgress {
  current: number;
  total: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <!-- Toast Container -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <div
        *ngFor="let toast of toasts"
        [class]="'px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium ' +
          (toast.exiting ? 'toast-exit ' : 'toast-enter ') +
          (toast.type === 'success' ? 'bg-green-600 text-white' :
           toast.type === 'error' ? 'bg-red-600 text-white' :
           toast.type === 'warning' ? 'bg-yellow-500 text-black' :
           'bg-blue-600 text-white')"
      >
        <span>{{ toast.type === 'success' ? '&#10003;' : toast.type === 'error' ? '&#10007;' : toast.type === 'warning' ? '!' : 'i' }}</span>
        <span>{{ toast.message }}</span>
      </div>
    </div>

    <!-- Export Loading Overlay -->
    <div *ngIf="isExporting" class="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
      <div class="bg-slate-800 rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
        <div class="export-spinner"></div>
        <div class="text-white font-medium">{{ exportingType }}...</div>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="min-h-screen bg-slate-900 text-white">

      <!-- Header -->
      <header class="bg-slate-800 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <h1 class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              FIFA IT Card Generator
            </h1>
            <div class="flex items-center gap-3">
              <button
                (click)="showToast('Language switching coming soon', 'info')"
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
              >
                EN / FR
              </button>
              <button
                (click)="toggleDarkMode()"
                class="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                {{ isDarkMode ? '&#9788;' : '&#9790;' }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div class="grid lg:grid-cols-3 gap-6 lg:gap-8">

          <!-- Center: Card Preview (first on mobile) -->
          <div class="lg:col-span-1 order-first lg:order-2">
            <div class="sticky top-8">
              <div class="bg-slate-800 rounded-xl shadow-xl p-4 sm:p-6">
                <h3 class="text-lg font-semibold mb-4 text-center text-yellow-400">Live Preview</h3>

                <!-- FIFA Card with 3D tilt -->
                <div class="flex justify-center mb-6">
                  <div class="card-tilt-container">
                    <div
                      class="card-tilt-inner"
                      [class.card-animate-entrance]="cardAnimating"
                      (mousemove)="onCardMouseMove($event)"
                      (mouseleave)="onCardMouseLeave($event)"
                      [style.transform]="cardTiltTransform"
                    >
                      <div
                        id="fifa-card-preview"
                        [class]="'fifa-card ' + currentPlayer.backgroundTheme"
                      >
                        <!-- Header with rating and position -->
                        <div class="card-header">
                          <div class="rating-badge">{{ currentPlayer.rating }}</div>
                          <div class="position-badge">{{ currentPlayer.position }}</div>
                          <div *ngIf="currentPlayer.nationality"
                               class="flag-logo"
                               [title]="currentPlayer.nationality">
                            {{ getFlagEmoji(currentPlayer.nationality) }}
                          </div>
                        </div>

                        <!-- Player photo -->
                        <div class="player-photo-container">
                          <img
                            *ngIf="currentPlayer.profilePhoto"
                            [src]="currentPlayer.profilePhoto"
                            [class]="'player-photo ' + (selectedTemplate?.maskShape === 'circle' ? 'circle-mask' : '')"
                            alt="Player Photo"
                            (error)="onImageError($event)"
                          >
                          <div
                            *ngIf="!currentPlayer.profilePhoto"
                            class="photo-placeholder"
                          >
                            &#128100;
                          </div>
                        </div>

                        <!-- Player info -->
                        <div class="player-info">
                          <div class="player-name">{{ currentPlayer.name || 'Player Name' }}</div>
                          <div class="nationality-info">{{ currentPlayer.nationality || 'NAT' }}</div>
                        </div>

                        <!-- Stats grid -->
                        <div class="stats-grid">
                          <div *ngFor="let stat of statKeys" class="stat-item">
                            <div class="stat-value">{{ currentPlayer.stats[stat] || 0 }}</div>
                            <div class="stat-label">{{ getStatLabel(stat) }}</div>
                          </div>
                        </div>

                        <!-- Brand logo -->
                        <div *ngIf="currentPlayer.customLogo" class="brand-logo">
                          <img [src]="currentPlayer.customLogo" alt="Logo">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Export buttons -->
                <div class="grid grid-cols-2 gap-3">
                  <button
                    (click)="exportPNG('transparent')"
                    [disabled]="isExporting"
                    class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    PNG Export
                  </button>
                  <button
                    (click)="copyToClipboard()"
                    [disabled]="isExporting"
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    Copy
                  </button>
                  <button
                    (click)="exportPDF()"
                    [disabled]="isExporting"
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    PDF Sheet
                  </button>
                  <button
                    (click)="duplicateCard()"
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Duplicate
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Left Panel: Card Builder -->
          <div class="lg:col-span-1 order-2 lg:order-1">
            <div class="bg-slate-800 rounded-xl shadow-xl p-4 sm:p-6 space-y-6">

              <!-- Template Selector -->
              <div>
                <h3 class="text-lg font-semibold mb-3 text-yellow-400">Card Template</h3>
                <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                  <button
                    *ngFor="let template of availableTemplates"
                    (click)="selectTemplate(template.id)"
                    [class]="'p-2 rounded-lg border-2 transition-all text-center ' +
                    (currentPlayer.backgroundTheme === template.name ?
                      'border-yellow-400 bg-yellow-400/10 shadow-glow-gold' :
                      'border-slate-600 hover:border-slate-500')"
                  >
                    <div class="text-xs font-medium truncate">{{ template.displayName }}</div>
                  </button>
                </div>
              </div>

              <!-- Player Form -->
              <form [formGroup]="cardForm" class="space-y-4">

                <!-- Name -->
                <div>
                  <label class="block text-sm font-medium mb-1">Player Name</label>
                  <input
                    type="text"
                    formControlName="name"
                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Enter player name"
                  >
                </div>

                <!-- Position -->
                <div>
                  <label class="block text-sm font-medium mb-1">IT Position</label>
                  <select
                    formControlName="position"
                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    <option *ngFor="let position of itPositions" [value]="position">
                      {{ position }} - {{ getPositionName(position) }}
                    </option>
                  </select>
                </div>

                <!-- Nationality -->
                <div>
                  <label class="block text-sm font-medium mb-1">Nationality (ISO Code)</label>
                  <input
                    type="text"
                    formControlName="nationality"
                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="FR, US, DE, etc."
                    maxlength="3"
                  >
                </div>

                <!-- Overall Rating -->
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Overall Rating: <span class="text-yellow-400 font-bold">{{ currentPlayer.rating }}</span>
                    <button
                      type="button"
                      (click)="toggleManualRating()"
                      [class]="'ml-2 text-xs px-2 py-1 rounded ' +
                      (currentPlayer.manualRating ? 'bg-red-600 text-white' : 'bg-green-600 text-white')"
                    >
                      {{ currentPlayer.manualRating ? 'Manual' : 'Auto' }}
                    </button>
                  </label>
                  <input
                    type="range"
                    formControlName="rating"
                    [disabled]="!currentPlayer.manualRating"
                    min="1"
                    max="99"
                    class="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                  >
                </div>

                <!-- Photo Upload -->
                <div>
                  <label class="block text-sm font-medium mb-1">Profile Photo</label>
                  <div
                    class="w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-slate-500 transition-colors"
                    (click)="fileInput.click()"
                    (drop)="onFileDrop($event)"
                    (dragover)="onDragOver($event)"
                    (dragleave)="onDragLeave($event)"
                  >
                    <div class="text-center">
                      <div *ngIf="!currentPlayer.profilePhoto" class="text-slate-400">
                        <div class="text-sm">Drag & drop or click to upload</div>
                      </div>
                      <img
                        *ngIf="currentPlayer.profilePhoto"
                        [src]="currentPlayer.profilePhoto"
                        class="max-h-28 max-w-full object-cover rounded"
                        alt="Preview"
                      >
                    </div>
                  </div>
                  <input
                    #fileInput
                    type="file"
                    accept="image/*"
                    (change)="onImageUpload($event)"
                    class="hidden"
                  >
                </div>

                <!-- Stats -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium">IT Skills</h4>
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        (click)="randomizeStats()"
                        class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
                      >
                        Randomize
                      </button>
                      <button
                        type="button"
                        (click)="recomputeRating()"
                        class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                      >
                        Recompute
                      </button>
                      <button
                        type="button"
                        (click)="resetStats()"
                        class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div *ngFor="let stat of statKeys" class="flex items-center gap-3">
                      <div class="w-12 text-xs font-medium uppercase text-slate-400">{{ getStatLabel(stat) }}</div>
                      <input
                        type="range"
                        [formControlName]="stat"
                        min="1"
                        max="99"
                        class="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                      >
                      <div class="w-8 text-xs font-bold text-right text-yellow-400">
                        {{ cardForm.get(stat)?.value }}
                      </div>
                    </div>
                  </div>
                </div>

              </form>
            </div>
          </div>

          <!-- Right Panel: Batch & History -->
          <div class="lg:col-span-1 order-3">
            <div class="bg-slate-800 rounded-xl shadow-xl p-4 sm:p-6 space-y-6">

              <!-- Tabs -->
              <div class="flex border-b border-slate-700">
                <button
                  (click)="activeTab = 'single'"
                  [class]="'px-4 py-2 text-sm font-medium transition-colors ' +
                  (activeTab === 'single' ? 'border-b-2 border-yellow-400 text-yellow-400' : 'text-slate-400 hover:text-white')"
                >
                  Single Card
                </button>
                <button
                  (click)="activeTab = 'batch'"
                  [class]="'px-4 py-2 text-sm font-medium transition-colors ' +
                  (activeTab === 'batch' ? 'border-b-2 border-yellow-400 text-yellow-400' : 'text-slate-400 hover:text-white')"
                >
                  Batch Mode
                </button>
                <button
                  (click)="activeTab = 'history'"
                  [class]="'px-4 py-2 text-sm font-medium transition-colors ' +
                  (activeTab === 'history' ? 'border-b-2 border-yellow-400 text-yellow-400' : 'text-slate-400 hover:text-white')"
                >
                  History
                </button>
              </div>

              <!-- Single Card Tab -->
              <div *ngIf="activeTab === 'single'" class="space-y-4">
                <h4 class="font-medium">Export Options</h4>
                <div class="space-y-2">
                  <button
                    (click)="exportPNG('transparent')"
                    [disabled]="isExporting"
                    class="w-full p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors text-left"
                  >
                    <div class="font-medium">Transparent PNG</div>
                    <div class="text-xs text-slate-400">1024x1536 for printing</div>
                  </button>
                  <button
                    (click)="exportPNG('web')"
                    [disabled]="isExporting"
                    class="w-full p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors text-left"
                  >
                    <div class="font-medium">Web PNG</div>
                    <div class="text-xs text-slate-400">512x768 for web use</div>
                  </button>
                  <button
                    (click)="exportPNG('social')"
                    [disabled]="isExporting"
                    class="w-full p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors text-left"
                  >
                    <div class="font-medium">Social Media</div>
                    <div class="text-xs text-slate-400">1080x1080 square crop</div>
                  </button>
                </div>
              </div>

              <!-- Batch Mode Tab -->
              <div *ngIf="activeTab === 'batch'" class="space-y-4">
                <h4 class="font-medium">Import Data</h4>
                <div class="space-y-3">
                  <div class="file-input-wrapper w-full">
                    <div class="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center cursor-pointer text-sm">
                      Upload CSV or JSON file
                    </div>
                    <input
                      type="file"
                      accept=".csv,.json"
                      (change)="onBatchImport($event)"
                    >
                  </div>
                  <div class="file-input-wrapper w-full">
                    <div class="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center cursor-pointer text-sm">
                      Upload Photos ZIP (optional)
                    </div>
                    <input
                      type="file"
                      accept=".zip"
                      (change)="onPhotoZipImport($event)"
                    >
                  </div>
                </div>

                <!-- Batch Progress -->
                <div *ngIf="batchProgress.status !== 'idle'" class="space-y-2">
                  <div class="text-xs text-slate-400">{{ batchProgress.message }}</div>
                  <div *ngIf="batchProgress.total > 0" class="w-full bg-slate-700 rounded-full h-2">
                    <div
                      class="bg-yellow-400 h-2 rounded-full progress-bar-fill"
                      [style.width.%]="batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0"
                    ></div>
                  </div>
                </div>

                <!-- Batch Cards List -->
                <div *ngIf="batchCards.length > 0" class="space-y-2">
                  <h4 class="font-medium text-sm">Imported Cards ({{ batchCards.length }})</h4>
                  <div class="max-h-64 overflow-y-auto space-y-1">
                    <div
                      *ngFor="let card of batchCards"
                      (click)="loadBatchCard(card)"
                      class="p-2 bg-slate-700 hover:bg-slate-600 rounded cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <span class="text-sm font-medium">{{ card.name }}</span>
                        <span class="text-xs text-slate-400 ml-2">{{ card.position }}</span>
                      </div>
                      <span class="text-xs text-yellow-400 font-bold">{{ card.rating }}</span>
                    </div>
                  </div>
                </div>

                <div class="text-xs text-slate-400">
                  CSV columns: name, position, nationality, technical, leadership, creativity, reliability, collaboration, adaptability
                </div>
              </div>

              <!-- History Tab -->
              <div *ngIf="activeTab === 'history'" class="space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="font-medium">Recent Cards</h4>
                  <button
                    *ngIf="cardHistory.length > 0"
                    (click)="clearHistory()"
                    class="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div *ngIf="cardHistory.length === 0" class="text-sm text-slate-400">
                  No cards in history yet. Export a card to save it here.
                </div>

                <div *ngIf="cardHistory.length > 0" class="max-h-96 overflow-y-auto space-y-2">
                  <div
                    *ngFor="let stored of cardHistory"
                    class="p-3 bg-slate-700 rounded-lg flex items-center justify-between group transition-colors hover:bg-slate-600"
                  >
                    <div (click)="loadFromHistory(stored)" class="cursor-pointer flex-1">
                      <div class="font-medium text-sm">{{ stored.playerData.name }}</div>
                      <div class="text-xs text-slate-400">
                        {{ stored.playerData.position }} &middot; {{ stored.playerData.rating }} OVR
                      </div>
                    </div>
                    <button
                      (click)="removeFromHistory(stored.id)"
                      class="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-lg px-2"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Form and data
  cardForm!: FormGroup;
  currentPlayer: PlayerData = {} as PlayerData;
  availableTemplates: CardTemplate[] = [];
  selectedTemplate: CardTemplate | null = null;

  // UI state
  activeTab: 'single' | 'batch' | 'history' = 'single';
  isDragOver = false;
  isDarkMode = true;
  cardAnimating = false;
  cardTiltTransform = '';

  // Toast system
  toasts: Toast[] = [];
  private toastIdCounter = 0;

  // Export state
  isExporting = false;
  exportingType = '';

  // History & Batch
  cardHistory: StoredCard[] = [];
  batchCards: PlayerData[] = [];
  batchProgress: BatchProgress = { current: 0, total: 0, status: 'idle', message: '' };

  // Constants
  itPositions: ITPosition[] = ['DEV', 'OPS', 'DATA', 'PM', 'QA', 'UX', 'SEC', 'ARCH'];
  statKeys: (keyof PlayerStats)[] = ['technical', 'leadership', 'creativity', 'reliability', 'collaboration', 'adaptability'];

  constructor(
    private fb: FormBuilder,
    private cardService: CardService,
    private exportService: ExportService,
    private batchService: BatchService,
    private storageService: StorageService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    // Subscribe to card service data
    this.cardService.currentPlayer$
      .pipe(takeUntil(this.destroy$))
      .subscribe(player => {
        this.currentPlayer = player;
        this.updateFormFromPlayer(player);
      });

    this.cardService.availableTemplates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(templates => {
        this.availableTemplates = templates;
        this.selectedTemplate = templates.find(t => t.id === this.currentPlayer.backgroundTheme) || templates[0];
      });

    // Subscribe to history
    this.storageService.history$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.cardHistory = history;
      });

    // Subscribe to batch data
    this.batchService.batchProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.batchProgress = progress;
      });

    this.batchService.batchCards$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cards => {
        this.batchCards = cards;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== Toast System =====
  showToast(message: string, type: Toast['type'] = 'info', duration: number = 3000) {
    const toast: Toast = { id: ++this.toastIdCounter, message, type };
    this.toasts.push(toast);

    setTimeout(() => {
      const t = this.toasts.find(x => x.id === toast.id);
      if (t) t.exiting = true;

      setTimeout(() => {
        this.toasts = this.toasts.filter(x => x.id !== toast.id);
      }, 300);
    }, duration);
  }

  // ===== Dark Mode =====
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.showToast(this.isDarkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  }

  // ===== Form initialization =====
  private initializeForm() {
    this.cardForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(30)]],
      position: ['DEV', Validators.required],
      nationality: ['FR', [Validators.required, Validators.pattern(/^[A-Z]{2,3}$/)]],
      rating: [85, [Validators.required, Validators.min(1), Validators.max(99)]],
      technical: [75, [Validators.min(1), Validators.max(99)]],
      leadership: [75, [Validators.min(1), Validators.max(99)]],
      creativity: [75, [Validators.min(1), Validators.max(99)]],
      reliability: [75, [Validators.min(1), Validators.max(99)]],
      collaboration: [75, [Validators.min(1), Validators.max(99)]],
      adaptability: [75, [Validators.min(1), Validators.max(99)]]
    });

    // Subscribe to form changes
    this.cardForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(formValues => {
        if (this.cardForm.valid) {
          this.updatePlayerFromForm(formValues);
        }
      });
  }

  private updateFormFromPlayer(player: PlayerData) {
    this.cardForm.patchValue({
      name: player.name,
      position: player.position,
      nationality: player.nationality,
      rating: player.rating,
      ...player.stats
    }, { emitEvent: false });
  }

  private updatePlayerFromForm(formValues: any) {
    const updatedPlayer: Partial<PlayerData> = {
      name: this.cardService.sanitizeInput(formValues.name, 30),
      position: formValues.position,
      nationality: formValues.nationality?.toUpperCase(),
      rating: formValues.rating,
      stats: {
        technical: formValues.technical,
        leadership: formValues.leadership,
        creativity: formValues.creativity,
        reliability: formValues.reliability,
        collaboration: formValues.collaboration,
        adaptability: formValues.adaptability
      }
    };

    this.cardService.updatePlayer(updatedPlayer);
  }

  // ===== Template management =====
  selectTemplate(templateId: string) {
    const template = this.cardService.getTemplateById(templateId);
    if (template) {
      this.selectedTemplate = template;
      this.cardService.updatePlayer({ backgroundTheme: template.name as CardTheme });

      // Trigger entrance animation
      this.cardAnimating = false;
      requestAnimationFrame(() => {
        this.cardAnimating = true;
        setTimeout(() => this.cardAnimating = false, 500);
      });
    }
  }

  // ===== 3D Card Tilt =====
  onCardMouseMove(event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateY = ((x - centerX) / centerX) * 8;
    const rotateX = ((centerY - y) / centerY) * 8;

    this.cardTiltTransform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  onCardMouseLeave(event: MouseEvent) {
    this.cardTiltTransform = '';
  }

  // ===== Stats management =====
  randomizeStats() {
    const seed = this.currentPlayer.name + Date.now();
    const newStats = this.cardService.randomizeStats(seed);
    this.cardService.updatePlayer({ stats: newStats, manualRating: false });
    this.cardForm.patchValue(newStats);
  }

  recomputeRating() {
    const newRating = this.cardService.calculateOverallRating(this.currentPlayer.stats);
    this.cardService.updatePlayer({ rating: newRating, manualRating: false });
    this.cardForm.patchValue({ rating: newRating });
  }

  resetStats() {
    const defaultStats = {
      technical: 75,
      leadership: 75,
      creativity: 75,
      reliability: 75,
      collaboration: 75,
      adaptability: 75
    };
    this.cardService.updatePlayer({ stats: defaultStats, manualRating: false });
    this.cardForm.patchValue(defaultStats);
  }

  toggleManualRating() {
    const manual = !this.currentPlayer.manualRating;
    this.cardService.updatePlayer({ manualRating: manual });

    if (!manual) {
      this.recomputeRating();
    }
  }

  // ===== Image handling =====
  onImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processImageFile(file);
    }
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processImageFile(files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  private async processImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image file too large. Please select a file under 5MB.', 'error');
      return;
    }

    try {
      const processedImage = await this.stripExifAndResize(file);
      this.cardService.updatePlayer({ profilePhoto: processedImage });
      this.showToast('Photo uploaded successfully', 'success');
    } catch (error) {
      console.error('Error processing image:', error);
      this.showToast('Error processing image. Please try a different file.', 'error');
    }
  }

  private stripExifAndResize(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const maxSize = 800;
          const { width, height } = this.calculateResizedimensions(img.width, img.height, maxSize);

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private calculateResizedimensions(originalWidth: number, originalHeight: number, maxSize: number) {
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      return { width: maxSize, height: Math.round(maxSize / aspectRatio) };
    } else {
      return { width: Math.round(maxSize * aspectRatio), height: maxSize };
    }
  }

  onImageError(event: Event) {
    console.warn('Image failed to load');
    this.cardService.updatePlayer({ profilePhoto: undefined });
  }

  // ===== Export functions =====
  private resetTiltBeforeExport() {
    this.cardTiltTransform = '';
  }

  async exportPNG(size: 'transparent' | 'web' | 'social' = 'transparent') {
    const cardElement = document.getElementById('fifa-card-preview');
    if (!cardElement) return;

    this.resetTiltBeforeExport();
    this.isExporting = true;
    this.exportingType = 'Generating PNG';

    // Wait a tick for tilt reset to apply
    await new Promise(r => setTimeout(r, 50));

    try {
      const dataUrl = await this.exportService.exportCardAsPNG(cardElement, this.currentPlayer, size);
      this.downloadImage(dataUrl, `${this.currentPlayer.name}_FIFA_Card_${size}.png`);
      this.showToast('PNG exported successfully!', 'success');

      // Auto-save to history
      await this.storageService.saveCardToHistory(this.currentPlayer, cardElement);
    } catch (error) {
      console.error('Error generating PNG:', error);
      this.showToast('Error generating PNG. Please try again.', 'error');
    } finally {
      this.isExporting = false;
      this.exportingType = '';
    }
  }

  async copyToClipboard() {
    const cardElement = document.getElementById('fifa-card-preview');
    if (!cardElement) return;

    this.resetTiltBeforeExport();
    await new Promise(r => setTimeout(r, 50));

    try {
      const success = await this.exportService.copyToClipboard(cardElement);
      if (success) {
        this.showToast('Card copied to clipboard!', 'success');
      } else {
        this.showToast('Unable to copy to clipboard.', 'error');
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.showToast('Unable to copy to clipboard. Try PNG export instead.', 'error');
    }
  }

  async exportPDF() {
    const cardElement = document.getElementById('fifa-card-preview');
    if (!cardElement) return;

    this.resetTiltBeforeExport();
    this.isExporting = true;
    this.exportingType = 'Generating PDF';

    await new Promise(r => setTimeout(r, 50));

    try {
      // Generate the current card as PNG first
      const pngDataUrl = await this.exportService.exportCardAsPNG(cardElement, this.currentPlayer, 'transparent');

      // Generate PDF contact sheet with the current card
      const pdfBytes = await this.exportService.generatePDFContactSheet([
        { playerData: this.currentPlayer, imageDataUrl: pngDataUrl }
      ]);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      this.exportService.downloadFile(blob, `${this.currentPlayer.name}_FIFA_Card_Sheet.pdf`);
      this.showToast('PDF exported successfully!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.showToast('Error generating PDF. Please try again.', 'error');
    } finally {
      this.isExporting = false;
      this.exportingType = '';
    }
  }

  duplicateCard() {
    const duplicated = {
      ...this.currentPlayer,
      id: undefined,
      name: `${this.currentPlayer.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.cardService.updatePlayer(duplicated);
    this.showToast('Card duplicated', 'info');
  }

  // ===== Batch operations =====
  async onBatchImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      let result;
      if (file.name.endsWith('.csv')) {
        result = await this.batchService.importFromCSV(file);
      } else if (file.name.endsWith('.json')) {
        result = await this.batchService.importFromJSON(file);
      } else {
        this.showToast('Please upload a CSV or JSON file.', 'error');
        return;
      }

      const successCount = result.success.length;
      const errorCount = result.errors.length;

      if (successCount > 0) {
        this.showToast(`Imported ${successCount} cards successfully!`, 'success');
      }
      if (errorCount > 0) {
        this.showToast(`${errorCount} rows had errors.`, 'warning');
      }
    } catch (error) {
      console.error('Batch import error:', error);
      this.showToast('Error importing file. Check format and try again.', 'error');
    }

    // Reset file input
    input.value = '';
  }

  async onPhotoZipImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const photos = await this.batchService.importPhotoLibrary(file);
      this.showToast(`Loaded ${photos.size} photos`, 'success');

      // Auto-match photos to batch cards if any
      if (this.batchCards.length > 0) {
        this.batchService.matchPhotosToPlayers();
        this.showToast('Photos matched to players', 'info');
      }
    } catch (error) {
      console.error('Photo ZIP import error:', error);
      this.showToast('Error importing photos. Check ZIP file.', 'error');
    }

    input.value = '';
  }

  loadBatchCard(card: PlayerData) {
    this.cardService.updatePlayer(card);
    this.showToast(`Loaded card: ${card.name}`, 'info');
  }

  // ===== History =====
  loadFromHistory(stored: StoredCard) {
    this.cardService.updatePlayer(stored.playerData);
    this.showToast(`Loaded: ${stored.playerData.name}`, 'info');
  }

  removeFromHistory(id: string) {
    this.storageService.removeFromHistory(id);
    this.showToast('Card removed from history', 'info');
  }

  clearHistory() {
    this.storageService.clearHistory();
    this.showToast('History cleared', 'info');
  }

  // ===== Utility functions =====
  private downloadImage(dataUrl: string, filename: string) {
    const link = document.createElement('a');
    link.download = filename.replace(/\s+/g, '_');
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getPositionName(position: ITPosition): string {
    return POSITION_NAMES[position] || position;
  }

  getStatLabel(stat: string): string {
    return STAT_LABELS[stat] || stat.toUpperCase();
  }

  getFlagEmoji(countryCode: string): string {
    if (!countryCode || countryCode.length < 2) return '';
    const code = countryCode.toUpperCase();
    // Convert country code to regional indicator symbols
    const offset = 127397;
    const chars = [...code].map(c => String.fromCodePoint(c.charCodeAt(0) + offset));
    return chars.join('');
  }
}
