// --- OPPONENT AI FLOW ---
// =========================================
// 1. GAME STATE & UTILS
// =========================================

// Phase 1: gameState is now initialized in index.php from state.js
// This legacy object is kept for compatibility during transition
// TODO Phase 2: Remove this and use only the centralized gameState
let legacyGameState = {
    normalSummonUsed: false,
    specialSummonsCount: 0,
    playerLP: 8000,
    oppLP: 8000,
    gameOver: false,
    pendingOpponentAction: null,
    aiMainPhaseState: { hasSummoned: false, backrowSetCount: 0 }
};

// =========================================
// STATE SYNCHRONIZATION LAYER (Phase 1)
// =========================================

/**
 * Sync GameState -> Legacy Globals
 * Call this after updating gameState
 */
function syncStateToGlobals() {
    playerDeckData = gameState.players.player.deck;
    oppDeckData = gameState.players.opponent.deck;
    playerHandData = gameState.players.player.hand;
    oppHandData = gameState.players.opponent.hand;
    playerGYData = gameState.players.player.gy;
    oppGYData = gameState.players.opponent.gy;

    // Sync legacy gameState properties
    legacyGameState.normalSummonUsed = gameState.turnInfo.normalSummonUsed;
    legacyGameState.gameOver = gameState.turnInfo.gameOver;
    legacyGameState.playerLP = gameState.players.player.lp;
    legacyGameState.oppLP = gameState.players.opponent.lp;
}

/**
 * Sync Legacy Globals -> GameState
 * Call this after updating legacy globals
 */
function syncGlobalsToState() {
    gameState.players.player.deck = playerDeckData;
    gameState.players.opponent.deck = oppDeckData;
    gameState.players.player.hand = playerHandData;
    gameState.players.opponent.hand = oppHandData;
    gameState.players.player.gy = playerGYData;
    gameState.players.opponent.gy = oppGYData;

    gameState.turnInfo.normalSummonUsed = legacyGameState.normalSummonUsed;
    gameState.turnInfo.gameOver = legacyGameState.gameOver;
    gameState.players.player.lp = legacyGameState.playerLP;
    gameState.players.opponent.lp = legacyGameState.oppLP;
}

// UI State (not part of game logic)
let selectedFieldCard = null;

/**
 * Synchronize DOM state to GameState
 * Critical for AI to see the actual board
 */
function syncDOMToGameState() {
    // 1. Sync Players
    ['player', 'opponent'].forEach(pid => {
        const player = gameState.players[pid];

        // Sync LP (Already synced via updateLP, but good for safety)
        const lpVal = (pid === 'player') ?
            document.getElementById('player-lp-val').textContent :
            document.getElementById('opp-lp-val').textContent;
        player.lp = parseInt(lpVal);

        // Sync Hand (Object references from globals)
        // Note: Global arrays are the source of truth for Hand/Deck/GY content
        player.hand = (pid === 'player') ? playerHandData : oppHandData;
        player.deck = (pid === 'player') ? playerDeckData : oppDeckData;
        player.gy = (pid === 'player') ? playerGYData : oppGYData;

        // Sync Field
        // Monsters
        let monsterZones = [];
        if (pid === 'player') {
            monsterZones = [document.getElementById('p-m1'), document.getElementById('p-m2'), document.getElementById('p-m3')];
        } else {
            monsterZones = Array.from(document.querySelectorAll('.opp-zone.monster-zone'));
        }

        player.field.monsters = monsterZones.map((zone, index) => {
            if (!zone) return null;
            const cardEl = zone.querySelector('.card');

            if (!cardEl) return null;

            return {
                name: cardEl.getAttribute('data-name'),
                atk: parseInt(cardEl.getAttribute('data-atk')),
                def: parseInt(cardEl.getAttribute('data-def')),
                level: parseInt(cardEl.getAttribute('data-level') || 0),
                attribute: cardEl.getAttribute('data-attribute'),
                race: cardEl.getAttribute('data-race'),
                type: cardEl.getAttribute('data-type'), // e.g. "Dragon/Effect"
                position: cardEl.classList.contains('pos-atk') ? 'atk' : 'def',
                faceUp: !cardEl.classList.contains('face-down'),
                attacked: cardEl.getAttribute('data-attacked') === 'true',
                uid: cardEl.getAttribute('data-uid'),
                category: 'monster'
            };
        });

        // Spells/Traps
        let spellZones = [];
        if (pid === 'player') {
            spellZones = [document.getElementById('p-s1'), document.getElementById('p-s2'), document.getElementById('p-s3')];
        } else {
            spellZones = Array.from(document.querySelectorAll('.opp-zone.spell-trap-zone'));
        }

        player.field.spells = spellZones.map((zone, index) => {
            if (!zone) return null;
            const cardEl = zone.querySelector('.card');

            if (!cardEl) return null;

            return {
                name: cardEl.getAttribute('data-name'),
                type: cardEl.getAttribute('data-type'),
                faceUp: !cardEl.classList.contains('face-down'),
                setTurn: parseInt(cardEl.getAttribute('data-set-turn') || -1),
                uid: cardEl.getAttribute('data-uid'),
                category: cardEl.getAttribute('data-card-category') || 'spell'
            };
        });
    });

    // Sync Turn Info
    gameState.turnInfo.phase = currentPhase;
    // activePlayer and turnCount are managed in switchTurn but good to ensure
    gameState.turnInfo.activePlayer = isPlayerTurn ? 'player' : 'opponent';
}
let selectedHandCard = null;
let selectedChainCard = null;

let battleState = { isAttacking: false, attackerCard: null };

let spellState = { isTargeting: false, sourceCard: null, targetType: null };
let tributeState = { isActive: false, pendingCard: null, requiredTributes: 0, currentTributes: [], actionType: null };
let activeTurnBuffs = [];

