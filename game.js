class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Make canvas fill the white space
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Add window resize handler
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            // Recalculate background layer dimensions
            if (this.background) {
                this.background.calculateDimensions();
            }
        });
        
        // Game state
        this.score = 0;
        this.gameOver = false;
        this.wave = 1;
        this.isPaused = false;
        
        // Game objects
        this.santa = null;
        this.jets = [];
        this.candyCanes = [];
        this.bullets = [];
        this.explosions = [];
        this.background = null;
        
        // Add health
        this.health = 100;  // Make sure health is initialized here
        this.ammo = 100;    // Add initial ammo
        this.maxAmmo = 100; // Add max ammo
        
        // Load custom font
        const customFont = new FontFace('GameFont', 'url(./assets/fonts/GameFont.ttf)');
        customFont.load().then(font => {
            document.fonts.add(font);
            // Continue with game initialization after font is loaded
            this.loadAssets().then(() => {
                this.init();
                this.setupControls();
                this.gameLoop();
            });
        });
        
        this.finalExplosionParticles = [];
        this.screenShake = 0;
        this.lastSpawnTime = Date.now();
        this.baseSpawnInterval = 1500;  // 1.5 seconds
        this.minSpawnInterval = 800;    // Minimum spawn time at high scores
        this.maxJets = 6;              // Maximum jets at once

        // Add background update to the game loop
        this.lastTime = performance.now();

        this.gameOverAlpha = 0;
        this.gameOverFading = false;

        this.setupControls();  // Make sure keys are bound

        this.supplies = [];
        this.lastSupplyTime = Date.now();
        this.supplyInterval = 10000;  // 10 seconds between drops

        this.gameSpeed = 1;  // Add base game speed
        this.baseSpawnInterval = 1500;  // Base spawn interval
        this.minSpawnInterval = 800;    // Minimum spawn interval

        this.spitfireActive = false;
        this.spitfireCooldown = 0;
        this.spitfireMaxCooldown = 1200; // 20 seconds at 60fps
        this.spitfireDuration = 360;     // 6 seconds at 60fps

        this.warheads = [];
        this.warheadTimer = 1800; // 30 seconds initial spawn
        this.lastWarheadTime = 0;
        this.assets = this.assets || {};

        this.timeAlive = 0; // Initialize time alive
        this.state = 'start'; // Add a new state for the start screen
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.code); // Debug logging

            // J key for instructions (should work in any state)
            if (e.code === 'KeyJ') {
                alert(
                    "CONTROLS:\n" +
                    "W, A, S, D - Move Santa\n" +
                    "SPACE - Shoot candy canes\n" +
                    "Hold SPACE - Activate Spitfire mode (when available)\n" +
                    "\n" +
                    "OBJECTIVES:\n" +
                    "- Dodge enemy jets and missiles\n" +
                    "- Collect supply drops for health and ammo\n" +
                    "- Survive as long as possible"
                );
                return;
            }

            // Only process other controls if instructions aren't showing
            if (!this.showInstructions) {
                // Start game (Space)
                if (e.code === 'Space' && this.state === 'start') {
                    this.state = 'playing';
                    return;
                }

                // Restart game (R)
                if (e.code === 'KeyR' && this.gameOver) {
                    this.restart();
                    return;
                }

                // Gameplay controls
                if (this.state === 'playing' && !this.gameOver && this.santa) {
                    switch(e.code) {
                        case 'Space':
                            e.preventDefault();
                            this.santa.spacePressed = true;
                            this.santa.shoot();
                            break;
                        case 'KeyW': this.santa.keysPressed.w = true; break;
                        case 'KeyS': this.santa.keysPressed.s = true; break;
                        case 'KeyA': this.santa.keysPressed.a = true; break;
                        case 'KeyD': this.santa.keysPressed.d = true; break;
                    }
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.state === 'playing' && this.santa) {
                switch(e.code) {
                    case 'Space': 
                        this.santa.spacePressed = false;
                        console.log('Space released');
                        break;
                    case 'KeyW': this.santa.keysPressed.w = false; break;
                    case 'KeyS': this.santa.keysPressed.s = false; break;
                    case 'KeyA': this.santa.keysPressed.a = false; break;
                    case 'KeyD': this.santa.keysPressed.d = false; break;
                }
            }
        });

        // Spitfire detection
        let spaceHoldTimer = 0;
        setInterval(() => {
            if (this.state === 'playing' && !this.gameOver && this.santa && this.santa.spacePressed) {
                spaceHoldTimer++;
                if (spaceHoldTimer === 30 && !this.spitfireActive && this.spitfireCooldown === 0) {
                    console.log('Activating spitfire');
                    this.activateSpitfire();
                }
            } else {
                spaceHoldTimer = 0;
            }
        }, 1000/60);
    }

    restart() {
        console.log('=== GAME RESTART ===');
        
        // Reset ALL game state variables
        this.state = 'playing';
        this.gameOver = false;
        this.gameOverAlpha = 0;
        this.timeAlive = 0;
        this.wave = 1;
        this.screenShake = 0;
        this.gameSpeed = 1;
        this.health = 100;
        this.ammo = 100;
        
        // Clear all game objects
        this.jets = [];
        this.bullets = [];
        this.explosions = [];
        this.supplies = [];
        this.candyCanes = [];
        this.warheads = [];
        
        // Reset timers
        this.lastSpawnTime = Date.now();
        this.lastSupplyTime = Date.now();
        this.warheadTimer = 1800;
        
        // Create new santa
        this.santa = new Santa(this);
        
        console.log('=== RESTART COMPLETE ===');
    }

    async loadAssets() {
        const assetPaths = {
            sleigh: './assets/sprites/sleigh.png',
            jet: './assets/sprites/jet.png',
            cane: './assets/sprites/cane.png',
            sky: './assets/sprites/sky.png',
            mountain: './assets/sprites/mountain.png',
            pine1: './assets/sprites/pine1.png',
            pine2: './assets/sprites/pine2.png',
            bullet: './assets/sprites/bullet.png',
            supply: './assets/sprites/supply.png',
            warhead: './assets/sprites/warhead.png',
            // Explosion frames
            exp1: './assets/sprites/explosion/exp1.png',
            exp2: './assets/sprites/explosion/exp2.png',
            exp3: './assets/sprites/explosion/exp3.png',
            exp4: './assets/sprites/explosion/exp4.png',
            exp5: './assets/sprites/explosion/exp5.png'
        };

        this.assets = {};
        for (const [key, path] of Object.entries(assetPaths)) {
            try {
                this.assets[key] = await this.loadImage(path);
                console.log(`Loaded asset: ${key}`);
            } catch (error) {
                console.error(`Error loading asset: ${key}`, error);
            }
        }
    }

    loadImage(path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
            img.src = path;
        });
    }

    init() {
        // Create santa
        this.santa = new Santa(this);
        
        // Initialize background
        this.background = new Background(this);
        
        // Spawn initial enemies
        this.spawnJet();
    }

    spawnJet() {
        const y = Math.random() * (this.canvas.height - 100) + 50;
        const jet = new Jet(this, this.canvas.width + 50, y);
        this.jets.push(jet);
        console.log(`Spawned new jet. Current game speed: ${this.gameSpeed}`);
    }

    update() {
        if (this.gameOver) return;

        // Increment time alive (60 frames per second)
        this.timeAlive += 1/60;

        this.background.update();
        this.santa.update();
        this.jets.forEach(jet => jet.update());
        this.candyCanes.forEach(cane => cane.update());
        this.bullets.forEach(bullet => bullet.update());
        this.explosions = this.explosions.filter(exp => exp.update());
        
        this.checkCollisions();
        
        // Add spawn rate handling
        const currentTime = Date.now();
        const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
        if (timeSinceLastSpawn >= this.baseSpawnInterval) {
            this.spawnJet();
            this.lastSpawnTime = currentTime;
        }

        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
        }

        // Update and spawn supplies
        if (currentTime - this.lastSupplyTime > this.supplyInterval && !this.gameOver) {
            console.log("Spawning supply with sparkle effect");
            this.supplies.push(new Supply(this));
            this.lastSupplyTime = currentTime;
        }

        // Update and cleanup supplies
        this.supplies = this.supplies.filter(supply => {
            supply.update();
            return !supply.collected && supply.y < this.canvas.height + 100;
        });

        // Update spitfire timers
        if (this.spitfireActive) {
            this.spitfireDuration--;
            if (this.spitfireDuration <= 0) {
                this.spitfireActive = false;
                this.spitfireCooldown = this.spitfireMaxCooldown;
                this.spitfireDuration = 360;
            }
        }
        
        if (this.spitfireCooldown > 0) {
            this.spitfireCooldown--;
        }

        // Update warhead system
        if (!this.gameOver) {
            this.warheadTimer--;
            
            if (this.warheadTimer <= 0 && Date.now() - this.lastWarheadTime > 14000) {
                const randomDelay = Math.random() * (40000 - 14000) + 14000; // Random between 14-40 seconds
                this.spawnWarhead();
                this.lastWarheadTime = Date.now();
                this.warheadTimer = randomDelay / (1000/60); // Convert to frames
            }
        }

        // Update existing warheads
        this.warheads = this.warheads.filter(warhead => warhead.update());
    }

    removeOffscreenObjects() {
        // Increase padding to prevent premature removal
        const padding = 200;  // Increased from 100
        
        // Add debug logs
        const beforeLength = this.jets.length;
        
        // Remove off-screen jets (with larger padding)
        this.jets = this.jets.filter(jet => {
            const keep = jet.x > -padding * 2 &&
                jet.x < this.canvas.width + padding * 2 &&
                jet.y > -padding * 2 &&
                jet.y < this.canvas.height + padding * 2;
            
            if (!keep) {
                console.log('Removing jet at:', jet.x, jet.y);
            }
            return keep;
        });

        if (beforeLength !== this.jets.length) {
            console.log(`Jets removed: ${beforeLength} -> ${this.jets.length}`);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'tutorial') {
            this.drawTutorial();
        } else if (this.state === 'start') {
            this.drawStartScreen();
        } else if (this.state === 'playing') {
            // Draw game elements
            this.background.draw(this.ctx);
            this.santa.draw(this.ctx);
            this.jets.forEach(jet => jet.draw(this.ctx));
            this.candyCanes.forEach(cane => cane.draw(this.ctx));
            this.bullets.forEach(bullet => bullet.draw(this.ctx));
            this.explosions.forEach(explosion => explosion.draw(this.ctx));
            this.supplies.forEach(supply => supply.draw(this.ctx));
            this.warheads.forEach(warhead => warhead.draw(this.ctx));

            this.drawTimeAlive();
            this.drawHealthAndAmmo();
            this.drawSpitfireCooldown();

            if (this.gameOver) {
                this.drawGameOver();
            }
        }

        // Always draw instructions on top if they're showing
        if (this.showInstructions) {
            this.drawInstructionsPopup();
        }
    }

    drawTimeAlive() {
        this.ctx.font = '24px GameFont';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'left';
        // Math.floor to ensure we get whole numbers
        const minutes = Math.floor(this.timeAlive / 60);
        const seconds = Math.floor(this.timeAlive % 60);
        // Format the time string
        const timeString = `Time Alive: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.ctx.fillText(timeString, 20, 40);
    }

    drawGameOver() {
        // Draw semi-transparent black overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game over text with GameFont
        this.ctx.font = '48px GameFont';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width/2, this.canvas.height/2);
        
        // Draw time alive
        this.ctx.font = '24px GameFont';
        const minutes = Math.floor(this.timeAlive / 60);
        const seconds = Math.floor(this.timeAlive % 60);
        const timeString = `Time Alive: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.ctx.fillText(timeString, this.canvas.width/2, this.canvas.height/2 + 50);
        
        // Updated restart instruction
        this.ctx.fillText('Press R to Restart', this.canvas.width/2, this.canvas.height/2 + 100);
    }

    drawHealthAndAmmo() {
        const barWidth = 200;
        const barHeight = 20;
        const barX = (this.canvas.width - barWidth) / 2;
        const healthBarY = 50;
        const ammoBarY = 110;
        
        // Pulsing effect calculation
        const pulseAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 100);
        
        // Draw health text
        this.ctx.font = '24px GameFont';
        this.ctx.textAlign = 'center';
        
        // Health text color
        this.ctx.fillStyle = this.health > 25 ? 'white' : `rgba(255, 0, 0, ${pulseAlpha})`;
        this.ctx.fillText(`Health: ${this.health}%`, this.canvas.width/2, 40);

        // Health bar background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(barX, healthBarY, barWidth, barHeight);

        // Health bar
        if (this.health > 25) {
            this.ctx.fillStyle = 'green';
        } else {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        }
        this.ctx.fillRect(barX, healthBarY, barWidth * (this.health / 100), barHeight);

        // Ammo text
        this.ctx.fillStyle = this.ammo > 10 ? 'white' : `rgba(255, 0, 0, ${pulseAlpha})`;
        this.ctx.fillText(`Ammo: ${this.ammo}`, this.canvas.width/2, 100);

        // Ammo bar background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(barX, ammoBarY, barWidth, barHeight);

        // Ammo bar
        if (this.ammo > 10) {
            this.ctx.fillStyle = 'gold';
        } else {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        }
        this.ctx.fillRect(barX, ammoBarY, barWidth * (this.ammo / this.maxAmmo), barHeight);

        // Draw borders around bars for better visibility
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, healthBarY, barWidth, barHeight);
        this.ctx.strokeRect(barX, ammoBarY, barWidth, barHeight);
    }

    gameLoop() {
        if (!this.isPaused) {
            this.update();
            this.draw();
        }
        
        // Always request next frame, even if game over
        requestAnimationFrame(() => this.gameLoop());
    }

    checkCollisions() {
        // Check candy canes hitting jets
        this.candyCanes.forEach((cane, caneIndex) => {
            this.jets.forEach((jet, jetIndex) => {
                if (this.checkCollision(cane, jet)) {
                    this.createExplosion(jet.x + jet.width/2, jet.y + jet.height/2);
                    this.jets.splice(jetIndex, 1);
                    this.candyCanes.splice(caneIndex, 1);
                    this.score += 100;
                }
            });
        });

        // Check bullets hitting santa
        this.bullets.forEach((bullet, bulletIndex) => {
            if (this.checkCollision(bullet, this.santa)) {
                this.bullets.splice(bulletIndex, 1);
                this.health = Math.max(0, this.health - 2);
                
                if (this.health <= 0 && !this.gameOver) {
                    console.log("Triggering explosion"); // Debug log
                    this.santa.explode();
                    this.gameOver = true;
                }
            }
        });

        // Check jet collisions
        this.jets.forEach((jet, jetIndex) => {
            if (this.checkCollision(jet, this.santa)) {
                this.createExplosion(jet.x + jet.width/2, jet.y + jet.height/2);
                this.jets.splice(jetIndex, 1);
                this.health = Math.max(0, this.health - 5);
                
                if (this.health <= 0 && !this.gameOver) {
                    console.log("Triggering explosion"); // Debug log
                    this.santa.explode();
                    this.gameOver = true;
                }
            }
        });
    }

    checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }

    createExplosion(x, y) {
        this.explosions.push(new Explosion(this, x, y));
    }

    createFinalExplosion(x, y) {
        // Create multiple explosion instances for dramatic effect
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.createExplosion(
                    x + (Math.random() - 0.5) * 100,
                    y + (Math.random() - 0.5) * 100
                );
                // Add screen shake
                this.screenShake = 20;
            }, i * 150);
        }

        // Create particle explosion
        for (let i = 0; i < 50; i++) {
            this.finalExplosionParticles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 60 + Math.random() * 30,
                size: 3 + Math.random() * 5,
                color: `hsl(${Math.random() * 60}, 100%, 50%)`  // Red to yellow
            });
        }
    }

    updateFinalExplosion() {
        // Update particles
        this.finalExplosionParticles = this.finalExplosionParticles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            return particle.life > 0;
        });

        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
        }
    }

    drawFinalExplosion(ctx) {
        // Apply screen shake
        if (this.screenShake > 0) {
            ctx.save();
            ctx.translate(
                (Math.random() - 0.5) * this.screenShake,
                (Math.random() - 0.5) * this.screenShake
            );
        }

        // Draw particles
        this.finalExplosionParticles.forEach(particle => {
            ctx.globalAlpha = particle.life / 90;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });

        if (this.screenShake > 0) {
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    // Add this method to check health
    getHealth() {
        return this.health;
    }

    spawnWarhead() {
        const warhead = new Warhead(this, this.santa.x, this.santa.y);
        this.warheads.push(warhead);
        
        console.log('Spawned warhead targeting Santa');
    }

    drawSpitfireCooldown() {
        if (this.spitfireCooldown > 0) {
            const secondsLeft = Math.ceil(this.spitfireCooldown / 60);
            this.ctx.font = '20px GameFont';
            this.ctx.fillStyle = 'orange';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Spitfire Ready in: ${secondsLeft}s`, this.canvas.width / 2, 160);
        }
    }

    activateSpitfire() {
        if (this.spitfireCooldown === 0) {
            this.spitfireActive = true;
            this.spitfireDuration = 360; // 6 seconds
            this.spitfireCooldown = this.spitfireMaxCooldown; // Start cooldown
            console.log('Spitfire activated!');
        }
    }

    drawStartScreen() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = '48px GameFont';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SANTA VS THE AIRFORCE', this.canvas.width / 2, this.canvas.height / 2 - 50);

        this.ctx.font = '24px GameFont';
        this.ctx.fillText('Press Space to Start', this.canvas.width / 2, this.canvas.height / 2 + 50);

        // Add instructions prompt
        this.ctx.font = '18px GameFont';
        this.ctx.fillText('Press J for Instructions', this.canvas.width / 2, this.canvas.height / 2 + 150);
        this.ctx.fillText('by ashfelloff', this.canvas.width / 2, this.canvas.height / 2 + 100);

        // Draw instructions popup if active
        if (this.showInstructions) {
            this.drawInstructionsPopup();
        }
    }

    drawInstructionsPopup() {
        // Semi-transparent black overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Popup box
        const boxWidth = 600;
        const boxHeight = 400;
        const boxX = (this.canvas.width - boxWidth) / 2;
        const boxY = (this.canvas.height - boxHeight) / 2;

        // Draw popup box with dark background
        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.95)';
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Draw border
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Instructions text
        const instructions = [
            "CONTROLS:",
            "W, A, S, D - Move Santa",
            "SPACE - Shoot candy canes",
            "Hold SPACE - Activate Spitfire mode (when available)",
            "",
            "OBJECTIVES:",
            "- Dodge enemy jets and missiles",
            "- Collect supply drops for health and ammo",
            "- Survive as long as possible",
            "",
            "Press J again to close"
        ];

        // Draw text
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'left';
        this.ctx.font = '24px GameFont';
        instructions.forEach((line, index) => {
            const y = boxY + 50 + (index * 30);
            this.ctx.fillText(line, boxX + 30, y);
        });
    }
}

class Background {
    constructor(game) {
        this.game = game;
        this.layers = [
            { 
                image: game.assets.sky, 
                speed: 1, 
                x: 0, 
                heightRatio: 0.35,  // Takes up top 35% of screen
                y: 0
            },
            { 
                image: game.assets.mountain, 
                speed: 2, 
                x: 0, 
                heightRatio: 0.4,   // Takes up 40% of screen with overlap
                y: game.canvas.height * 0.25  // Starts at 25% down
            },
            { 
                image: game.assets.pine1, 
                speed: 3, 
                x: 0, 
                heightRatio: 0.45,  // Takes up 45% of screen with overlap
                y: game.canvas.height * 0.45  // Starts at 45% down
            },
            { 
                image: game.assets.pine2, 
                speed: 4, 
                x: 0, 
                heightRatio: 0.5,   // Takes up bottom 50% with overlap
                y: game.canvas.height * 0.65  // Starts at 65% down
            }
        ];
        
        this.calculateDimensions();
    }

    calculateDimensions() {
        this.layers.forEach(layer => {
            layer.height = this.game.canvas.height * layer.heightRatio;
            const scale = layer.height / layer.image.height;
            layer.width = layer.image.width * scale;
        });
    }

    update() {
        this.layers.forEach(layer => {
            layer.x -= layer.speed;
            if (layer.x <= -layer.width) {
                layer.x = 0;
            }
        });
    }

    draw() {
        this.layers.forEach(layer => {
            // Draw each layer twice for seamless scrolling
            let x = layer.x;
            
            // Keep drawing until we cover the entire canvas width
            while (x < this.game.canvas.width) {
                this.game.ctx.drawImage(
                    layer.image,
                    x,
                    layer.y,
                    layer.width,
                    layer.height
                );
                x += layer.width;
            }
            
            // Draw one more segment to ensure smooth scrolling
            this.game.ctx.drawImage(
                layer.image,
                x,
                layer.y,
                layer.width,
                layer.height
            );
        });
    }
}

class Santa {
    constructor(game) {
        this.game = game;
        this.x = game.canvas.width * 0.2;
        this.y = game.canvas.height * 0.5;
        const scale = 0.3;
        this.width = game.assets.sleigh.width * scale;
        this.height = game.assets.sleigh.height * scale;
        
        // Increased speed values
        this.baseSpeed = 12;          // Increased from 8
        this.maxSpeed = 20;           // Increased from 16
        this.acceleration = 0.3;      // Increased from 0.2
        this.deceleration = 0.08;     // Adjusted for smoother deceleration
        
        this.currentSpeedX = 0;
        this.currentSpeedY = 0;
        this.rotation = 0;
        this.targetRotation = 0;
        this.rotationSpeed = 0.15;    // Slightly increased for more responsive tilting
        this.isSpinning = false;
        this.spinAccumulator = 0;
        
        this.shootCooldown = 0;
        this.shootDelay = 5;
        
        this.keysPressed = {
            w: false,
            s: false,
            a: false,
            d: false
        };
        
        // Add glimmer effect properties
        this.glimmerParticles = [];
        this.glimmerSpawnRate = 2; // Spawn new particles every N frames
        this.glimmerFrame = 0;
        this.isExploding = false;
        this.explosionParticles = [];
        this.isDead = false;  // New flag to track complete death
        this.spacePressed = false;
        this.spaceHoldTime = 0;
        this.spitfireDelay = 5;  // Delay between rapid shots
        this.spitfireTimer = 0;
    }

    shoot() {
        if (this.game.ammo > 0) {
            if (this.game.spitfireActive && this.spitfireTimer <= 0) {
                // Rapid fire mode
                const spreadAngles = [-0.2, 0, 0.2]; // Slight spread
                spreadAngles.forEach(spread => {
                    const angle = this.rotation + spread;
                    const caneX = this.x + this.width/2 + Math.cos(angle) * this.width/2;
                    const caneY = this.y + this.height/2 + Math.sin(angle) * this.height/2;
                    
                    this.game.candyCanes.push(new CandyCane(this.game, caneX, caneY, angle));
                    this.game.ammo--;
                });
                this.spitfireTimer = this.spitfireDelay;
            } else if (!this.game.spitfireActive) {
                // Normal shot
                const angle = this.rotation;
                const caneX = this.x + this.width/2 + Math.cos(angle) * this.width/2;
                const caneY = this.y + this.height/2 + Math.sin(angle) * this.height/2;
                
                this.game.candyCanes.push(new CandyCane(this.game, caneX, caneY, angle));
                this.game.ammo--;
            }
        }
    }

    explode() {
        console.log("Explosion triggered");
        this.isExploding = true;
        
        // Create particle explosion
        for (let i = 0; i < 100; i++) {
            this.explosionParticles.push({
                x: this.x + this.width/2,
                y: this.y + this.height/2,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 120,
                size: 5 + Math.random() * 8,
                color: `hsl(${30 + Math.random() * 30}, 100%, ${50 + Math.random() * 50}%)`
            });
        }

        // Add multiple regular explosions
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                this.game.explosions.push(new Explosion(
                    this.game,
                    this.x + this.width/2 + (Math.random() - 0.5) * 100,
                    this.y + this.height/2 + (Math.random() - 0.5) * 100,
                    2  // Make explosions bigger
                ));
            }, i * 100);  // Stagger the explosions
        }

        // Add one big central explosion
        this.game.explosions.push(new Explosion(
            this.game,
            this.x + this.width/2,
            this.y + this.height/2,
            3  // Even bigger central explosion
        ));

        // Add screen shake
        this.game.screenShake = 20;
    }

    update() {
        if (this.isExploding) {
            // Update explosion particles
            this.explosionParticles = this.explosionParticles.filter(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life--;
                return particle.life > 0;
            });

            // Only set isDead when all particles are gone
            if (this.explosionParticles.length === 0) {
                this.isDead = true;
            }
            return;
        }

        // Update speeds based on key states
        if (this.keysPressed.w) {
            this.currentSpeedY = Math.max(this.currentSpeedY - this.acceleration, -this.maxSpeed);
            this.targetRotation = -0.2;  // Tilt up
        } else if (this.keysPressed.s) {
            this.currentSpeedY = Math.min(this.currentSpeedY + this.acceleration, this.maxSpeed);
            this.targetRotation = 0.2;   // Tilt down
        } else {
            this.currentSpeedY *= (1 - this.deceleration);
            if (Math.abs(this.currentSpeedY) < 0.1) {
                this.currentSpeedY = 0;
                this.targetRotation = 0;  // Return to neutral when not moving vertically
            }
        }

        if (this.keysPressed.a) {
            this.currentSpeedX = Math.max(this.currentSpeedX - this.acceleration, -this.maxSpeed);
            this.spinAccumulator -= 0.1;
            this.rotation = this.spinAccumulator;
            this.isSpinning = true;
        } else if (this.keysPressed.d) {
            this.currentSpeedX = Math.min(this.currentSpeedX + this.acceleration, this.maxSpeed);
        } else {
            this.currentSpeedX *= (1 - this.deceleration);
            if (Math.abs(this.currentSpeedX) < 0.1) this.currentSpeedX = 0;
            
            // Auto-rotate back to neutral when A is released
            if (this.isSpinning) {
                let currentAngle = this.spinAccumulator % (Math.PI * 2);
                if (currentAngle > Math.PI) currentAngle -= Math.PI * 2;
                else if (currentAngle < -Math.PI) currentAngle += Math.PI * 2;
                
                this.spinAccumulator += -currentAngle * 0.1;
                this.rotation = this.spinAccumulator;
                
                if (Math.abs(currentAngle) < 0.05) {
                    this.isSpinning = false;
                    this.spinAccumulator = 0;
                    this.rotation = 0;
                }
            }
        }

        // Update position
        this.x += this.currentSpeedX;
        this.y += this.currentSpeedY;
        
        // Keep santa within bounds
        this.x = Math.max(this.width/2, Math.min(this.x, this.game.canvas.width - this.width/2));
        this.y = Math.max(this.height/2, Math.min(this.y, this.game.canvas.height - this.height/2));

        // Update cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }

        // Update glimmer effect
        this.glimmerFrame++;
        if (this.glimmerFrame >= this.glimmerSpawnRate) {
            this.glimmerFrame = 0;
            // Spawn new glimmer particle
            this.glimmerParticles.push({
                x: this.x + Math.random() * this.width,
                y: this.y + Math.random() * this.height,
                size: 2 + Math.random() * 3,
                life: 30 + Math.random() * 20,
                alpha: 1,
                color: `hsl(${40 + Math.random() * 20}, ${90 + Math.random() * 10}%, ${70 + Math.random() * 30}%)`
            });
        }

        // Update existing particles
        this.glimmerParticles = this.glimmerParticles.filter(particle => {
            particle.life--;
            particle.alpha = particle.life / 50;
            return particle.life > 0;
        });

        // Keep santa within vertical bounds
        this.y = Math.max(this.height/2, Math.min(this.y, this.game.canvas.height - this.height));

        // Update spitfire shooting
        if (this.game.spitfireActive && this.spacePressed) {
            if (this.spitfireTimer <= 0) {
                this.spitfireShoot();
                this.spitfireTimer = this.spitfireDelay;
            }
            this.spitfireTimer--;
        }
    }

    spitfireShoot() {
        if (this.game.ammo >= 3) {
            const spreadAngles = [-0.2, 0, 0.2];
            spreadAngles.forEach(spread => {
                const angle = this.rotation + spread;
                const caneX = this.x + this.width/2 + Math.cos(angle) * this.width/2;
                const caneY = this.y + this.height/2 + Math.sin(angle) * this.height/2;
                
                this.game.candyCanes.push(new CandyCane(this.game, caneX, caneY, angle));
                this.game.ammo--;
            });
        }
    }

    draw(ctx) {
        // Draw glimmer particles first
        this.glimmerParticles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.alpha;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Then draw Santa
        if (!this.isExploding) {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            ctx.drawImage(
                this.game.assets.sleigh,
                -this.width/2,
                -this.height/2,
                this.width,
                this.height
            );
            ctx.restore();
        }
    }

    // Use game's health instead of storing separately
    get health() {
        return this.game.getHealth();
    }

    set health(value) {
        this.game.health = value;
    }
}

class Jet {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        const scale = 0.3;
        this.width = game.assets.jet.width * scale;
        this.height = game.assets.jet.height * scale;
        
        // Fixed speed that won't be modified by game state
        this.speed = 7;
        this.turnSpeed = 0.08;
        this.aggressionRadius = 600;
        
        this.rotation = 0;
        this.targetRotation = 0;
        
        this.fireRate = 15;
        this.nextShotTime = 0;
        
        console.log(`New jet created with fixed speed: ${this.speed}`);
    }

    update() {
        const dx = this.game.santa.x - this.x;
        const dy = this.game.santa.y - this.y;
        const distanceToSanta = Math.sqrt(dx * dx + dy * dy);
        
        // Keep on screen
        const padding = 50;
        if (this.x < padding) this.x = padding;
        if (this.x > this.game.canvas.width - padding) this.x = this.game.canvas.width - padding;
        if (this.y < padding) this.y = padding;
        if (this.y > this.game.canvas.height - padding) this.y = this.game.canvas.height - padding;

        this.targetRotation = Math.atan2(dy, dx);
        
        let rotationDiff = this.targetRotation - this.rotation;
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        this.rotation += Math.sign(rotationDiff) * Math.min(Math.abs(rotationDiff), this.turnSpeed);

        // Use fixed speed value
        this.x += Math.cos(this.rotation) * this.speed;
        this.y += Math.sin(this.rotation) * this.speed;

        if (distanceToSanta < this.aggressionRadius && this.nextShotTime <= 0) {
            this.fire();
            this.nextShotTime = this.fireRate;
        }

        this.nextShotTime--;
    }

    fire() {
        const gunX = this.x + this.width/2 + Math.cos(this.rotation) * this.width;
        const gunY = this.y + this.height/2 + Math.sin(this.rotation) * this.width;
        
        this.game.bullets.push(new Bullet(this.game, gunX, gunY, this.rotation));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.scale(1, -1);
        ctx.rotate(this.rotation);
        
        ctx.drawImage(
            this.game.assets.jet,
            -this.width/2,
            -this.height/2,
            this.width,
            this.height
        );
        
        ctx.restore();
    }
}

class CandyCane {
    constructor(game, x, y, angle) {
        this.game = game;
        this.x = x;
        this.y = y;
        const scale = 0.03;
        this.width = game.assets.cane.width * scale;
        this.height = game.assets.cane.height * scale;
        this.speed = 10;
        this.angle = angle;  // Use provided angle
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        // Rotate candy cane to match movement direction
        ctx.rotate(this.angle + Math.PI/2);
        ctx.drawImage(
            this.game.assets.cane,
            -this.width/2,
            -this.height/2,
            this.width,
            this.height
        );
        ctx.restore();
    }

    update() {
        // Move in direction of angle
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }
}

class Bullet {
    constructor(game, x, y, angle) {
        this.game = game;
        this.x = x;
        this.y = y;
        const scale = 0.4;  // Increased from 0.2 to make bullets 2x bigger
        this.width = game.assets.bullet.width * scale;
        this.height = game.assets.bullet.height * scale;
        this.speed = 15;
        this.angle = angle;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);  // Adjust rotation to match direction
        ctx.drawImage(
            this.game.assets.bullet,
            -this.width / 2,
            -this.height / 2,
            this.width,
            this.height
        );
        ctx.restore();
    }
}

class Explosion {
    constructor(game, x, y, radius) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.radius = radius || 100; // Default radius if not specified
        this.frame = 0;
        this.frameCount = 5;
        this.frameDelay = 3;
        this.frameTimer = 0;
        this.complete = false;
    }

    update() {
        this.frameTimer++;
        if (this.frameTimer >= this.frameDelay) {
            this.frame++;
            this.frameTimer = 0;
            
            if (this.frame >= this.frameCount) {
                this.complete = true;
            }
        }
        return !this.complete;
    }

    draw(ctx) {
        const explosionImage = this.game.assets[`exp${this.frame + 1}`];
        if (explosionImage) {
            ctx.drawImage(
                explosionImage,
                this.x - this.radius,
                this.y - this.radius,
                this.radius * 2,
                this.radius * 2
            );
        }
    }
}

class Supply {
    constructor(game) {
        this.game = game;
        
        // Smaller size - reduced by factor of 3
        const scale = 0.17; // Adjusted from 0.5 to make it 3 times smaller
        this.width = this.game.assets.supply.width * scale;
        this.height = this.game.assets.supply.height * scale;
        
        // Random spawn position in upper area
        this.x = 200 + Math.random() * 800;
        this.y = -this.height;
        
        // Movement
        this.fallSpeed = 1.5;
        
        // Sparkle effect properties
        this.sparkles = [];
        this.sparkleIntensity = 0.6;
        this.visible = false;
        this.collected = false;
        
        this.healAmount = 25;
        this.ammoAmount = 35;  // Increased ammo restore
        
        // Adjust number of sparkles for smaller size
        for (let i = 0; i < 12; i++) { // Reduced number of sparkles
            this.addSparkle();
        }
    }

    addSparkle() {
        this.sparkles.push({
            x: this.x + Math.random() * this.width,
            y: this.y + Math.random() * this.height,
            vx: (Math.random() - 0.5) * 1,  // Reduced sparkle spread
            vy: (Math.random() - 0.5) * 1,
            size: 1 + Math.random() * 2,    // Smaller sparkles
            life: 30 + Math.random() * 20,
            alpha: this.sparkleIntensity,
            color: `hsl(${40 + Math.random() * 20}, ${90 + Math.random() * 10}%, ${70 + Math.random() * 30}%)`
        });
    }

    update() {
        // Always add new sparkles
        if (Math.random() < 0.3) {
            this.addSparkle();
        }

        // Update sparkles
        this.sparkles = this.sparkles.filter(sparkle => {
            sparkle.x += sparkle.vx;
            sparkle.y += sparkle.vy;
            sparkle.life--;
            sparkle.alpha = (sparkle.life / 50) * this.sparkleIntensity;
            return sparkle.life > 0;
        });

        // Always move down if not collected
        if (!this.collected) {
            this.y += this.fallSpeed;
            this.visible = true;
        }

        // Check collection
        if (!this.collected && this.checkCollision()) {
            this.collected = true;
            // Restore health
            this.game.health = Math.min(100, this.game.health + this.healAmount);
            // Restore ammo
            this.game.ammo = Math.min(this.game.maxAmmo, this.game.ammo + this.ammoAmount);
            console.log(`Supply collected! Health: ${this.game.health}, Ammo: ${this.game.ammo}`);
        }

        // Return false if off screen to remove from game
        return this.y < this.game.canvas.height + 100;
    }

    draw(ctx) {
        ctx.save();
        
        // Draw supply
        if (!this.collected) {
            ctx.drawImage(
                this.game.assets.supply,
                this.x,
                this.y,
                this.width,
                this.height
            );
        }

        // Draw sparkles
        this.sparkles.forEach(sparkle => {
            ctx.globalAlpha = sparkle.alpha;
            ctx.fillStyle = sparkle.color;
            ctx.beginPath();
            ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    checkCollision() {
        return (
            this.x < this.game.santa.x + this.game.santa.width &&
            this.x + this.width > this.game.santa.x &&
            this.y < this.game.santa.y + this.game.santa.height &&
            this.y + this.height > this.game.santa.y
        );
    }
}

class Warhead {
    constructor(game, targetX, targetY) {
        this.game = game;
        this.targetX = targetX;
        this.targetY = targetY;
        
        // Targeting box properties
        this.boxSize = 300;
        this.minBoxSize = 50;
        this.boxShrinkRate = 1;
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.targeting = true;
        
        // Warhead properties
        const scale = 0.5; // Adjust scale to maintain proportions
        this.width = game.assets.warhead.width * scale;
        this.height = game.assets.warhead.height * scale;
        
        this.x = targetX;
        this.y = this.game.canvas.height + 100;
        this.speed = 8;
        this.turnSpeed = 0.04; // Reduced for more realistic turning
        this.rotation = -Math.PI/2; // Start pointing upward
        this.health = 10;
        this.lifeTimer = 300;
        this.explosionRadius = 200;
        this.active = true;
    }

    update() {
        if (!this.active) return false;

        if (this.targeting) {
            // Update targeting box to follow Santa
            this.targetX = this.game.santa.x;
            this.targetY = this.game.santa.y;
            this.boxSize = Math.max(this.boxSize - this.boxShrinkRate, this.minBoxSize);
            
            if (this.boxSize === this.minBoxSize) {
                this.blinkTimer++;
                this.isBlinking = (this.blinkTimer % 10) < 5;
                
                if (this.blinkTimer >= 30) {
                    this.targeting = false;
                }
            }
        } else {
            // Calculate target angle
            const dx = this.game.santa.x - this.x;
            const dy = this.game.santa.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            
            // Smoothly rotate towards target
            let angleDiff = targetAngle - this.rotation;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Apply rotation
            this.rotation += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnSpeed);
            
            // Move in direction of rotation
            this.x += Math.cos(this.rotation) * this.speed;
            this.y += Math.sin(this.rotation) * this.speed;
            
            // Check for hits from candy canes
            this.game.candyCanes.forEach(cane => {
                if (this.checkCollision(cane)) {
                    this.health--;
                    cane.active = false;
                }
            });
            
            this.lifeTimer--;
            
            if (this.health <= 0 || this.lifeTimer <= 0) {
                this.explode();
                return false;
            }
            
            if (this.checkCollisionWithSanta()) {
                this.explode();
                return false;
            }
        }
        
        return true;
    }

    draw(ctx) {
        if (this.targeting) {
            // Draw targeting box
            ctx.strokeStyle = this.isBlinking ? 'transparent' : 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                this.targetX - this.boxSize/2,
                this.targetY - this.boxSize/2,
                this.boxSize,
                this.boxSize
            );
        } else {
            const warheadImage = this.game.assets.warhead;
            if (warheadImage) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation); // Rotate based on movement direction
                ctx.drawImage(
                    warheadImage,
                    -this.width/2,
                    -this.height/2,
                    this.width,
                    this.height
                );
                ctx.restore();
            }
        }
    }

    explode() {
        // Create larger explosion effect
        this.game.explosions.push(new Explosion(this.game, this.x, this.y, this.explosionRadius));
        
        // Check for damage to Santa
        const distToSanta = Math.hypot(
            this.game.santa.x - this.x,
            this.game.santa.y - this.y
        );
        
        if (distToSanta < this.explosionRadius) {
            this.game.health -= 25;
        }
        
        // Check for damage to jets
        this.game.jets = this.game.jets.filter(jet => {
            const distToJet = Math.hypot(jet.x - this.x, jet.y - this.y);
            if (distToJet < this.explosionRadius) {
                this.game.explosions.push(new Explosion(this.game, jet.x, jet.y, this.explosionRadius));
                return false;
            }
            return true;
        });
        
        this.active = false;
    }

    checkCollision(cane) {
        return (
            this.x < cane.x + cane.width &&
            this.x + this.width > cane.x &&
            this.y < cane.y + cane.height &&
            this.y + this.height > cane.y
        );
    }

    checkCollisionWithSanta() {
        return (
            this.x < this.game.santa.x + this.game.santa.width &&
            this.x + this.width > this.game.santa.x &&
            this.y < this.game.santa.y + this.game.santa.height &&
            this.y + this.height > this.game.santa.y
        );
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});

