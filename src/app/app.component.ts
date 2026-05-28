import { Component, OnInit, OnDestroy } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as htmlToImage from 'html-to-image';
import { CardService } from './services/card.service';
import { ExportService } from './services/export.service';
import { BatchService, CSVParseResult, FieldMapping, CardFieldKey } from './services/batch.service';
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
    imports: [FormsModule, ReactiveFormsModule],
    template: `
    <!-- Toast Container -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      @for (toast of toasts; track toast) {
        <div
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
      }
    </div>

    <!-- Export Loading Overlay -->
    @if (isExporting) {
      <div class="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
        <div class="bg-slate-800 rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
          <div class="export-spinner"></div>
          <div class="text-white font-medium">{{ exportingType }}...</div>
        </div>
      </div>
    }

    <!-- Batch Import Wizard Modal -->
    @if (showBatchWizard) {
      <div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" (click)="closeBatchWizard()">
        <div class="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">

          <!-- Modal Header -->
          <div class="flex items-center justify-between p-5 border-b border-slate-700">
            <h2 class="text-lg font-bold text-yellow-400">Batch Import</h2>
            <button (click)="closeBatchWizard()" class="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
          </div>

          <!-- Step Indicators -->
          <div class="flex items-center gap-0 px-5 pt-4">
            @for (step of wizardSteps; track step; let i = $index) {
              <div class="flex items-center" [class.flex-1]="i < wizardSteps.length - 1">
                <div [class]="'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ' +
                  (wizardStep > i + 1 ? 'bg-green-600 text-white' :
                   wizardStep === i + 1 ? 'bg-yellow-400 text-black' :
                   'bg-slate-600 text-slate-400')">
                  {{ wizardStep > i + 1 ? '&#10003;' : (i + 1) }}
                </div>
                <div class="text-xs ml-1.5 shrink-0" [class]="wizardStep === i + 1 ? 'text-yellow-400 font-medium' : 'text-slate-500'">{{ step }}</div>
                @if (i < wizardSteps.length - 1) {
                  <div class="flex-1 h-px bg-slate-600 mx-2"></div>
                }
              </div>
            }
          </div>

          <!-- Step 1: File Upload -->
          @if (wizardStep === 1) {
            <div class="p-5 space-y-4">
              <p class="text-sm text-slate-400">Upload a CSV or JSON file containing player data.</p>
              <div
                class="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
                [class]="wizardDragOver ? 'border-yellow-400 bg-yellow-400/5' : 'border-slate-600 hover:border-slate-500'"
                (click)="wizardFileInput.click()"
                (dragover)="onWizardDragOver($event)"
                (dragleave)="onWizardDragLeave($event)"
                (drop)="onWizardFileDrop($event)"
                >
                <div class="text-4xl mb-3">&#128196;</div>
                <div class="font-medium mb-1">Drag &amp; drop or click to upload</div>
                <div class="text-sm text-slate-400">CSV or JSON files supported</div>
              </div>
              <input
                #wizardFileInput
                type="file"
                accept=".csv,.json"
                class="hidden"
                (change)="onWizardFileSelect($event)"
                >
              @if (wizardFileName) {
                <div class="flex items-center gap-2 p-3 bg-slate-700 rounded-lg">
                  <span class="text-green-400">&#10003;</span>
                  <span class="text-sm">{{ wizardFileName }}</span>
                </div>
              }
            </div>
          }

          <!-- Step 2: Field Mapping (CSV only) -->
          @if (wizardStep === 2) {
            <div class="p-5 space-y-4">
              <p class="text-sm text-slate-400">Map each column from your CSV to the corresponding card field.</p>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-slate-700">
                      <th class="text-left py-2 pr-4 text-slate-400 font-medium">CSV Column</th>
                      <th class="text-left py-2 pr-4 text-slate-400 font-medium">Sample Data</th>
                      <th class="text-left py-2 text-slate-400 font-medium">Map To</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (header of csvParseResult?.headers; track header) {
                      <tr class="border-b border-slate-700/50">
                        <td class="py-2 pr-4 font-medium">{{ header }}</td>
                        <td class="py-2 pr-4 text-slate-400 text-xs max-w-24 truncate">
                          {{ getPreviewCellValue(header) }}
                        </td>
                        <td class="py-2">
                          <select
                            [ngModel]="fieldMapping[header]"
                            (ngModelChange)="fieldMapping[header] = $event"
                            class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs focus:border-blue-500 focus:outline-none w-36"
                            >
                            <option value="skip">-- Skip --</option>
                            <option value="name">Name</option>
                            <option value="position">Position</option>
                            <option value="nationality">Nationality</option>
                            <option value="rating">Overall Rating</option>
                            <option value="theme">Theme</option>
                            <option value="technical">Technical</option>
                            <option value="leadership">Leadership</option>
                            <option value="creativity">Creativity</option>
                            <option value="reliability">Reliability</option>
                            <option value="collaboration">Collaboration</option>
                            <option value="adaptability">Adaptability</option>
                            <option value="photo">Photo URL</option>
                          </select>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <!-- CSV Preview -->
              @if (csvParseResult && csvParseResult.preview.length > 0) {
                <div>
                  <div class="text-xs text-slate-400 mb-2">Preview (first 3 rows):</div>
                  <div class="overflow-x-auto bg-slate-900 rounded p-2 text-xs font-mono space-y-1">
                    @for (row of csvParseResult.preview; track row; let i = $index) {
                      <div class="text-slate-300">{{ formatPreviewRow(row) }}</div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Step 3: Preview & Confirm -->
          @if (wizardStep === 3) {
            <div class="p-5 space-y-4">
              <div class="flex items-center justify-between">
                <p class="text-sm text-slate-400">Review how your data will be imported.</p>
                <span class="text-yellow-400 font-bold text-sm">{{ wizardPreviewCards.length }} player{{ wizardPreviewCards.length !== 1 ? 's' : '' }} ready</span>
              </div>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                @for (card of wizardPreviewCards.slice(0, 3); track card; let i = $index) {
                  <div class="p-3 bg-slate-700 rounded-lg flex items-center gap-4">
                    <div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-yellow-400 font-bold text-sm shrink-0">
                      {{ card.rating }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm truncate">{{ card.name || '(no name)' }}</div>
                      <div class="text-xs text-slate-400">{{ card.position }} &middot; {{ card.nationality }} &middot; {{ card.backgroundTheme }}</div>
                    </div>
                    <div class="text-xs text-slate-500 shrink-0">Row {{ i + 1 }}</div>
                  </div>
                }
                @if (wizardPreviewCards.length > 3) {
                  <div class="text-center text-xs text-slate-400 py-2">
                    + {{ wizardPreviewCards.length - 3 }} more cards
                  </div>
                }
              </div>
              @if (wizardPreviewCards.length === 0) {
                <div class="p-4 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
                  No valid cards could be parsed. Please go back and check your field mapping.
                </div>
              }
            </div>
          }

          <!-- Step 4: Done -->
          @if (wizardStep === 4) {
            <div class="p-5 flex flex-col items-center gap-4 py-8">
              <div class="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-3xl">&#10003;</div>
              <div class="text-lg font-bold">Import Complete</div>
              <div class="text-slate-400 text-sm text-center">
                {{ wizardImportResult ? wizardImportResult.success.length : 0 }} card{{ (wizardImportResult ? wizardImportResult.success.length : 0) !== 1 ? 's' : '' }} imported successfully.
                @if (wizardImportResult && wizardImportResult.errors.length > 0) {
                  <span class="text-yellow-400"> {{ wizardImportResult.errors.length }} row{{ wizardImportResult.errors.length !== 1 ? 's' : '' }} had errors and were skipped.</span>
                }
              </div>
            </div>
          }

          <!-- Modal Footer -->
          <div class="flex items-center justify-between p-5 border-t border-slate-700">
            <div>
              @if (wizardStep > 1 && wizardStep < 4) {
                <button
                  (click)="wizardBack()"
                  class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                  >
                  Back
                </button>
              }
            </div>
            <div class="flex gap-3">
              @if (wizardStep < 4) {
                <button
                  (click)="closeBatchWizard()"
                  class="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                  Cancel
                </button>
              }
              @if (wizardStep === 1) {
                <button
                  (click)="wizardNext()"
                  [disabled]="!wizardFile"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg text-sm transition-colors"
                  >
                  Next
                </button>
              }
              @if (wizardStep === 2) {
                <button
                  (click)="wizardNext()"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-medium rounded-lg text-sm transition-colors"
                  >
                  Preview
                </button>
              }
              @if (wizardStep === 3) {
                <button
                  (click)="wizardImport()"
                  [disabled]="wizardPreviewCards.length === 0"
                  class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors"
                  >
                  Import {{ wizardPreviewCards.length }} Player{{ wizardPreviewCards.length !== 1 ? 's' : '' }}
                </button>
              }
              @if (wizardStep === 4) {
                <button
                  (click)="closeBatchWizard()"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-medium rounded-lg text-sm transition-colors"
                  >
                  Close
                </button>
              }
            </div>
          </div>

        </div>
      </div>
    }

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
                          @if (currentPlayer.nationality) {
                            <div
                              class="flag-logo"
                              [title]="currentPlayer.nationality">
                              {{ getFlagEmoji(currentPlayer.nationality) }}
                            </div>
                          }
                        </div>

                        <!-- Player photo -->
                        <div class="player-photo-container">
                          @if (currentPlayer.profilePhoto) {
                            <img
                              [src]="currentPlayer.profilePhoto"
                              [class]="'player-photo ' + (selectedTemplate?.maskShape === 'circle' ? 'circle-mask' : '')"
                              alt="Player Photo"
                              (error)="onImageError($event)"
                              >
                          }
                          @if (!currentPlayer.profilePhoto) {
                            <div
                              class="photo-placeholder"
                              >
                              &#128100;
                            </div>
                          }
                        </div>

                        <!-- Player info -->
                        <div class="player-info">
                          <div class="player-name">{{ currentPlayer.name || 'Player Name' }}</div>
                          <div class="nationality-info">{{ currentPlayer.nationality || 'NAT' }}</div>
                        </div>

                        <!-- Stats grid -->
                        <div class="stats-grid">
                          @for (stat of statKeys; track stat) {
                            <div class="stat-item">
                              <div class="stat-value">{{ currentPlayer.stats[stat] || 0 }}</div>
                              <div class="stat-label">{{ getStatLabel(stat) }}</div>
                            </div>
                          }
                        </div>

                        <!-- Brand logo -->
                        @if (currentPlayer.customLogo) {
                          <div class="brand-logo">
                            <img [src]="currentPlayer.customLogo" alt="Logo">
                          </div>
                        }
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
                    (click)="exportContactSheet()"
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
                  @for (template of availableTemplates; track template) {
                    <button
                      (click)="selectTemplate(template.id)"
                    [class]="'p-2 rounded-lg border-2 transition-all text-center ' +
                    (currentPlayer.backgroundTheme === template.name ?
                      'border-yellow-400 bg-yellow-400/10 shadow-glow-gold' :
                      'border-slate-600 hover:border-slate-500')"
                      >
                      <div class="text-xs font-medium truncate">{{ template.displayName }}</div>
                    </button>
                  }
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
                    @for (position of itPositions; track position) {
                      <option [value]="position">
                        {{ position }} - {{ getPositionName(position) }}
                      </option>
                    }
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
                      @if (!currentPlayer.profilePhoto) {
                        <div class="text-slate-400">
                          <div class="text-sm">Drag & drop or click to upload</div>
                        </div>
                      }
                      @if (currentPlayer.profilePhoto) {
                        <img
                          [src]="currentPlayer.profilePhoto"
                          class="max-h-28 max-w-full object-cover rounded"
                          alt="Preview"
                          >
                      }
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
                    @for (stat of statKeys; track stat) {
                      <div class="flex items-center gap-3">
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
                    }
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
              @if (activeTab === 'single') {
                <div class="space-y-4">
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
              }

              <!-- Batch Mode Tab -->
              @if (activeTab === 'batch') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h4 class="font-medium">Import Data</h4>
                    @if (batchCards.length > 0) {
                      <button
                        (click)="exportBatchPDF()"
                        [disabled]="isExporting"
                        class="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
                        >
                        PDF Sheet
                      </button>
                    }
                  </div>
                  <div class="space-y-3">
                    <button
                      (click)="openBatchWizard()"
                      class="w-full p-3 bg-yellow-400 hover:bg-yellow-300 text-black font-medium rounded-lg transition-colors text-sm text-center"
                      >
                      Batch Import (CSV / JSON)
                    </button>
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
                  @if (batchProgress.status !== 'idle') {
                    <div class="space-y-2">
                      <div class="text-xs text-slate-400">{{ batchProgress.message }}</div>
                      @if (batchProgress.total > 0) {
                        <div class="w-full bg-slate-700 rounded-full h-2">
                          <div
                            class="bg-yellow-400 h-2 rounded-full progress-bar-fill"
                            [style.width.%]="batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0"
                          ></div>
                        </div>
                      }
                    </div>
                  }
                  <!-- Batch Cards List -->
                  @if (batchCards.length > 0) {
                    <div class="space-y-2">
                      <h4 class="font-medium text-sm">Imported Cards ({{ batchCards.length }})</h4>
                      <div class="max-h-64 overflow-y-auto space-y-1">
                        @for (card of batchCards; track card) {
                          <div
                            (click)="loadBatchCard(card)"
                            class="p-2 bg-slate-700 hover:bg-slate-600 rounded cursor-pointer flex items-center justify-between transition-colors"
                            >
                            <div>
                              <span class="text-sm font-medium">{{ card.name }}</span>
                              <span class="text-xs text-slate-400 ml-2">{{ card.position }}</span>
                            </div>
                            <span class="text-xs text-yellow-400 font-bold">{{ card.rating }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                  <div class="text-xs text-slate-400">
                    Use the wizard to import CSV or JSON with custom field mapping.
                  </div>
                </div>
              }

              <!-- History Tab -->
              @if (activeTab === 'history') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h4 class="font-medium">Recent Cards</h4>
                    <div class="flex items-center gap-2">
                      @if (cardHistory.length > 1) {
                        <button
                          (click)="exportContactSheet()"
                          [disabled]="isExporting"
                          class="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
                          >
                          PDF Sheet
                        </button>
                      }
                      @if (cardHistory.length > 0) {
                        <button
                          (click)="clearHistory()"
                          class="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                          Clear All
                        </button>
                      }
                    </div>
                  </div>
                  @if (cardHistory.length === 0) {
                    <div class="text-sm text-slate-400">
                      No cards in history yet. Export a card to save it here.
                    </div>
                  }
                  @if (cardHistory.length > 0) {
                    <div class="max-h-96 overflow-y-auto space-y-2">
                      @for (stored of cardHistory; track stored) {
                        <div
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
                      }
                    </div>
                  }
                </div>
              }

            </div>
          </div>

        </div>
      </main>

      <footer class="mt-12 mb-6 px-6 py-5 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        <p class="mb-1">
          Made by
          <a href="https://atomstudios.fr" target="_blank" rel="noopener" class="font-semibold text-slate-700 dark:text-slate-300 hover:underline">Atom Studios</a>
          — small studio building privacy-first tools.
        </p>
        <p>
          If you need email aliases that don't read your inbox, try
          <a href="https://smtpy.fr" target="_blank" rel="noopener" class="font-semibold text-violet-600 dark:text-violet-400 hover:underline">SMTPy</a>.
        </p>
      </footer>

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

  // Batch Import Wizard state
  showBatchWizard = false;
  wizardStep = 1;
  wizardSteps = ['Upload', 'Map Fields', 'Preview', 'Done'];
  wizardFile: File | null = null;
  wizardFileName = '';
  wizardDragOver = false;
  csvParseResult: CSVParseResult | null = null;
  fieldMapping: FieldMapping = {};
  wizardPreviewCards: PlayerData[] = [];
  wizardImportResult: { success: PlayerData[]; errors: any[]; warnings: any[] } | null = null;

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

    this.storageService.history$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.cardHistory = history;
      });

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

    await new Promise(r => setTimeout(r, 50));

    try {
      const dataUrl = await this.exportService.exportCardAsPNG(cardElement, this.currentPlayer, size);
      this.downloadImage(dataUrl, `${this.currentPlayer.name}_FIFA_Card_${size}.png`);
      this.showToast('PNG exported successfully!', 'success');

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

  async exportContactSheet() {
    const cardElement = document.getElementById('fifa-card-preview');
    if (!cardElement) return;

    this.resetTiltBeforeExport();
    this.isExporting = true;
    this.exportingType = 'Generating PDF Contact Sheet';

    await new Promise(r => setTimeout(r, 50));

    try {
      const savedPlayer = { ...this.currentPlayer };
      const cardsToRender: PlayerData[] = [];

      if (this.cardHistory.length > 0) {
        for (const stored of this.cardHistory) {
          cardsToRender.push(stored.playerData);
        }
      } else {
        cardsToRender.push(savedPlayer);
      }

      const renderedCards: { playerData: PlayerData; imageDataUrl: string }[] = [];

      for (const playerData of cardsToRender) {
        this.cardService.updatePlayer(playerData);
        await new Promise(r => setTimeout(r, 120));

        try {
          const pngDataUrl = await this.exportService.exportCardAsPNG(cardElement, playerData, 'transparent');
          renderedCards.push({ playerData, imageDataUrl: pngDataUrl });
        } catch (err) {
          console.warn(`Failed to render card for ${playerData.name}:`, err);
        }
      }

      this.cardService.updatePlayer(savedPlayer);
      await new Promise(r => setTimeout(r, 50));

      if (renderedCards.length === 0) {
        this.showToast('No cards to export.', 'warning');
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const pdfBytes = await this.exportService.generatePDFContactSheet(renderedCards);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      this.exportService.downloadFile(blob, `team-cards-${dateStr}.pdf`);
      this.showToast(`PDF contact sheet exported (${renderedCards.length} card${renderedCards.length !== 1 ? 's' : ''})!`, 'success');
    } catch (error) {
      console.error('Error generating PDF contact sheet:', error);
      this.showToast('Error generating PDF. Please try again.', 'error');
    } finally {
      this.isExporting = false;
      this.exportingType = '';
    }
  }

  async exportBatchPDF() {
    const cardElement = document.getElementById('fifa-card-preview');
    if (!cardElement || this.batchCards.length === 0) return;

    this.resetTiltBeforeExport();
    this.isExporting = true;
    this.exportingType = 'Generating Batch PDF';

    await new Promise(r => setTimeout(r, 50));

    try {
      const savedPlayer = { ...this.currentPlayer };
      const renderedCards: { playerData: PlayerData; imageDataUrl: string }[] = [];

      for (const playerData of this.batchCards) {
        this.cardService.updatePlayer(playerData);
        await new Promise(r => setTimeout(r, 120));

        try {
          const pngDataUrl = await this.exportService.exportCardAsPNG(cardElement, playerData, 'transparent');
          renderedCards.push({ playerData, imageDataUrl: pngDataUrl });
        } catch (err) {
          console.warn(`Failed to render card for ${playerData.name}:`, err);
        }
      }

      this.cardService.updatePlayer(savedPlayer);
      await new Promise(r => setTimeout(r, 50));

      if (renderedCards.length === 0) {
        this.showToast('No cards could be rendered.', 'warning');
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const pdfBytes = await this.exportService.generatePDFContactSheet(renderedCards);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      this.exportService.downloadFile(blob, `team-cards-${dateStr}.pdf`);
      this.showToast(`PDF contact sheet exported (${renderedCards.length} cards)!`, 'success');
    } catch (error) {
      console.error('Error generating batch PDF:', error);
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

  // ===== Batch Import Wizard =====
  openBatchWizard() {
    this.showBatchWizard = true;
    this.wizardStep = 1;
    this.wizardFile = null;
    this.wizardFileName = '';
    this.wizardDragOver = false;
    this.csvParseResult = null;
    this.fieldMapping = {};
    this.wizardPreviewCards = [];
    this.wizardImportResult = null;
  }

  closeBatchWizard() {
    this.showBatchWizard = false;
  }

  onWizardDragOver(event: DragEvent) {
    event.preventDefault();
    this.wizardDragOver = true;
  }

  onWizardDragLeave(event: DragEvent) {
    event.preventDefault();
    this.wizardDragOver = false;
  }

  onWizardFileDrop(event: DragEvent) {
    event.preventDefault();
    this.wizardDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setWizardFile(file);
    }
  }

  onWizardFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setWizardFile(file);
    }
    input.value = '';
  }

  private setWizardFile(file: File) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
      this.showToast('Please select a CSV or JSON file.', 'error');
      return;
    }
    this.wizardFile = file;
    this.wizardFileName = file.name;
  }

  async wizardNext() {
    if (this.wizardStep === 1) {
      if (!this.wizardFile) return;

      if (this.wizardFile.name.endsWith('.json')) {
        try {
          const result = await this.batchService.importFromJSON(this.wizardFile);
          this.wizardImportResult = result;
          this.wizardPreviewCards = result.success;
          this.wizardStep = 3;
        } catch (error) {
          this.showToast('Failed to parse JSON file.', 'error');
        }
      } else {
        try {
          this.csvParseResult = await this.batchService.parseCSVForMapping(this.wizardFile);
          this.fieldMapping = this.batchService.autoDetectMapping(this.csvParseResult.headers);
          this.wizardStep = 2;
        } catch (error) {
          this.showToast('Failed to parse CSV file.', 'error');
        }
      }
    } else if (this.wizardStep === 2) {
      if (!this.csvParseResult) return;
      const preview = this.buildPreviewFromMapping(this.csvParseResult.rows);
      this.wizardPreviewCards = preview;
      this.wizardStep = 3;
    }
  }

  wizardBack() {
    if (this.wizardStep === 3 && this.wizardFile?.name.endsWith('.json')) {
      this.wizardStep = 1;
    } else if (this.wizardStep > 1) {
      this.wizardStep--;
    }
  }

  async wizardImport() {
    if (!this.csvParseResult && this.wizardFile?.name.endsWith('.json')) {
      this.wizardStep = 4;
      this.showToast(`${this.wizardPreviewCards.length} cards imported!`, 'success');
      this.activeTab = 'batch';
      return;
    }

    if (this.csvParseResult) {
      try {
        const result = await this.batchService.importFromCSVWithMapping(
          this.csvParseResult.rows,
          this.csvParseResult.headers,
          this.fieldMapping
        );
        this.wizardImportResult = result;
        this.wizardStep = 4;
        this.showToast(`${result.success.length} cards imported!`, 'success');
        this.activeTab = 'batch';
      } catch (error) {
        this.showToast('Import failed. Please check your data.', 'error');
      }
    }
  }

  private buildPreviewFromMapping(rows: string[][]): PlayerData[] {
    if (!this.csvParseResult) return [];

    const headers = this.csvParseResult.headers;
    const preview: PlayerData[] = [];

    for (let i = 0; i < rows.length; i++) {
      const values = rows[i];
      const getValue = (field: CardFieldKey): string => {
        const col = headers.find(h => this.fieldMapping[h] === field);
        if (!col) return '';
        const idx = headers.indexOf(col);
        return idx >= 0 ? values[idx]?.trim() || '' : '';
      };

      const getNumericValue = (field: CardFieldKey, def: number): number => {
        const v = getValue(field);
        const p = parseInt(v, 10);
        return !isNaN(p) ? Math.max(1, Math.min(99, p)) : def;
      };

      const stats: PlayerStats = {
        technical: getNumericValue('technical', 75),
        leadership: getNumericValue('leadership', 75),
        creativity: getNumericValue('creativity', 75),
        reliability: getNumericValue('reliability', 75),
        collaboration: getNumericValue('collaboration', 75),
        adaptability: getNumericValue('adaptability', 75)
      };

      const ratingRaw = getValue('rating');
      const name = getValue('name');
      if (!name) continue;

      const validPositions: ITPosition[] = ['DEV', 'OPS', 'DATA', 'PM', 'QA', 'UX', 'SEC', 'ARCH'];
      const pos = getValue('position').toUpperCase() as ITPosition;

      preview.push({
        id: `preview_${i}`,
        name: name.substring(0, 30),
        position: validPositions.includes(pos) ? pos : 'DEV',
        nationality: getValue('nationality').toUpperCase().substring(0, 3) || 'INT',
        rating: ratingRaw ? Math.max(1, Math.min(99, parseInt(ratingRaw, 10))) || this.cardService.calculateOverallRating(stats) : this.cardService.calculateOverallRating(stats),
        manualRating: ratingRaw !== '',
        stats,
        backgroundTheme: 'gold-classic',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return preview;
  }

  formatPreviewRow(row: string[]): string {
    return row.map(v => v || '(empty)').join(' | ');
  }

  getPreviewCellValue(header: string): string {
    if (!this.csvParseResult) return '';
    const idx = this.csvParseResult.headers.indexOf(header);
    return idx >= 0 ? (this.csvParseResult.preview[0]?.[idx] || '') : '';
  }

  // ===== Legacy batch operations =====
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

    input.value = '';
  }

  async onPhotoZipImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const photos = await this.batchService.importPhotoLibrary(file);
      this.showToast(`Loaded ${photos.size} photos`, 'success');

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
    const offset = 127397;
    const chars = [...code].map(c => String.fromCodePoint(c.charCodeAt(0) + offset));
    return chars.join('');
  }
}