// Utility: Generate unique ID
function generateUID() {
    return 'card-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

// Helper: Determine who currently controls a card
// "Controller" is based on which zone the card is currently in.
// Helper: Determine who currently controls a card
// "Controller" is based on which zone the card is currently in.
function getOwner(card) {
    if (card.closest('.player-zone')) return 'player';
    if (card.closest('#playerHand')) return 'player';
    if (card.closest('.opp-zone')) return 'opponent';
    if (card.closest('.opponent-hand-container')) return 'opponent';
    return 'opponent'; // Default/Fallback
}

function getController(card) {
    return getOwner(card);
}

function getOpponent(controller) {
    return controller === 'player' ? 'opponent' : 'player';
}

// --- UPDATED: Send Card to Graveyard (Handles Ownership & Equip Revert) ---
function sendToGraveyard(cardEl, owner) {
    if (!cardEl) return;
    if (cardEl.hasAttribute('data-dying')) return; // Recursion Protection
    cardEl.setAttribute('data-dying', 'true');

    const uid = cardEl.getAttribute('data-uid');

    // 1. GENERIC CLEANUP (Effects applied BY this card)
    // If this card targets another ("Equips", "Continuous Targets"), revert changes.
    // Standard Attribute: data-affects-target-uid
    // Legacy mapping: data-equip-target-uid -> data-affects-target-uid (Handled via dual check)
    const targetUid = cardEl.getAttribute('data-affects-target-uid') || cardEl.getAttribute('data-equip-target-uid');

    if (targetUid) {
        const targetMonster = document.querySelector(`.card[data-uid="${targetUid}"]`);
        if (targetMonster) {
            // Revert ATK/DEF Buffs
            if (cardEl.hasAttribute('data-buff-val-atk')) {
                const buffAtk = parseInt(cardEl.getAttribute('data-buff-val-atk'));
                const buffDef = parseInt(cardEl.getAttribute('data-buff-val-def'));
                log(`Effect removed: Reverting ${buffAtk} ATK from ${targetMonster.getAttribute('data-name')}`);
                modifyStats(targetMonster, -buffAtk, -buffDef);
            }

            // Remove Attack/Position Locks (Generic)
            if (targetMonster.getAttribute('data-disable-attack') === 'true' && targetMonster.getAttribute('data-source-bind-uid') === uid) {
                targetMonster.removeAttribute('data-disable-attack');
                targetMonster.removeAttribute('data-source-bind-uid');
                log("Battle Restriction Lifted.");
            }
            if (targetMonster.getAttribute('data-disable-pos-change') === 'true' && targetMonster.getAttribute('data-source-bind-uid') === uid) {
                targetMonster.removeAttribute('data-disable-pos-change');
            }
        }
    }

    // 2. KILL LINK (Call of the Haunted Logic: "When this card leaves... destroy that target")
    const killLinkUid = cardEl.getAttribute('data-kill-link');
    if (killLinkUid) {
        const linkedCard = document.querySelector(`.card[data-uid="${killLinkUid}"]`);
        if (linkedCard) {
            log(`${cardEl.getAttribute('data-name')} removed. Destroying linked card.`);
            sendToGraveyard(linkedCard, getOwner(linkedCard));
        }
    }

    // 3. REVERSE DEPENDENCY CHECK (Global Scan)
    // Find any card that says "data-die-with-link = THIS UID"
    // (Equips, CotH Reverse, Spellbinding Circle Reverse)
    if (uid) {
        const fieldCards = document.querySelectorAll('.card');
        fieldCards.forEach(c => {
            const dependencyUid = c.getAttribute('data-die-with-link');
            // Legacy Equip check: data-equip-target-uid (Equips die if monster dies) -> mapped to logic
            const equipTarget = c.getAttribute('data-equip-target-uid');

            if (dependencyUid === uid || equipTarget === uid) {
                const followerOwner = getOwner(c);
                log(`${c.getAttribute('data-name')} destroyed because linked card was removed.`);
                sendToGraveyard(c, followerOwner);
            }
        });
    }

    // 3. DETERMINE CORRECT GRAVEYARD (Ownership Logic)
    let finalDest = 'opponent'; // Default

    // PRIORITY 1: Explicit Owner passed (e.g. from ChainManager pending queue)
    if (owner === 'player') {
        finalDest = 'player';
    } else if (owner === 'opponent') {
        finalDest = 'opponent';
    } else {
        // PRIORITY 2: Data Attribute (Original Owner)
        const ownerAttr = cardEl.getAttribute('data-owner');
        if (ownerAttr === 'player') {
            finalDest = 'player';
        } else if (ownerAttr === 'opponent') {
            finalDest = 'opponent';
        } else {
            // PRIORITY 3: Controller (Fallback)
            if (getController(cardEl) === 'player') {
                finalDest = 'player';
            }
        }
    }

    // 4. CAPTURE DATA & REMOVE
    const orgAtk = cardEl.getAttribute('data-original-atk') || cardEl.getAttribute('data-atk');
    const orgDef = cardEl.getAttribute('data-original-def') || cardEl.getAttribute('data-def');

    const cardData = {
        name: cardEl.getAttribute('data-name'),
        type: cardEl.getAttribute('data-type'),
        atk: orgAtk,
        def: orgDef,
        desc: cardEl.getAttribute('data-desc'),
        img: cardEl.getAttribute('data-img'),
        category: cardEl.getAttribute('data-card-category'),
        level: cardEl.getAttribute('data-level'),
        attribute: cardEl.getAttribute('data-attribute'),
        race: cardEl.getAttribute('data-race')
    };

    // --- GRAVEYARD TRIGGERS ---
    // Note: Triggers happen even if destroyed face-down (for Black Pendant provided rules)
    const gyTriggerName = cardEl.getAttribute('data-name');

    // 1. Black Pendant (Mandatory)
    if (gyTriggerName === 'Black Pendant') {
        log("Black Pendant activates: 500 Damage!");
        updateLP(500, finalDest === 'player' ? 'opponent' : 'player');
    }

    // 2. Axe of Despair / Malevolent Nuzzler (Optional - Player Only for Check)
    // Runs async to allow GY UI to update first
    if (finalDest === 'player' && (gyTriggerName === 'Axe of Despair' || gyTriggerName === 'Malevolent Nuzzler')) {
        setTimeout(() => {
            // Check LP Cost availability
            if (gyTriggerName === 'Malevolent Nuzzler' && gameState.players.player.lp <= 500) {
                log("Malevolent Nuzzler sent to GY. Insufficient LP to pay cost.");
                return;
            }

            // Custom Confirm Modal Logic
            let msg = `Activate ${gyTriggerName} effect? Pay 500 LP to place on top of Deck?`;
            let isAxe = false;

            if (gyTriggerName === 'Axe of Despair') {
                msg = `Activate ${gyTriggerName} effect? Tribute 1 Monster to place on top of Deck?`;
                isAxe = true;

                // Check if Player has monsters to tribute
                const monsters = document.querySelectorAll('.player-zone.monster-zone .card');
                if (monsters.length === 0) {
                    log("Axe of Despair sent to GY. No monsters to tribute.");
                    return;
                }
            }

            // Helper to reuse Return Logic
            const returnToDeck = (name) => {
                let index = -1;
                for (let i = playerGYData.length - 1; i >= 0; i--) {
                    if (playerGYData[i].name === name) {
                        index = i;
                        break;
                    }
                }
                if (index > -1) {
                    const recycled = playerGYData.splice(index, 1)[0];
                    playerDeckData.push(recycled);
                    updateCounters();
                    const topCardImg = playerGYData.length > 0 ? playerGYData[playerGYData.length - 1].img : '';
                    updateGYVisual('playerGY', topCardImg);
                    log(`${name} returned to top of Deck.`);
                } else {
                    log(`Error: Could not find ${name} in Graveyard.`);
                }
            };

            showConfirmModal(msg).then(confirmed => {
                if (confirmed) {
                    if (isAxe) {
                        // AXE: Tribute -> Return
                        // We use initiateTribute with a callback
                        initiateTribute(null, 1, 'effect-cost', () => {
                            returnToDeck(gyTriggerName);
                        });
                    } else {
                        // NUZZLER: Pay LP -> Return
                        updateLP(500, 'player');
                        log("Paid 500 LP for Malevolent Nuzzler.");
                        returnToDeck(gyTriggerName);
                    }
                } else {
                    log(`${gyTriggerName} effect cancelled.`);
                }
            });
        }, 600);
    }

    if (finalDest === 'player') {
        playerGYData.push(cardData);
        updateGYVisual('playerGY', cardData.img);
    } else {
        oppGYData.push(cardData);
        updateGYVisual('oppGY', cardData.img);
    }

    cardEl.remove();
    updateCounters();
}

function updateGYVisual(elementId, imgUrl) {
    const gyZone = document.getElementById(elementId);
    const oldCard = gyZone.querySelector('.card');
    if (oldCard) oldCard.remove();
    const topCard = document.createElement('div');
    topCard.className = 'card face-up';
    topCard.style.backgroundImage = `url('${imgUrl}')`;
    topCard.style.width = '100%'; topCard.style.height = '100%'; topCard.style.border = 'none';
    gyZone.prepend(topCard);
}

const ChainManager = {
    stack: [],
    pendingGraveyardQueue: [],
    isResolving: false,

    addLink: function (card, effectFn, player) {
        const id = this.stack.length + 1;
        this.stack.push({
            id: id,
            card: card,
            effect: effectFn,
            player: player
        });

        // Visual Badge
        const badge = document.createElement('div');
        badge.className = 'chain-badge';
        badge.textContent = id;
        card.appendChild(badge);

        log(`Chain Link ${id}: ${card.getAttribute('data-name')} activated.`);

        // After adding link, check for response from the OTHER player
        // If Opponent added, Player gets to respond.
        // Use Helpers for Logic consistency
        // const nextResponder = (player === 'player') ? 'opponent' : 'player';
        const nextResponder = getOpponent(player);
        this.promptResponse(nextResponder);
    },

    promptResponse: function (responder) {
        if (this.isResolving) return;

        // Check for available Fast Effects (Traps/Quick-Plays) for the responder
        const candidates = this.findCandidates(responder);

        if (candidates.length > 0) {
            // AI HANDLER
            if (responder === 'opponent') {
                log("AI checking for chain response...");
                setTimeout(() => {
                    const chosen = this.aiCheckChain(candidates);
                    if (chosen) {
                        log(`AI chains ${chosen.name}!`);
                        // Activate it
                        // executeOpponentPlay uses 'activate' but that sets it to field.
                        // Here we are likely activating ALREADY SET card.
                        // So we just call activateSetCard logic or similar.
                        // check activateSetCard() implementation to reuse.
                        // Or just simulate click.
                        activateSetCard(chosen.el, false); // false = not chain link 1 necessarily, handled by addToChain
                    } else {
                        // AI passes
                        log("AI passes chain.");
                        this.resolve();
                    }
                }, 1000);
                return;
            }

            // PLAYER HANDLER
            // FIX: Do NOT overwrite pendingOpponentAction (which stores the Phase Resume callback)
            // Instead, use the specific cancel callback for this modal prompt
            window._currentCancelCallback = () => this.resolve();

            openActivationModal(responder, candidates, () => {
                // On Cancel:
                this.resolve();
            });
        } else {
            // No responses available, proceed to resolve
            setTimeout(() => this.resolve(), 500);
        }
    },

    // AI Decision Logic for Phase Response (Traps/Quick-Plays)
    // These functions are defined in ai.js but called from here
    aiSelectBestResponse: function (candidates) {
        return aiSelectBestResponse(candidates);
    },

    aiCheckChain: function (candidates) {
        return aiCheckChain(candidates);
    },

    findCandidates: function (player) {
        const zoneSelector = (player === 'player') ? '.player-zone' : '.opp-zone';
        const handSelector = (player === 'player') ? '#playerHand .hand-card' : '.opponent-hand-container .opponent-hand-card';

        // Check Hand (Quick-Plays allowed from hand if Turn Player)
        // Check Field (Set Cards)
        const sources = [
            ...document.querySelectorAll(`${zoneSelector}.spell-trap-zone .card.face-down`),
            ...document.querySelectorAll(handSelector)
        ];

        const validCards = [];

        sources.forEach(c => {
            // "isChainLink1" is FALSE because we are finding COMPATIBLE responses to a chain
            // Wait, if chain stack is 0, it IS ChainLink 1? 
            // "promptResponse" is called AFTER addLink, so stack is > 0.
            // So isChainLink1 = false.
            if (validateActivation(c, false)) {
                validCards.push({ el: c, name: c.getAttribute('data-name'), img: c.getAttribute('data-img'), source: 'field' });
            }
        });

        return validCards;
    },

    resolve: function () {
        if (this.stack.length === 0) {
            log("Chain Resolved.");
            this.isResolving = false;

            // --- NEW: Process Pending Graveyard Queue ---
            if (this.pendingGraveyardQueue && this.pendingGraveyardQueue.length > 0) {
                log(`Processing Pending GY Queue: ${this.pendingGraveyardQueue.length} cards.`);
                this.pendingGraveyardQueue.forEach(item => {
                    sendToGraveyard(item.card, item.owner);
                });
                this.pendingGraveyardQueue = [];
            }
            // --------------------------------------------

            // Clean up global state and resume pending actions
            if (gameState.pendingOpponentAction) {
                resumeOpponentTurn();
            }
            return;
        }

        this.isResolving = true;

        // LIFO -> Pop last added
        const link = this.stack.pop();
        log(`Resolving Chain Link ${link.id}...`);

        const card = link.card;
        card.classList.add('resolving');

        // Highlight logic
        card.style.boxShadow = "0 0 20px #ffcc00";

        // EXECUTE EFFECT (Capture return value)
        let result = true;
        if (link.effect) {
            result = link.effect();
        }

        // If returned false, PAUSE resolution
        if (result === false) {
            log("Chain Link paused for selection...");
            this.isPaused = true;
            return;
        }

        // --- NEW: Add to Pending Queue ---
        const typeStr = card.getAttribute('data-type') || "";
        const raceStr = card.getAttribute('data-race') || "";
        const isEquip = raceStr === 'Equip' || typeStr.includes('Equip');
        const isCont = raceStr === 'Continuous' || typeStr.includes('Continuous');
        const isField = raceStr === 'Field' || typeStr.includes('Field');

        if (result === true && !isEquip && !isCont && !isField) {
            const owner = getOwner(card);
            // Ensure queue exists
            if (!this.pendingGraveyardQueue) this.pendingGraveyardQueue = [];

            this.pendingGraveyardQueue.push({ card: card, owner: owner });
        }
        // ---------------------------------

        // Otherwise continue after delay
        setTimeout(() => {
            card.classList.remove('resolving');
            card.style.boxShadow = "";

            const badge = card.querySelector('.chain-badge');
            if (badge) badge.remove();

            // Next Link
            this.resolve();
        }, 1200);
    },

    // NEW: Resume after targeting
    continueResolution: function () {
        if (!this.isResolving) return;

        // Find the currently resolving card (visual cleanup)
        const resolvingCard = document.querySelector('.card.resolving');
        if (resolvingCard) {
            resolvingCard.classList.remove('resolving');
            resolvingCard.style.boxShadow = "";
            const badge = resolvingCard.querySelector('.chain-badge');
            if (badge) badge.remove();

            // Note: The specific effect function is responsible for sending to GY usually.
            // But if it was a paused spell (e.g. Reinforcements), it might need cleanup?
            // The effect wrapper in activateSetCard does "setTimeout -> sendToGraveyard" if finished=true.
            // For targeting spells, we returned false initially. 
            // So we need to handle "finishing" it here or in resolveSpellTarget.
            // Let's assume resolveSpellTarget logic handles the "sendToGraveyard" part for the specific card.
        }

        this.isPaused = false;
        // Resume next link
        setTimeout(() => this.resolve(), 500);
    },

    // NEW: Check if Player wants to activate something at start of Phase/Step
    checkPhaseResponse: function (player, onContinue) {
        log(`Checking Phase Response for ${player} in ${currentPhase}...`);
        // If checking for Player, we look for Player's cards
        const candidates = this.findCandidates(player);
        log(`Candidates found: ${candidates.length}`);

        if (candidates.length > 0) {
            // If checking for OPPONENT and they're AI, let AI decide automatically
            if (player === 'opponent') {
                log("AI Opponent has candidates. AI will decide whether to activate...");
                gameState.pendingOpponentAction = onContinue;

                // AI Decision Logic
                const bestChoice = this.aiSelectBestResponse(candidates);

                if (bestChoice) {
                    log(`AI decided to activate: ${bestChoice.name}`);
                    setTimeout(() => {
                        // Activate the chosen card
                        const cardEl = bestChoice.el;
                        const isFromHand = cardEl.classList.contains('hand-card') || cardEl.classList.contains('opponent-hand-card');

                        if (isFromHand) {
                            // For Quick-Play from hand, would need to place on field
                            // For now, AI doesn't activate from hand during player turn
                            log("AI chose not to activate (hand cards not implemented for AI).");
                            resumeOpponentTurn();
                        } else {
                            // Activate set card
                            activateSetCard(cardEl, true);
                        }
                    }, 800);
                } else {
                    log("AI chose not to activate.");
                    setTimeout(() => {
                        resumeOpponentTurn();
                    }, 500);
                }
                return;
            }

            // Player's cards - show UI
            log("Opening Phase Response Modal...");
            gameState.pendingOpponentAction = onContinue;

            // Re-use modal but slightly different context text
            const modal = document.getElementById('activationModal');
            const list = document.getElementById('activationList');
            const text = document.getElementById('activationText');

            text.textContent = `End of ${currentPhase}. Activate a card?`;
            list.innerHTML = '';
            selectedChainCard = null;

            candidates.forEach(cand => {
                const el = document.createElement('div');
                el.className = 'chain-card-item';
                el.style.backgroundImage = `url('${cand.img}')`;
                el.onclick = function (e) {
                    e.stopPropagation();
                    document.querySelectorAll('.chain-card-item').forEach(c => c.classList.remove('selected'));
                    el.classList.add('selected');
                    selectedChainCard = cand;
                };
                list.appendChild(el);
            });

            // On Cancel: Just resume
            window._currentCancelCallback = () => {
                log("Phase Response Cancelled. Resuming...");
                resumeOpponentTurn();
            };

            modal.classList.add('active');
        } else {
            // No candidates, proceed
            setTimeout(onContinue, 500);
        }
    }
};

// --- HELPER: Activation Modal ---
function openActivationModal(player, candidates, onCancel) {
    const modal = document.getElementById('activationModal');
    const list = document.getElementById('activationList');
    const text = document.getElementById('activationText');

    text.textContent = `${player === 'player' ? 'You' : 'Opponent'} - Chain a card?`;
    list.innerHTML = '';
    selectedChainCard = null;

    candidates.forEach(cand => {
        const el = document.createElement('div');
        el.className = 'chain-card-item';
        el.style.backgroundImage = `url('${cand.img}')`;
        el.onclick = function (e) {
            e.stopPropagation();
            document.querySelectorAll('.chain-card-item').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            selectedChainCard = cand;
        };
        list.appendChild(el);
    });

    // Store Cancel Callback on the modal temporarily or use global
    // We'll hijack the existing cancelActivation function
    window._currentCancelCallback = onCancel;

    modal.classList.add('active');
}

// Replaces addToChain
function addToChain(card, effectFn, player) {
    ChainManager.addLink(card, effectFn, player);
}

// =========================================
// 2. SPELL & EFFECT SYSTEM (FACTORIES)
// =========================================

// Fix Ownership Check in Factories
// (Usually getOwner is generic, but let's check ModifyLP)

function modifyStats(card, atkMod, defMod) {
    let currentAtk = parseInt(card.getAttribute('data-atk'));
    let currentDef = parseInt(card.getAttribute('data-def'));
    currentAtk += atkMod;
    currentDef += defMod;
    card.setAttribute('data-atk', currentAtk);
    card.setAttribute('data-def', currentDef);

    let statsBar = card.querySelector('.stats-bar');
    if (!statsBar) {
        // Auto-create if missing (Robustness)
        statsBar = document.createElement('div');
        statsBar.className = 'stats-bar';
        statsBar.innerHTML = `<span class="stat-val stat-atk">${currentAtk}</span><span class="stat-val stat-def">${currentDef}</span>`;
        card.appendChild(statsBar);
    } else {
        statsBar.querySelector('.stat-atk').textContent = currentAtk;
        statsBar.querySelector('.stat-def').textContent = currentDef;
    }
}

// EFFECT FACTORY: Shortcut generator for common effects
const EffectFactory = {
    draw: function (count) {
        return function (card) {
            const owner = getOwner(card);
            log(`${owner === 'player' ? 'You' : 'Opponent'} draws ${count} card(s)!`);
            for (let i = 0; i < count; i++) {
                if (owner === 'player') drawCard();
                else drawOpponentCard();
            }
            return true;
        };
    },
    modifyLP: function (val) {
        return function (card) {
            const owner = getOwner(card);
            if (val > 0) {
                log(`${owner === 'player' ? 'You' : 'Opponent'} recovers ${val} LP!`);
                updateLP(-val, owner);
            } else {
                const victim = owner === 'player' ? 'opponent' : 'player';
                log(`${victim} takes ${Math.abs(val)} damage!`);
                updateLP(Math.abs(val), victim);
            }
            return true;
        };
    },
    // UPDATED: Buff Factory now saves the boost amount on the card
    buff: function (atk, def) {
        return function (card) {
            log(`Select a monster to buff (${atk > 0 ? '+' + atk : atk}/${def > 0 ? '+' + def : def}).`);
            spellState.isTargeting = true;
            spellState.sourceCard = card;
            spellState.targetType = 'monster';
            spellState.reqFaceUp = true; // FIX: Buffs require face-up targets

            // Store specific stats for the resolver
            card.setAttribute('data-effect-atk', atk);
            card.setAttribute('data-effect-def', def);

            // STORE PERSISTENTLY FOR CLEANUP (MST Fix)
            card.setAttribute('data-buff-val-atk', atk);
            card.setAttribute('data-buff-val-def', def);

            highlightTargets('monster');
            return false; // Wait for target
        };
    }
};

// --- HELPER: MONSTER REBORN LOGIC ---
function reviveMonster(targetData, newController) {
    // 1. Remove from source Graveyard array
    if (targetData.sourceGY === 'player') {
        const index = playerGYData.findIndex(c => c.name === targetData.name && c.img === targetData.img);
        if (index > -1) playerGYData.splice(index, 1);
    } else {
        const index = oppGYData.findIndex(c => c.name === targetData.name && c.img === targetData.img);
        if (index > -1) oppGYData.splice(index, 1);
    }
    updateCounters();

    // 2. Find Zone
    let targetZone = null;
    if (newController === 'player') {
        const zones = ['p-m1', 'p-m2', 'p-m3'];
        for (let id of zones) { if (document.getElementById(id).children.length === 0) { targetZone = document.getElementById(id); break; } }
    } else {
        const zones = document.querySelectorAll('.opp-zone.monster-zone');
        for (let z of zones) { if (z.children.length === 0) { targetZone = z; break; } }
    }

    if (!targetZone) { alert("Field full! Monster lost."); return null; }

    // 3. Create Card Element
    const newCard = document.createElement('div');
    newCard.className = 'card face-up pos-atk';
    newCard.style.backgroundImage = `url('${targetData.img}')`;
    newCard.setAttribute('data-uid', generateUID());
    newCard.setAttribute('data-name', targetData.name);

    // --- THIS WAS MISSING ---
    newCard.setAttribute('data-img', targetData.img);
    if (targetData.category === 'monster') {
        newCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${targetData.atk}</span><span class="stat-val stat-def">${targetData.def}</span></div>`;
    }
    // ------------------------

    newCard.setAttribute('data-atk', targetData.atk);
    newCard.setAttribute('data-def', targetData.def);
    newCard.setAttribute('data-original-atk', targetData.atk);
    newCard.setAttribute('data-original-def', targetData.def);
    newCard.setAttribute('data-card-category', 'monster');
    newCard.setAttribute('data-type', targetData.type);
    newCard.setAttribute('data-level', targetData.level);
    newCard.setAttribute('data-attribute', targetData.attribute);
    newCard.setAttribute('data-race', targetData.race);

    // CRITICAL: Set original owner so it returns correctly
    newCard.setAttribute('data-original-owner', targetData.sourceGY);
    newCard.setAttribute('data-owner', targetData.sourceGY); // Ensure sendToGraveyard respects this

    newCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${targetData.atk}</span><span class="stat-val stat-def">${targetData.def}</span></div>`;

    targetZone.appendChild(newCard);
    log(`Revived ${targetData.name} from ${targetData.sourceGY === 'player' ? 'Your' : 'Opponent'} Graveyard!`);
    return newCard;
}

const cardEffects = {
    'Pot of Greed': EffectFactory.draw(2),
    'Graceful Charity': EffectFactory.draw(3),
    'Axe of Despair': EffectFactory.buff(1000, 0),
    'Malevolent Nuzzler': EffectFactory.buff(700, 0),
    'Black Pendant': EffectFactory.buff(500, 0),
    'Rush Recklessly': EffectFactory.buff(700, 0),
    'Dian Keto the Cure Master': EffectFactory.modifyLP(1000),
    'Ookazi': EffectFactory.modifyLP(-800),
    'Hinotama': EffectFactory.modifyLP(-500),

    // --- NEW TRAPS ---
    'Reinforcements': EffectFactory.buff(500, 0), // "Target 1 face-up monster ... gains 500 ATK"
    'Just Desserts': function (card) {
        const owner = getOwner(card);
        // "Inflict 500 damage to your opponent for each monster they control."
        // If 'player' activates it, count 'opponent' monsters.
        const targetZone = owner === 'player' ? '.opp-zone.monster-zone .card' : '.player-zone.monster-zone .card';
        const count = document.querySelectorAll(targetZone).length;
        if (count === 0) {
            log("Just Desserts: No monsters to count. 0 Damage.");
            return true;
        }
        const damage = count * 500;
        const victim = owner === 'player' ? 'opponent' : 'player';
        log(`Just Desserts: ${count} monster(s) found. Inflicting ${damage} damage to ${victim}!`);
        updateLP(damage, victim);
        return true;
    },

    // --- UPDATED MONSTER REBORN ---
    'Monster Reborn': function (card) {
        const owner = getOwner(card);

        // Collect Targets from BOTH graveyards
        const pTargets = playerGYData
            .filter(c => c.category === 'monster')
            .map((c, i) => ({ ...c, sourceGY: 'player' }));

        const oTargets = oppGYData
            .filter(c => c.category === 'monster')
            .map((c, i) => ({ ...c, sourceGY: 'opponent' }));

        const allTargets = [...pTargets, ...oTargets];

        if (allTargets.length === 0) {
            alert("No monsters in either Graveyard!");
            return true; // Use up card
        }
        // Open Modal
        const listModal = document.getElementById('listModal');
        const listGrid = document.getElementById('listGrid');
        const listTitle = document.getElementById('listTitle');

        listTitle.textContent = "Select a Monster to Revive";
        listGrid.innerHTML = '';

        allTargets.forEach(target => {
            const el = document.createElement('div');
            el.className = 'list-card';
            el.style.backgroundImage = `url('${target.img}')`;
            // Blue border for yours, Red for theirs
            el.style.border = target.sourceGY === 'player' ? '2px solid #00d4ff' : '2px solid #ff3333';

            el.onclick = function (e) {
                e.stopPropagation();
                reviveMonster(target, owner);
                listModal.classList.remove('active');

                // Manually remove the spell card now that selection is done
                sendToGraveyard(card, owner);

                // FIX: Resume Chain or Game Flow
                if (ChainManager.isResolving) {
                    ChainManager.continueResolution();
                } else {
                    if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
                }
            };
            listGrid.appendChild(el);
        });

        listModal.classList.add('active');
        return false; // Pause standard cleanup (handled in onclick)
    },

    'Raigeki': (function () {
        const fn = function (card) {
            const owner = getOwner(card);
            const victim = (owner === 'player') ? 'opponent' : 'player';
            log(`Effect: Destroy all ${victim} monsters!`);
            const targetZone = (victim === 'player') ? '.player-zone' : '.opp-zone';
            const targets = document.querySelectorAll(`${targetZone}.monster-zone .card`);
            let destroyedCount = 0;
            targets.forEach(c => {
                c.style.transition = 'all 0.5s'; c.style.transform = 'scale(0) rotate(360deg)'; c.style.opacity = '0';
                setTimeout(() => { sendToGraveyard(c, victim); }, 500);
                destroyedCount++;
            });
            if (destroyedCount === 0) log("Effect: No monsters to destroy.");
            return true;
        };
        // Condition: Opponent must have monsters
        fn.condition = function (card) {
            const owner = getOwner(card);
            const targetZone = (owner === 'player') ? '.opp-zone' : '.player-zone';
            const count = document.querySelectorAll(`${targetZone}.monster-zone .card`).length;
            if (count === 0) { alert("Raigeki: No monsters to destroy."); return false; }
            return true;
        };
        return fn;
    })(),

    'Mystical Space Typhoon': (function () {
        const fn = function (card) {
            log("Select a Spell/Trap to destroy.");
            spellState.isTargeting = true; spellState.sourceCard = card; spellState.targetType = 'spell';
            spellState.reqFaceUp = false; // FIX: Explicitly allow Face-Down
            highlightTargets('spell'); return false;
        };
        fn.condition = function (card) {
            // Rule: Must be cards on field (excluding self?)
            // Simple check: S/T count > 0 (excluding self if possible, but imprecise here is OK for basic check)
            const total = document.querySelectorAll('.spell-trap-zone .card').length;
            // If I am activating from S/T zone, I am 1. So if total <= 1 (just me), I cannot activate?
            // If from hand, total is field count.
            // Let's rely on basic "Are there targets?"
            // A better check would filter out 'card' itself.
            // But 'card' element might be in Hand or Zone.
            // If in Zone, it is counted.
            if (total === 0) { alert("MST: No targets."); return false; }
            return true;
        };
        return fn;
    })(),

    // --- CONTINUOUS TRAPS ---
    'Call of the Haunted': function (card) {
        const owner = getOwner(card);
        const gyData = owner === 'player' ? playerGYData : oppGYData; // Simplification: CotH only targets YOUR GY usually

        // Filter monsters and MAP sourceGY (Fixes duplication bug)
        const targets = gyData
            .filter(c => c.category === 'monster')
            .map(c => ({ ...c, sourceGY: owner }));

        if (targets.length === 0) {
            log("No monsters in Graveyard to target.");
            return true; // Resolve without effect
        }

        // Setup Selection Modal (Similar to Monster Reborn but sets dependencies)
        if (owner === 'player') {
            // Open Modal
            const listModal = document.getElementById('listModal');
            const listGrid = document.getElementById('listGrid');
            const listTitle = document.getElementById('listTitle');

            listTitle.textContent = "Select a Monster to Revive";
            listGrid.innerHTML = '';

            targets.forEach(target => {
                const el = document.createElement('div');
                el.className = 'list-card';
                el.style.backgroundImage = `url('${target.img}')`;
                el.onclick = function (e) {
                    e.stopPropagation();

                    // 1. Revive
                    const bornCard = reviveMonster(target, owner);

                    // 2. Set Dependencies if successful
                    if (bornCard) {
                        const monUid = bornCard.getAttribute('data-uid');
                        const trapUid = card.getAttribute('data-uid');

                        // SET DEPENDENCIES
                        // 1. "When this card leaves... destroy that monster"
                        card.setAttribute('data-kill-link', monUid);

                        // 2. "When that monster is destroyed, destroy this card"
                        // This means: If Monster (monUid) dies, I (Trap) die.
                        card.setAttribute('data-die-with-link', monUid); // FIXED: Trap has the dependency

                        // Visual link
                        log(`Linked ${bornCard.getAttribute('data-name')} to Call of the Haunted.`);
                    }

                    listModal.classList.remove('active');

                    // Resume Chain
                    if (ChainManager.isResolving) {
                        ChainManager.continueResolution();
                    } else {
                        if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
                    }
                };
                listGrid.appendChild(el);
            });
            listModal.classList.add('active');
            return false; // Pause
        } else {
            // AI Logic: Just pick first strong monster
            targets.sort((a, b) => b.atk - a.atk);
            const choice = targets[0];
            reviveMonster(choice, 'opponent');
            // ... need to find AI's new card to link it ...
            // implementation skipped for simplified AI
            return true;
        }
    },

    'Spellbinding Circle': function (card) {
        log("Select a monster to bind.");
        spellState.isTargeting = true;
        spellState.sourceCard = card;
        spellState.targetType = 'monster';
        spellState.reqFaceUp = false; // FIX: Allows Face-Down
        highlightTargets('monster');
        return false; // Pause for target
    },

    // --- CONTINUOUS SPELLS ---
    'Banner of Courage': {
        type: 'Continuous',
        apply: function (card, currentPhase, activePlayer) {
            const owner = getOwner(card);
            if (currentPhase === 'BP' && activePlayer === owner) {
                const selector = owner === 'player' ? '.player-zone.monster-zone .card' : '.opp-zone.monster-zone .card';
                document.querySelectorAll(selector).forEach(m => {
                    if (!m.hasAttribute('data-buff-banner')) {
                        modifyStats(m, 200, 0);
                        m.setAttribute('data-buff-banner', 'true');
                    }
                });
            } else {
                const selector = owner === 'player' ? '.player-zone.monster-zone .card' : '.opp-zone.monster-zone .card';
                document.querySelectorAll(selector).forEach(m => {
                    if (m.hasAttribute('data-buff-banner')) {
                        modifyStats(m, -200, 0);
                        m.removeAttribute('data-buff-banner');
                    }
                });
            }
        }
    },
    'Burning Land': {
        type: 'Continuous',
        apply: function (card) { /* Logic handled in Standby Phase trigger */ }
    }
};

function executeSpellTargetLogic(target) {
    const source = spellState.sourceCard;
    if (!source) return;

    const effectName = source.getAttribute('data-name');
    if (target === source) { alert("Cannot target itself!"); return; }

    spellState.isTargeting = false; spellState.sourceCard = null; clearHighlights();
    log(`Target selected: ${target.getAttribute('data-name')}`);

    // 1. GENERIC FACTORY BUFF CHECK
    if (source.hasAttribute('data-effect-atk')) {
        const atk = parseInt(source.getAttribute('data-effect-atk'));
        const def = parseInt(source.getAttribute('data-effect-def'));
        modifyStats(target, atk, def);

        const isEquip = source.getAttribute('data-race') === 'Equip';
        if (isEquip) {
            source.setAttribute('data-equip-target-uid', target.getAttribute('data-uid'));
            log(`${target.getAttribute('data-name')} equipped with ${effectName}!`);

            // FIX: Resume Chain
            if (ChainManager.isResolving) {
                ChainManager.continueResolution();
            } else {
                if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
            }
        } else {
            // Temporary Buff (Rush Recklessly)
            activeTurnBuffs.push({ uid: target.getAttribute('data-uid'), atkMod: atk, defMod: def });
            log(`${target.getAttribute('data-name')} gains ${atk} ATK temporarily!`);

            const spellOwner = getOwner(source);
            setTimeout(() => {
                sendToGraveyard(source, spellOwner);
                // IF WE ARE IN A CHAIN -> RESUME IT
                if (ChainManager.isResolving) {
                    ChainManager.continueResolution();
                } else {
                    if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
                }
            }, 500);
        }
        return;
    }

    // 2. SPECIFIC COMPLEX CARDS
    if (effectName === 'Mystical Space Typhoon') {
        log(`${target.getAttribute('data-name')} destroyed!`);
        const targetOwner = getOwner(target);
        const spellOwner = getOwner(source);
        // Destroy target
        sendToGraveyard(target, targetOwner);
        // Destroy MST itself
        setTimeout(() => {
            sendToGraveyard(source, spellOwner);

            // FIX: Resume Chain if we are in one
            if (ChainManager.isResolving) {
                ChainManager.continueResolution();
            } else {
                if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
            }
        }, 500);
    }

    else if (effectName === 'Spellbinding Circle') {
        const sourceUid = source.getAttribute('data-uid');
        const targetUid = target.getAttribute('data-uid');

        log(`${target.getAttribute('data-name')} is now bound!`);

        // 1. Trap targets Monster (for cleanup if trap dies)
        source.setAttribute('data-affects-target-uid', targetUid);

        // 2. Monster dies if Trap dies? "When that monster is destroyed, destroy this card." -> Reverse dependency
        // So: If Monster dies, destroying this Trap.
        source.setAttribute('data-die-with-link', targetUid);

        // 3. Apply Debuffs
        target.setAttribute('data-disable-attack', 'true');
        target.setAttribute('data-disable-pos-change', 'true');
        target.setAttribute('data-source-bind-uid', sourceUid);

        // Trap stays on field.
        // Resume Chain
        if (ChainManager.isResolving) {
            ChainManager.continueResolution();
        } else {
            if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
        }
    }
}

function highlightTargets(type) {
    let selector = '';
    if (type === 'monster') selector = '.monster-zone .card.face-up';
    else if (type === 'spell') selector = '.spell-trap-zone .card, .field-zone .card';
    const targets = document.querySelectorAll(selector);
    targets.forEach(el => { if (el !== spellState.sourceCard) el.parentElement.classList.add('targetable'); });
}

function clearHighlights() { document.querySelectorAll('.zone').forEach(el => el.classList.remove('targetable')); }

function cancelSpellActivation(card) {
    spellState.isTargeting = false;
    spellState.sourceCard = null;
    spellState.reqFaceUp = false; // FIX: Reset requirement
    clearHighlights();
    log("Activation Cancelled.");

    // Revert Visuals (Flip back down)
    // Assuming card was set (Traps/Set Spells). 
    // If it was played from hand, we might need to return to hand? 
    // For now, let's assume if it's on field, we flip it down.
    if (card && card.parentElement && card.parentElement.classList.contains('spell-trap-zone')) {
        card.classList.remove('face-up');
        card.classList.add('face-down');
        card.style.backgroundImage = 'none'; // CSS handles face-down image usually, or we clear the specific URL
        // Re-cleaning text content if any
        // card.innerHTML = ''; 
    }

    // Resume Opponent Turn if necessary
    if (!isPlayerTurn && gameState.pendingOpponentAction) resumeOpponentTurn();
}

// =========================================
// 3. COUNTERS & LP
// =========================================
function updateCounters() {
    document.getElementById('player-deck-count').textContent = playerDeckData.length;
    document.getElementById('player-gy-count').textContent = playerGYData.length;
    document.getElementById('player-ex-count').textContent = playerExData.length;
    document.getElementById('opp-deck-count').textContent = oppDeckData.length;
    document.getElementById('opp-gy-count').textContent = oppGYData.length;
    document.getElementById('opp-ex-count').textContent = oppExData.length;
}

function updateLP(damage, target) {
    if (target === 'player') gameState.players.player.lp -= damage;
    else gameState.players.opponent.lp -= damage;
    if (gameState.players.player.lp < 0) gameState.players.player.lp = 0;
    if (gameState.players.opponent.lp < 0) gameState.players.opponent.lp = 0;
    document.getElementById('player-lp-val').textContent = gameState.players.player.lp;
    document.getElementById('opp-lp-val').textContent = gameState.players.opponent.lp;
    checkWinCondition();
}

function checkWinCondition() {
    if (gameState.turnInfo.gameOver) return;
    if (gameState.players.player.lp <= 0) endDuel("You Lost! LP reached 0.");
    else if (gameState.players.opponent.lp <= 0) endDuel("You Won! Opponent LP reached 0.");
}

function endDuel(msg) {
    gameState.turnInfo.gameOver = true; alert(msg); log(`GAME OVER: ${msg}`); document.body.style.pointerEvents = 'none';
}

// =========================================
// 4. GAME LOOP & PHASES
// =========================================
// =========================================
// 4. GAME LOOP & PHASES
// =========================================
let currentPhase = 'DP';
let isPlayerTurn = true;
let turnCount = 1;
const phaseOrder = ['DP', 'SP', 'MP1', 'BP', 'MP2', 'EP'];

// Assuming gameState is defined globally or passed around
// Adding pendingOpponentAction to gameState
// gameState definition removed (duplicate)

// --- NEW: RESPONSE / CHAIN SYSTEM ---


// --- REPLACED BY ChainManager ---
function cancelActivation() {
    const modal = document.getElementById('activationModal');
    modal.classList.remove('active');
    selectedChainCard = null;
    if (window._currentCancelCallback) {
        const cb = window._currentCancelCallback;
        window._currentCancelCallback = null;
        cb();
    } else {
        resumeOpponentTurn();
    }
}

function confirmActivation() {
    if (!selectedChainCard) {
        alert("Please select a card to activate.");
        return;
    }
    const modal = document.getElementById('activationModal');
    modal.classList.remove('active');

    const cardEl = selectedChainCard.el;

    // Store the callback before clearing it
    const pendingCallback = window._currentCancelCallback;
    window._currentCancelCallback = null;

    // Check if card is from hand (Quick-Play Spell)
    const isFromHand = cardEl.classList.contains('hand-card');

    if (isFromHand) {
        // Place card on field first, then activate
        const cardData = {
            name: cardEl.getAttribute('data-name'),
            type: cardEl.getAttribute('data-type'),
            desc: cardEl.getAttribute('data-desc'),
            img: cardEl.getAttribute('data-img'),
            category: cardEl.getAttribute('data-card-category'),
            race: cardEl.getAttribute('data-race'),
            subType: cardEl.getAttribute('data-sub-type'),
            speed: cardEl.getAttribute('data-speed')
        };

        // Find empty spell/trap zone
        const zones = ['p-s1', 'p-s2', 'p-s3'];
        let targetZone = null;
        for (let id of zones) {
            if (document.getElementById(id).children.length === 0) {
                targetZone = document.getElementById(id);
                break;
            }
        }

        if (!targetZone) {
            alert("S/T Zones Full!");
            return;
        }

        // Create card on field
        const newCard = document.createElement('div');
        newCard.className = 'card face-up pos-atk';
        newCard.setAttribute('data-turn', turnCount);
        const uid = generateUID();
        newCard.setAttribute('data-uid', uid);

        for (let k in cardData) {
            if (k === 'category') newCard.setAttribute('data-card-category', cardData[k]);
            else if (cardData[k]) newCard.setAttribute('data-' + k, cardData[k]);
        }

        newCard.style.backgroundImage = `url('${cardData.img}')`;
        targetZone.appendChild(newCard);

        // Remove from hand
        cardEl.remove();

        // Now activate the field card
        activateSetCard(newCard, true);
    } else {
        // Card is already set on field
        activateSetCard(cardEl, true);
    }

    selectedChainCard = null;
}

function resumeOpponentTurn() {
    if (gameState.pendingOpponentAction) {
        const cb = gameState.pendingOpponentAction;
        gameState.pendingOpponentAction = null;
        setTimeout(cb, 500);
    }
}
// checkResponseWindow removed (Superseded by ChainManager.promptResponse)
function checkResponseWindow(nextActionCallback) {
    // Legacy stub or remove completely? 
    // We'll leave it empty to prevent crashes if called elsewhere, but we should remove callers.
    if (nextActionCallback) nextActionCallback();
}

window.onload = function () {
    document.querySelectorAll('.card').forEach(c => {
        if (!c.hasAttribute('data-uid')) c.setAttribute('data-uid', generateUID());
        if (!c.hasAttribute('data-original-atk')) {
            c.setAttribute('data-original-atk', c.getAttribute('data-atk'));
            c.setAttribute('data-original-def', c.getAttribute('data-def'));
        }
    });
    updateCounters();
    log("Duel Started");
    startDuelSequence();
};

function startDuelSequence() {
    log("Turn 1: Draw Phase");
    let drawsLeft = 4;
    let interval = setInterval(() => {
        if (drawsLeft > 0) { drawCard(); drawOpponentCard(); drawsLeft--; }
        else { clearInterval(interval); proceedToMainPhase(); }
    }, 600);
}

function runNormalTurn() {
    if (gameState.turnInfo.gameOver) return;
    log(`Turn ${turnCount}: Draw Phase`);
    setPhaseText('DP', "DRAW PHASE");
    if (playerDeckData.length === 0) { endDuel("You Lost! Deck is empty."); return; }
    setTimeout(() => {
        drawCard();
        // Allow Player to respond first (Priority), then Opponent
        ChainManager.checkPhaseResponse('player', () => {
            ChainManager.checkPhaseResponse('opponent', proceedToMainPhase);
        });
    }, 500);
}

function proceedToMainPhase() {
    setTimeout(() => {
        setPhaseText('SP', "STANDBY PHASE"); log("Standby Phase");

        const spells = document.querySelectorAll('.spell-trap-zone .card.face-up');
        spells.forEach(s => {
            if (s.getAttribute('data-name') === 'Burning Land') {
                log("Burning Land: 500 Damage to Turn Player!");
                updateLP(500, 'player'); // Run Normal Turn = Player's Turn
                s.style.boxShadow = "0 0 20px #ff5533"; setTimeout(() => s.style.boxShadow = "", 500);
            }
        });

        // Check for Player Response, then Opponent Response
        ChainManager.checkPhaseResponse('player', () => {
            ChainManager.checkPhaseResponse('opponent', () => {
                setTimeout(() => {
                    setPhaseText('MP1', "MAIN PHASE 1");
                    log("Main Phase 1");
                    currentPhase = 'MP1';
                    updateContinuousEffects();
                }, 500);
            });
        });
    }, 1500);
}

// --- NEW: Centralized Activation Validation ---
// --- NEW: Centralized Activation Validation ---
function validateActivation(card, isChainLink1 = true) {
    if (!card) return false;
    if (ChainManager.isResolving) return false;

    const type = card.getAttribute('data-type') || "";
    const speed = parseInt(card.getAttribute('data-speed') || "1");
    const setTurn = parseInt(card.getAttribute('data-set-turn') || "-1");

    // Ownership Check
    const owner = getOwner(card);
    const isMyTurn = (owner === 'player' && isPlayerTurn) || (owner === 'opponent' && !isPlayerTurn);

    // 0. LOCATION RESTRICTIONS
    const isHand = card.parentElement && card.parentElement.classList.contains('hand-container');
    const isTrap = type.includes('Trap');
    const isQuickPlay = type.includes('Quick-Play');

    // Rule: Traps cannot activate from Hand (unless specifically implied by effect)
    // Rule: Quick-Play Spells can activate from Hand during YOUR turn, but NOT Opponent's turn.
    if (isHand) {
        if (isTrap) {
            return false;
        }
        if (isQuickPlay && !isMyTurn) {
            // log("Failed Quick-Play Hand Rule: Cannot activate QP from Hand on Opponent Turn.");
            return false;
        }

        // Check if there's space in S/T zone to place the card
        const zoneSelector = (owner === 'player') ? '#p-s1, #p-s2, #p-s3' : '.opp-zone.spell-trap-zone';
        const zones = document.querySelectorAll(zoneSelector);
        let hasSpace = false;
        zones.forEach(zone => {
            if (zone.children.length === 0) hasSpace = true;
        });

        if (!hasSpace) {
            return false;
        }

        // Normal Spells from Hand are handled by Phase Rules (Speed 1)
    }

    // 1. SET RESTRICTIONS (Traps & Quick-Plays cannot activate turn they are Set)
    if (setTurn === turnCount) {
        // Technically strict rule: ANY card set cannot be activated same turn, 
        // except Spells (Normal/Equip/Cont/Field) which can be used same turn if Speed 1.
        // But QPs and Traps are Speed 2/3.
        if (speed >= 2) return false;
    }

    // 2. CHAIN LINK RULES
    if (!isChainLink1) {
        // Rule: Spell Speed 1 cannot be CL 2+, EXCEPT for SEGOC (Simultaneous Triggers).
        // Since this engine currently handles sequential responses (Fast Effect Timing),
        // we strictly block Speed 1 here to prevent Normal Spells from chaining.
        if (speed === 1) return false;

        // Check against previous Link
        const stack = ChainManager.stack;
        if (stack.length > 0) {
            const lastLinkCard = stack[stack.length - 1].card;
            const lastSpeed = parseInt(lastLinkCard.getAttribute('data-speed') || "1");
            if (speed < lastSpeed) return false; // Rule: Cannot chain slower speed to higher
        }
    }

    // 3. PHASE RULES (Speed 1 only in Main Phases)
    if (speed === 1) {
        if (!isMyTurn) {
            // log(`Failed Speed 1 Rule: Not My Turn.`);
            return false; // Speed 1 only in own turn
        }
        if (currentPhase !== 'MP1' && currentPhase !== 'MP2') return false;
    }

    // 4. CARD CONDITIONS
    const cardName = card.getAttribute('data-name');

    if (cardEffects[cardName] && typeof cardEffects[cardName].condition === 'function') {
        if (!cardEffects[cardName].condition(card)) {
            return false;
        }
    }

    return true;
}

function switchTurn() {
    if (gameState.turnInfo.gameOver) return;

    // Clear Turn Buffs
    if (activeTurnBuffs.length > 0) {
        log("End Phase: Resetting temporary boosts.");
        activeTurnBuffs.forEach(buff => {
            const card = document.querySelector(`.card[data-uid="${buff.uid}"]`);
            if (card) modifyStats(card, -buff.atkMod, -buff.defMod);
        });
        activeTurnBuffs = [];
    }

    isPlayerTurn = !isPlayerTurn;
    turnCount++; // FIX: Increment turn count on EVERY switch (T1, T2, T3...)

    // Update State
    gameState.turnInfo.activePlayer = isPlayerTurn ? 'player' : 'opponent';
    gameState.turnInfo.turnCount = turnCount;

    // Sync DOM to State to ensure AI sees the new turn state
    syncDOMToGameState();

    document.getElementById('actionMenu').classList.remove('active');
    gameState.turnInfo.normalSummonUsed = false;
    document.querySelectorAll('.card').forEach(c => c.setAttribute('data-attacked', 'false'));
    cancelBattleMode();
    spellState.isTargeting = false; clearHighlights();
    cancelTributeMode();

    updateContinuousEffects();

    if (isPlayerTurn) {
        document.getElementById('phaseText').classList.remove('opponent-turn');
        runNormalTurn();
    } else {
        document.getElementById('phaseText').classList.add('opponent-turn');
        setPhaseText('DP', "DRAW PHASE");
        if (oppDeckData.length === 0) { endDuel("You Won! Opponent Deck is empty."); return; }
        log(`Opponent's Turn (Turn ${turnCount})`);

        // Start Opponent Flow
        setTimeout(oppDrawPhase, 1000);
    }
}


// AI functions have been moved to ai.js


function updateContinuousEffects() {
    const activeSpells = document.querySelectorAll('.spell-trap-zone .card.face-up');
    const activePlayer = isPlayerTurn ? 'player' : 'opponent';

    activeSpells.forEach(card => {
        const name = card.getAttribute('data-name');
        if (cardEffects[name] && cardEffects[name].type === 'Continuous') {
            cardEffects[name].apply(card, currentPhase, activePlayer);
        }
    });
}

function setPhase(phase) {
    const currIdx = phaseOrder.indexOf(currentPhase);
    const targetIdx = phaseOrder.indexOf(phase);

    if (targetIdx <= currIdx && turnCount > 1) return;
    if (currentPhase === 'MP1' && phase === 'MP2') return;
    if (turnCount === 1 && (phase === 'BP' || phase === 'MP2')) { log("Cannot conduct Battle Phase on the first turn."); return; }

    if (currentPhase === 'BP' && phase !== 'BP') {
        updateContinuousEffects(); // Cleanup battle buffs
    }

    // Helper function to execute phase change
    const executePhaseChange = () => {
        currentPhase = phase;
        phaseBtn.textContent = phase;
        let text = "MAIN PHASE 1";
        if (phase === 'BP') text = "BATTLE PHASE";
        if (phase === 'MP2') text = "MAIN PHASE 2";
        if (phase === 'EP') text = "END PHASE";
        phaseText.textContent = text;
        phaseMenu.classList.remove('active');
        log(`Phase: ${text}`);

        if (phase !== 'BP') cancelBattleMode();
        updateContinuousEffects();

        // If entering End Phase, check for responses before ending turn
        if (phase === 'EP') {
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', () => {
                    ChainManager.checkPhaseResponse('opponent', switchTurn);
                });
            }, 1000);
        }
    };

    // Add response checks before entering new phases (except from EP which already has it)
    if (currentPhase !== 'EP') {
        // Check for responses at end of current phase before moving to next
        ChainManager.checkPhaseResponse('player', () => {
            ChainManager.checkPhaseResponse('opponent', executePhaseChange);
        });
    } else {
        executePhaseChange();
    }
}

