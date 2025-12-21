// =========================================
// RENDERER.JS - Pure UI/View Layer
// =========================================
//
// This module handles ONLY UI updates and animations.
// It reads from GameState and updates the DOM.
// It does NOT modify GameState - that's engine.js's job.
//
// Pattern:
// gameState (data) -> Renderer (view) -> DOM (display)

const Renderer = {
    // =========================================
    // HAND RENDERING
    // =========================================

    /**
     * Update hand display for a player
     * @param {string} playerId - 'player' or 'opponent'
     */
    updateHand(playerId) {
        const player = gameState.getPlayer(playerId);

        if (playerId === 'player') {
            // Render player hand cards
            const container = document.getElementById('playerHand');
            if (!container) return;

            container.innerHTML = '';
            player.hand.forEach((card, i) => {
                const el = this.createHandCardElement(card, i);
                container.appendChild(el);
            });
        } else {
            // Render opponent card backs
            const container = document.querySelector('.opponent-hand-container');
            if (!container) return;

            container.innerHTML = '';
            player.hand.forEach(() => {
                const el = this.createCardBackElement();
                container.appendChild(el);
            });
        }
    },

    /**
     * Create a hand card element for player
     * @param {Object} card 
     * @param {number} index 
     * @returns {HTMLElement}
     */
    createHandCardElement(card, index) {
        const cardEl = document.createElement('div');
        cardEl.className = 'hand-card';
        cardEl.style.backgroundImage = `url('${card.img}')`;
        cardEl.setAttribute('data-index', index);
        cardEl.setAttribute('data-name', card.name);
        cardEl.setAttribute('data-category', card.category);

        // Copy all card data
        for (let key in card) {
            if (key !== 'img') {
                cardEl.setAttribute(`data-${key}`, card[key]);
            }
        }

        return cardEl;
    },

    /**
     * Create opponent card back element
     * @returns {HTMLElement}
     */
    createCardBackElement() {
        const cardEl = document.createElement('div');
        cardEl.className = 'opponent-hand-card';
        return cardEl;
    },

    // =========================================
    // FIELD RENDERING
    // =========================================

    /**
     * Update field zone for a player
     * @param {string} playerId 
     * @param {string} zone - 'monsters' or 'spells'
     */
    updateField(playerId, zone) {
        const player = gameState.getPlayer(playerId);
        const zoneClass = zone === 'monsters' ? 'monster-zone' : 'spell-trap-zone';
        const playerClass = playerId === 'player' ? 'player-zone' : 'opp-zone';

        const zones = document.querySelectorAll(`.${playerClass}.${zoneClass}`);
        zones.forEach((zoneEl, i) => {
            zoneEl.innerHTML = '';
            const card = player.field[zone][i];
            if (card) {
                const cardEl = this.createFieldCardElement(card, zone);
                zoneEl.appendChild(cardEl);
            }
        });
    },

    /**
     * Create field card element
     * @param {Object} card 
     * @param {string} zone 
     * @returns {HTMLElement}
     */
    createFieldCardElement(card, zone) {
        const cardEl = document.createElement('div');

        // Determine CSS classes
        const faceClass = card.faceUp ? 'face-up' : 'face-down';
        const posClass = card.position === 'atk' ? 'pos-atk' : 'pos-def';
        cardEl.className = `card ${faceClass} ${posClass}`;

        // Set attributes
        for (let key in card) {
            if (typeof card[key] !== 'object') {
                cardEl.setAttribute(`data-${key}`, card[key]);
            }
        }

        // Set image
        if (card.faceUp && card.img) {
            cardEl.style.backgroundImage = `url('${card.img}')`;
        } else {
            cardEl.style.backgroundImage = 'var(--card-back-url)';
        }

        // Add stats bar for face-up monsters
        if (card.faceUp && zone === 'monsters') {
            const statsBar = document.createElement('div');
            statsBar.className = 'stats-bar';
            statsBar.innerHTML = `
                <span class="stat-val stat-atk">${card.atk || 0}</span>
                <span class="stat-val stat-def">${card.def || 0}</span>
            `;
            cardEl.appendChild(statsBar);
        }

        return cardEl;
    },

    /**
     * Update all zones for a player
     * @param {string} playerId 
     */
    updateAllZones(playerId) {
        this.updateField(playerId, 'monsters');
        this.updateField(playerId, 'spells');
    },

    // =========================================
    // COUNTER RENDERING
    // =========================================

    /**
     * Update all counters (deck, hand, GY counts)
     */
    updateCounters() {
        // Player counters
        const playerDeckEl = document.getElementById('player-deck-count');
        const playerGYEl = document.getElementById('player-gy-count');
        if (playerDeckEl) playerDeckEl.textContent = gameState.players.player.deck.length;
        if (playerGYEl) playerGYEl.textContent = gameState.players.player.gy.length;

        // Opponent counters
        const oppDeckEl = document.getElementById('opp-deck-count');
        const oppGYEl = document.getElementById('opp-gy-count');
        if (oppDeckEl) oppDeckEl.textContent = gameState.players.opponent.deck.length;
        if (oppGYEl) oppGYEl.textContent = gameState.players.opponent.gy.length;
    },

    // =========================================
    // LP RENDERING
    // =========================================

    /**
     * Update LP display
     * @param {string} playerId 
     */
    updateLP(playerId) {
        const lp = gameState.getPlayer(playerId).lp;
        const elementId = playerId === 'player' ? 'player-lp-val' : 'opp-lp-val';
        const el = document.getElementById(elementId);
        if (el) el.textContent = lp;
    },

    /**
     * Update both players' LP
     */
    updateAllLP() {
        this.updateLP('player');
        this.updateLP('opponent');
    },

    // =========================================
    // GRAVEYARD RENDERING
    // =========================================

    /**
     * Update graveyard visual
     * @param {string} playerId 
     */
    updateGraveyard(playerId) {
        const player = gameState.getPlayer(playerId);
        const elementId = playerId === 'player' ? 'playerGY' : 'oppGY';
        const gyZone = document.getElementById(elementId);

        if (!gyZone || player.gy.length === 0) return;

        // Show top card
        const topCard = player.gy[player.gy.length - 1];
        gyZone.innerHTML = '';

        const cardEl = document.createElement('div');
        cardEl.className = 'card face-up pos-atk';
        cardEl.style.backgroundImage = `url('${topCard.img}')`;
        gyZone.appendChild(cardEl);

        // Update counter
        this.updateCounters();
    },

    // =========================================
    // ANIMATIONS
    // =========================================

    /**
     * Animate card draw
     * @param {string} playerId 
     */
    animateCardDraw(playerId) {
        // Create animation element
        const deckZone = playerId === 'player'
            ? document.getElementById('playerDeck')
            : document.querySelector('.opp-zone.deck-zone');

        if (!deckZone) return;

        const rect = deckZone.getBoundingClientRect();
        const animCard = document.createElement('div');
        animCard.className = 'draw-card-anim';
        animCard.style.left = rect.left + 'px';
        animCard.style.top = rect.top + 'px';

        document.body.appendChild(animCard);

        // Animate to hand
        setTimeout(() => {
            const handZone = playerId === 'player'
                ? document.getElementById('playerHand')
                : document.querySelector('.opponent-hand-container');

            if (handZone) {
                const handRect = handZone.getBoundingClientRect();
                animCard.style.left = handRect.left + 'px';
                animCard.style.top = handRect.top + 'px';
                animCard.style.opacity = '0';
            }

            setTimeout(() => animCard.remove(), 800);
        }, 100);
    },

    /**
     * Animate battle
     * @param {HTMLElement} attackerEl 
     * @param {HTMLElement} defenderEl 
     */
    animateBattle(attackerEl, defenderEl) {
        if (!attackerEl) return;

        // Simple shake animation
        attackerEl.style.animation = 'battle-shake 0.3s';
        if (defenderEl) {
            defenderEl.style.animation = 'battle-shake 0.3s';
        }

        setTimeout(() => {
            if (attackerEl) attackerEl.style.animation = '';
            if (defenderEl) defenderEl.style.animation = '';
        }, 300);
    },

    /**
     * Show damage number
     * @param {string} playerId 
     * @param {number} damage 
     */
    showDamageNumber(playerId, damage) {
        const avatarContainer = playerId === 'player'
            ? document.querySelector('.bottom-hud .profile-container')
            : document.querySelector('.top-hud .profile-container');

        if (!avatarContainer) return;

        const damageEl = document.createElement('div');
        damageEl.className = 'damage-number';
        damageEl.textContent = `-${damage}`;
        damageEl.style.cssText = `
            position: absolute;
            color: #ff3333;
            font-size: 32px;
            font-weight: bold;
            animation: float-up 1s ease-out;
            pointer-events: none;
        `;

        avatarContainer.appendChild(damageEl);

        setTimeout(() => damageEl.remove(), 1000);
    },

    // =========================================
    // FULL RENDER
    // =========================================

    /**
     * Render entire game state (full refresh)
     */
    renderAll() {
        this.updateHand('player');
        this.updateHand('opponent');
        this.updateAllZones('player');
        this.updateAllZones('opponent');
        this.updateCounters();
        this.updateAllLP();
        this.updateGraveyard('player');
        this.updateGraveyard('opponent');
    }
};

// Add CSS for animations (if not already in stylesheet)
if (!document.getElementById('renderer-animations')) {
    const style = document.createElement('style');
    style.id = 'renderer-animations';
    style.textContent = `
        @keyframes battle-shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        
        @keyframes float-up {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-50px);
            }
        }
    `;
    document.head.appendChild(style);
}
