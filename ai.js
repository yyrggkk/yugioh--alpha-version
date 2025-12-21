// =========================================
// AI.JS - AI Logic and Decision Making
// =========================================

// --- AI OPPONENT TURN FLOW ---

function oppDrawPhase() {
    if (gameState.turnInfo.gameOver) return;
    drawOpponentCard();
    // Check if Player wants to respond to Draw Phase
    ChainManager.checkPhaseResponse('player', oppStandbyPhase);
}

function oppStandbyPhase() {
    if (gameState.turnInfo.gameOver) return;
    setPhaseText('SP', "STANDBY PHASE");
    const spells = document.querySelectorAll('.spell-trap-zone .card.face-up');
    spells.forEach(s => {
        if (s.getAttribute('data-name') === 'Burning Land') {
            updateLP(500, 'opponent'); // Opponent Turn = Opponent takes damage
        }
    });

    // Check Response before Main Phase
    ChainManager.checkPhaseResponse('player', oppMainPhase);
}

function oppMainPhase() {
    if (gameState.turnInfo.gameOver) return;
    setPhaseText('MP1', "MAIN PHASE 1");
    currentPhase = 'MP1';
    updateContinuousEffects();

    log("Opponent Main Phase 1: Thinking...");

    // Initialize AI state for this Main Phase
    gameState.aiMainPhaseState = {
        hasSummoned: false,
        backrowSetCount: 0
    };

    setTimeout(() => {
        oppMainPhaseStep();
    }, 1500);
}

// ==========================================
// PHASE 3: STRATEGIC AI - MINIMAX INTEGRATION
// ==========================================

// Sequential AI "Think Loop" for Main Phase
// NOW USES MINIMAX TO THINK 2 TURNS AHEAD!
function oppMainPhaseStep() {
    if (gameState.turnInfo.gameOver) return;

    // Sync DOM to State to ensure AI sees the updated field
    if (typeof syncDOMToGameState === 'function') {
        syncDOMToGameState();
    }

    // Use Minimax to find best move
    log("[AI] Analyzing best move with Minimax...");

    try {
        const bestMove = Sim_findBestMove(gameState, 'opponent', AI_CONFIG.MINIMAX_DEPTH);

        if (!bestMove) {
            // No good moves found, pass to battle phase
            log("[AI] No beneficial moves found. Passing to Battle Phase.");
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            return;
        }

        log(`[AI] Best move: ${bestMove.type}`);

        // Execute the move chosen by Minimax
        if (bestMove.type === 'PASS_PHASE') {
            // AI wants to pass to next phase
            log("[AI] Strategic pass to Battle Phase.");
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            return;
        }

        // Execute the move
        executeSimulatedMove(bestMove);

    } catch (error) {
        console.error('[AI] Minimax error:', error);
        // Fallback: pass to battle phase
        log("[AI] Error in AI brain, passing turn.");
        setTimeout(() => {
            ChainManager.checkPhaseResponse('player', oppBattlePhase);
        }, 1000);
    }
}

/**
 * Execute a move decided by simulation
 * @param {Move} move - Move object from Minimax
 */