function setPhaseText(short, long) { currentPhase = short; phaseBtn.textContent = short; phaseText.textContent = long; }

// --- DRAW LOGIC ---
function drawCard() {
    if (gameState.turnInfo.gameOver) return;
    if (playerDeckData.length > 0) {
        const card = playerDeckData.pop(); playerHandData.push(card); updateCounters();
        const rect = document.getElementById('playerDeck').getBoundingClientRect();
        const animCard = document.createElement('div'); animCard.className = 'draw-card-anim';
        animCard.style.left = rect.left + 'px'; animCard.style.top = rect.top + 'px';
        document.body.appendChild(animCard);
        setTimeout(() => {
            const handRect = document.getElementById('playerHand').getBoundingClientRect();
            animCard.style.top = (handRect.top + 20) + 'px'; animCard.style.left = (handRect.left + handRect.width / 2) + 'px';
            animCard.style.transform = 'scale(0.5)'; animCard.style.opacity = '0';
        }, 50);
        setTimeout(() => { animCard.remove(); renderHandCard(card); }, 800);
    } else { if (currentPhase === 'DP' && isPlayerTurn) endDuel("You Lost! Deck is empty."); }
}

function drawOpponentCard() {
    if (oppDeckData.length > 0) {
        const card = oppDeckData.pop();
        oppHandData.push(card);
        updateCounters();
        const cardEl = document.createElement('div'); cardEl.className = 'opponent-hand-card';
        // Mapping UI to Data Index for easier retrieval
        cardEl.setAttribute('data-hand-index', oppHandData.length - 1);
        document.querySelector('.opponent-hand-container').appendChild(cardEl);
        log(`Opponent drew a card.`);
    } else if (!isPlayerTurn && currentPhase === 'DP') { endDuel("You Won! Opponent Deck is empty."); }
}

