// =========================================
// SIMULATION.JS - AI Brain / Tree Search
// =========================================
//
// This module implements game tree search algorithms
// to enable AI to "think ahead" by simulating future moves.
//
// Algorithms:
// - Minimax with Alpha-Beta Pruning
// - Advanced Position Evaluation
//
// The AI can now answer: "What happens if I make this move?"

// =========================================
// CONFIGURATION
// =========================================

const AI_CONFIG = {
    // Minimax depth (turns to look ahead)
    MINIMAX_DEPTH: 2,  // Start conservative (2 turns = 1 full round)

    // Algorithm selection
    ALGORITHM: 'minimax',

    // Time limit per move (ms)
    TIME_LIMIT: 3000,

    // Evaluation weights
    EVAL_WEIGHTS: {
        LP_DIFF: 5,
        BOARD_ATK: 10,
        CARD_ADVANTAGE: 150,
        TEMPO: 100,
        BACKROW: 30,
        MONSTER_COUNT: 50
    },

    // Debug logging
    DEBUG: true
};

// =========================================
// HELPER FUNCTIONS
// =========================================

/**
 * Get combinations of array elements
 * @param {Array} arr 
 * @param {number} k - Number to select
 * @returns {Array} Array of combinations
 */
function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];

    const [first, ...rest] = arr;
    const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = getCombinations(rest, k);

    return [...withFirst, ...withoutFirst];
}

/**
 * Count cards in field
 */
function countFieldCards(player) {
    return player.field.monsters.filter(m => m).length +
        player.field.spells.filter(s => s).length;
}

/**
 * Count backrow (set spell/trap)
 */
function countBackrow(player) {
    return player.field.spells.filter(s => s && !s.faceUp).length;
}

/**
 * Get board ATK value
 */
function getBoardATK(player) {
    return player.field.monsters
        .filter(m => m && m.faceUp && m.position === 'atk')
        .reduce((sum, m) => sum + (m.atk || 0), 0);
}

// =========================================
// MOVE GENERATION
// =========================================

/**
 * Get all legal moves for simplified AI
 * (Focuses on most common actions to keep search tractable)
 * @param {GameState} state 
 * @param {string} playerId 
 * @returns {Array<Move>}
 */
