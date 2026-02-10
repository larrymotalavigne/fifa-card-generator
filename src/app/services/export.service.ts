import { Injectable } from '@angular/core';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as JSZip from 'jszip';
import * as htmlToImage from 'html-to-image';
import { PlayerData, ExportOptions } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() {}

  // PNG Export with multiple sizes
  async exportCardAsPNG(
    cardElement: HTMLElement, 
    playerData: PlayerData, 
    size: 'transparent' | 'web' | 'social' = 'transparent'
  ): Promise<string> {
    const dimensions = this.getExportDimensions(size);
    
    return await htmlToImage.toPng(cardElement, {
      quality: 1,
      backgroundColor: size === 'transparent' ? undefined : '#ffffff',
      width: dimensions.width,
      height: dimensions.height,
      pixelRatio: window.devicePixelRatio || 2, // High DPI support
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left'
      }
    });
  }

  // Generate A4 PDF contact sheet with multiple cards
  async generatePDFContactSheet(
    cards: { playerData: PlayerData; imageDataUrl: string }[],
    options: { 
      cardsPerRow?: number; 
      cardsPerColumn?: number; 
      includeWatermark?: boolean;
      customBranding?: string;
    } = {}
  ): Promise<Uint8Array> {
    const { cardsPerRow = 3, cardsPerColumn = 4, includeWatermark = false } = options;
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // A4 dimensions in points (595 × 842)
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
    const bleedMargin = 10;
    
    // Calculate card dimensions with bleed
    const availableWidth = pageWidth - (2 * margin);
    const availableHeight = pageHeight - (2 * margin);
    const cardWidth = (availableWidth - ((cardsPerRow - 1) * bleedMargin)) / cardsPerRow;
    const cardHeight = (availableHeight - ((cardsPerColumn - 1) * bleedMargin)) / cardsPerColumn;
    
    const cardsPerPage = cardsPerRow * cardsPerColumn;
    const totalPages = Math.ceil(cards.length / cardsPerPage);
    
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Add crop marks
      this.addCropMarks(page, pageWidth, pageHeight, margin);
      
      // Add page header
      page.drawText(`FIFA IT Cards - Sheet ${pageIndex + 1}/${totalPages}`, {
        x: margin,
        y: pageHeight - 20,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
      
      // Add cards to page
      const startIndex = pageIndex * cardsPerPage;
      const endIndex = Math.min(startIndex + cardsPerPage, cards.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const cardIndex = i - startIndex;
        const row = Math.floor(cardIndex / cardsPerRow);
        const col = cardIndex % cardsPerRow;
        
        const x = margin + (col * (cardWidth + bleedMargin));
        const y = pageHeight - margin - (row + 1) * (cardHeight + bleedMargin);
        
        try {
          // Embed card image
          const cardImage = await pdfDoc.embedPng(cards[i].imageDataUrl);
          const imageDims = cardImage.scale(Math.min(cardWidth / cardImage.width, cardHeight / cardImage.height));
          
          // Center the image in the card area
          const imageX = x + (cardWidth - imageDims.width) / 2;
          const imageY = y + (cardHeight - imageDims.height) / 2;
          
          page.drawImage(cardImage, {
            x: imageX,
            y: imageY,
            width: imageDims.width,
            height: imageDims.height
          });
          
          // Add player name below card (optional)
          const playerName = cards[i].playerData.name;
          page.drawText(playerName, {
            x: x + cardWidth / 2 - (playerName.length * 3),
            y: y - 15,
            size: 8,
            font: helveticaFont,
            color: rgb(0.3, 0.3, 0.3)
          });
          
        } catch (error) {
          console.error(`Error embedding card ${i}:`, error);
          
          // Draw placeholder rectangle if image fails
          page.drawRectangle({
            x,
            y,
            width: cardWidth,
            height: cardHeight,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1
          });
          
          page.drawText('Image Error', {
            x: x + cardWidth / 2 - 30,
            y: y + cardHeight / 2,
            size: 10,
            font: helveticaFont,
            color: rgb(0.5, 0.5, 0.5)
          });
        }
      }
      
      // Add watermark if enabled
      if (includeWatermark) {
        this.addWatermark(page, pageWidth, pageHeight, helveticaFont, options.customBranding);
      }
    }
    
    return await pdfDoc.save();
  }

  // Create ZIP file with multiple PNGs and PDF
  async createBatchExportZip(
    cards: { playerData: PlayerData; pngData: string }[],
    pdfData?: Uint8Array,
    options: { includeJSON?: boolean } = {}
  ): Promise<Blob> {
    const zip = new JSZip();
    
    // Add individual PNG files
    const pngFolder = zip.folder('cards');
    cards.forEach((card, index) => {
      const filename = `${this.sanitizeFilename(card.playerData.name)}_FIFA_Card.png`;
      const base64Data = card.pngData.split(',')[1]; // Remove data URL prefix
      pngFolder?.file(filename, base64Data, { base64: true });
    });
    
    // Add PDF contact sheet
    if (pdfData) {
      zip.file('FIFA_Cards_Contact_Sheet.pdf', pdfData);
    }
    
    // Add project JSON file
    if (options.includeJSON) {
      const projectData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        cards: cards.map(c => c.playerData),
        settings: {
          template: cards[0]?.playerData.backgroundTheme || 'gold-classic',
          exportOptions: options
        }
      };
      
      zip.file('fifa_cards_project.json', JSON.stringify(projectData, null, 2));
    }
    
    // Generate ZIP
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  // Copy card image to clipboard
  async copyToClipboard(cardElement: HTMLElement): Promise<boolean> {
    try {
      const blob = await htmlToImage.toBlob(cardElement, {
        quality: 1,
        backgroundColor: undefined,
        pixelRatio: 2
      });
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      return false;
    }
  }

  // Import project file
  async importProjectFile(file: File): Promise<{ cards: PlayerData[]; settings: any } | null> {
    try {
      const text = await file.text();
      const projectData = JSON.parse(text);
      
      if (projectData.version && projectData.cards) {
        return {
          cards: projectData.cards,
          settings: projectData.settings || {}
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error importing project file:', error);
      return null;
    }
  }

  // Helper methods
  private getExportDimensions(size: string): { width: number; height: number } {
    switch (size) {
      case 'transparent': return { width: 1024, height: 1536 }; // Print quality
      case 'web': return { width: 512, height: 768 }; // Web optimized
      case 'social': return { width: 1080, height: 1080 }; // Square social media
      default: return { width: 1024, height: 1536 };
    }
  }

  private addCropMarks(page: any, pageWidth: number, pageHeight: number, margin: number) {
    const markLength = 10;
    const markColor = rgb(0, 0, 0);
    
    // Corner crop marks
    const corners = [
      { x: margin, y: pageHeight - margin }, // Top-left
      { x: pageWidth - margin, y: pageHeight - margin }, // Top-right
      { x: margin, y: margin }, // Bottom-left
      { x: pageWidth - margin, y: margin } // Bottom-right
    ];
    
    corners.forEach(corner => {
      // Horizontal marks
      page.drawLine({
        start: { x: corner.x - markLength, y: corner.y },
        end: { x: corner.x + markLength, y: corner.y },
        thickness: 0.5,
        color: markColor
      });
      
      // Vertical marks
      page.drawLine({
        start: { x: corner.x, y: corner.y - markLength },
        end: { x: corner.x, y: corner.y + markLength },
        thickness: 0.5,
        color: markColor
      });
    });
  }

  private addWatermark(page: any, pageWidth: number, pageHeight: number, font: any, customBranding?: string) {
    const watermarkText = customBranding || 'FIFA IT Card Generator';
    
    page.drawText(watermarkText, {
      x: pageWidth / 2 - (watermarkText.length * 2),
      y: 15,
      size: 8,
      font: font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.5
    });
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  // Download helper
  downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}