function renderHandCard(card) {
    const handContainer = document.getElementById('playerHand');
    const el = document.createElement('div');
    el.className = 'hand-card';
    el.style.backgroundImage = `url('${card.img}')`;
    el.setAttribute('data-name', card.name);
    // Use humanReadableCardType for consistent display
    const displayType = card.humanReadableCardType || card.full_type || card.type;
    el.setAttribute('data-type', displayType);
    el.setAttribute('data-atk', card.atk); el.setAttribute('data-def', card.def);
    el.setAttribute('data-original-atk', card.atk); el.setAttribute('data-original-def', card.def);
    el.setAttribute('data-desc', card.desc); el.setAttribute('data-img', card.img);
    el.setAttribute('data-card-category', card.category);
    el.setAttribute('data-level', card.level); el.setAttribute('data-attribute', card.attribute);
    el.setAttribute('data-race', card.race);
    el.setAttribute('data-speed', card.speed || 1);
    el.setAttribute('data-sub-type', card.subType || 'Normal');
    handContainer.appendChild(el);
}

// =========================================
// 5. ACTIONS & INTERACTIONS
// =========================================

function initiateTribute(card, required, action, callback = null) {
    tributeState.isActive = true;
    tributeState.pendingCard = card;
    tributeState.requiredTributes = required;
    tributeState.currentTributes = [];
    tributeState.actionType = action;
    tributeState.callback = callback; // Store generic callback
    log(`Tribute Summon/Cost: Select ${required} monster(s) to tribute.`);
    document.querySelectorAll('.player-zone.monster-zone .card').forEach(c => c.parentElement.classList.add('targetable'));
}