function Sim_getAllMoves(state, playerId) {
    const moves = [];
    const player = state.getPlayer(playerId);
    const phase = state.turnInfo.phase;

    // Main Phase actions
    if (phase === 'MP1' || phase === 'MP2') {
        // Normal summons
        if (!state.turnInfo.normalSummonUsed) {
            player.hand.forEach((card, handIdx) => {
                if (card.category !== 'monster') return;

                const level = card.level || 0;

                // Level 1-4: No tribute
                if (level <= 4) {
                    player.field.monsters.forEach((slot, zoneIdx) => {
                        if (slot === null) {
                            // Summon in ATK
                            moves.push({
                                type: 'NORMAL_SUMMON',
                                playerId,
                                handIndex: handIdx,
                                zoneIndex: zoneIdx,
                                position: 'atk',
                                faceUp: true,
                                card: card
                            });
                            // Set in DEF
                            moves.push({
                                type: 'SET_MONSTER',
                                playerId,
                                handIndex: handIdx,
                                zoneIndex: zoneIdx,
                                position: 'def',
                                faceUp: false,
                                card: card
                            });
                        }
                    });
                }
            });
        }

        // Set spell/trap (simplified - only sets, no activations from hand for now)
        player.hand.forEach((card, handIdx) => {
            if (card.category === 'spell' || card.category === 'trap') {
                player.field.spells.forEach((slot, zoneIdx) => {
                    if (slot === null) {
                        moves.push({
                            type: 'SET_SPELL',
                            playerId,
                            handIndex: handIdx,
                            zoneIndex: zoneIdx,
                            card: card
                        });
                    }
                });
            }
        });

        // Pass to next phase
        moves.push({
            type: 'PASS_PHASE',
            playerId
        });
    }

    // Battle Phase actions
    if (phase === 'BP') {
        const opponent = state.getOpponent(playerId);
        const hasDefenders = opponent.field.monsters.some(m => m !== null);

        player.field.monsters.forEach((monster, zoneIdx) => {
            if (!monster || !monster.faceUp || monster.attacked) return;
            if (monster.position !== 'atk') return;

            if (!hasDefenders) {
                // Direct attack
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
        });

        // Pass to next phase
        moves.push({
            type: 'PASS_PHASE',
            playerId
        });
    }

    // If no moves generated, at least allow passing
    if (moves.length === 0) {
        moves.push({
            type: 'PASS_TURN',
            playerId
        });
    }

    return moves;
}

// =========================================
// POSITION EVALUATION
// =========================================

/**
 * Evaluate game state for a player
 * @param {GameState} state 
 * @param {string} forPlayer 
 * @returns {number} Score (higher is better for forPlayer)
 */
function Sim_evaluate(state, forPlayer) {
    const player = state.getPlayer(forPlayer);
    const opponent = state.getOpponent(forPlayer);

    // Terminal states
    if (state.turnInfo.gameOver) {
        return state.turnInfo.winner === forPlayer ? 100000 : -100000;
    }

    let score = 0;
    const w = AI_CONFIG.EVAL_WEIGHTS;

    // 1. LP Advantage
    score += (player.lp - opponent.lp) * w.LP_DIFF;

    // 2. Board Control (ATK)
    const playerBoardATK = getBoardATK(player);
    const oppBoardATK = getBoardATK(opponent);
    score += (playerBoardATK - oppBoardATK) * w.BOARD_ATK;

    // 3. Card Advantage
    const playerCards = player.hand.length + countFieldCards(player);
    const oppCards = opponent.hand.length + countFieldCards(opponent);
    score += (playerCards - oppCards) * w.CARD_ADVANTAGE;

    // 4. Tempo (active player bonus)
    if (state.turnInfo.activePlayer === forPlayer) {
        score += w.TEMPO;
    }

    // 5. Defensive resources (backrow)
    score += countBackrow(player) * w.BACKROW;
    score -= countBackrow(opponent) * w.BACKROW;

    // 6. Monster count advantage
    const playerMonsters = player.field.monsters.filter(m => m).length;
    const oppMonsters = opponent.field.monsters.filter(m => m).length;
    score += (playerMonsters - oppMonsters) * w.MONSTER_COUNT;

    return score;
}

// =========================================
// MINIMAX ALGORITHM
// =========================================

/**
 * Minimax with Alpha-Beta Pruning
 * @param {GameState} state 
 * @param {string} playerId - Player to optimize for
 * @param {number} depth - Remaining depth
 * @param {number} alpha - Best score for maximizer
 * @param {number} beta - Best score for minimizer
 * @param {boolean} isMaximizing 
 * @returns {Object} {score, move}
 */
function Sim_minimax(state, playerId, depth, alpha = -Infinity, beta = Infinity, isMaximizing = true) {
    // Terminal conditions
    if (depth === 0 || state.turnInfo.gameOver) {
        return {
            score: Sim_evaluate(state, playerId),
            move: null
        };
    }

    const currentPlayer = isMaximizing ? playerId : (playerId === 'player' ? 'opponent' : 'player');
    const moves = Sim_getAllMoves(state, currentPlayer);

    // No moves? Pass turn
    if (moves.length === 0) {
        const nextState = Engine_switchTurn(state);
        return Sim_minimax(nextState, playerId, depth - 1, alpha, beta, !isMaximizing);
    }

    let bestMove = moves[0]; // Default to first move

    if (isMaximizing) {
        let maxScore = -Infinity;

        for (const move of moves) {
            const newState = Sim_applyMove(state.clone(), move);
            const result = Sim_minimax(newState, playerId, depth - 1, alpha, beta, false);

            if (result.score > maxScore) {
                maxScore = result.score;
                bestMove = move;
            }

            alpha = Math.max(alpha, maxScore);
            // Alpha-beta pruning
            if (beta <= alpha) {
                if (AI_CONFIG.DEBUG) {
                    console.log(`[Minimax] Pruned at depth ${depth}`);
                }
                break;
            }
        }

        return { score: maxScore, move: bestMove };

    } else {
        let minScore = Infinity;

        for (const move of moves) {
            const newState = Sim_applyMove(state.clone(), move);
            const result = Sim_minimax(newState, playerId, depth - 1, alpha, beta, true);

            if (result.score < minScore) {
                minScore = result.score;
                bestMove = move;
            }

            beta = Math.min(beta, minScore);
            // Alpha-beta pruning
            if (beta <= alpha) {
                if (AI_CONFIG.DEBUG) {
                    console.log(`[Minimax] Pruned at depth ${depth}`);
                }
                break;
            }
        }

        return { score: minScore, move: bestMove };
    }
}

/**
 * Apply a move to state (uses Engine functions)
 * @param {GameState} state 
 * @param {Move} move 
 * @returns {GameState} New state
 */
function Sim_applyMove(state, move) {
    switch (move.type) {
        case 'NORMAL_SUMMON':
            return Engine_normalSummon(
                state, move.playerId, move.handIndex,
                move.zoneIndex, move.position, move.faceUp
            );

        case 'SET_MONSTER':
            return Engine_normalSummon(
                state, move.playerId, move.handIndex,
                move.zoneIndex, 'def', false
            );

        case 'SET_SPELL':
            return Engine_setSpellTrap(
                state, move.playerId, move.handIndex, move.zoneIndex
            );

        case 'ATTACK':
            const opponentId = move.playerId === 'player' ? 'opponent' : 'player';
            return Engine_resolveBattle(
                state, move.playerId, move.attackerZone,
                opponentId, move.targetZone
            );

        case 'DIRECT_ATTACK':
            return Engine_directAttack(
                state, move.playerId, move.attackerZone
            );

        case 'PASS_PHASE':
            // Advance to next phase
            const nextPhase = getNextPhase(state.turnInfo.phase);
            if (nextPhase === 'DP') {
                // End of turn
                return Engine_switchTurn(state);
            } else {
                return Engine_setPhase(state, nextPhase);
            }

        case 'PASS_TURN':
            return Engine_switchTurn(state);

        default:
            console.warn('[Sim] Unknown move type:', move.type);
            return state;
    }
}

/**
 * Get next phase in sequence
 */
function getNextPhase(currentPhase) {
    const sequence = ['DP', 'SP', 'MP1', 'BP', 'MP2', 'EP', 'DP'];
    const idx = sequence.indexOf(currentPhase);
    return sequence[idx + 1] || 'DP';
}

// =========================================
// AI DECISION INTERFACE
// =========================================

/**
 * Find best move using configured algorithm
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {number} depth - Optional override
 * @returns {Move} Best move
 */
function Sim_findBestMove(state, playerId, depth = null) {
    const searchDepth = depth || AI_CONFIG.MINIMAX_DEPTH;

    if (AI_CONFIG.DEBUG) {
        console.log(`[AI] Analyzing moves (depth ${searchDepth})...`);
    }

    const startTime = Date.now();

    // Use Minimax
    const result = Sim_minimax(state, playerId, searchDepth);

    const elapsed = Date.now() - startTime;

    if (AI_CONFIG.DEBUG) {
        console.log(`[AI] Best move found in ${elapsed}ms`);
        console.log(`[AI] Projected score: ${result.score}`);
        console.log(`[AI] Move:`, result.move);
    }

    return result.move;
}

/**
 * Analyze multiple candidate moves and pick best
 * @param {GameState} state 
 * @param {string} playerId 
 * @param {Array<Move>} candidates 
 * @returns {Move}
 */
function Sim_pickBestFromCandidates(state, playerId, candidates) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of candidates) {
        const futureState = Sim_applyMove(state.clone(), move);
        const score = Sim_evaluate(futureState, playerId);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Sim_getAllMoves,
        Sim_evaluate,
        Sim_minimax,
        Sim_applyMove,
        Sim_findBestMove,
        Sim_pickBestFromCandidates,
        AI_CONFIG
    };
}

console.log('[Simulation] AI Brain loaded. Minimax ready.');