function executeSimulatedMove(move) {
    switch (move.type) {
        case 'NORMAL_SUMMON':
            log(`[AI] Summons ${move.card.name} in ATK position!`);
            executeOpponentPlay(move.card, 'summon');
            gameState.aiMainPhaseState.hasSummoned = true;

            // Continue thinking
            setTimeout(() => oppMainPhaseStep(), 800);
            break;

        case 'SET_MONSTER':
            log(`[AI] Sets a monster in DEF position.`);
            executeOpponentPlay(move.card, 'set');
            gameState.aiMainPhaseState.hasSummoned = true;

            // Continue thinking
            setTimeout(() => oppMainPhaseStep(), 800);
            break;

        case 'SET_SPELL':
            log(`[AI] Sets a Spell/Trap card.`);
            executeOpponentPlay(move.card, 'set');
            gameState.aiMainPhaseState.backrowSetCount++;

            // Continue thinking
            setTimeout(() => oppMainPhaseStep(), 800);
            break;

        case 'ACTIVATE_SPELL':
            log(`[AI] Activates Spell: ${move.card.name}`);
            // Use Direct Hand Activation logic to ensure it works
            executeAIHandActivation(move.card);

            // Continue thinking (longer delay for resolution)
            setTimeout(() => oppMainPhaseStep(), 1500);
            break;

        case 'TRIBUTE_SUMMON':
            log(`[AI] Tribute Summoning ${move.card.name}!`);
            const tributes = move.tributes || [];

            // Process Tributes
            // We need to find the actual DOM elements for the zone indices
            const oppMonsters = document.querySelectorAll('.opp-zone.monster-zone');
            tributes.forEach(idx => {
                const zone = oppMonsters[idx];
                if (zone && zone.children.length > 0) {
                    const cardEl = zone.children[0];
                    sendToGraveyard(cardEl, 'opponent');
                }
            });

            // Execute Summon
            executeOpponentPlay(move.card, 'summon');
            gameState.aiMainPhaseState.hasSummoned = true;

            setTimeout(() => oppMainPhaseStep(), 1500);
            break;

        case 'CHANGE_POSITION':
            log(`[AI] Changing position of monster at zone ${move.zoneIndex}`);
            const monZone = document.querySelectorAll('.opp-zone.monster-zone')[move.zoneIndex];
            if (monZone && monZone.children.length > 0) {
                const cardEl = monZone.children[0];
                // Use main.js changePosition function if global, or simulate click
                if (typeof changePosition === 'function') {
                    // Since changePosition usually toggles based on current state, correct.
                    // But changePosition might check for turn/phase for PLAYER.
                    // We might need a force flag or separate AI function.
                    // Let's implement AI specific toggle to be safe.

                    const currentPos = cardEl.classList.contains('pos-atk') ? 'atk' : 'def';
                    const newPos = currentPos === 'atk' ? 'def' : 'atk';

                    cardEl.classList.remove('pos-atk', 'pos-def', 'face-down'); // Face-down? If flipping up.
                    // AI logic usually flips up if changing pos?
                    // If it was Set (face-down def), changing to Attack flips it face-up.
                    // If it was Atk, changing to Def keeps it face-up usually (unless book of moon).

                    if (newPos === 'atk') {
                        cardEl.classList.add('face-up', 'pos-atk');
                        // ensure image is shown
                        const img = cardEl.getAttribute('data-img');
                        cardEl.style.backgroundImage = `url('${img}')`;
                    } else {
                        cardEl.classList.add('pos-def'); // Keep face-up if was face-up?
                        // If we are changing FROM Atk, we stay face-up.
                        if (!cardEl.classList.contains('face-down')) cardEl.classList.add('face-up');
                    }
                }
            }
            setTimeout(() => oppMainPhaseStep(), 800);
            break;

        case 'PASS_PHASE':
            // AI decided best move is to pass to next phase
            log(`[AI] Passing to next phase.`);
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            break;

        case 'PASS_TURN':
            // AI has no beneficial moves, pass turn
            log(`[AI] No beneficial moves. Passing turn.`);
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            break;

        case 'ATTACK':
            // AI attacks a monster
            log(`[AI] Attacking opponent's monster!`);
            // The existing battle phase logic handles this
            // Just pass to battle phase
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            break;

        case 'DIRECT_ATTACK':
            // AI direct attacks
            log(`[AI] Direct attack!`);
            // The existing battle phase logic handles this
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            break;

        default:
            // Unknown move type, pass
            log(`[AI] Unknown move type: ${move.type}. Passing.`);
            setTimeout(() => {
                ChainManager.checkPhaseResponse('player', oppBattlePhase);
            }, 1000);
            break;
    }
}