function handleTributeSelection(target) {
    if (tributeState.currentTributes.includes(target)) return;
    tributeState.currentTributes.push(target);
    target.style.opacity = '0.5';
    log(`Selected tribute: ${target.getAttribute('data-name')} (${tributeState.currentTributes.length}/${tributeState.requiredTributes})`);

    if (tributeState.currentTributes.length >= tributeState.requiredTributes) {
        tributeState.currentTributes.forEach(t => sendToGraveyard(t, 'player'));

        if (tributeState.callback) {
            tributeState.callback();
        } else {
            executeCardPlay(tributeState.pendingCard, tributeState.actionType);
        }
        cancelTributeMode();
    }
}

function cancelTributeMode() {
    if (tributeState.currentTributes.length > 0) { tributeState.currentTributes.forEach(t => t.style.opacity = '1'); }
    document.querySelectorAll('.zone').forEach(el => el.classList.remove('targetable'));
    tributeState.isActive = false; tributeState.pendingCard = null; tributeState.currentTributes = []; tributeState.actionType = null;
}

// --- NEW: Special Summon Logic ---
function performSpecialSummon(card, mechanism) {
    if (!card) return;

    if (mechanism === 'built-in') {
        const name = card.getAttribute('data-name');

        // CONDITIONS CHECK
        if (name === 'Cyber Dragon') {
            const oppMonsters = document.querySelectorAll('.opp-zone.monster-zone .card').length;
            const playerMonsters = document.querySelectorAll('.player-zone.monster-zone .card').length;
            if (oppMonsters === 0 || playerMonsters > 0) {
                alert("Condition not met: Opponent must control a monster and you must control no monsters.");
                actionMenu.classList.remove('active');
                return;
            }
        }

        // EXECUTE SUMMON (No Chain)
        log(`Special Summoned ${name}!`);
        executeCardPlay(card, 'special-summon'); // Reuse executeCardPlay for placement
    }
    // Effect summons handled by effect functions usually
}

