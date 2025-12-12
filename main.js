// =========================================
// 1. GAME STATE & UTILS
// =========================================
let gameState = {
    normalSummonUsed: false,
    specialSummonsCount: 0,
    playerLP: 8000,
    oppLP: 8000,
    gameOver: false
};

let selectedFieldCard = null;
let selectedHandCard = null; // Added to ensure hand selection works
let battleState = { isAttacking: false, attackerCard: null };
let spellState = { isTargeting: false, sourceCard: null, targetType: null };
let tributeState = { isActive: false, pendingCard: null, requiredTributes: 0, currentTributes: [], actionType: null };
let activeTurnBuffs = []; 

// Generate unique ID
function generateUID() {
    return 'card-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

// Helper: Determine who owns a card (Player or Opponent)
function getOwner(card) {
    return card.closest('.player-zone') ? 'player' : 'opponent';
}

// --- Helper Function: Send Card to Graveyard ---
function sendToGraveyard(cardEl, owner) {
    if (!cardEl) return;

    // 1. EQUIP SPELL CLEANUP CHECK
    const uid = cardEl.getAttribute('data-uid');
    if (uid) {
        const fieldCards = document.querySelectorAll('.card');
        fieldCards.forEach(c => {
            if (c.getAttribute('data-equip-target-uid') === uid) {
                const equipOwner = c.closest('.player-zone') ? 'player' : 'opponent';
                sendToGraveyard(c, equipOwner);
            }
        });
    }

    // 2. RESET STATS FOR GRAVEYARD DATA
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

    if (owner === 'player') {
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

// =========================================
// 2. SPELL & EFFECT LOGIC
// =========================================

function modifyStats(card, atkMod, defMod) {
    let currentAtk = parseInt(card.getAttribute('data-atk'));
    let currentDef = parseInt(card.getAttribute('data-def'));
    
    currentAtk += atkMod;
    currentDef += defMod;
    
    card.setAttribute('data-atk', currentAtk);
    card.setAttribute('data-def', currentDef);
    
    const statsBar = card.querySelector('.stats-bar');
    if(statsBar) {
        statsBar.querySelector('.stat-atk').textContent = currentAtk;
        statsBar.querySelector('.stat-def').textContent = currentDef;
    }
}

// REFACTORED CARD EFFECTS
const cardEffects = {
    'Pot of Greed': function(card) {
        const owner = getOwner(card);
        log(`${owner === 'player' ? 'You' : 'Opponent'} activates Pot of Greed!`);
        if (owner === 'player') {
            drawCard(); setTimeout(drawCard, 500);
        } else {
            drawOpponentCard(); setTimeout(drawOpponentCard, 500);
        }
        return true; 
    },
    'Raigeki': function(card) {
        const owner = getOwner(card);
        const victim = (owner === 'player') ? 'opponent' : 'player';
        
        log(`Effect: Destroy all ${victim} monsters!`);
        
        const targetZone = (victim === 'player') ? '.player-zone' : '.opp-zone';
        const targets = document.querySelectorAll(`${targetZone}.monster-zone .card`);
        
        let destroyedCount = 0;
        targets.forEach(c => {
            c.style.transition = 'all 0.5s'; 
            c.style.transform = 'scale(0) rotate(360deg)'; 
            c.style.opacity = '0';
            setTimeout(() => { sendToGraveyard(c, victim); }, 500);
            destroyedCount++;
        });
        if(destroyedCount === 0) log("Effect: No monsters to destroy.");
        return true;
    },
    'Axe of Despair': function(card) {
        log("Select a monster to equip (+1000 ATK).");
        spellState.isTargeting = true; spellState.sourceCard = card; spellState.targetType = 'monster';
        highlightTargets('monster'); return false;
    },
    'Malevolent Nuzzler': function(card) {
        log("Select a monster to equip (+700 ATK).");
        spellState.isTargeting = true; spellState.sourceCard = card; spellState.targetType = 'monster';
        highlightTargets('monster'); return false;
    },
    'Mystical Space Typhoon': function(card) {
        log("Select a Spell/Trap to destroy.");
        spellState.isTargeting = true; spellState.sourceCard = card; spellState.targetType = 'spell';
        highlightTargets('spell'); return false;
    },
    'Rush Recklessly': function(card) {
        log("Select a monster (+700 ATK until End Phase).");
        spellState.isTargeting = true; spellState.sourceCard = card; spellState.targetType = 'monster';
        highlightTargets('monster'); return false;
    },
    'Banner of Courage': {
        type: 'Continuous',
        apply: function(card, currentPhase, activePlayer) {
            const owner = getOwner(card);
            // Effect: +200 ATK during YOUR Battle Phase only
            if (currentPhase === 'BP' && activePlayer === owner) {
                const selector = owner === 'player' ? '.player-zone.monster-zone .card' : '.opp-zone.monster-zone .card';
                document.querySelectorAll(selector).forEach(m => {
                    if (!m.hasAttribute('data-buff-banner')) {
                        modifyStats(m, 200, 0);
                        m.setAttribute('data-buff-banner', 'true');
                    }
                });
            } else {
                // Remove buff if phase changes or turn ends
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
        apply: function(card) { /* Handled in Standby Phase trigger */ }
    }
};

function resolveSpellTarget(target) {
    const source = spellState.sourceCard;
    const effectName = source.getAttribute('data-name');
    if (target === source) { alert("Cannot target itself!"); return; }

    spellState.isTargeting = false; spellState.sourceCard = null; clearHighlights();
    log(`Target selected: ${target.getAttribute('data-name')}`);

    if (effectName === 'Axe of Despair') {
        modifyStats(target, 1000, 0); source.setAttribute('data-equip-target-uid', target.getAttribute('data-uid'));
        log(`${target.getAttribute('data-name')} gains 1000 ATK!`);
    } 
    else if (effectName === 'Malevolent Nuzzler') {
        modifyStats(target, 700, 0); source.setAttribute('data-equip-target-uid', target.getAttribute('data-uid'));
        log(`${target.getAttribute('data-name')} gains 700 ATK!`);
    }
    else if (effectName === 'Rush Recklessly') {
        modifyStats(target, 700, 0);
        log(`${target.getAttribute('data-name')} gains 700 ATK!`);
        activeTurnBuffs.push({ uid: target.getAttribute('data-uid'), atkMod: 700, defMod: 0 });
        const spellOwner = getOwner(source);
        setTimeout(() => sendToGraveyard(source, spellOwner), 500);
    }
    else if (effectName === 'Mystical Space Typhoon') {
        log(`${target.getAttribute('data-name')} destroyed!`);
        const targetOwner = getOwner(target);
        const spellOwner = getOwner(source);
        sendToGraveyard(target, targetOwner);
        setTimeout(() => sendToGraveyard(source, spellOwner), 500);
    }
}

function highlightTargets(type) {
    let selector = '';
    if (type === 'monster') selector = '.monster-zone .card.face-up';
    else if (type === 'spell') selector = '.spell-trap-zone .card, .field-zone .card';
    const targets = document.querySelectorAll(selector);
    targets.forEach(el => { if(el !== spellState.sourceCard) el.parentElement.classList.add('targetable'); });
}

function clearHighlights() { document.querySelectorAll('.zone').forEach(el => el.classList.remove('targetable')); }

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
    if(target === 'player') gameState.playerLP -= damage;
    else gameState.oppLP -= damage;
    if(gameState.playerLP < 0) gameState.playerLP = 0;
    if(gameState.oppLP < 0) gameState.oppLP = 0;
    document.getElementById('player-lp-val').textContent = gameState.playerLP;
    document.getElementById('opp-lp-val').textContent = gameState.oppLP;
    checkWinCondition();
}

function checkWinCondition() {
    if (gameState.gameOver) return;
    if (gameState.playerLP <= 0) endDuel("You Lost! LP reached 0.");
    else if (gameState.oppLP <= 0) endDuel("You Won! Opponent LP reached 0.");
}

function endDuel(msg) {
    gameState.gameOver = true; alert(msg); log(`GAME OVER: ${msg}`); document.body.style.pointerEvents = 'none';
}

// =========================================
// 4. GAME LOOP & PHASES
// =========================================
let currentPhase = 'DP';
let isPlayerTurn = true;
let turnCount = 1;
const phaseOrder = ['DP', 'SP', 'MP1', 'BP', 'MP2', 'EP'];

window.onload = function() {
    document.querySelectorAll('.card').forEach(c => {
        if(!c.hasAttribute('data-uid')) c.setAttribute('data-uid', generateUID());
        if(!c.hasAttribute('data-original-atk')) {
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
    let drawsLeft = 4; // Standard Speed Duel Hand Size
    let interval = setInterval(() => {
        if(drawsLeft > 0) { drawCard(); drawOpponentCard(); drawsLeft--; }
        else { clearInterval(interval); proceedToMainPhase(); }
    }, 600);
}

function runNormalTurn() {
    if(gameState.gameOver) return;
    log(`Turn ${turnCount}: Draw Phase`);
    setPhaseText('DP', "DRAW PHASE");
    if(playerDeckData.length === 0) { endDuel("You Lost! Deck is empty."); return; }
    setTimeout(() => { drawCard(); proceedToMainPhase(); }, 500);
}

function proceedToMainPhase() {
    setTimeout(() => {
        setPhaseText('SP', "STANDBY PHASE"); log("Standby Phase");
        
        // Handle Standby Phase Effects like Burning Land
        const spells = document.querySelectorAll('.spell-trap-zone .card.face-up');
        spells.forEach(s => {
            if(s.getAttribute('data-name') === 'Burning Land') {
                log("Burning Land: 500 Damage to both!");
                updateLP(500, 'player'); updateLP(500, 'opponent');
                s.style.boxShadow = "0 0 20px #ff5533"; setTimeout(() => s.style.boxShadow = "", 500);
            }
        });

        setTimeout(() => { 
            setPhaseText('MP1', "MAIN PHASE 1"); 
            log("Main Phase 1"); 
            currentPhase = 'MP1';
            updateContinuousEffects(); // Initial check
        }, 1500);
    }, 1500);
}

function switchTurn() {
    if(gameState.gameOver) return;
    
    // Clear Temp Buffs
    if(activeTurnBuffs.length > 0) {
        log("End Phase: Resetting temporary boosts.");
        activeTurnBuffs.forEach(buff => {
            const card = document.querySelector(`.card[data-uid="${buff.uid}"]`);
            if(card) modifyStats(card, -buff.atkMod, -buff.defMod);
        });
        activeTurnBuffs = [];
    }

    isPlayerTurn = !isPlayerTurn;
    document.getElementById('actionMenu').classList.remove('active');
    gameState.normalSummonUsed = false;
    document.querySelectorAll('.card').forEach(c => c.setAttribute('data-attacked', 'false'));
    cancelBattleMode();
    spellState.isTargeting = false; clearHighlights();
    cancelTributeMode(); 
    
    // Update Continuous Effects for phase change
    updateContinuousEffects();

    if(isPlayerTurn) {
        turnCount++;
        document.getElementById('phaseText').classList.remove('opponent-turn');
        runNormalTurn();
    } else {
        document.getElementById('phaseText').classList.add('opponent-turn');
        setPhaseText('DP', "DRAW PHASE");
        if(oppDeckData.length === 0) { endDuel("You Won! Opponent Deck is empty."); return; }
        log("Opponent's Turn");
        setTimeout(() => {
            drawOpponentCard();
            setTimeout(() => {
                setPhaseText('SP', "STANDBY PHASE");
                const spells = document.querySelectorAll('.spell-trap-zone .card.face-up');
                spells.forEach(s => {
                    if(s.getAttribute('data-name') === 'Burning Land') {
                        updateLP(500, 'player'); updateLP(500, 'opponent');
                    }
                });
                
                setTimeout(() => { 
                    setPhaseText('MP1', "MAIN PHASE 1"); 
                    currentPhase = 'MP1'; 
                    updateContinuousEffects();

                    // NO AI: Simply pass turn back to player for Hotseat/Testing
                    log("Opponent ends turn.");
                    setTimeout(switchTurn, 1000); 
                }, 1000);
            }, 1000);
        }, 500);
    }
}

// GENERIC CONTINUOUS EFFECT UPDATER
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

    // Logic: Leave old phase
    if (currentPhase === 'BP' && phase !== 'BP') {
        // Force cleanup of Banner if leaving BP
        updateContinuousEffects(); 
    }

    currentPhase = phase;
    phaseBtn.textContent = phase;
    let text = "MAIN PHASE 1";
    if(phase === 'BP') text = "BATTLE PHASE"; 
    if(phase === 'MP2') text = "MAIN PHASE 2"; 
    if(phase === 'EP') text = "END PHASE";
    phaseText.textContent = text;
    phaseMenu.classList.remove('active');
    log(`Phase: ${text}`);

    if (phase !== 'BP') cancelBattleMode();

    // Logic: Enter new phase
    updateContinuousEffects();

    if(phase === 'EP') setTimeout(switchTurn, 1000);
}

function setPhaseText(short, long) { currentPhase = short; phaseBtn.textContent = short; phaseText.textContent = long; }

// --- DRAW LOGIC ---
function drawCard() {
    if(gameState.gameOver) return;
    if (playerDeckData.length > 0) {
        const card = playerDeckData.pop(); playerHandData.push(card); updateCounters();
        const rect = document.getElementById('playerDeck').getBoundingClientRect();
        const animCard = document.createElement('div'); animCard.className = 'draw-card-anim'; 
        animCard.style.left = rect.left + 'px'; animCard.style.top = rect.top + 'px';
        document.body.appendChild(animCard);
        setTimeout(() => {
            const handRect = document.getElementById('playerHand').getBoundingClientRect();
            animCard.style.top = (handRect.top + 20) + 'px'; animCard.style.left = (handRect.left + handRect.width/2) + 'px'; 
            animCard.style.transform = 'scale(0.5)'; animCard.style.opacity = '0';
        }, 50);
        setTimeout(() => { animCard.remove(); renderHandCard(card); }, 800);
    } else { if(currentPhase === 'DP' && isPlayerTurn) endDuel("You Lost! Deck is empty."); }
}

function drawOpponentCard() {
    if (oppDeckData.length > 0) {
        oppDeckData.pop(); oppHandData.push('card'); updateCounters();
        const cardEl = document.createElement('div'); cardEl.className = 'opponent-hand-card';
        document.querySelector('.opponent-hand-container').appendChild(cardEl);
    } else if (!isPlayerTurn && currentPhase === 'DP') { endDuel("You Won! Opponent Deck is empty."); }
}

function renderHandCard(card) {
    const handContainer = document.getElementById('playerHand');
    const el = document.createElement('div');
    el.className = 'hand-card';
    el.style.backgroundImage = `url('${card.img}')`;
    el.setAttribute('data-name', card.name); 
    el.setAttribute('data-type', card.full_type);
    el.setAttribute('data-atk', card.atk); el.setAttribute('data-def', card.def); 
    el.setAttribute('data-original-atk', card.atk); el.setAttribute('data-original-def', card.def);
    el.setAttribute('data-desc', card.desc); el.setAttribute('data-img', card.img);
    el.setAttribute('data-card-category', card.category);
    el.setAttribute('data-level', card.level); el.setAttribute('data-attribute', card.attribute);
    el.setAttribute('data-race', card.race);
    handContainer.appendChild(el);
}

// =========================================
// 5. ACTIONS & INTERACTIONS
// =========================================

// --- TRIBUTE LOGIC ---
function initiateTribute(card, required, action) {
    tributeState.isActive = true;
    tributeState.pendingCard = card;
    tributeState.requiredTributes = required;
    tributeState.currentTributes = [];
    tributeState.actionType = action;
    log(`Tribute Summon: Select ${required} monster(s) to tribute.`);
    document.querySelectorAll('.player-zone.monster-zone .card').forEach(c => c.parentElement.classList.add('targetable'));
}

function handleTributeSelection(target) {
    if (tributeState.currentTributes.includes(target)) return;
    tributeState.currentTributes.push(target);
    target.style.opacity = '0.5'; 
    log(`Selected tribute: ${target.getAttribute('data-name')} (${tributeState.currentTributes.length}/${tributeState.requiredTributes})`);

    if (tributeState.currentTributes.length >= tributeState.requiredTributes) {
        tributeState.currentTributes.forEach(t => sendToGraveyard(t, 'player'));
        executeCardPlay(tributeState.pendingCard, tributeState.actionType);
        cancelTributeMode();
    }
}

function cancelTributeMode() {
    if(tributeState.currentTributes.length > 0) { tributeState.currentTributes.forEach(t => t.style.opacity = '1'); }
    document.querySelectorAll('.zone').forEach(el => el.classList.remove('targetable'));
    tributeState.isActive = false; tributeState.pendingCard = null; tributeState.currentTributes = []; tributeState.actionType = null;
}

// --- MAIN ACTION HANDLER ---
function performAction(action) {
    if (!selectedHandCard) return;
    
    const canActInMain = (currentPhase === 'MP1' || currentPhase === 'MP2');
    const isQP = selectedHandCard.getAttribute('data-race') === 'Quick-Play';
    const canActInBP = (currentPhase === 'BP' && isQP && action === 'activate');
    
    if (!canActInMain && !canActInBP) { alert("Action not allowed in this Phase!"); actionMenu.classList.remove('active'); return; }
    
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
        const zones = ['p-m1', 'p-m2', 'p-m3', 'p-m4', 'p-m5'];
        for (let id of zones) { if (document.getElementById(id).children.length === 0) { targetZone = document.getElementById(id); break; } }
        if (!targetZone) { alert("Monster Zones Full!"); return; }
        cssClass = (action === 'summon') ? 'face-up pos-atk' : 'face-down pos-def';
        gameState.normalSummonUsed = true;
    } else {
        const zones = ['p-s1', 'p-s2', 'p-s3', 'p-s4', 'p-s5'];
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

    for(let k in cardData) {
        if (k === 'category') newCard.setAttribute('data-card-category', cardData[k]);
        else newCard.setAttribute('data-'+k, cardData[k]);
    }
    newCard.setAttribute('data-original-atk', cardData.atk);
    newCard.setAttribute('data-original-def', cardData.def);

    if (cssClass.includes('face-up')) {
        newCard.style.backgroundImage = `url('${cardData.img}')`;
        if(cardData.category === 'monster') {
            newCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${cardData.atk}</span><span class="stat-val stat-def">${cardData.def}</span></div>`;
        }
    }
    targetZone.appendChild(newCard);

    if (action === 'activate') {
        let finished = true;
        // Check generic registry first
        if(cardEffects[cardData.name] && typeof cardEffects[cardData.name] === 'function') { 
            finished = cardEffects[cardData.name](newCard); 
        } 
        else if (cardEffects[cardData.name] && cardEffects[cardData.name].type === 'Continuous') {
            log(`Activated Continuous Spell: ${cardData.name}`);
            finished = false; // Stay on field
            updateContinuousEffects();
        }
        else { log(`Activated: ${cardData.name}`); }
        
        const typeStr = cardData.type || "";
        const raceStr = cardData.race || "";
        const isEquip = raceStr === 'Equip' || typeStr.includes('Equip');
        const isCont = raceStr === 'Continuous' || typeStr.includes('Continuous');
        
        if (!isEquip && !isCont && finished) {
             setTimeout(() => { sendToGraveyard(newCard, 'player'); }, 1000);
        }
    }

    handCardEl.remove(); selectedHandCard = null;
    actionMenu.classList.remove('active');
    
    if (cardData.category === 'monster') {
        log(`${action === 'summon' ? 'Summoned' : 'Set'}: ${cardData.name}`);
    }
}

// --- CLICK LISTENER ---
document.body.addEventListener('click', function(e) {
    if (gameState.gameOver) return;

    // 1. TRIBUTE MODE
    if (tributeState.isActive) {
        const target = e.target.closest('.player-zone.monster-zone .card');
        if (target) { handleTributeSelection(target); e.stopPropagation(); return; }
        if (!e.target.closest('.action-menu')) { cancelTributeMode(); log("Tribute Summon cancelled."); }
    }

    // 2. SPELL TARGETING
    if (spellState.isTargeting) {
        const target = e.target.closest('.card.face-up, .card.face-down'); 
        if (target) {
            const targetIsMonster = target.getAttribute('data-card-category') === 'monster';
            const targetIsSpell = target.getAttribute('data-card-category') === 'spell';
            if ((spellState.targetType === 'monster' && targetIsMonster) ||
                (spellState.targetType === 'spell' && targetIsSpell)) {
                resolveSpellTarget(target); e.stopPropagation(); return;
            }
        }
        if (!e.target.closest('.action-menu')) { spellState.isTargeting = false; spellState.sourceCard = null; clearHighlights(); log("Spell activation cancelled."); }
    }

    // 3. BATTLE TARGETING
    if (battleState.isAttacking && battleState.attackerCard) {
        const targetMonster = e.target.closest('.opp-zone.monster-zone .card');
        if (targetMonster) { resolveAttack(battleState.attackerCard, targetMonster); e.stopPropagation(); return; }
        const targetAvatar = e.target.closest('#oppAvatarContainer');
        if (targetAvatar && targetAvatar.classList.contains('targetable')) { performDirectAttack(battleState.attackerCard); e.stopPropagation(); return; }
        if (!e.target.closest('.action-menu')) { cancelBattleMode(); }
    }

    // 4. SELECTION
    const target = e.target.closest('.card, .hand-card'); 
    if (target) {
        updateSidebar(target);
        const rect = target.getBoundingClientRect();
        actionMenu.classList.remove('active');

        if (target.classList.contains('hand-card')) {
            const isQP = target.getAttribute('data-race') === 'Quick-Play';
            const canActInBP = currentPhase === 'BP' && isQP;
            const canActInMain = (currentPhase === 'MP1' || currentPhase === 'MP2');

            if (isPlayerTurn && (canActInMain || canActInBP)) {
                selectedHandCard = target;
                const cat = target.getAttribute('data-card-category');
                let menuHtml = '';
                if (cat === 'monster') {
                    if (!gameState.normalSummonUsed && canActInMain) {
                        menuHtml = `<button class="action-btn" onclick="performAction('summon')">Normal Summon</button>
                                    <button class="action-btn" onclick="performAction('set')">Set</button>`;
                    }
                } else {
                    menuHtml = `<button class="action-btn" onclick="performAction('activate')">Activate</button>
                                <button class="action-btn" onclick="performAction('set')">Set</button>`;
                }
                if (menuHtml) { actionMenu.innerHTML = menuHtml; showMenu(rect); e.stopPropagation(); }
            }
        } 
        else if (target.parentElement.classList.contains('player-zone')) {
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
                    if (isFaceDown) { menuHtml = `<button class="action-btn" onclick="activateSetCard()">Activate</button>`; }
                }
            }
            if (menuHtml) { actionMenu.innerHTML = menuHtml; showMenu(rect); e.stopPropagation(); }
        }
    } else {
        if(!e.target.closest('.action-menu') && !e.target.closest('.phase-content')) {
            actionMenu.classList.remove('active'); phaseMenu.classList.remove('active');
        }
    }
});

function activateSetCard() {
    if (!selectedFieldCard) return;
    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') { alert("Action only allowed in Main Phase!"); actionMenu.classList.remove('active'); return; }
    
    selectedFieldCard.classList.remove('face-down'); selectedFieldCard.classList.add('face-up');
    const imgUrl = selectedFieldCard.getAttribute('data-img');
    selectedFieldCard.style.backgroundImage = `url('${imgUrl}')`;
    const cardName = selectedFieldCard.getAttribute('data-name');
    log(`Activated Set Card: ${cardName}`);

    let finished = true;
    if(cardEffects[cardName] && typeof cardEffects[cardName] === 'function') { finished = cardEffects[cardName](selectedFieldCard); }
    else if(cardEffects[cardName] && cardEffects[cardName].type === 'Continuous') { finished = false; updateContinuousEffects(); }

    const typeStr = selectedFieldCard.getAttribute('data-type') || "";
    const raceStr = selectedFieldCard.getAttribute('data-race') || "";
    const isEquip = raceStr === 'Equip' || typeStr.includes('Equip');
    const isCont = raceStr === 'Continuous' || typeStr.includes('Continuous');

    if (!isEquip && !isCont && finished) {
        setTimeout(() => { sendToGraveyard(selectedFieldCard, 'player'); }, 1000);
    }
    actionMenu.classList.remove('active');
}

// =========================================
// 6. BATTLE LOGIC
// =========================================

function initiateAttack() {
    if (currentPhase !== 'BP') { alert("Attacks can only be declared in the Battle Phase!"); actionMenu.classList.remove('active'); return; }
    if (!selectedFieldCard) return;
    if (selectedFieldCard.getAttribute('data-attacked') === 'true') { alert("This monster has already attacked!"); actionMenu.classList.remove('active'); return; }

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
        if(!target.querySelector('.stats-bar')) {
            target.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${targetAtk}</span><span class="stat-val stat-def">${targetDef}</span></div>`;
        }
    }

    const destroyCard = (card, owner) => {
        card.style.transition = 'all 0.5s ease-in';
        card.style.transform = 'scale(0) rotate(360deg)';
        card.style.opacity = '0';
        setTimeout(() => { sendToGraveyard(card, owner); }, 500);
    };

    if (!isTargetDef) {
        if (atkVal > targetAtk) {
            const diff = atkVal - targetAtk;
            log(`Victory! ${targetName} destroyed. Opponent takes ${diff} damage.`);
            updateLP(diff, 'opponent');
            destroyCard(target, 'opponent');
        } else if (atkVal < targetAtk) {
            const diff = targetAtk - atkVal;
            log(`Defeat! ${attackerName} destroyed. You take ${diff} damage.`);
            updateLP(diff, 'player');
            destroyCard(attacker, 'player');
        } else {
            log("Double KO! Both monsters destroyed.");
            destroyCard(target, 'opponent'); destroyCard(attacker, 'player');
        }
    } else {
        if (atkVal > targetDef) {
            log(`Defense pierced! ${targetName} destroyed.`);
            destroyCard(target, 'opponent');
        } else if (atkVal < targetDef) {
            const diff = targetDef - atkVal;
            log(`Blocked! You take ${diff} damage.`);
            updateLP(diff, 'player');
        } else { log("Stalemate. No monsters destroyed."); }
    }

    if (document.body.contains(attacker)) { attacker.setAttribute('data-attacked', 'true'); }
    cancelBattleMode();
}

function performDirectAttack(attacker) {
    const oppMonsters = document.querySelectorAll('.opp-zone.monster-zone .card');
    if (oppMonsters.length > 0) { alert("Cannot attack directly! Opponent controls monsters."); return; }
    const atk = parseInt(attacker.getAttribute('data-atk'));
    log(`${attacker.getAttribute('data-name')} attacks directly!`);
    attacker.style.transform = 'translateY(-50px) scale(1.2)';
    setTimeout(() => { attacker.style.transform = ''; }, 300);
    updateLP(atk, 'opponent');
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

function togglePhaseMenu() { if(isPlayerTurn && currentPhase !== 'DP' && currentPhase !== 'SP') { updatePhaseMenuState(); phaseMenu.classList.toggle('active'); } }

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
    let menuTop = rect.top - 50; if(menuTop < 0) menuTop = 20;
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
    const atk = selectedFieldCard.getAttribute('data-atk');
    const def = selectedFieldCard.getAttribute('data-def');
    const statsHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${atk}</span><span class="stat-val stat-def">${def}</span></div>`;

    if (selectedFieldCard.classList.contains('pos-atk')) {
        selectedFieldCard.classList.remove('pos-atk'); selectedFieldCard.classList.add('pos-def');
        if(selectedFieldCard.innerHTML.trim() === "") selectedFieldCard.innerHTML = statsHTML;
        log(`Changed ${selectedFieldCard.getAttribute('data-name')} to Defense.`);
    } else {
        selectedFieldCard.classList.remove('pos-def'); selectedFieldCard.classList.add('pos-atk');
        if(selectedFieldCard.innerHTML.trim() === "") selectedFieldCard.innerHTML = statsHTML;
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
        for(let k in card) el.setAttribute('data-'+k, card[k]);
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