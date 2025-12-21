// =========================================
// ENGINE.JS - Pure Game Logic Layer
// =========================================
//
// CRITICAL RULES:
// - All functions accept GameState as first parameter
// - All functions return NEW GameState (immutable)
// - NO document.querySelector or DOM manipulation
// - NO window, alert, prompt, or UI code
// - NO animations or setTimeout
// - Pure data transformation only
//
// This enables AI to simulate thousands of moves
// per second without rendering overhead.

// =========================================
// CARD MOVEMENT FUNCTIONS
// =========================================

/**
 * Draw a card from deck to hand
 * @param {GameState} state - Current game state
 * @param {string} playerId - 'player' or 'opponent'
 * @returns {GameState} New state with card drawn
 */
function Engine_drawCard(state, playerId) {
    const newState = state.clone();
    const player = newState.getPlayer(playerId);

    if (player.deck.length === 0) {
        // Deck out - player loses
        newState.turnInfo.gameOver = true;
        newState.turnInfo.winner = playerId === 'player' ? 'opponent' : 'player';
        newState.turnInfo.winReason = 'Deck Out';
        return newState;
    }

    const card = player.deck.pop();
    player.hand.push(card);
    return newState;
}

/**
 * Move card from hand to field
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} handIndex - Index in hand array
 * @param {number} fieldIndex - Destination zone index
 * @param {string} zone - 'monsters' or 'spells'
 * @param {Object} cardState - {faceUp, position, etc}
 * @returns {GameState}
 */
function Engine_playCardFromHand(state, playerId, handIndex, fieldIndex, zone, cardState) {
    const newState = state.clone();
    const player = newState.getPlayer(playerId);

    // Validate indices
    if (handIndex < 0 || handIndex >= player.hand.length) return state;
    if (fieldIndex < 0 || fieldIndex >= player.field[zone].length) return state;
    if (player.field[zone][fieldIndex] !== null) return state; // Zone occupied

    const card = player.hand[handIndex];
    player.hand.splice(handIndex, 1);

    // Add to field zone with state
    player.field[zone][fieldIndex] = {
        ...card,
        faceUp: cardState.faceUp,
        position: cardState.position, // 'atk' or 'def'
        turnPlayed: newState.turnInfo.turnCount,
        attacked: false,
        setTurn: cardState.setTurn || null
    };

    return newState;
}

/**
 * Send card to graveyard
 * @param {GameState} state 
 * @param {string} playerId - Owner of the card
 * @param {string} zone - 'monsters', 'spells', 'hand'
 * @param {number} zoneIndex 
 * @returns {GameState}
 */
function Engine_sendToGraveyard(state, playerId, zone, zoneIndex) {
    const newState = state.clone();
    const player = newState.getPlayer(playerId);

    let card;
    if (zone === 'hand') {
        if (zoneIndex < 0 || zoneIndex >= player.hand.length) return state;
        card = player.hand[zoneIndex];
        player.hand.splice(zoneIndex, 1);
    } else if (zone === 'monsters' || zone === 'spells') {
        if (zoneIndex < 0 || zoneIndex >= player.field[zone].length) return state;
        card = player.field[zone][zoneIndex];
        player.field[zone][zoneIndex] = null;
    }

    if (card) {
        // Strip state data, keep card data
        const gyCard = {
            name: card.name,
            img: card.img,
            atk: card.atk || card['data-atk'],
            def: card.def || card['data-def'],
            desc: card.desc,
            type: card.type,
            category: card.category,
            level: card.level,
            attribute: card.attribute,
            race: card.race
        };
        player.gy.push(gyCard);
    }

    return newState;
}

/**
 * Move card from graveyard to hand
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} gyIndex 
 * @returns {GameState}
 */
function Engine_retrieveFromGraveyard(state, playerId, gyIndex) {
    const newState = state.clone();
    const player = newState.getPlayer(playerId);

    if (gyIndex < 0 || gyIndex >= player.gy.length) return state;

    const card = player.gy[gyIndex];
    player.gy.splice(gyIndex, 1);
    player.hand.push(card);

    return newState;
}