function performAction(action) {
    if (!selectedHandCard) return;

    if (action === 'special-summon') {
        performSpecialSummon(selectedHandCard, 'built-in');
        return;
    }

    if (action === 'activate') {
        const isLink1 = ChainManager.stack.length === 0;
        if (!validateActivation(selectedHandCard, isLink1)) {
            alert("Cannot activate this card at this time (Check Phase/Speed).");
            actionMenu.classList.remove('active');
            return;
        }
    }

    const isMonsterSummon = (action === 'summon') || (action === 'set' && selectedHandCard.getAttribute('data-card-category') === 'monster');
    if (isMonsterSummon && gameState.normalSummonUsed) { alert("Already used Normal Summon/Set this turn!"); actionMenu.classList.remove('active'); return; }

    if (isMonsterSummon) {
        const level = parseInt(selectedHandCard.getAttribute('data-level'));
        let tributesNeeded = 0;
        if (level >= 5 && level <= 6) tributesNeeded = 1;
        if (level >= 7) tributesNeeded = 2;

        if (tributesNeeded > 0) {
            const playerMonsters = document.querySelectorAll('.player-zone.monster-zone .card');
            if (playerMonsters.length < tributesNeeded) {
                alert(`Not enough tributes! Level ${level} requires ${tributesNeeded} tribute(s).`);
                actionMenu.classList.remove('active'); return;
            }
            actionMenu.classList.remove('active');
            initiateTribute(selectedHandCard, tributesNeeded, action);
            return;
        }
    }
    executeCardPlay(selectedHandCard, action);
}