function oppBattlePhase() {
    if (gameState.turnInfo.gameOver) return;
    setPhaseText('BP', "BATTLE PHASE");
    currentPhase = 'BP';
    updateContinuousEffects();

    log("Opponent Battle Phase");

    setTimeout(() => {
        // Get attackers ONCE, but process them sequentially
        const myAttackers = Array.from(document.querySelectorAll('.opp-zone.monster-zone .card.pos-atk'));

        // Recursive function to handle sequential attacks
        const executeAttackSequence = (index) => {
            if (index >= myAttackers.length || gameState.turnInfo.gameOver) {
                // Done with all attacks
                setTimeout(() => {
                    ChainManager.checkPhaseResponse('player', oppMainPhase2);
                }, 1000);
                return;
            }

            const attacker = myAttackers[index];

            // Validation: Check if still on field and able to attack
            if (!attacker.closest('.opp-zone') ||
                attacker.getAttribute('data-attacked') === 'true' ||
                attacker.getAttribute('data-disable-attack') === 'true') {

                // Skip this attacker
                executeAttackSequence(index + 1);
                return;
            }

            // DYNAMIC TARGET SELECTION (Re-scan board)
            const playerMonsters = Array.from(document.querySelectorAll('.player-zone.monster-zone .card'));

            let target = null;
            let isDirect = false;

            if (playerMonsters.length === 0) {
                isDirect = true; // Direct Attack
            } else {
                // Find beatable target
                const atkVal = parseInt(attacker.getAttribute('data-atk'));
                let bestTarget = null;
                let maxThreat = -1;

                playerMonsters.forEach(pm => {
                    const isDef = pm.classList.contains('pos-def');
                    const pAtk = parseInt(pm.getAttribute('data-atk'));
                    const pDef = parseInt(pm.getAttribute('data-def'));

                    if (isDef) {
                        if (pm.classList.contains('face-down')) {
                            // Hit Face-down. High priority.
                            if (maxThreat < 0) { maxThreat = 0; bestTarget = pm; }
                        } else {
                            if (atkVal > pDef) {
                                if (pDef > maxThreat) { maxThreat = pDef; bestTarget = pm; }
                            }
                        }
                    } else {
                        if (atkVal > pAtk) {
                            if (pAtk > maxThreat) { maxThreat = pAtk; bestTarget = pm; }
                        }
                    }
                });
                if (bestTarget) target = bestTarget;
            }

            // EXECUTE OR SKIP
            if (target || isDirect) {
                log(`Opponent attacks ${isDirect ? 'Directly' : target.getAttribute('data-name')}!`);
                battleState.attackerCard = attacker;

                if (isDirect) performDirectAttack(attacker);
                else resolveAttack(attacker, target);

                // Wait for resolution animation before next attack
                const nextStep = () => {
                    if (gameState.isPaused) {
                        // Wait/Poll until unpaused
                        setTimeout(nextStep, 500);
                    } else {
                        executeAttackSequence(index + 1);
                    }
                };

                setTimeout(nextStep, 2500);
            } else {
                // No valid target? Skip.
                executeAttackSequence(index + 1);
            }
        };

        // Start Sequence
        executeAttackSequence(0);

    }, 1000);
}

function oppMainPhase2() {
    if (gameState.turnInfo.gameOver) return;
    setPhaseText('MP2', "MAIN PHASE 2");
    currentPhase = 'MP2';
    updateContinuousEffects();
    log("Opponent Main Phase 2");

    // Logic: Set any remaining Spells? for now simple pass
    setTimeout(() => {
        // Prompt at End of MP2 (Before EP)
        ChainManager.checkPhaseResponse('player', oppEndPhase);
    }, 1000);
}

function oppEndPhase() {
    if (gameState.turnInfo.gameOver) return;
    setPhaseText('EP', "END PHASE");
    currentPhase = 'EP'; // Important: Update phase var
    log("Opponent End Phase");

    updateContinuousEffects();

    setTimeout(() => {
        // Prompt at End of EP (Before Turn Change)
        ChainManager.checkPhaseResponse('player', switchTurn);
    }, 1000);
}

// --- AI HELPER FUNCTIONS ---

function getPlayerBestAtk() {
    let max = 0;
    document.querySelectorAll('.player-zone.monster-zone .card.pos-atk').forEach(c => {
        const atk = parseInt(c.getAttribute('data-atk'));
        if (atk > max) max = atk;
    });
    // Check DEF of DEF pos monsters too? (To beat them)
    document.querySelectorAll('.player-zone.monster-zone .card.pos-def').forEach(c => {
        const def = parseInt(c.getAttribute('data-def'));
        // If we want to beat it, we need ATK > DEF. 
        if (def > max) max = def;
    });
    return max;
}