// =========================================
// SUMMON FUNCTIONS
// =========================================

/**
 * Normal Summon a monster
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} handIndex 
 * @param {number} monsterZoneIndex 
 * @param {string} position - 'atk' or 'def'
 * @param {boolean} faceUp 
 * @returns {GameState}
 */
function Engine_normalSummon(state, playerId, handIndex, monsterZoneIndex, position, faceUp) {
    const newState = state.clone();

    // Check if normal summon already used
    if (newState.turnInfo.normalSummonUsed) {
        return state; // Invalid action
    }

    // Check if it's the player's turn
    if (newState.turnInfo.activePlayer !== playerId) {
        return state; // Invalid action
    }

    // Check if it's Main Phase
    if (newState.turnInfo.phase !== 'MP1' && newState.turnInfo.phase !== 'MP2') {
        return state;
    }

    // Perform the summon
    const result = Engine_playCardFromHand(
        newState, playerId, handIndex, monsterZoneIndex, 'monsters',
        { faceUp, position }
    );

    result.turnInfo.normalSummonUsed = true;
    return result;
}

/**
 * Tribute summon a monster
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} handIndex 
 * @param {number} monsterZoneIndex 
 * @param {Array<number>} tributeIndices - Zones to tribute
 * @returns {GameState}
 */
function Engine_tributeSummon(state, playerId, handIndex, monsterZoneIndex, tributeIndices) {
    let newState = state.clone();
    const player = newState.getPlayer(playerId);

    if (handIndex < 0 || handIndex >= player.hand.length) return state;

    const card = player.hand[handIndex];

    // Validate tribute count
    const level = card.level || 0;
    const required = level >= 7 ? 2 : level >= 5 ? 1 : 0;
    if (tributeIndices.length < required) return state;

    // Send tributes to GY (in reverse order to maintain indices)
    for (const zoneIdx of tributeIndices.sort((a, b) => b - a)) {
        newState = Engine_sendToGraveyard(newState, playerId, 'monsters', zoneIdx);
    }

    // Summon the monster
    newState = Engine_playCardFromHand(
        newState, playerId, handIndex, monsterZoneIndex, 'monsters',
        { faceUp: true, position: 'atk' }
    );

    newState.turnInfo.normalSummonUsed = true;
    return newState;
}

/**
 * Special summon a monster
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {Object} card - Card data
 * @param {number} monsterZoneIndex 
 * @param {string} position 
 * @param {boolean} faceUp 
 * @returns {GameState}
 */
function Engine_specialSummon(state, playerId, card, monsterZoneIndex, position, faceUp) {
    const newState = state.clone();
    const player = newState.getPlayer(playerId);

    // Validate zone
    if (monsterZoneIndex < 0 || monsterZoneIndex >= player.field.monsters.length) return state;
    if (player.field.monsters[monsterZoneIndex] !== null) return state;

    // Place card directly on field
    player.field.monsters[monsterZoneIndex] = {
        ...card,
        faceUp,
        position,
        turnPlayed: newState.turnInfo.turnCount,
        attacked: false,
        specialSummoned: true
    };

    return newState;
}

/**
 * Set a spell/trap card
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} handIndex 
 * @param {number} spellZoneIndex 
 * @returns {GameState}
 */
function Engine_setSpellTrap(state, playerId, handIndex, spellZoneIndex) {
    return Engine_playCardFromHand(
        state, playerId, handIndex, spellZoneIndex, 'spells',
        { faceUp: false, position: 'atk', setTurn: state.turnInfo.turnCount }
    );
}

// =========================================
// BATTLE FUNCTIONS
// =========================================

/**
 * Resolve battle between two monsters
 * @param {GameState} state 
 * @param {string} attackerPlayerId 
 * @param {number} attackerZone 
 * @param {string} defenderPlayerId 
 * @param {number} defenderZone 
 * @returns {GameState}
 */