function executeCardPlay(handCardEl, action) {
    const cardData = {
        name: handCardEl.getAttribute('data-name'),
        type: handCardEl.getAttribute('data-type'),
        atk: handCardEl.getAttribute('data-atk'),
        def: handCardEl.getAttribute('data-def'),
        desc: handCardEl.getAttribute('data-desc'),
        img: handCardEl.getAttribute('data-img'),
        category: handCardEl.getAttribute('data-card-category'),
        level: handCardEl.getAttribute('data-level'),
        attribute: handCardEl.getAttribute('data-attribute'),
        race: handCardEl.getAttribute('data-race')
    };

    let targetZone = null; let cssClass = '';

    if (cardData.category === 'monster') {
        const zones = ['p-m1', 'p-m2', 'p-m3'];
        for (let id of zones) { if (document.getElementById(id).children.length === 0) { targetZone = document.getElementById(id); break; } }
        if (!targetZone) { alert("Monster Zones Full!"); return; }
        cssClass = (action === 'summon' || action === 'special-summon') ? 'face-up pos-atk' : 'face-down pos-def';
        if (action === 'summon' || action === 'set') gameState.normalSummonUsed = true;
    } else {
        const zones = ['p-s1', 'p-s2', 'p-s3'];
        for (let id of zones) { if (document.getElementById(id).children.length === 0) { targetZone = document.getElementById(id); break; } }
        if (!targetZone) { alert("S/T Zones Full!"); return; }
        cssClass = (action === 'activate') ? 'face-up pos-atk' : 'face-down pos-atk';
    }

    const newCard = document.createElement('div');
    newCard.className = `card ${cssClass}`;
    newCard.setAttribute('data-turn', turnCount);
    newCard.setAttribute('data-attacked', 'false');
    const uid = generateUID();
    newCard.setAttribute('data-uid', uid);

    for (let k in cardData) {
        if (k === 'category') newCard.setAttribute('data-card-category', cardData[k]);
        else newCard.setAttribute('data-' + k, cardData[k]);
    }
    newCard.setAttribute('data-original-atk', cardData.atk);
    newCard.setAttribute('data-original-def', cardData.def);

    // Official Rules Logic
    const subType = handCardEl.getAttribute('data-sub-type');
    const speed = handCardEl.getAttribute('data-speed');
    if (subType) newCard.setAttribute('data-sub-type', subType);
    if (speed) newCard.setAttribute('data-speed', speed);

    if (action === 'set') {
        newCard.setAttribute('data-set-turn', turnCount);
    }

    if (cssClass.includes('face-up')) {
        newCard.style.backgroundImage = `url('${cardData.img}')`;
        if (cardData.category === 'monster') {
            newCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${cardData.atk}</span><span class="stat-val stat-def">${cardData.def}</span></div>`;
        }
    }
    targetZone.appendChild(newCard);

    if (action === 'activate') {
        const cardName = cardData.name;

        // WRAPPER for Hand Activation
        const effectWrapper = function () {
            let finished = true;
            if (cardEffects[cardName] && typeof cardEffects[cardName] === 'function') {
                finished = cardEffects[cardName](newCard);
            }
            else if (cardEffects[cardName] && cardEffects[cardName].type === 'Continuous') {
                log(`Activated Continuous Spell: ${cardName}`);
                finished = true;
                updateContinuousEffects();
            }
            else { log(`Activated: ${cardName}`); }

            const typeStr = cardData.type || "";
            const raceStr = cardData.race || "";
            const isEquip = raceStr === 'Equip' || typeStr.includes('Equip');
            const isCont = raceStr === 'Continuous' || typeStr.includes('Continuous');

            if (!isEquip && !isCont && finished) {
                // REMOVED: Immediate GY Send. Handled by ChainManager.resolve() / pendingGraveyardQueue
                // const owner = getOwner(newCard); 
                // setTimeout(() => { sendToGraveyard(newCard, owner); }, 1000);
            }
            return finished; // Return status to ChainManager
        };

        // Add to Chain (Player activating from Hand)
        addToChain(newCard, effectWrapper, 'player');
    }


    handCardEl.remove(); selectedHandCard = null;
    actionMenu.classList.remove('active');

    if (cardData.category === 'monster') {
        log(`${action === 'summon' ? 'Summoned' : 'Set'}: ${cardData.name}`);
    }
}

// --- CLICK LISTENER ---
document.body.addEventListener('click', function (e) {
    if (gameState.gameOver) return;

    if (tributeState.isActive) {
        // 1. Check for Valid Target (Player Monster)
        const target = e.target.closest('.player-zone.monster-zone .card');
        if (target) { handleTributeSelection(target); e.stopPropagation(); return; }

        // 2. Check for Menu Interaction (Allow it)
        if (e.target.closest('.action-menu') || e.target.closest('.modal-overlay')) {
            return;
        }

        // 3. Invalid Click (Wrong Card or Background) -> IGNORE (Do not cancel)
        // User requested: "wait a valid target"
        // We log a hint but do not cancel.
        log("Invalid Tribute Target. Select a monster you control.");
        e.stopPropagation(); // Stop propagation to prevent hitting other logic
        return;

        // OLD LOGIC (Auto-Cancel)
        // if (!e.target.closest('.action-menu')) { cancelTributeMode(); log("Tribute Summon cancelled."); }
    }



    if (spellState.isTargeting) {
        const target = e.target.closest('.card.face-up, .card.face-down');

        // 1. If clicking the SOURCE card -> CANCEL
        if (target && target === spellState.sourceCard) {
            cancelSpellActivation(target);
            e.stopPropagation(); return;
        }

        // 2. If valid target -> RESOLVE
        if (target) {
            const targetIsMonster = target.getAttribute('data-card-category') === 'monster';
            const targetIsSpell = target.getAttribute('data-card-category') === 'spell';

            if ((spellState.targetType === 'monster' && targetIsMonster) ||
                (spellState.targetType === 'spell' && targetIsSpell)) {

                // FIX: Check Face-Up Requirement
                if (spellState.reqFaceUp && target.classList.contains('face-down')) {
                    log("Invalid Target: Must be Face-Up.");
                    return;
                }

                executeSpellTargetLogic(target); e.stopPropagation(); return;
            }
            // If card but invalid type
            log("Invalid Target. Please select a valid target or click the activating card to cancel.");
            e.stopPropagation(); return;
        }

        // 3. If clicking empty space (and not menu) -> IGNORE (Keep Targeting)
        if (!e.target.closest('.action-menu')) {
            // Do NOTHING. Just log hint.
            // log("Targeting... click valid target or source card to cancel.");
            e.stopPropagation();
            return;
        }
        // If menu click, allow it? Probably shouldn't happen during targeting usually.
    }

    if (battleState.isAttacking && battleState.attackerCard) {
        const targetMonster = e.target.closest('.opp-zone.monster-zone .card');
        if (targetMonster) { resolveAttack(battleState.attackerCard, targetMonster); e.stopPropagation(); return; }
        const targetAvatar = e.target.closest('#oppAvatarContainer');
        if (targetAvatar && targetAvatar.classList.contains('targetable')) { performDirectAttack(battleState.attackerCard); e.stopPropagation(); return; }
        if (!e.target.closest('.action-menu')) { cancelBattleMode(); }
    }

    const target = e.target.closest('.card, .hand-card');
    if (target) {
        // BUG FIX: Hide details for Opponent Face-down cards
        const isOpponent = target.closest('.opp-zone') || target.classList.contains('opponent-hand-card');
        const isFaceDown = target.classList.contains('face-down') || target.classList.contains('opponent-hand-card');

        if (isOpponent && isFaceDown) {
            // Show Generic Detail
            document.getElementById('detailImg').style.backgroundImage = 'var(--card-back-url)';
            document.getElementById('detailName').textContent = "Face-down Card";
            document.getElementById('detailType').textContent = "???";
            document.getElementById('detailAtk').textContent = "?";
            document.getElementById('detailDef').textContent = "?";
            document.getElementById('detailDesc').textContent = "A hidden card.";
            document.getElementById('detailAttrIcon').className = 'attr-icon';
            document.getElementById('detailAttrIcon').textContent = "?";
            document.getElementById('detailLevel').textContent = "";
        } else {
            // Standard Update
            updateSidebar(target);
        }

        const rect = target.getBoundingClientRect();
        actionMenu.classList.remove('active');

        // AI Logic interaction (unchanged except wrapper)
        if (target.classList.contains('hand-card')) {
            const isQP = target.getAttribute('data-race') === 'Quick-Play';
            const canActInBP = currentPhase === 'BP' && isQP;
            const canActInMain = (currentPhase === 'MP1' || currentPhase === 'MP2');

            if (isPlayerTurn && (canActInMain || canActInBP)) {
                selectedHandCard = target;
                const cat = target.getAttribute('data-card-category');
                let menuHtml = '';
                if (cat === 'monster') {
                    const summonLogic = target.getAttribute('data-summon-logic');

                    // Logic for Built-in Special Summons (e.g. Cyber Dragon)
                    if (summonLogic === 'built-in') {
                        if (canActInMain) {
                            menuHtml = `<button class="action-btn" onclick="performAction('special-summon')">Special Summon</button>`;
                            if (!gameState.normalSummonUsed) {
                                menuHtml += `<button class="action-btn" onclick="performAction('summon')">Normal Summon</button>`;
                            }
                            menuHtml += `<button class="action-btn" onclick="performAction('set')">Set</button>`;
                        }
                    } else {
                        // Standard Normal Summon/Set
                        if (!gameState.normalSummonUsed && canActInMain) {
                            menuHtml = `<button class="action-btn" onclick="performAction('summon')">Normal Summon</button>
                                        <button class="action-btn" onclick="performAction('set')">Set</button>`;
                        }
                    }
                } else {
                    menuHtml = `<button class="action-btn" onclick="performAction('activate')">Activate</button>
                                <button class="action-btn" onclick="performAction('set')">Set</button>`;
                }
                if (menuHtml) { actionMenu.innerHTML = menuHtml; showMenu(rect); e.stopPropagation(); }
            }
        }
        else if (target.parentElement.classList.contains('player-zone') && !target.closest('.opp-zone')) { // FIX: Strict exclusion of opp-zone
            // DEBUG LOG for UI Ghost
            // console.log("Menu Triggered", target);

            selectedFieldCard = target;
            let menuHtml = '';
            const isMonster = target.getAttribute('data-card-category') === 'monster';
            const isFaceUp = target.classList.contains('face-up');
            const isFaceDown = target.classList.contains('face-down');
            const cardTurn = parseInt(target.getAttribute('data-turn'));
            const lastChange = parseInt(target.getAttribute('data-last-pos-change') || 0);

            if (currentPhase === 'BP' && isPlayerTurn && isMonster && isFaceUp && target.classList.contains('pos-atk')) {
                const hasAttacked = target.getAttribute('data-attacked') === 'true';
                if (!hasAttacked && turnCount > 1) { menuHtml = `<button class="action-btn battle-option" onclick="initiateAttack()">Attack</button>`; }
            }
            else if ((currentPhase === 'MP1' || currentPhase === 'MP2') && isPlayerTurn) {
                if (isMonster) {
                    if (isFaceUp) {
                        if (cardTurn !== turnCount && lastChange !== turnCount) { menuHtml = `<button class="action-btn" onclick="changeBattlePosition()">Change Position</button>`; }
                    } else if (isFaceDown) {
                        if (cardTurn !== turnCount) { menuHtml = `<button class="action-btn" onclick="flipSummon()">Flip Summon</button>`; }
                    }
                } else {
                    // Logic for Set Spells/Traps
                    // STRICT CHECK: Player can only activate THEIR OWN cards (unless Debug)
                    if (isFaceDown && getController(target) === 'player') {
                        // Updated Visibility Check
                        const type = target.getAttribute('data-type');
                        const setTurn = parseInt(target.getAttribute('data-turn'));
                        const isTrap = type.includes('Trap');
                        const isQP = type.includes('Quick-Play');

                        let canActivate = true;

                        // 1. Trap/QP Delay check
                        if ((isTrap || isQP) && setTurn === turnCount) canActivate = false;

                        // 2. Normal Spell Phase check
                        if (!isTrap && !isQP && currentPhase !== 'MP1' && currentPhase !== 'MP2') canActivate = false;

                        if (canActivate) {
                            menuHtml = `<button class="action-btn" onclick="activateSetCard()">Activate</button>`;
                        }
                    }
                }
            }
            if (menuHtml) { actionMenu.innerHTML = menuHtml; showMenu(rect); e.stopPropagation(); }
        }
    } else {
        if (!e.target.closest('.action-menu') && !e.target.closest('.phase-content')) {
            actionMenu.classList.remove('active'); phaseMenu.classList.remove('active');
        }
    }
});

function activateSetCard(cardOverride = null, force = false) {
    const cardEl = cardOverride || selectedFieldCard;
    if (!cardEl) return;

    // Manual Activation Logic (Force = true bypasses checks, used by Opponent Turn response)
    const controller = getController(cardEl);

    // FIX: If Manual Activation (User Click OR Modal Click) and card belongs to Opponent -> BLOCK
    // Check if cardOverride implies UI interaction (selectedChainCard)
    // Check if cardOverride implies UI interaction (selectedChainCard)
    const isUIAction = !cardOverride || (cardOverride === selectedChainCard);

    console.log(`[AI-DEBUG] activateSetCard: Name=${cardEl.getAttribute('data-name')} Force=${force} UI=${isUIAction} Controller=${controller}`);

    if (isUIAction && controller === 'opponent') {
        console.log("[AI-DEBUG] Blocked Opponent Card Activation via UI logic.");
        log("Cannot activate Opponent's card!");
        return;
    }

    if (!force) {
        // New Validation
        // If Chain stack is empty, it is Chain Link 1.
        // If responding to opponent via UI button, stack might not be empty?
        // Actually, normal "Activate" button is for initiating. 
        // Responses use the "checkPhaseResponse" or "ChainManager" UI which bypasses this or calls it with force=true?
        // Let's check ChainManager.promptResponse calls openActivationModal. 
        // openActivationModal onclick sets selectedChainCard. Does it call activateSetCard?
        // No, current logic (Step 223 snippet) in openActivationModal onclick just selects card.
        // Then `ChainManager.resolve()` happens.
        // Wait, where is the card actually ACTIVATED in response?
        // I need to ensure `force` is handled correctly or `validateActivation` receives correct `isChainLink1`.

        const isLink1 = ChainManager.stack.length === 0;
        if (!validateActivation(cardEl, isLink1)) {
            log("Activation conditions not met (Turn/Phase/Speed).");
            return;
        }
    }

    // EXECUTE ACTIVATION -> NOW ADDS TO CHAIN
    cardEl.classList.remove('face-down'); cardEl.classList.add('face-up');
    const imgUrl = cardEl.getAttribute('data-img');
    cardEl.style.backgroundImage = `url('${imgUrl}')`;
    const cardName = cardEl.getAttribute('data-name');

    // Create Effect Wrapper
    const effectWrapper = function () {
        let finished = true;

        // --- ORIGINAL LOGIC RESTORED INSIDE WRAPPER ---
        if (cardEffects[cardName] && typeof cardEffects[cardName] === 'function') { finished = cardEffects[cardName](cardEl); }
        else if (cardEffects[cardName] && cardEffects[cardName].type === 'Continuous') { finished = false; updateContinuousEffects(); }

        const typeStr = cardEl.getAttribute('data-type') || "";
        const raceStr = cardEl.getAttribute('data-race') || "";
        const isEquip = raceStr === 'Equip' || typeStr.includes('Equip');
        const isCont = raceStr === 'Continuous' || typeStr.includes('Continuous');

        if (!isEquip && !isCont && finished) {
            // REMOVED: Immediate GY Send. Handled by ChainManager pendingGraveyardQueue.
            // const owner = getOwner(cardEl); 
            // setTimeout(() => { sendToGraveyard(cardEl, owner); }, 1000);
        }
        return finished; // FIX: Return status to ChainManager
    };

    // Add into Chain
    addToChain(cardEl, effectWrapper, getController(cardEl));

    // HIDE MENU
    actionMenu.classList.remove('active');

    // NOTE: checkResponseWindow is now handled internally by ChainManager via addToChain
    // So we don't need to manually trigger it here.

}

// Old resolveChain removed (Superseded by ChainManager.resolve)


// =========================================
// MISSING TARGETING LOGIC RESTORED
// =========================================

function highlightTargets(type) {
    if (type === 'monster') {
        document.querySelectorAll('.monster-zone .card').forEach(c => {
            // FIX: Only highlight valid targets
            if (spellState.reqFaceUp && c.classList.contains('face-down')) return;
            c.parentElement.classList.add('targetable');
        });
    } else if (type === 'spell') {
        document.querySelectorAll('.spell-trap-zone .card').forEach(c => c.parentElement.classList.add('targetable'));
    }
}

function clearHighlights() {
    document.querySelectorAll('.zone').forEach(el => el.classList.remove('targetable'));
}

function cancelSpellActivation(card) {
    log("Targeting cancelled.");
    spellState.isTargeting = false;
    spellState.sourceCard = null;
    clearHighlights();

    // If we were in a chain, we need to abort/clean up?
    // Usually cancelling happens before chain resolution starts if triggering from hand.
    // BUT if we are resolving a chain (MST in chain), we can't really "cancel" easily without breaking chain.
    // So if internal chain resolution, maybe we shouldn't allow cancel? 
    // For now, simple reset.
    if (ChainManager.isResolving) {
        // If we cancel inside a chain, it effectively fizzles the effect?
        ChainManager.continueResolution();
    }
}

// [Deleted obsolete resolveSpellTarget function]

// =========================================
// 6. BATTLE LOGIC
// =========================================

function initiateAttack() {
    if (currentPhase !== 'BP') { alert("Attacks can only be declared in the Battle Phase!"); actionMenu.classList.remove('active'); return; }
    if (!selectedFieldCard) return;
    if (selectedFieldCard.getAttribute('data-attacked') === 'true') { alert("This monster has already attacked!"); actionMenu.classList.remove('active'); return; }
    if (selectedFieldCard.getAttribute('data-disable-attack') === 'true') { alert("This monster cannot attack!"); actionMenu.classList.remove('active'); return; }

    battleState.isAttacking = true;
    battleState.attackerCard = selectedFieldCard;
    log(`Battle: ${selectedFieldCard.getAttribute('data-name')} is attacking... Select a target.`);

    const oppMonsters = document.querySelectorAll('.opp-zone.monster-zone .card');
    if (oppMonsters.length > 0) { oppMonsters.forEach(el => el.parentElement.classList.add('targetable')); }
    else { document.getElementById('oppAvatarContainer').classList.add('targetable'); }
    actionMenu.classList.remove('active');
}

function resolveAttack(attacker, target) {
    const attackerName = attacker.getAttribute('data-name');
    const targetName = target.getAttribute('data-name');
    const atkVal = parseInt(attacker.getAttribute('data-atk'));
    let targetAtk = parseInt(target.getAttribute('data-atk'));
    let targetDef = parseInt(target.getAttribute('data-def'));
    const isTargetFaceDown = target.classList.contains('face-down');
    const isTargetDef = target.classList.contains('pos-def');

    log(`${attackerName} attacks ${targetName || 'Face-Down Card'}!`);

    if (isTargetFaceDown) {
        log("Opponent monster flipped face-up!");
        target.classList.remove('face-down'); target.classList.add('face-up');
        target.style.backgroundImage = `url('${target.getAttribute('data-img')}')`;
        if (!target.querySelector('.stats-bar')) {
            target.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${targetAtk}</span><span class="stat-val stat-def">${targetDef}</span></div>`;
        }
    }

    const destroyCard = (card, owner = null) => {
        card.style.transition = 'all 0.5s ease-in';
        card.style.transform = 'scale(0) rotate(360deg)';
        card.style.opacity = '0';
        setTimeout(() => { sendToGraveyard(card, owner); }, 500);
    };

    // DYNAMIC OWNERSHIP & LOGIC via Helpers
    const attackerController = getController(attacker);
    const targetController = getController(target);

    // Safety check: Attacking own monster?
    if (attackerController === targetController) {
        log("Error: Cannot attack your own monster.");
        cancelBattleMode();
        return;
    }

    if (!isTargetDef) {
        if (atkVal > targetAtk) {
            const diff = atkVal - targetAtk;
            log(`Victory! ${targetName} destroyed. ${targetController === 'player' ? 'You' : 'Opponent'} take ${diff} damage.`);
            updateLP(diff, targetController);
            destroyCard(target, null); // Fix: Respect data-owner
        } else if (atkVal < targetAtk) {
            const diff = targetAtk - atkVal;
            log(`Defeat! ${attackerName} destroyed. ${attackerController === 'player' ? 'You' : 'Opponent'} take ${diff} damage.`);
            updateLP(diff, attackerController);
            destroyCard(attacker, null); // Fix: Respect data-owner
        } else {
            log("Double KO! Both monsters destroyed.");
            destroyCard(target, null); destroyCard(attacker, null);
        }
    } else {
        if (atkVal > targetDef) {
            log(`Defense pierced! ${targetName} destroyed.`);
            destroyCard(target, null); // Fix: Respect data-owner
        } else if (atkVal < targetDef) {
            const diff = targetDef - atkVal;
            log(`Blocked! ${attackerController === 'player' ? 'You' : 'Opponent'} take ${diff} damage.`);
            updateLP(diff, attackerController);
        } else { log("Stalemate. No monsters destroyed."); }
    }

    if (document.body.contains(attacker)) { attacker.setAttribute('data-attacked', 'true'); }
    cancelBattleMode();
}