function executeOpponentPlay(cardData, action) {
    if (!cardData) return;

    // Remove from Hand Data
    const index = oppHandData.findIndex(c => c.name === cardData.name && c.desc === cardData.desc); // Simple match
    if (index > -1) {
        oppHandData.splice(index, 1);
        updateCounters();
        // Remove visual card (last one)
        const handEl = document.querySelector('.opponent-hand-container .opponent-hand-card');
        if (handEl) handEl.remove();
    }

    // Determine Zone
    let targetZone = null;
    let zonesSelector = action === 'activate' || cardData.category !== 'monster'
        ? '.opp-zone.spell-trap-zone:empty'
        : '.opp-zone.monster-zone:empty';

    targetZone = document.querySelector(zonesSelector);
    if (!targetZone) { log("AI Error: No Zone Avail"); return; }

    // CSS Class
    let cssClass = '';
    if (cardData.category === 'monster') {
        cssClass = (action === 'summon' || action === 'special-summon') ? 'face-up pos-atk' : 'face-down pos-def';
    } else {
        // Fix: If activating, it must be face-up
        cssClass = (action === 'activate') ? 'face-up pos-atk' : 'face-down pos-atk';
    }

    const newCard = document.createElement('div');
    newCard.className = `card ${cssClass}`;
    newCard.setAttribute('data-turn', turnCount);
    newCard.setAttribute('data-attacked', 'false');
    const uid = generateUID();
    newCard.setAttribute('data-uid', uid);

    for (let k in cardData) {
        if (k !== 'index') { // Don't add internal index
            if (k === 'category') {
                newCard.setAttribute('data-card-category', cardData[k]);
            } else if (k === 'type') {
                // Use humanReadableCardType for consistent display
                const displayType = cardData.humanReadableCardType || cardData.full_type || cardData.type;
                newCard.setAttribute('data-type', displayType);
            } else {
                newCard.setAttribute('data-' + k, cardData[k]);
            }
        }
    }

    // Important Stats
    newCard.setAttribute('data-original-atk', cardData.atk);
    newCard.setAttribute('data-original-def', cardData.def);
    newCard.setAttribute('data-owner', 'opponent');

    if (action === 'set') newCard.setAttribute('data-set-turn', turnCount);

    // FIX: Set global flag when AI summons
    if (action === 'summon' || action === 'set') {
        if (cardData.category === 'monster') {
            gameState.turnInfo.normalSummonUsed = true;
        }
    }

    if (cssClass.includes('face-up')) {
        newCard.style.backgroundImage = `url('${cardData.img}')`;
        if (cardData.category === 'monster') {
            newCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${cardData.atk}</span><span class="stat-val stat-def">${cardData.def}</span></div>`;
        }
    } else {
        // Face down
        newCard.style.backgroundImage = `var(--card-back-url)`;
    }

    targetZone.appendChild(newCard);
    log(`Opponent ${action}s a card.`);

    if (action === 'activate') {
        // Trigger effect immediately (as    if (action === 'activate') {
        // 1. Trigger Activation Visuals/Logic
        // Ensure we call activation logic (which calls cardEffects)
        // We need to pass 'true' to activateSetCard to treat it as Chain Link 1 if started here
        // But executeOpponentPlay is Main Phase action, so yes CL1.
        setTimeout(() => { activateSetCard(newCard, true); }, 500);
    }
}

/**
 * Direct Hand Activation for AI
 * Bypasses generic "Set" logic mostly to ensure correct state.
 */
function executeAIHandActivation(cardData) {
    const zones = document.querySelectorAll('.opp-zone.spell-trap-zone');
    let targetZone = null;
    for (let z of zones) { if (z.children.length === 0) { targetZone = z; break; } }

    if (!targetZone) { log("[AI] Spells Full!"); return; }

    const newCard = document.createElement('div');
    newCard.className = 'card face-up pos-atk'; // Create FACE UP directly
    newCard.setAttribute('data-turn', turnCount);
    newCard.setAttribute('data-uid', generateUID());
    newCard.setAttribute('data-owner', 'opponent'); // Critical

    // Copy Attributes
    newCard.setAttribute('data-name', cardData.name);
    newCard.setAttribute('data-type', cardData.humanReadableCardType || cardData.type);
    newCard.setAttribute('data-img', cardData.img);
    newCard.setAttribute('data-card-category', 'spell');
    newCard.setAttribute('data-race', cardData.race || '');
    newCard.setAttribute('data-sub-type', cardData.subType || '');

    newCard.style.backgroundImage = `url('${cardData.img}')`;

    targetZone.appendChild(newCard);

    // Remove from Hand Logic (Simulated by finding Card in Hand Array/State?)
    // executeOpponentPlay usually handles "Remove from Hand Element" if passed an element.
    // Here we passed 'cardData' which object.
    // We must ensure the hand visual is updated.
    // Since AI hand is hidden, any card removal visualizes "playing a card".
    const handContainer = document.querySelector('.opponent-hand-container');
    if (handContainer && handContainer.children.length > 0) {
        handContainer.children[0].remove();
    }

    // Activate Immediately
    // No timeout, just go.
    activateSetCard(newCard, true); // force=true
}

// --- AI DECISION LOGIC ---

function aiShouldActivate(cardOrData) {
    // If it's a DOM element
    let cardEl = null;
    let name = '';

    if (cardOrData.nodeType) {
        cardEl = cardOrData;
        name = cardEl.getAttribute('data-name');
    } else {
        // It's a data object (from Hand)
        name = cardOrData.name;
    }

    // 1. Check Technical Legality (if element exists)
    if (cardEl) {
        if (!validateActivation(cardEl, ChainManager.stack.length === 0)) return false;
    } else {
        // If from Hand (data object), we simulate Condition Check
        if (cardEffects[name] && typeof cardEffects[name].condition === 'function') {
            const dummy = document.createElement('div');
            dummy.setAttribute('data-name', name);
            if (!cardEffects[name].condition(dummy)) return false;
        }
    }

    // 2. Strategic Heuristics (Avoid wasting cards)

    // Destruction Logic
    const playerMons = document.querySelectorAll('.player-zone.monster-zone .card').length;
    const playerBackrow = document.querySelectorAll('.player-zone.spell-trap-zone .card, .player-zone.field-zone .card').length;

    if (['Raigeki', 'Dark Hole', 'Fissure', 'Smashing Ground', 'Trap Hole'].includes(name)) {
        if (playerMons === 0) return false;
    }

    if (['Heavy Storm', 'Harpie\'s Feather Duster', 'Mystical Space Typhoon', 'Dust Tornado', 'Twister'].includes(name)) {
        if (playerBackrow === 0) return false;
    }

    // Stat Modifiers / Battle
    if (['Rush Recklessly', 'Reinforcements', 'Castle Walls'].includes(name)) {
        // Allow in MP1 (Pre-Battle Buff) OR BP (During Attack)
        // Disallow MP2 and EP
        if (currentPhase === 'MP2' || currentPhase === 'EP' || currentPhase === 'DP' || currentPhase === 'SP') return false;

        if (currentPhase === 'BP' && !battleState.isAttacking) return false;

        // FIX: Must have a monster to target!
        // We assume AI only targets its own monsters for buffs (simplified)
        const aiMonsters = document.querySelectorAll('.opp-zone.monster-zone .card').length;
        if (aiMonsters === 0) return false;
    }

    // Mirror Force / Sakuretsu - handled by condition implicitly mostly, but explicit check:
    if (['Mirror Force', 'Sakuretsu Armor', 'Magic Cylinder'].includes(name)) {
        if (!battleState.isAttacking) return false;
    }

    return true;
}

// These methods are added to ChainManager but defined here for AI logic
// They will be called from main.js ChainManager object

function aiSelectBestResponse(candidates) {
    if (!candidates || candidates.length === 0) return null;

    // Filter by validity first using general heuristic
    const validCandidates = candidates.filter(c => aiShouldActivate(c.el));

    if (validCandidates.length === 0) return null;

    // Advanced Filtering ("Perfect Timing")
    const timedCandidates = validCandidates.filter(c => {
        const name = c.name;

        // 1. Battle Tricks (Reinforcements, Rush Recklessly)
        if (['Reinforcements', 'Rush Recklessly', 'Castle Walls'].includes(name)) {
            if (currentPhase === 'BP' && battleState.isAttacking) {
                // Check if we are winning or losing
                // Simplified: Assuming we know who is fighting
                // If AI is defender and ATK < Attacker ATK -> Activate
                // If AI is attacker and ATK < Defender ATK -> Activate
                // Implementation requires access to current battle stats (battleState.attacker, battleState.target)
                // If battleState vars are global:
                if (battleState.attacker && battleState.target) {
                    const aiCard = (getController(battleState.attacker) === 'opponent') ? battleState.attacker : battleState.target;
                    const playerCard = (aiCard === battleState.attacker) ? battleState.target : battleState.attacker;

                    if (aiCard && playerCard) {
                        const aiAtk = parseInt(aiCard.getAttribute('data-atk')) || 0;
                        const pAtk = parseInt(playerCard.getAttribute('data-atk')) || 0; // Or DEF?
                        // Simplified ATK vs ATK

                        // If AI winning heavily, don't waste
                        if (aiAtk >= pAtk + 500) return false;

                        // If AI losing slightly, activate
                        if (aiAtk < pAtk) return true;

                        // If AI winning slightly, maybe save? But usually secure the win.
                        return true;
                    }
                }
            }
        }

        // 2. Removal (Raigeki, Trap Hole) - Assuming chain response to Summon?
        // Trap Hole is Speed 2? No, normal trap. 
        // If responding to summon:
        if (name === 'Trap Hole') {
            // Check last summoned monster stats
            // We can check the "last chain link" or assume the system prompts us appropriately.
            // Heuristic: If opponent has Strong Monster (>1500), activate.
            const oppMons = document.querySelectorAll('.player-zone.monster-zone .card');
            let hasThreat = false;
            oppMons.forEach(m => {
                const atk = parseInt(m.getAttribute('data-atk')) || 0;
                if (atk >= 1500) hasThreat = true;
            });
            return hasThreat;
        }

        return true;
    });

    if (timedCandidates.length === 0) return null;

    // Sort by priority (Simple heuristic)
    timedCandidates.sort((a, b) => {
        const getScore = (cand) => {
            const name = cand.name;
            if (name === 'Magic Jammer' || name === 'Seven Tools of the Bandit') return 10;
            if (name === 'Mirror Force' || name === 'Sakuretsu Armor') return 9;
            if (name === 'Trap Hole') return 8;
            if (name === 'Ring of Destruction') return 7;
            if (name === 'Mystical Space Typhoon') return 6;
            return 1;
        };
        return getScore(b) - getScore(a);
    });

    return timedCandidates[0];
}

function aiCheckChain(candidates) {
    return aiSelectBestResponse(candidates);
}

// =========================================
// AI TARGETING LOGIC
// =========================================

/**
 * Handle AI selection for targeting effects (Equip Spells, Traps, etc.)
 * Called when ChainManager pauses for AI selection.
 */
function aiResolveTarget() {
    const resolvingCard = document.querySelector('.card.resolving');
    if (!resolvingCard) {
        // Fallback?
        ChainManager.isPaused = false;
        ChainManager.resolve();
        return;
    }

    const cardName = resolvingCard.getAttribute('data-name');
    const type = resolvingCard.getAttribute('data-type') || "";
    const race = resolvingCard.getAttribute('data-race') || "";

    // Determine Target Type
    let targetType = 'monster';
    if (type.includes('Spell') || type.includes('Trap')) {
        // Logic depends on card. simplified:
        if (cardName === 'Mystical Space Typhoon') targetType = 'spell';
    }

    // Find Candidates
    let candidates = [];
    if (targetType === 'monster') {
        const zoneSelector = (cardName === 'Monster Reborn') ? '.monster-zone' : '.monster-zone';
        // For Equips/Buffs -> Prefer Own Monsters
        // For Destruction -> Prefer Opponent Monsters

        const isBuff = ['Axe of Despair', 'Malevolent Nuzzler', 'Rush Recklessly', 'Reinforcements'].includes(cardName) || type.includes('Equip') || race === 'Equip';
        const isDestruction = ['Fissure', 'Smashing Ground', 'Trap Hole', 'Ring of Destruction'].includes(cardName);

        if (isBuff) {
            candidates = Array.from(document.querySelectorAll('.opp-zone.monster-zone .card')); // AI uses Opp-Zone (itself)
        } else if (isDestruction) {
            candidates = Array.from(document.querySelectorAll('.player-zone.monster-zone .card')); // AI targets Player
        } else {
            // General/Fallback
            candidates = Array.from(document.querySelectorAll('.monster-zone .card'));
        }
    } else {
        // Spell destruction -> Player backrow
        candidates = Array.from(document.querySelectorAll('.player-zone.spell-trap-zone .card'));
    }

    // fallback if specific targeting failed (e.g. no targets)
    if (candidates.length === 0) {
        log(`[AI] No targets for ${cardName}. Effect fizzles.`);
        ChainManager.continueResolution();
        return;
    }

    // Selection Strategy: Best/Worst
    // Buff: Buff strongest to make it stronger? Or Buff weak? 
    // Logic: Buff Strongest usually.
    // Destruction: Destroy Strongest.

    let bestTarget = candidates[0];
    let bestStat = -1;

    candidates.forEach(c => {
        const atk = parseInt(c.getAttribute('data-atk'));
        if (atk > bestStat) {
            bestStat = atk;
            bestTarget = c;
        }
    });

    log(`[AI] Targets ${bestTarget.getAttribute('data-name')} with ${cardName}.`);

    // EXECUTE TARGET LOGIC
    // We reuse executeSpellTargetLogic to ensure consistency

    spellState.isTargeting = true;
    spellState.sourceCard = resolvingCard;

    // Call existing logic
    executeSpellTargetLogic(bestTarget);

    // Resume Chain if not done by helper
    // executeSpellTargetLogic usually just sets attrs.
    if (ChainManager.isPaused) {
        ChainManager.continueResolution();
    }
}