function Engine_resolveBattle(state, attackerPlayerId, attackerZone, defenderPlayerId, defenderZone) {
    const newState = state.clone();
    const attacker = newState.getPlayer(attackerPlayerId).field.monsters[attackerZone];
    const defender = newState.getPlayer(defenderPlayerId).field.monsters[defenderZone];

    if (!attacker || !defender) return state;

    const atkVal = attacker.atk || 0;
    const defVal = defender.position === 'atk' ? (defender.atk || 0) : (defender.def || 0);

    let result = newState;

    if (atkVal > defVal) {
        // Attacker wins - destroy defender
        result = Engine_sendToGraveyard(result, defenderPlayerId, 'monsters', defenderZone);

        // Inflict damage if ATK vs ATK
        if (defender.position === 'atk') {
            const damage = atkVal - defVal;
            result = Engine_inflictDamage(result, defenderPlayerId, damage);
        }
    } else if (atkVal < defVal) {
        // Defender wins
        if (defender.position === 'atk') {
            // Destroy attacker, damage attacker's controller
            result = Engine_sendToGraveyard(result, attackerPlayerId, 'monsters', attackerZone);
            const damage = defVal - atkVal;
            result = Engine_inflictDamage(result, attackerPlayerId, damage);
        } else {
            // Just damage attacker (DEF position)
            const damage = defVal - atkVal;
            result = Engine_inflictDamage(result, attackerPlayerId, damage);
        }
    } else {
        // Equal - both destroyed if ATK vs ATK
        if (defender.position === 'atk') {
            result = Engine_sendToGraveyard(result, attackerPlayerId, 'monsters', attackerZone);
            result = Engine_sendToGraveyard(result, defenderPlayerId, 'monsters', defenderZone);
        }
        // If DEF position, nothing happens
    }

    // Mark attacker as attacked (if still on field)
    const attackerStillExists = result.getPlayer(attackerPlayerId).field.monsters[attackerZone];
    if (attackerStillExists) {
        result.getPlayer(attackerPlayerId).field.monsters[attackerZone].attacked = true;
    }

    return result;
}

/**
 * Direct attack
 * @param {GameState} state 
 * @param {string} attackerPlayerId 
 * @param {number} attackerZone 
 * @returns {GameState}
 */
function Engine_directAttack(state, attackerPlayerId, attackerZone) {
    const newState = state.clone();
    const attacker = newState.getPlayer(attackerPlayerId).field.monsters[attackerZone];

    if (!attacker) return state;
    if (attacker.attacked) return state; // Already attacked

    const damage = attacker.atk || 0;
    const defenderPlayerId = attackerPlayerId === 'player' ? 'opponent' : 'player';

    let result = Engine_inflictDamage(newState, defenderPlayerId, damage);

    // Mark attacker as attacked
    if (result.getPlayer(attackerPlayerId).field.monsters[attackerZone]) {
        result.getPlayer(attackerPlayerId).field.monsters[attackerZone].attacked = true;
    }

    return result;
}

// =========================================
// LIFE POINT FUNCTIONS
// =========================================

/**
 * Inflict damage to a player
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} damage 
 * @returns {GameState}
 */
function Engine_inflictDamage(state, playerId, damage) {
    const newState = state.clone();
    const player = newState.getPlayer(playerId);

    player.lp -= damage;

    // Check win condition
    if (player.lp <= 0) {
        player.lp = 0; // Cap at 0
        newState.turnInfo.gameOver = true;
        newState.turnInfo.winner = playerId === 'player' ? 'opponent' : 'player';
        newState.turnInfo.winReason = 'LP Reached 0';
    }

    return newState;
}

/**
 * Restore LP
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} amount 
 * @returns {GameState}
 */
function Engine_gainLP(state, playerId, amount) {
    const newState = state.clone();
    newState.getPlayer(playerId).lp += amount;
    return newState;
}

// =========================================
// TURN/PHASE FUNCTIONS
// =========================================

/**
 * Switch to next player's turn
 * @param {GameState} state 
 * @returns {GameState}
 */