function performDirectAttack(attacker) {
    const attackerController = getController(attacker);
    const opponent = getOpponent(attackerController);

    // Verify Opponent actually has no monsters? 
    // The selector needs to check the OPPONENT's field relative to attacker
    const oppZoneSelector = (attackerController === 'player') ? '.opp-zone.monster-zone .card' : '.player-zone.monster-zone .card';
    const oppMonsters = document.querySelectorAll(oppZoneSelector);

    if (oppMonsters.length > 0) { alert("Cannot attack directly! Opponent controls monsters."); return; }

    const atk = parseInt(attacker.getAttribute('data-atk'));
    log(`${attacker.getAttribute('data-name')} attacks directly!`);

    // Animation
    const direction = attackerController === 'player' ? -50 : 50;
    attacker.style.transform = `translateY(${direction}px) scale(1.2)`;
    setTimeout(() => { attacker.style.transform = ''; }, 300);

    updateLP(atk, opponent);
    attacker.setAttribute('data-attacked', 'true');
    cancelBattleMode();
}

function cancelBattleMode() {
    battleState.isAttacking = false;
    battleState.attackerCard = null;
    document.querySelectorAll('.opp-zone.monster-zone').forEach(el => el.classList.remove('targetable'));
    document.getElementById('oppAvatarContainer').classList.remove('targetable');
}

// =========================================
// 7. UI HELPERS
// =========================================
const phaseMenu = document.getElementById('phaseMenu');
const phaseBtn = document.getElementById('phaseBtn');
const phaseText = document.getElementById('phaseText');

function togglePhaseMenu() { if (isPlayerTurn && currentPhase !== 'DP' && currentPhase !== 'SP') { updatePhaseMenuState(); phaseMenu.classList.toggle('active'); } }

function updatePhaseMenuState() {
    const phases = ['MP1', 'BP', 'MP2', 'EP'];
    const currIdx = phaseOrder.indexOf(currentPhase);
    phases.forEach(ph => {
        const el = document.getElementById('ph-' + ph);
        const targetIdx = phaseOrder.indexOf(ph);
        el.classList.remove('disabled');
        if (targetIdx <= currIdx) el.classList.add('disabled');
        if (currentPhase === 'MP1' && ph === 'MP2') el.classList.add('disabled');
        if (ph === 'MP2' && currentPhase !== 'BP') el.classList.add('disabled');
        if (turnCount === 1 && (ph === 'BP' || ph === 'MP2')) el.classList.add('disabled');
    });
}

function showMenu(rect) {
    let menuTop = rect.top - 50; if (menuTop < 0) menuTop = 20;
    actionMenu.style.left = `${rect.left + 20}px`; actionMenu.style.top = `${menuTop}px`;
    actionMenu.classList.add('active');
}

function changeBattlePosition() {
    if (!selectedFieldCard) return;
    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') { alert("Action only allowed in Main Phase!"); actionMenu.classList.remove('active'); return; }
    const summonedTurn = parseInt(selectedFieldCard.getAttribute('data-turn'));
    const lastPosChange = parseInt(selectedFieldCard.getAttribute('data-last-pos-change') || 0);
    const hasAttacked = selectedFieldCard.getAttribute('data-attacked') === 'true';

    if (summonedTurn === turnCount || lastPosChange === turnCount || hasAttacked) { alert("Cannot change position!"); actionMenu.classList.remove('active'); return; }
    if (selectedFieldCard.getAttribute('data-disable-pos-change') === 'true') { alert("Cannot change position due to effect!"); actionMenu.classList.remove('active'); return; }
    const atk = selectedFieldCard.getAttribute('data-atk');
    const def = selectedFieldCard.getAttribute('data-def');
    const statsHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${atk}</span><span class="stat-val stat-def">${def}</span></div>`;

    if (selectedFieldCard.classList.contains('pos-atk')) {
        selectedFieldCard.classList.remove('pos-atk'); selectedFieldCard.classList.add('pos-def');
        if (selectedFieldCard.innerHTML.trim() === "") selectedFieldCard.innerHTML = statsHTML;
        log(`Changed ${selectedFieldCard.getAttribute('data-name')} to Defense.`);
    } else {
        selectedFieldCard.classList.remove('pos-def'); selectedFieldCard.classList.add('pos-atk');
        if (selectedFieldCard.innerHTML.trim() === "") selectedFieldCard.innerHTML = statsHTML;
        log(`Changed ${selectedFieldCard.getAttribute('data-name')} to Attack.`);
    }
    selectedFieldCard.setAttribute('data-last-pos-change', turnCount);
    actionMenu.classList.remove('active');
}

function flipSummon() {
    if (!selectedFieldCard) return;
    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') { alert("Action only allowed in Main Phase!"); actionMenu.classList.remove('active'); return; }
    const setTurn = parseInt(selectedFieldCard.getAttribute('data-turn'));
    if (setTurn === turnCount) { alert("Cannot Flip Summon!"); actionMenu.classList.remove('active'); return; }

    selectedFieldCard.classList.remove('face-down', 'pos-def'); selectedFieldCard.classList.add('face-up', 'pos-atk');
    const imgUrl = selectedFieldCard.getAttribute('data-img');
    selectedFieldCard.style.backgroundImage = `url('${imgUrl}')`;
    const atk = selectedFieldCard.getAttribute('data-atk');
    const def = selectedFieldCard.getAttribute('data-def');
    selectedFieldCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${atk}</span><span class="stat-val stat-def">${def}</span></div>`;

    selectedFieldCard.setAttribute('data-last-pos-change', turnCount);
    log(`Flip Summoned: ${selectedFieldCard.getAttribute('data-name')}`);
    actionMenu.classList.remove('active');
}

// Modal Logic
const listModal = document.getElementById('listModal');
const listGrid = document.getElementById('listGrid');
const listTitle = document.getElementById('listTitle');

function openList(title, data) {
    listTitle.textContent = title; listGrid.innerHTML = '';
    data.forEach(card => {
        const el = document.createElement('div'); el.className = 'list-card';
        let imgUrl = card.img || ''; el.style.backgroundImage = `url('${imgUrl}')`;
        for (let k in card) el.setAttribute('data-' + k, card[k]);
        el.addEventListener('click', (e) => { e.stopPropagation(); updateSidebar(el); });
        listGrid.appendChild(el);
    });
    listModal.classList.add('active');
}
function closeList() { listModal.classList.remove('active'); }

document.getElementById('playerGY').addEventListener('click', () => openList('Your Graveyard', playerGYData));
document.getElementById('oppGY').addEventListener('click', () => openList('Opponent Graveyard', oppGYData));
document.getElementById('playerEx').addEventListener('click', () => openList('Extra Deck', playerExData));

// Sidebar Updates
let detailImg = document.getElementById('detailImg');
let detailName = document.getElementById('detailName');
let detailType = document.getElementById('detailType');
let detailAtk = document.getElementById('detailAtk');
let detailDef = document.getElementById('detailDef');
let detailDesc = document.getElementById('detailDesc');
let detailLevel = document.getElementById('detailLevel');
let detailAttrIcon = document.getElementById('detailAttrIcon');

function updateSidebar(el) {
    detailName.textContent = el.getAttribute('data-name');
    detailType.textContent = el.getAttribute('data-type');
    detailAtk.textContent = el.getAttribute('data-atk');
    detailDef.textContent = el.getAttribute('data-def');
    detailDesc.textContent = el.getAttribute('data-desc');
    detailImg.style.backgroundImage = `url('${el.getAttribute('data-img')}')`;
    detailImg.classList.remove('empty');

    const level = parseInt(el.getAttribute('data-level'));
    if (level > 0) {
        detailLevel.textContent = '★'.repeat(level);
        detailLevel.style.display = 'inline';
    } else { detailLevel.style.display = 'none'; }

    const attr = el.getAttribute('data-attribute');
    if (attr && attr !== 'undefined' && attr !== '') {
        detailAttrIcon.textContent = attr.substring(0, 1);
        detailAttrIcon.className = `attr-icon attr-${attr}`;
        detailAttrIcon.style.display = 'inline-block';
    } else { detailAttrIcon.style.display = 'none'; }
}

function log(msg) {
    const entry = document.createElement('div'); entry.className = 'log-entry';
    entry.innerHTML = `<span>System:</span> ${msg}`;
    const logBody = document.getElementById('logBody'); logBody.appendChild(entry); logBody.scrollTop = logBody.scrollHeight;
}

// --- HELPER: Custom Confirm Modal ---
function showConfirmModal(message) {
    return new Promise((resolve) => {
        // Create Modal Elements dynamically to ensure existence
        let modal = document.getElementById('customConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customConfirmModal';
            modal.className = 'modal-overlay';
            // Improved Styling: Dark theme with metallic/cyber vibes
            const modalStyle = `
                position: relative;
                width: 400px;
                max-width: 90%;
                background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
                border: 2px solid #a4a4a4;
                border-radius: 8px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 255, 255, 0.3);
                color: #fff;
                padding: 0;
                overflow: hidden;
                font-family: 'Verdana', sans-serif;
                animation: fadeIn 0.2s ease-out;
            `;
            const headerStyle = `
                background: linear-gradient(to right, #333, #111);
                color: #ddd;
                padding: 10px 15px;
                font-size: 14px;
                font-weight: bold;
                border-bottom: 1px solid #444;
                text-transform: uppercase;
                letter-spacing: 1px;
            `;
            const bodyStyle = `
                padding: 25px 20px;
                font-size: 16px;
                text-align: center;
                line-height: 1.5;
            `;
            const footerStyle = `
                padding: 15px 20px 20px;
                display: flex;
                justify-content: center;
                gap: 20px;
            `;
            const btnStyle = `
                padding: 8px 25px;
                border: 1px solid #777;
                background: linear-gradient(to bottom, #444, #222);
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                border-radius: 4px;
                transition: all 0.2s;
                text-transform: uppercase;
                font-weight: bold;
            `;

            modal.innerHTML = `
                <div class="modal-content" style="${modalStyle}">
                    <div style="${headerStyle}">System Confirmation</div>
                    <div style="${bodyStyle}">
                        <div id="customConfirmText"></div>
                    </div>
                    <div style="${footerStyle}">
                        <button id="customConfirmYes" class="action-btn" style="${btnStyle}">Yes</button>
                        <button id="customConfirmNo" class="action-btn" style="${btnStyle}">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Add hover effects via JS since inline styles make pseudo-classes hard
            const btns = modal.querySelectorAll('button');
            btns.forEach(btn => {
                btn.onmouseenter = () => {
                    btn.style.borderColor = '#00d4ff';
                    btn.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.5)';
                    btn.style.color = '#fff';
                };
                btn.onmouseleave = () => {
                    btn.style.borderColor = '#777';
                    btn.style.boxShadow = 'none';
                    btn.style.color = '#fff';
                };
            });
        }

        const textEl = document.getElementById('customConfirmText');
        const yesBtn = document.getElementById('customConfirmYes');
        const noBtn = document.getElementById('customConfirmNo');

        textEl.textContent = message;
        modal.classList.add('active');
        gameState.isPaused = true; // PAUSE GAME LOOPS

        // Handlers
        const close = (val) => {
            modal.classList.remove('active');
            gameState.isPaused = false; // RESUME
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(val);
        };

        // Added stopPropagation to prevent game board click triggers
        yesBtn.onclick = (e) => { e.stopPropagation(); close(true); };
        noBtn.onclick = (e) => { e.stopPropagation(); close(false); };
    });
}
