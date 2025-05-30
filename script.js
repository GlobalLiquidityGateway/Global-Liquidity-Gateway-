class AudioVisualizer {
    constructor() {
        this.audio = document.getElementById('audio');
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.playButton = document.getElementById('playButton');
        this.audioStatus = document.getElementById('audioStatus');
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.bufferLength = 0;
        this.isPlaying = false;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.drawStaticVisualizer();
        
        // Handle window resize
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    setupEventListeners() {
        this.playButton.addEventListener('click', () => this.toggleAudio());
        
        // Progress bar click to seek
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.audio.currentTime = percent * this.audio.duration;
            });
        }
        
        this.audio.addEventListener('loadstart', () => {
            this.updateStatus('Loading...', true);
        });
        
        this.audio.addEventListener('canplay', () => {
            this.updateStatus('Ready to play', false);
        });
        
        this.audio.addEventListener('play', () => {
            this.updateStatus('Playing', false);
            this.updatePlayButton(true);
        });
        
        this.audio.addEventListener('pause', () => {
            this.updateStatus('Paused', false);
            this.updatePlayButton(false);
        });
        
        this.audio.addEventListener('ended', () => {
            this.updateStatus('Finished', false);
            this.updatePlayButton(false);
            this.isPlaying = false;
            this.stopVisualization();
        });
        
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
            this.updateTimeDisplay();
        });
        
        this.audio.addEventListener('error', (e) => {
            this.handleAudioError(e);
        });
        
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateStatus('Ready to play', false);
            this.updateTimeDisplay();
        });
    }
    
    async toggleAudio() {
        try {
            if (!this.audioContext) {
                await this.initializeAudioContext();
            }
            
            if (this.audio.paused) {
                await this.audio.play();
                this.startVisualization();
                this.isPlaying = true;
            } else {
                this.audio.pause();
                this.stopVisualization();
                this.isPlaying = false;
            }
        } catch (error) {
            this.handleAudioError(error);
        }
    }
    
    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            throw new Error('Failed to initialize audio context: ' + error.message);
        }
    }
    
    startVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.animate();
    }
    
    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.drawStaticVisualizer();
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (!this.analyser || !this.dataArray) {
            return;
        }
        
        this.analyser.getByteFrequencyData(this.dataArray);
        this.draw();
    }
    
    draw() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;
        
        // Clear canvas with gradient background
        this.ctx.fillStyle = 'rgba(15, 23, 42, 1)';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        
        // Add subtle grid pattern
        this.drawGrid(rect.width, rect.height);
        
        // Draw frequency bars in circular pattern
        const barCount = this.bufferLength;
        const angleStep = (Math.PI * 2) / barCount;
        
        for (let i = 0; i < barCount; i++) {
            const angle = i * angleStep;
            const barHeight = (this.dataArray[i] / 255) * radius * 0.8;
            const barWidth = 2;
            
            // Calculate positions
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            
            // Create gradient for each bar
            const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            const hue = (i / barCount) * 360;
            gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, 0.8)`);
            gradient.addColorStop(1, `hsla(${hue}, 70%, 70%, 1)`);
            
            // Draw bar
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = barWidth;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }
        
        // Draw center circle
        this.drawCenterCircle(centerX, centerY, radius * 0.3);
        
        // Draw outer ring
        this.drawOuterRing(centerX, centerY, radius);
    }
    
    drawStaticVisualizer() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;
        
        // Clear canvas
        this.ctx.fillStyle = 'rgba(15, 23, 42, 1)';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        
        // Add grid pattern
        this.drawGrid(rect.width, rect.height);
        
        // Draw static circular pattern
        const barCount = 64;
        const angleStep = (Math.PI * 2) / barCount;
        
        for (let i = 0; i < barCount; i++) {
            const angle = i * angleStep;
            const staticHeight = radius * 0.1;
            
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + staticHeight);
            const y2 = centerY + Math.sin(angle) * (radius + staticHeight);
            
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = `hsla(220, 70%, 50%, 0.3)`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
        
        // Draw center elements
        this.drawCenterCircle(centerX, centerY, radius * 0.3);
        this.drawOuterRing(centerX, centerY, radius);
    }
    
    drawGrid(width, height) {
        this.ctx.strokeStyle = 'rgba(30, 136, 229, 0.1)';
        this.ctx.lineWidth = 0.5;
        
        const gridSize = 20;
        
        for (let x = 0; x <= width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }
    
    drawCenterCircle(centerX, centerY, radius) {
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(30, 136, 229, 0.3)');
        gradient.addColorStop(1, 'rgba(30, 136, 229, 0.1)');
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        this.ctx.strokeStyle = 'rgba(30, 136, 229, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    drawOuterRing(centerX, centerY, radius) {
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(30, 136, 229, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    updatePlayButton(isPlaying) {
        const icon = this.playButton.querySelector('i');
        if (isPlaying) {
            icon.className = 'fas fa-pause';
            this.playButton.setAttribute('aria-label', 'Pause audio');
        } else {
            icon.className = 'fas fa-play';
            this.playButton.setAttribute('aria-label', 'Play audio');
        }
    }
    
    updateStatus(status, isLoading = false) {
        this.audioStatus.textContent = status;
        
        if (isLoading) {
            this.audioStatus.classList.add('pulsing');
        } else {
            this.audioStatus.classList.remove('pulsing');
        }
    }
    
    updateProgress() {
        if (this.audio.duration) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressFill.style.width = progress + '%';
        }
    }
    
    updateTimeDisplay() {
        if (this.currentTimeEl && this.totalTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
            if (this.audio.duration) {
                this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
            }
        }
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    handleAudioError(error) {
        console.error('Audio error:', error);
        
        let errorMessage = 'Audio playback failed';
        
        if (error.target && error.target.error) {
            switch (error.target.error.code) {
                case error.target.error.MEDIA_ERR_ABORTED:
                    errorMessage = 'Audio loading was aborted';
                    break;
                case error.target.error.MEDIA_ERR_NETWORK:
                    errorMessage = 'Network error occurred';
                    break;
                case error.target.error.MEDIA_ERR_DECODE:
                    errorMessage = 'Audio decoding failed';
                    break;
                case error.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Audio format not supported';
                    break;
            }
        }
        
        this.updateStatus(errorMessage, false);
        this.updatePlayButton(false);
        this.isPlaying = false;
        
        // Add error styling
        this.canvas.classList.add('error');
        setTimeout(() => {
            this.canvas.classList.remove('error');
        }, 3000);
    }
}

// Smooth scroll functionality for better UX
class SmoothScroll {
    constructor() {
        this.init();
    }
    
    init() {
        // Add scroll-to-section functionality if needed
        const links = document.querySelectorAll('a[href^="#"]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                const target = document.querySelector(targetId);
                
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
}

// Intersection Observer for animations
class AnimationObserver {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            }
        );
        
        this.init();
    }
    
    init() {
        const elements = document.querySelectorAll('.info-section, .pass-option');
        elements.forEach(el => {
            this.observer.observe(el);
        });
    }
    
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('slide-in');
                this.observer.unobserve(entry.target);
            }
        });
    }
}



// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize audio visualizer
    new AudioVisualizer();
    
    // Initialize smooth scrolling
    new SmoothScroll();
    
    // Initialize animations
    new AnimationObserver();
    

    
    // Add loading state management
    window.addEventListener('load', () => {
        document.body.classList.remove('loading');
    });
});

// Handle page visibility changes to pause audio when tab is not visible
document.addEventListener('visibilitychange', () => {
    const audio = document.getElementById('audio');
    if (document.hidden && !audio.paused) {
        audio.pause();
    }
});