function Engine_switchTurn(state) {
    const newState = state.clone();
    newState.turnInfo.activePlayer =
        newState.turnInfo.activePlayer === 'player' ? 'opponent' : 'player';
    newState.turnInfo.turnCount++;
    newState.turnInfo.phase = 'DP';
    newState.turnInfo.normalSummonUsed = false;

    // Reset attacked flags for all monsters
    ['player', 'opponent'].forEach(p => {
        const player = newState.getPlayer(p);
        player.field.monsters.forEach(m => {
            if (m) m.attacked = false;
        });
    });

    return newState;
}

/**
 * Change phase
 * @param {GameState} state 
 * @param {string} phase - 'DP', 'SP', 'MP1', 'BP', 'MP2', 'EP'
 * @returns {GameState}
 */
function Engine_setPhase(state, phase) {
    const newState = state.clone();
    newState.turnInfo.phase = phase;
    return newState;
}

// =========================================
// CARD STATE FUNCTIONS
// =========================================

/**
 * Change monster position
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} monsterZone 
 * @param {string} newPosition - 'atk' or 'def'
 * @returns {GameState}
 */
function Engine_changePosition(state, playerId, monsterZone, newPosition) {
    const newState = state.clone();
    const monster = newState.getPlayer(playerId).field.monsters[monsterZone];

    if (!monster) return state;
    if (monster.attacked) return state; // Can't change if attacked
    if (monster.turnPlayed === newState.turnInfo.turnCount) return state; // Can't change on summon turn

    monster.position = newPosition;
    monster.faceUp = true; // Changing position reveals the card

    return newState;
}

/**
 * Flip monster face-up
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} monsterZone 
 * @returns {GameState}
 */
function Engine_flipMonster(state, playerId, monsterZone) {
    const newState = state.clone();
    const monster = newState.getPlayer(playerId).field.monsters[monsterZone];

    if (!monster) return state;

    monster.faceUp = true;

    return newState;
}

/**
 * Modify monster stats
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} monsterZone 
 * @param {number} atkMod 
 * @param {number} defMod 
 * @returns {GameState}
 */
function Engine_modifyStats(state, playerId, monsterZone, atkMod, defMod) {
    const newState = state.clone();
    const monster = newState.getPlayer(playerId).field.monsters[monsterZone];

    if (!monster) return state;

    monster.atk = (monster.atk || 0) + atkMod;
    monster.def = (monster.def || 0) + defMod;

    // Ensure stats don't go negative
    if (monster.atk < 0) monster.atk = 0;
    if (monster.def < 0) monster.def = 0;

    return newState;
}

// =========================================
// UTILITY FUNCTIONS
// =========================================

/**
 * Get all legal moves for a player
 * @param {GameState} state 
 * @param {string} playerId 
 * @returns {Array} Array of move objects
 */
function Engine_getLegalMoves(state, playerId) {
    const moves = [];
    const player = state.getPlayer(playerId);

    // Can only make moves on your turn
    if (state.turnInfo.activePlayer !== playerId) return moves;

    const phase = state.turnInfo.phase;

    // Main Phase moves
    if (phase === 'MP1' || phase === 'MP2') {
        // Normal Summons
        if (!state.turnInfo.normalSummonUsed) {
            player.hand.forEach((card, handIdx) => {
                if (card.category === 'monster' && card.level <= 4) {
                    player.field.monsters.forEach((slot, zoneIdx) => {
                        if (slot === null) {
                            moves.push({
                                type: 'NORMAL_SUMMON',
                                playerId,
                                handIndex: handIdx,
                                zoneIndex: zoneIdx,
                                position: 'atk',
                                faceUp: true
                            });
                            moves.push({
                                type: 'SET_MONSTER',
                                playerId,
                                handIndex: handIdx,
                                zoneIndex: zoneIdx,
                                position: 'def',
                                faceUp: false
                            });
                        }
                    });
                }
            });
        }

        // Set Spell/Trap
        player.hand.forEach((card, handIdx) => {
            if (card.category === 'spell' || card.category === 'trap') {
                player.field.spells.forEach((slot, zoneIdx) => {
                    if (slot === null) {
                        moves.push({
                            type: 'SET_SPELL',
                            playerId,
                            handIndex: handIdx,
                            zoneIndex: zoneIdx
                        });
                    }
                });
            }
        });
    }

    // Battle Phase moves
    if (phase === 'BP') {
        player.field.monsters.forEach((monster, zoneIdx) => {
            if (monster && monster.faceUp && !monster.attacked && monster.position === 'atk') {
                const opponent = state.getOpponent(playerId);

                // Check for direct attack
                const hasDefenders = opponent.field.monsters.some(m => m !== null);
                if (!hasDefenders) {
                    moves.push({
                        type: 'DIRECT_ATTACK',
                        playerId,
                        attackerZone: zoneIdx
                    });
                } else {
                    // Attack each possible target
                    opponent.field.monsters.forEach((target, targetZone) => {
                        if (target) {
                            moves.push({
                                type: 'ATTACK',
                                playerId,
                                attackerZone: zoneIdx,
                                targetZone: targetZone
                            });
                        }
                    });
                }
            }
        });
    }

    return moves;
}

