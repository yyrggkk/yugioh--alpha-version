// =========================================
// STATE.JS - Centralized Game State
// Single Source of Truth for Game Logic
// =========================================

/**
 * GameState Class
 * 
 * This is the single source of truth for the entire game.
 * The DOM is now just a VIEW that reflects this state.
 * 
 * Why this matters:
 * - Enables AI to simulate future moves without touching DOM
 * - Enables save/load functionality (state is JSON-serializable)
 * - Enables replay functionality
 * - Enables network multiplayer (send state over wire)
 */
class GameState {
    constructor() {
        this.players = {
            player: {
                id: 'player',
                lp: 8000,
                hand: [],      // Array of card objects
                deck: [],      // Array of card objects
                gy: [],        // Graveyard
                extra: [],     // Extra deck
                field: {
                    monsters: [null, null, null],  // Monster zones (3)
                    spells: [null, null, null],    // S/T zones (3)
                    field: null                     // Field zone
                }
            },
            opponent: {
                id: 'opponent',
                lp: 8000,
                hand: [],
                deck: [],
                gy: [],
                extra: [],
                field: {
                    monsters: [null, null, null],
                    spells: [null, null, null],
                    field: null
                }
            }
        };

        this.turnInfo = {
            phase: 'DP',              // Current phase
            activePlayer: 'player',   // Who's turn it is
            turnCount: 1,
            normalSummonUsed: false,
            gameOver: false
        };

        this.chain = [];  // Active chain stack

        // AI-specific state (from previous work)
        this.aiMainPhaseState = {
            hasSummoned: false,
            backrowSetCount: 0
        };
    }

    /**
     * Get player by ID
     * @param {string} playerId - 'player' or 'opponent'
     * @returns {Object} Player object
     */
    getPlayer(playerId) {
        return this.players[playerId];
    }

    /**
     * Get opponent of given player
     * @param {string} playerId - 'player' or 'opponent'
     * @returns {Object} Opponent object
     */
    getOpponent(playerId) {
        return playerId === 'player' ? this.players.opponent : this.players.player;
    }

    /**
     * Deep clone state for simulation
     * This allows AI to "think ahead" without affecting real game
     * @returns {GameState} Cloned state
     */
    clone() {
        const cloned = new GameState();
        const data = JSON.parse(JSON.stringify(this));
        cloned.players = data.players;
        cloned.turnInfo = data.turnInfo;
        cloned.chain = data.chain;
        cloned.aiMainPhaseState = data.aiMainPhaseState;
        return cloned;
    }

    /**
     * Serialize to JSON (for save/load or network)
     * @returns {Object} JSON-serializable object
     */
    toJSON() {
        return {
            players: this.players,
            turnInfo: this.turnInfo,
            chain: this.chain,
            aiMainPhaseState: this.aiMainPhaseState
        };
    }

    /**
     * Load from JSON
     * @param {Object} data - Serialized state
     */
    fromJSON(data) {
        this.players = data.players;
        this.turnInfo = data.turnInfo;
        this.chain = data.chain;
        this.aiMainPhaseState = data.aiMainPhaseState;
    }

    /**
     * Helper: Find card in player's hand by name
     * @param {string} playerId 
     * @param {string} cardName 
     * @returns {Object|null} Card object or null
     */
    findCardInHand(playerId, cardName) {
        const player = this.getPlayer(playerId);
        return player.hand.find(c => c.name === cardName);
    }

    /**
     * Helper: Count cards in zone
     * @param {string} playerId 
     * @param {string} zone - 'monsters', 'spells', 'hand', 'deck', 'gy'
     * @returns {number} Count
     */
    countCardsInZone(playerId, zone) {
        const player = this.getPlayer(playerId);
        if (zone === 'monsters' || zone === 'spells') {
            return player.field[zone].filter(c => c !== null).length;
        }
        return player[zone].length;
    }

    /**
     * Debug: Print current state
     */
    log() {
        console.log('=== GAME STATE ===');
        console.log('Turn:', this.turnInfo.turnCount, 'Phase:', this.turnInfo.phase);
        console.log('Active Player:', this.turnInfo.activePlayer);
        console.log('Player LP:', this.players.player.lp, 'Opp LP:', this.players.opponent.lp);
        console.log('Player Hand:', this.players.player.hand.length, 'Opp Hand:', this.players.opponent.hand.length);
        console.log('==================');
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
