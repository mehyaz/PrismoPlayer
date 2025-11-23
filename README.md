# Prismo 🎬

<div align="center">
  <img src="public/prismo-logo.png" alt="Prismo Logo" width="120" height="120">
  
  ### Premium Video Player with Intelligent Content Filtering
  
  A modern, feature-rich video player built with Electron, React, and TypeScript that puts you in control of your viewing experience.

  ![Version](https://img.shields.io/badge/version-1.0.0-blue)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Electron](https://img.shields.io/badge/Electron-Latest-47848F)
  ![React](https://img.shields.io/badge/React-18.x-61DAFB)
</div>

---

## ✨ Features

### 🎮 **Modern Video Player**
- **Sleek Controls** - Beautiful, intuitive playback controls with smooth animations
- **Auto-Hide Interface** - Controls fade away for distraction-free viewing
- **Fullscreen Support** - Immersive viewing experience
- **Keyboard Shortcuts** - Control playback with ease

### 🎵 **Advanced Audio**
- **Volume Control** - Precise volume slider with visual feedback
- **Default 80%** - Smart default volume for comfortable listening
- **Mute/Unmute** - Quick audio toggle

### 📁 **Flexible Input**
- **Drag & Drop** - Simply drop video files to play
- **File Browser** - Traditional file selection dialog
- **Multiple Formats** - Supports MP4, MKV, AVI, MOV, WEBM, and more
- **Torrent Streaming** - Stream directly from magnet links

### 🎯 **Content Filtering** (Coming Soon)
- **IMDb Integration** - Automatic content rating lookup
- **Smart Skip** - Auto-skip explicit content based on IMDb Parents Guide
- **Customizable Filters** - Choose what content to skip

### 🎨 **Beautiful Design**
- **Dark Theme** - Easy on the eyes
- **Gradient Accents** - Modern color palette
- **Responsive Layout** - Adapts to any screen size
- **Premium Feel** - Polished, professional interface

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/prismo.git

# Navigate to project directory
cd prismo

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Build for Production

```bash
# Build for your platform
npm run build
```

The built application will be in the `dist` folder.

---

## 🎯 Usage

### Playing Videos

1. **Drag & Drop**: Drop any video file onto the window
2. **Browse**: Click "Browse Files" to select a video
3. **Torrent**: Paste a magnet link to stream

### Playback Controls

- **Play/Pause**: Click video or spacebar
- **Volume**: Use the volume slider or mute button
- **Seek**: Click anywhere on the progress bar
- **Fullscreen**: Click the fullscreen button
- **Back**: Return to home screen

---

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- **Frontend**: [React 18](https://react.dev/) - Modern UI library  
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- **Build Tool**: [Vite](https://vitejs.dev/) - Lightning-fast HMR
- **Icons**: [Lucide React](https://lucide.dev/) - Beautiful icons
- **Streaming**: [WebTorrent](https://webtorrent.io/) - Torrent support

---

## 📁 Project Structure

```
prismo/
├── electron/          # Electron main process
│   ├── main.ts       # Application entry point
│   ├── preload.ts    # Preload scripts
│   ├── scraper.ts    # IMDb scraping (future)
│   └── torrent-handler.ts # Torrent streaming
├── src/
│   ├── components/   # React components
│   │   └── Player/   # Video player component
│   ├── hooks/        # Custom React hooks
│   ├── types/        # TypeScript types
│   ├── App.tsx       # Main app component
│   └── main.tsx      # React entry point
├── public/           # Static assets
└── package.json      # Dependencies
```

---

## 🗺️ Roadmap

- [x] Core video playback
- [x] Modern UI/UX
- [x] Volume controls
- [x] Torrent streaming
- [x] Drag & drop support
- [ ] IMDb content filtering
- [ ] Auto-skip explicit content
- [ ] Keyboard shortcuts
- [ ] Subtitle support
- [ ] Playback speed control
- [ ] Playlist support
- [ ] Recently watched

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Icon design inspired by modern media players
- Built with love using open-source technologies
- Special thanks to the Electron and React communities

---

<div align="center">
  Made with ❤️ by Your Name
  
  ⭐ Star this repo if you find it useful!
</div>