/**
 * Apply a move to the state
 * @param {GameState} state 
 * @param {Object} move 
 * @returns {GameState}
 */
function Engine_applyMove(state, move) {
    switch (move.type) {
        case 'NORMAL_SUMMON':
            return Engine_normalSummon(state, move.playerId, move.handIndex, move.zoneIndex, move.position, move.faceUp);
        case 'SET_MONSTER':
            return Engine_normalSummon(state, move.playerId, move.handIndex, move.zoneIndex, move.position, move.faceUp);
        case 'SET_SPELL':
            return Engine_setSpellTrap(state, move.playerId, move.handIndex, move.zoneIndex);
        case 'ACTIVATE_SPELL':
            return Engine_simulateSpellActivation(state, move.playerId, move.handIndex, move.card);
        case 'TRIBUTE_SUMMON':
            return Engine_tributeSummon(state, move.playerId, move.handIndex, move.zoneIndex, move.position, move.faceUp, move.tributes);
        case 'CHANGE_POSITION':
            return Engine_changePosition(state, move.playerId, move.zoneIndex, move.newPosition);
        case 'ATTACK':
            const opponentId = move.playerId === 'player' ? 'opponent' : 'player';
            return Engine_resolveBattle(state, move.playerId, move.attackerZone, opponentId, move.targetZone);
        case 'DIRECT_ATTACK':
            return Engine_directAttack(state, move.playerId, move.attackerZone);
        default:
            return state;
    }
}

/**
 * Evaluate state for AI (simple heuristic)
 * @param {GameState} state 
 * @param {string} forPlayer - Player to evaluate for
 * @returns {number} Score (positive is good for forPlayer)
 */
function Engine_evaluateState(state, forPlayer) {
    const player = state.getPlayer(forPlayer);
    const opponent = state.getOpponent(forPlayer);

    // Win/Loss
    if (state.turnInfo.gameOver) {
        if (state.turnInfo.winner === forPlayer) return 10000;
        return -10000;
    }

    let score = 0;

    // LP Difference
    score += (player.lp - opponent.lp) * 2;

    // Board Presence (ATK)
    const playerBoardAtk = player.field.monsters
        .filter(m => m && m.faceUp)
        .reduce((sum, m) => sum + (m.atk || 0), 0);
    const oppBoardAtk = opponent.field.monsters
        .filter(m => m && m.faceUp)
        .reduce((sum, m) => sum + (m.atk || 0), 0);
    score += (playerBoardAtk - oppBoardAtk);

    // Card Advantage
    const playerCards = player.hand.length + player.field.monsters.filter(m => m).length + player.field.spells.filter(s => s).length;
    const oppCards = opponent.hand.length + opponent.field.monsters.filter(m => m).length + opponent.field.spells.filter(s => s).length;
    score += (playerCards - oppCards) * 100;

    return score;
}

