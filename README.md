# FIFA IT Card Generator

A pure frontend web application that generates FIFA-style player cards for IT team members. Built with Angular 17 and Tailwind CSS, it works entirely offline as a PWA with no backend dependencies.

![FIFA IT Card Generator](https://via.placeholder.com/800x400?text=FIFA+IT+Card+Generator+Preview)

## 🚀 Features

### ✨ Card Builder
- **IT-Specific Positions**: DEV, OPS, DATA, PM, QA, UX, SEC, ARCH
- **Drag & Drop Photo Upload**: Automatic EXIF stripping and resizing
- **Smart Stats System**: 6 IT-focused skills (Technical, Leadership, Creativity, Reliability, Collaboration, Adaptability)
- **Auto Rating Calculation**: Rounded mean of stats or manual override
- **Template Selection**: Gold Classic and Dark Mode IT themes
- **Input Validation**: Sanitization with blocked words and graceful text truncation

### 🎨 Card Templates
1. **Gold Classic**: Traditional FIFA gold card with metallic grain and noise texture
2. **Dark Mode IT**: Modern dark theme with blue accents and tech-inspired patterns

### 📊 Export Options
- **PNG Formats**:
  - Transparent 1024×1536 (print quality)
  - Web 512×768 (web optimized) 
  - Social 1080×1080 (square crop)
- **PDF Contact Sheets**: A4 layout (3×4 cards) with crop marks and bleed
- **ZIP Batches**: Individual PNGs + PDF sheet + project JSON

### 🔄 Batch Processing
- **CSV/JSON Import**: Validate and import multiple cards
- **Photo ZIP Matching**: Automatic photo-to-player matching by filename
- **Error Handling**: Detailed validation with warnings and error reporting
- **Progress Tracking**: Real-time import progress with thumbnails

### 💾 Persistence & History
- **Local Storage**: Last 20 cards with thumbnail previews
- **IndexedDB Support**: For larger datasets
- **Project Files**: Export/import `.fifacard.json` for sharing
- **Auto-Save**: Preserve work automatically

### 🌍 Internationalization
- **Multi-language**: English and French support
- **Extensible**: Easy string dictionary for adding locales
- **Accessibility**: Full keyboard navigation and screen reader support

## 🛠️ Quick Start

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm 6+

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/fifa-card-generator.git
cd fifa-card-generator

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

### Development Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview build
npm run test         # Run unit tests
npm run lint         # Lint code
npm run format       # Format code
```

## 🏗️ Architecture

### Rendering Pipeline
1. **SVG Layout**: Crisp vector-based card design
2. **HTML Canvas**: High-DPI rasterization for export
3. **Template System**: Modular themes with CSS variables
4. **Export Engine**: Multiple formats with optimized quality

### Project Structure
```
src/
├── app/
│   ├── components/          # Reusable UI components
│   ├── services/           # Business logic services
│   │   ├── card.service.ts    # Player data management
│   │   ├── export.service.ts  # PNG/PDF/ZIP generation
│   │   ├── batch.service.ts   # CSV/JSON processing
│   │   └── storage.service.ts # Persistence layer
│   ├── models/             # TypeScript interfaces
│   └── utils/              # Helper functions
├── assets/                 # Static resources
└── styles/                 # Global styles and themes
```

### Key Technologies
- **Angular 17**: Standalone components with reactive forms
- **Tailwind CSS**: Utility-first styling with custom FIFA themes
- **html-to-image**: High-quality PNG export with device pixel ratio support
- **pdf-lib**: Client-side PDF generation with crop marks
- **JSZip**: Archive creation for batch exports
- **RxJS**: Reactive state management

## 📋 Usage Examples

### Single Card Creation
1. Choose template (Gold Classic or Dark Mode IT)
2. Enter player details (name, position, nationality)
3. Upload profile photo (drag & drop supported)
4. Adjust IT skills or click "Randomize"
5. Export as PNG, copy to clipboard, or create PDF sheet

### Batch Import (CSV)
```csv
name,position,nationality,rating,theme,technical,leadership,creativity,reliability,collaboration,adaptability
Larry Mota,DEV,FR,85,gold-classic,88,82,90,85,83,87
Sarah Chen,DATA,US,,dark-mode-it,92,78,88,90,85,82
Mike Johnson,OPS,GB,,gold-classic,85,88,75,92,80,85
```

### Project File Format
```json
{
  "version": "1.0",
  "name": "IT Team Cards",
  "cards": [
    {
      "id": "1",
      "name": "Larry Mota",
      "position": "DEV",
      "nationality": "FR",
      "rating": 85,
      "stats": {
        "technical": 88,
        "leadership": 82,
        "creativity": 90,
        "reliability": 85,
        "collaboration": 83,
        "adaptability": 87
      },
      "backgroundTheme": "gold-classic"
    }
  ],
  "settings": {
    "defaultTemplate": "gold-classic"
  }
}
```

## 🎯 Sample Cards

### Larry Mota - Senior Developer
![Larry Mota Card](https://via.placeholder.com/320x480?text=Larry+Mota+Gold+Card)

**Stats:**
- Technical: 88 ⭐⭐⭐⭐⭐
- Leadership: 82 ⭐⭐⭐⭐
- Creativity: 90 ⭐⭐⭐⭐⭐
- Reliability: 85 ⭐⭐⭐⭐
- Collaboration: 83 ⭐⭐⭐⭐
- Adaptability: 87 ⭐⭐⭐⭐⭐

**Overall Rating:** 85 🏆

## 🎨 Customization

### Adding New Templates
1. Define template in `card.service.ts`:
```typescript
{
  id: 'silver-modern',
  name: 'silver-modern',
  displayName: 'Silver Modern',
  description: 'Sleek silver design with modern aesthetics',
  backgroundGradient: 'linear-gradient(135deg, #c0c0c0 0%, #e5e5e5 100%)',
  maskShape: 'hexagon',
  fontFamily: 'Inter',
  colorScheme: {
    primary: '#c0c0c0',
    secondary: '#a0a0a0',
    text: '#000000',
    accent: '#ffffff'
  }
}
```

2. Add corresponding CSS in `styles.scss`:
```scss
.fifa-card.silver-modern {
  background: linear-gradient(135deg, #c0c0c0 0%, #e5e5e5 100%);
  filter: drop-shadow(0 0 20px rgba(192, 192, 192, 0.3));
}
```

### Changing Fonts
Update the Google Fonts import in `styles.scss`:
```scss
@import url('https://fonts.googleapis.com/css2?family=Your+Font:wght@300;400;700&display=swap');
```

### Metallic Effects
Adjust the noise overlay and grain textures:
```scss
.fifa-card.gold-classic::before {
  background: url('data:image/svg+xml,<svg>...</svg>');
  opacity: 0.15; // Adjust opacity for more/less texture
}
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testNamePattern="CardService"

# Run with coverage
npm test -- --coverage
```

### Key Test Areas
- Stats randomization with seeded RNG
- Overall rating calculation
- Input sanitization and validation
- Template switching logic
- Export functionality

### Example Test
```typescript
describe('CardService', () => {
  it('should calculate correct overall rating', () => {
    const stats = {
      technical: 80,
      leadership: 75,
      creativity: 85,
      reliability: 70,
      collaboration: 90,
      adaptability: 80
    };
    
    const rating = service.calculateOverallRating(stats);
    expect(rating).toBe(80); // Rounded mean
  });
});
```

## 📱 PWA Features

### Offline Support
- Service worker caches app shell and assets
- Works without internet connection
- Background sync for data persistence

### Installation
- Add to home screen on mobile devices
- Desktop app experience
- Automatic updates

### Manifest Configuration
```json
{
  "name": "FIFA IT Card Generator",
  "short_name": "FIFA Cards",
  "theme_color": "#ffd700",
  "background_color": "#0f172a",
  "display": "standalone",
  "scope": "/",
  "start_url": "/"
}
```

## 🚀 Performance

### Optimization Features
- **High-DPI Rendering**: 2×/3× device pixel ratio support
- **Image Compression**: Automatic EXIF stripping and resizing
- **Lazy Loading**: Components and assets loaded on demand
- **Tree Shaking**: Unused code elimination
- **Bundle Splitting**: Optimized chunk sizes

### Memory Management
- Automatic cleanup of large image data
- localStorage quota management
- IndexedDB fallback for large datasets

## 🔒 Security & Privacy

### Client-Only Processing
- No data sent to external servers
- All processing happens in browser
- Images never leave your device

### Input Sanitization
- XSS protection on text inputs
- File type validation for uploads
- Size limits on images and data

### Data Privacy
- No tracking or analytics
- No cookies or external requests
- Complete offline functionality

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
- Use Prettier for formatting
- Follow Angular style guide
- Write unit tests for new features
- Update documentation

### Adding Languages
1. Add translations to `src/assets/i18n/`:
```json
// en.json
{
  "card.name": "Player Name",
  "card.position": "Position",
  "stats.technical": "Technical"
}

// fr.json
{
  "card.name": "Nom du Joueur",
  "card.position": "Position",
  "stats.technical": "Technique"
}
```

2. Update language service and components

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

### Common Issues
- **Build errors**: Use `--legacy-peer-deps` flag
- **Node version**: Requires Node.js 20.19+ or 22.12+
- **Memory issues**: Clear browser cache and localStorage

### Getting Help
- 📧 Email: support@fifa-card-generator.com
- 💬 Discord: [Join our community](https://discord.gg/fifa-cards)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/fifa-card-generator/issues)

## 🎉 Acknowledgments

- FIFA for the card design inspiration
- Angular team for the amazing framework
- Tailwind CSS for utility-first styling
- Open source community for the libraries used

---

Made with ❤️ by developers, for developers. Create amazing IT team cards that showcase your technical skills in FIFA style! 🚀