/**
 * Simulate Spell Activation for AI Minimax
 * (Simplified effects)
 */
function Engine_simulateSpellActivation(state, playerId, handIndex, card) {
    const player = state.getPlayer(playerId);
    const opponent = state.getOpponent(playerId);

    // Remove from hand
    player.hand.splice(handIndex, 1);

    // Apply Effects
    const name = card.name;

    if (name === 'Pot of Greed') {
        // Draw 2
        // We can't draw real cards in sim, but we can incr generic card count
        // Or if we have deck knowledge?
        // Simpler: Just add dummy objects
        player.hand.push({ name: 'Unknown', category: 'spell' });
        player.hand.push({ name: 'Unknown', category: 'spell' });
    }
    else if (name === 'Raigeki') {
        // Destroy all opp monsters
        opponent.field.monsters = [null, null, null];
    }
    else if (name === 'Dark Hole') {
        player.field.monsters = [null, null, null];
        opponent.field.monsters = [null, null, null];
    }
    else if (name === 'Ookazi') {
        opponent.lp -= 800;
    }
    else if (name === 'Dian Keto the Cure Master') {
        player.lp += 1000;
    }
    else if (name === 'Hinotama') {
        opponent.lp -= 500;
    }
    else if (name === 'Monster Reborn') {
        // Find best monster in either GY (Simulate simply by adding a strong monster)
        // Check if monster zones full
        const emptySlot = player.field.monsters.findIndex(m => m === null);
        if (emptySlot !== -1) {
            player.field.monsters[emptySlot] = { atk: 2500, def: 2000, faceUp: true, name: 'Revived Monster' };
        }
    }
    else if (name === 'Mystical Space Typhoon') {
        // Destroy 1 S/T
        const oppST = opponent.field.spells.findIndex(s => s !== null);
        if (oppST !== -1) {
            opponent.field.spells[oppST] = null;
        }
    }
    // Simple Equip Simulation & Stat Buffs
    // Check Equip OR Buffs (including Quick-Play stats like Rush Recklessly)
    else if ((card.type && card.type.includes('Equip')) || card.race === 'Equip' || card.subType === 'Equip' ||
        ['Rush Recklessly', 'Reinforcements'].includes(name)) {
        // Find best monster
        const bestMonster = player.field.monsters.reduce((prev, curr) => {
            if (!curr) return prev;
            if (!prev) return curr;
            return (curr.atk > prev.atk) ? curr : prev;
        }, null);

        if (bestMonster) {
            // Apply generic buff (e.g. 500-1000)
            let buff = 500;
            if (name === 'Axe of Despair') buff = 1000;
            else if (name === 'Malevolent Nuzzler' || name === 'Rush Recklessly') buff = 700;
            else if (name === 'Reinforcements') buff = 500;

            bestMonster.atk = (parseInt(bestMonster.atk) || 0) + buff;
        }
    }
    // Continuous Spells (Simulation)
    else if (name === 'Banner of Courage') {
        // Mock effect: +200 to all my monsters (Simulates value)
        player.field.monsters.forEach(m => {
            if (m) m.atk = (parseInt(m.atk) || 0) + 200;
        });
    }
    else if (name === 'Burning Land') {
        // Mock effect: Inflict 500 damage (Value of activating it)
        opponent.lp -= 500;
    }

    return state;
}

// Export for Node.js (if needed for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Engine_drawCard,
        Engine_playCardFromHand,
        Engine_sendToGraveyard,
        Engine_retrieveFromGraveyard,
        Engine_normalSummon,
        Engine_tributeSummon,
        Engine_specialSummon,
        Engine_setSpellTrap,
        Engine_resolveBattle,
        Engine_directAttack,
        Engine_inflictDamage,
        Engine_gainLP,
        Engine_switchTurn,
        Engine_setPhase,
        Engine_changePosition,
        Engine_flipMonster,
        Engine_modifyStats,
        Engine_getLegalMoves,
        Engine_applyMove,
        Engine_evaluateState
    };
}
