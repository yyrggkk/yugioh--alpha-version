// =========================================
// 2. GAME STATE & RULES ENGINE
// =========================================
let gameState = {
    normalSummonUsed: false,
    specialSummonsCount: 0,
    playerLP: 8000,
    oppLP: 8000,
    gameOver: false
};

let selectedFieldCard = null; // Track clicked card on the field
let battleState = {
    isAttacking: false,
    attackerCard: null
};

// --- Helper Function: Send Card to Graveyard ---
function sendToGraveyard(cardEl, owner) {
    const cardData = {
        name: cardEl.getAttribute('data-name'),
        type: cardEl.getAttribute('data-type'),
        atk: cardEl.getAttribute('data-atk'),
        def: cardEl.getAttribute('data-def'),
        desc: cardEl.getAttribute('data-desc'),
        img: cardEl.getAttribute('data-img'),
        category: cardEl.getAttribute('data-card-category')
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
    topCard.style.width = '100%';
    topCard.style.height = '100%';
    topCard.style.border = 'none'; 
    gyZone.prepend(topCard);
}

// Effects Engine
const cardEffects = {
    'Pot of Greed': function() {
        log("Effect: Draw 2 Cards!");
        drawCard();
        setTimeout(drawCard, 500);
    },
    'Raigeki': function() {
        log("Effect: Destroy all opponent monsters!");
        const oppMonsterZones = document.querySelectorAll('.opp-zone.monster-zone .card');
        let destroyedCount = 0;
        
        oppMonsterZones.forEach(card => {
            card.style.transition = 'all 0.5s'; 
            card.style.transform = 'scale(0) rotate(360deg)'; 
            card.style.opacity = '0';
            setTimeout(() => { sendToGraveyard(card, 'opponent'); }, 500);
            destroyedCount++;
        });
        if(destroyedCount === 0) log("Effect: No monsters to destroy.");
    }
};

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
    
    if (gameState.playerLP <= 0) {
        endDuel("You Lost! LP reached 0.");
    } else if (gameState.oppLP <= 0) {
        endDuel("You Won! Opponent LP reached 0.");
    }
}

function endDuel(msg) {
    gameState.gameOver = true;
    alert(msg);
    log(`GAME OVER: ${msg}`);
    document.body.style.pointerEvents = 'none';
}

// =========================================
// 3. GAME LOOP & PHASES
// =========================================
let currentPhase = 'DP';
let isPlayerTurn = true;
let turnCount = 1;
const phaseOrder = ['DP', 'SP', 'MP1', 'BP', 'MP2', 'EP'];

window.onload = function() {
    updateCounters();
    log("Duel Started");
    startDuelSequence();
};

function startDuelSequence() {
    log("Turn 1: Draw Phase");
    let drawsLeft = 3; 
    let interval = setInterval(() => {
        if(drawsLeft > 0) { drawCard(); drawOpponentCard(); drawsLeft--; }
        else { clearInterval(interval); proceedToMainPhase(); }
    }, 600);
}

function runNormalTurn() {
    if(gameState.gameOver) return;
    log(`Turn ${turnCount}: Draw Phase`);
    setPhaseText('DP', "DRAW PHASE");
    
    if(playerDeckData.length === 0) {
        endDuel("You Lost! Deck is empty.");
        return;
    }

    setTimeout(() => { drawCard(); proceedToMainPhase(); }, 500);
}

function proceedToMainPhase() {
    setTimeout(() => {
        setPhaseText('SP', "STANDBY PHASE");
        log("Standby Phase");
        setTimeout(() => { setPhaseText('MP1', "MAIN PHASE 1"); log("Main Phase 1"); currentPhase = 'MP1'; }, 1500);
    }, 1500);
}

function switchTurn() {
    if(gameState.gameOver) return;

    isPlayerTurn = !isPlayerTurn;
    document.getElementById('actionMenu').classList.remove('active');
    gameState.normalSummonUsed = false;
    
    document.querySelectorAll('.card').forEach(c => c.setAttribute('data-attacked', 'false'));
    cancelBattleMode();

    if(isPlayerTurn) {
        turnCount++;
        document.getElementById('phaseText').classList.remove('opponent-turn');
        runNormalTurn();
    } else {
        document.getElementById('phaseText').classList.add('opponent-turn');
        setPhaseText('DP', "DRAW PHASE");
        
        if(oppDeckData.length === 0) {
            endDuel("You Won! Opponent Deck is empty.");
            return;
        }

        log("Opponent's Turn");
        setTimeout(() => {
            drawOpponentCard();
            setTimeout(() => {
                setPhaseText('SP', "STANDBY PHASE");
                setTimeout(() => { setPhaseText('MP1', "MAIN PHASE 1"); currentPhase = 'MP1'; }, 1000);
            }, 1000);
        }, 500);
    }
}

function drawCard() {
    if(gameState.gameOver) return;
    if (playerDeckData.length > 0) {
        const card = playerDeckData.pop();
        playerHandData.push(card);
        updateCounters();
        const rect = document.getElementById('playerDeck').getBoundingClientRect();
        const animCard = document.createElement('div');
        animCard.className = 'draw-card-anim'; animCard.style.left = rect.left + 'px'; animCard.style.top = rect.top + 'px';
        document.body.appendChild(animCard);
        setTimeout(() => {
            const handRect = document.getElementById('playerHand').getBoundingClientRect();
            animCard.style.top = (handRect.top + 20) + 'px'; animCard.style.left = (handRect.left + handRect.width/2) + 'px'; animCard.style.transform = 'scale(0.5)'; animCard.style.opacity = '0';
        }, 50);
        setTimeout(() => { animCard.remove(); renderHandCard(card); }, 800);
    } else {
         if(currentPhase === 'DP' && isPlayerTurn) endDuel("You Lost! Deck is empty.");
    }
}

function drawOpponentCard() {
    if (oppDeckData.length > 0) {
        oppDeckData.pop(); oppHandData.push('card'); updateCounters();
        const cardEl = document.createElement('div'); cardEl.className = 'opponent-hand-card';
        document.querySelector('.opponent-hand-container').appendChild(cardEl);
    } else if (!isPlayerTurn && currentPhase === 'DP') {
        endDuel("You Won! Opponent Deck is empty.");
    }
}

function renderHandCard(card) {
    const handContainer = document.getElementById('playerHand');
    const el = document.createElement('div');
    el.className = 'hand-card';
    el.style.backgroundImage = `url('${card.img}')`;
    el.setAttribute('data-name', card.name); el.setAttribute('data-type', card.type); el.setAttribute('data-atk', card.atk);
    el.setAttribute('data-def', card.def); el.setAttribute('data-desc', card.desc); el.setAttribute('data-img', card.img);
    el.setAttribute('data-card-category', card.category);
    handContainer.appendChild(el);
}

// =========================================
// 4. UI INTERACTIONS (Clicks, Menu)
// =========================================
const phaseMenu = document.getElementById('phaseMenu');
const phaseBtn = document.getElementById('phaseBtn');
const phaseText = document.getElementById('phaseText');

function togglePhaseMenu() { if(isPlayerTurn && currentPhase !== 'DP' && currentPhase !== 'SP') { updatePhaseMenuState(); phaseMenu.classList.toggle('active'); } }

// UPDATED: Logic to disable BP and MP2 on Turn 1
function updatePhaseMenuState() {
    const phases = ['MP1', 'BP', 'MP2', 'EP'];
    const currIdx = phaseOrder.indexOf(currentPhase);
    phases.forEach(ph => {
        const el = document.getElementById('ph-' + ph);
        const targetIdx = phaseOrder.indexOf(ph);
        
        el.classList.remove('disabled');
        
        // 1. Basic progression logic (can't go backwards)
        if (targetIdx <= currIdx) el.classList.add('disabled');
        
        // 2. Can't jump from MP1 to MP2 without BP (unless it's End Phase)
        if (currentPhase === 'MP1' && ph === 'MP2') el.classList.add('disabled');
        
        // 3. Can't enter MP2 if BP hasn't happened yet (simplified)
        if (ph === 'MP2' && currentPhase !== 'BP') el.classList.add('disabled');

        // 4. *** NEW RULE: Turn 1 Restrictions ***
        if (turnCount === 1) {
            if (ph === 'BP') el.classList.add('disabled');
            if (ph === 'MP2') el.classList.add('disabled'); // No BP means no MP2
        }
    });
}

function setPhase(phase) {
    const currIdx = phaseOrder.indexOf(currentPhase);
    const targetIdx = phaseOrder.indexOf(phase);
    
    // Safety Checks
    if (targetIdx <= currIdx) return;
    if (currentPhase === 'MP1' && phase === 'MP2') return;
    
    // *** NEW RULE: Block BP on Turn 1 manually in case user edits DOM ***
    if (turnCount === 1 && (phase === 'BP' || phase === 'MP2')) {
        log("Cannot conduct Battle Phase on the first turn.");
        return;
    }

    currentPhase = phase;
    phaseBtn.textContent = phase;
    let text = "MAIN PHASE 1";
    if(phase === 'BP') text = "BATTLE PHASE"; if(phase === 'MP2') text = "MAIN PHASE 2"; if(phase === 'EP') text = "END PHASE";
    phaseText.textContent = text;
    phaseMenu.classList.remove('active');
    log(`Phase: ${text}`);

    if (phase !== 'BP') cancelBattleMode();

    if(phase === 'EP') setTimeout(switchTurn, 1000);
}

function setPhaseText(short, long) { currentPhase = short; phaseBtn.textContent = short; phaseText.textContent = long; }

function log(msg) {
    const entry = document.createElement('div'); entry.className = 'log-entry';
    entry.innerHTML = `<span>System:</span> ${msg}`;
    const logBody = document.getElementById('logBody'); logBody.appendChild(entry); logBody.scrollTop = logBody.scrollHeight;
}

let selectedHandCard = null;
const actionMenu = document.getElementById('actionMenu');
const detailImg = document.getElementById('detailImg');
const detailName = document.getElementById('detailName');
const detailType = document.getElementById('detailType');
const detailAtk = document.getElementById('detailAtk');
const detailDef = document.getElementById('detailDef');
const detailDesc = document.getElementById('detailDesc');

function updateSidebar(el) {
    detailName.textContent = el.getAttribute('data-name'); detailType.textContent = el.getAttribute('data-type');
    detailAtk.textContent = el.getAttribute('data-atk'); detailDef.textContent = el.getAttribute('data-def');
    detailDesc.textContent = el.getAttribute('data-desc'); detailImg.style.backgroundImage = `url('${el.getAttribute('data-img')}')`;
    detailImg.classList.remove('empty');
}

// --- CLICK LISTENER ---
document.body.addEventListener('click', function(e) {
    if (gameState.gameOver) return;

    if (battleState.isAttacking && battleState.attackerCard) {
        const targetMonster = e.target.closest('.opp-zone.monster-zone .card');
        if (targetMonster) {
            resolveAttack(battleState.attackerCard, targetMonster);
            e.stopPropagation(); return;
        }

        const targetAvatar = e.target.closest('#oppAvatarContainer');
        if (targetAvatar && targetAvatar.classList.contains('targetable')) {
            performDirectAttack(battleState.attackerCard);
            e.stopPropagation(); return;
        }

        if (!e.target.closest('.action-menu')) {
            cancelBattleMode();
        }
    }

    const target = e.target.closest('.card, .hand-card'); 
    
    if (target) {
        updateSidebar(target);
        const rect = target.getBoundingClientRect();
        
        actionMenu.classList.remove('active');

        // 1. HAND CARD LOGIC
        if (target.classList.contains('hand-card')) {
            if (isPlayerTurn && (currentPhase === 'MP1' || currentPhase === 'MP2')) {
                selectedHandCard = target;
                const cat = target.getAttribute('data-card-category');
                let menuHtml = '';

                if (cat === 'monster') {
                    if (!gameState.normalSummonUsed) {
                        menuHtml = `<button class="action-btn" onclick="performAction('summon')">Normal Summon</button>
                                    <button class="action-btn" onclick="performAction('set')">Set</button>`;
                    }
                } else {
                    menuHtml = `<button class="action-btn" onclick="performAction('activate')">Activate</button>
                                <button class="action-btn" onclick="performAction('set')">Set</button>`;
                }
                
                if (menuHtml) {
                    actionMenu.innerHTML = menuHtml;
                    showMenu(rect);
                    e.stopPropagation();
                }
            }
        } 
        // 2. FIELD CARD LOGIC
        else if (target.parentElement.classList.contains('player-zone')) {
            selectedFieldCard = target;
            let menuHtml = '';
            
            const isMonster = target.getAttribute('data-card-category') === 'monster';
            const isFaceUp = target.classList.contains('face-up');
            const isFaceDown = target.classList.contains('face-down');
            const cardTurn = parseInt(target.getAttribute('data-turn'));
            const lastChange = parseInt(target.getAttribute('data-last-pos-change') || 0);
            
            // BATTLE PHASE LOGIC
            if (currentPhase === 'BP' && isPlayerTurn && isMonster && isFaceUp && target.classList.contains('pos-atk')) {
                // Ensure turnCount > 1 check here too, just in case they arrived in BP via glitch
                const hasAttacked = target.getAttribute('data-attacked') === 'true';
                if (!hasAttacked && turnCount > 1) { 
                    menuHtml = `<button class="action-btn battle-option" onclick="initiateAttack()">Attack</button>`;
                }
            }
            // MAIN PHASE LOGIC
            else if ((currentPhase === 'MP1' || currentPhase === 'MP2') && isPlayerTurn) {
                if (isMonster) {
                    if (isFaceUp) {
                        if (cardTurn !== turnCount && lastChange !== turnCount) {
                            menuHtml = `<button class="action-btn" onclick="changeBattlePosition()">Change Position</button>`;
                        }
                    } else if (isFaceDown) {
                        if (cardTurn !== turnCount) {
                            menuHtml = `<button class="action-btn" onclick="flipSummon()">Flip Summon</button>`;
                        }
                    }
                } else {
                    if (isFaceDown) {
                        menuHtml = `<button class="action-btn" onclick="activateSetCard()">Activate</button>`;
                    }
                }
            }

            if (menuHtml) {
                actionMenu.innerHTML = menuHtml;
                showMenu(rect);
                e.stopPropagation();
            }
        }
    } else {
        if(!e.target.closest('.action-menu') && !e.target.closest('.phase-content')) {
            actionMenu.classList.remove('active');
            phaseMenu.classList.remove('active');
        }
    }
});

function showMenu(rect) {
    let menuTop = rect.top - 50; if(menuTop < 0) menuTop = 20;
    actionMenu.style.left = `${rect.left + 20}px`; actionMenu.style.top = `${menuTop}px`;
    actionMenu.classList.add('active');
}

// =========================================
// BATTLE PHASE LOGIC
// =========================================

function initiateAttack() {
    if (!selectedFieldCard) return;
    actionMenu.classList.remove('active');

    battleState.isAttacking = true;
    battleState.attackerCard = selectedFieldCard;

    log("Select a target for attack...");

    const oppMonsters = document.querySelectorAll('.opp-zone.monster-zone .card');
    
    if (oppMonsters.length > 0) {
        oppMonsters.forEach(m => {
            m.parentElement.classList.add('targetable'); 
        });
    } else {
        document.getElementById('oppAvatarContainer').classList.add('targetable');
    }
}

function cancelBattleMode() {
    battleState.isAttacking = false;
    battleState.attackerCard = null;
    
    document.querySelectorAll('.opp-zone.monster-zone').forEach(el => el.classList.remove('targetable'));
    document.getElementById('oppAvatarContainer').classList.remove('targetable');
}

function performDirectAttack(attacker) {
    const oppMonsters = document.querySelectorAll('.opp-zone.monster-zone .card');
    if (oppMonsters.length > 0) {
        alert("Cannot attack directly! Opponent controls monsters.");
        return;
    }

    const atk = parseInt(attacker.getAttribute('data-atk'));
    log(`${attacker.getAttribute('data-name')} attacks directly!`);
    
    attacker.style.transform = 'translateY(-50px) scale(1.2)';
    setTimeout(() => { attacker.style.transform = ''; }, 300);

    updateLP(atk, 'opponent');
    attacker.setAttribute('data-attacked', 'true');
    cancelBattleMode();
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
        target.classList.remove('face-down');
        target.classList.add('face-up');
        target.style.backgroundImage = `url('${target.getAttribute('data-img')}')`;
        if(!target.querySelector('.stats-bar')) {
            target.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${targetAtk}</span><span class="stat-val stat-def">${targetDef}</span></div>`;
        }
    }

    if (!isTargetDef) {
        if (atkVal > targetAtk) {
            const diff = atkVal - targetAtk;
            log(`Victory! ${targetName} destroyed. Opponent takes ${diff} damage.`);
            sendToGraveyard(target, 'opponent');
            updateLP(diff, 'opponent');
        } else if (atkVal < targetAtk) {
            const diff = targetAtk - atkVal;
            log(`Defeat! ${attackerName} destroyed. You take ${diff} damage.`);
            sendToGraveyard(attacker, 'player');
            updateLP(diff, 'player');
        } else {
            log("Double KO! Both monsters destroyed.");
            sendToGraveyard(target, 'opponent');
            sendToGraveyard(attacker, 'player');
        }
    } else {
        if (atkVal > targetDef) {
            log(`Defense pierced! ${targetName} destroyed.`);
            sendToGraveyard(target, 'opponent');
        } else if (atkVal < targetDef) {
            const diff = targetDef - atkVal;
            log(`Blocked! You take ${diff} damage.`);
            updateLP(diff, 'player');
        } else {
            log("Stalemate. No monsters destroyed.");
        }
    }

    if (document.body.contains(attacker)) {
        attacker.setAttribute('data-attacked', 'true');
    }
    cancelBattleMode();
}


function performAction(action) {
    if (!selectedHandCard) return;

    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') { alert("Action only allowed in Main Phase!"); actionMenu.classList.remove('active'); return; }
    
    const isMonsterSummon = (action === 'summon') || (action === 'set' && selectedHandCard.getAttribute('data-card-category') === 'monster');
    if (isMonsterSummon && gameState.normalSummonUsed) { 
        alert("Already used Normal Summon/Set this turn!"); 
        actionMenu.classList.remove('active'); 
        return; 
    }

    const cardData = {
        name: selectedHandCard.getAttribute('data-name'), 
        type: selectedHandCard.getAttribute('data-type'),
        atk: selectedHandCard.getAttribute('data-atk'), 
        def: selectedHandCard.getAttribute('data-def'),
        desc: selectedHandCard.getAttribute('data-desc'), 
        img: selectedHandCard.getAttribute('data-img'),
        category: selectedHandCard.getAttribute('data-card-category') 
    };

    let targetZone = null;
    let cssClass = '';
    
    if (cardData.category === 'monster') {
        const zones = ['p-m1', 'p-m2', 'p-m3', 'p-m4', 'p-m5'];
        for (let id of zones) { if (document.getElementById(id).children.length === 0) { targetZone = document.getElementById(id); break; } }
        if (!targetZone) { alert("Monster Zones Full!"); return; }
        cssClass = (action === 'summon') ? 'face-up pos-atk' : 'face-down pos-def';
        if (isMonsterSummon) gameState.normalSummonUsed = true;
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

    for(let k in cardData) {
        if (k === 'category') newCard.setAttribute('data-card-category', cardData[k]);
        else newCard.setAttribute('data-'+k, cardData[k]);
    }

    if (cssClass.includes('face-up')) {
        newCard.style.backgroundImage = `url('${cardData.img}')`;
        if(cardData.category === 'monster') {
            newCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${cardData.atk}</span><span class="stat-val stat-def">${cardData.def}</span></div>`;
        }
    }

    targetZone.appendChild(newCard);

    if (action === 'activate') {
        if(cardEffects[cardData.name]) { cardEffects[cardData.name](); } else { log(`Activated: ${cardData.name}`); }
        if(cardData.type.includes("Normal") && cardData.category === 'spell') {
            setTimeout(() => { sendToGraveyard(newCard, 'player'); }, 1000);
        }
    }

    selectedHandCard.remove(); 
    selectedHandCard = null;
    actionMenu.classList.remove('active');
    log(`${action}: ${cardData.name}`);
}

// --- LOGIC FUNCTIONS ---

function changeBattlePosition() {
    if (!selectedFieldCard) return;

    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') {
        alert("Action only allowed in Main Phase!");
        actionMenu.classList.remove('active');
        return;
    }

    const summonedTurn = parseInt(selectedFieldCard.getAttribute('data-turn'));
    const lastPosChange = parseInt(selectedFieldCard.getAttribute('data-last-pos-change') || 0);
    const hasAttacked = selectedFieldCard.getAttribute('data-attacked') === 'true';

    if (summonedTurn === turnCount || lastPosChange === turnCount || hasAttacked) {
        alert("Cannot change position!");
        actionMenu.classList.remove('active');
        return;
    }

    const atk = selectedFieldCard.getAttribute('data-atk');
    const def = selectedFieldCard.getAttribute('data-def');
    const statsHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${atk}</span><span class="stat-val stat-def">${def}</span></div>`;

    if (selectedFieldCard.classList.contains('pos-atk')) {
        selectedFieldCard.classList.remove('pos-atk');
        selectedFieldCard.classList.add('pos-def');
        if(selectedFieldCard.innerHTML.trim() === "") selectedFieldCard.innerHTML = statsHTML;
        log(`Changed ${selectedFieldCard.getAttribute('data-name')} to Defense.`);
    } else {
        selectedFieldCard.classList.remove('pos-def');
        selectedFieldCard.classList.add('pos-atk');
        if(selectedFieldCard.innerHTML.trim() === "") selectedFieldCard.innerHTML = statsHTML;
        log(`Changed ${selectedFieldCard.getAttribute('data-name')} to Attack.`);
    }

    selectedFieldCard.setAttribute('data-last-pos-change', turnCount);
    actionMenu.classList.remove('active');
}

function flipSummon() {
    if (!selectedFieldCard) return;

    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') {
        alert("Action only allowed in Main Phase!");
        actionMenu.classList.remove('active');
        return;
    }

    const setTurn = parseInt(selectedFieldCard.getAttribute('data-turn'));
    if (setTurn === turnCount) {
        alert("Cannot Flip Summon!");
        actionMenu.classList.remove('active');
        return;
    }

    selectedFieldCard.classList.remove('face-down', 'pos-def');
    selectedFieldCard.classList.add('face-up', 'pos-atk');
    
    const imgUrl = selectedFieldCard.getAttribute('data-img');
    selectedFieldCard.style.backgroundImage = `url('${imgUrl}')`;
    
    const atk = selectedFieldCard.getAttribute('data-atk');
    const def = selectedFieldCard.getAttribute('data-def');
    selectedFieldCard.innerHTML = `<div class="stats-bar"><span class="stat-val stat-atk">${atk}</span><span class="stat-val stat-def">${def}</span></div>`;

    selectedFieldCard.setAttribute('data-last-pos-change', turnCount);

    log(`Flip Summoned: ${selectedFieldCard.getAttribute('data-name')}`);
    actionMenu.classList.remove('active');
}

function activateSetCard() {
    if (!selectedFieldCard) return;
    if (currentPhase !== 'MP1' && currentPhase !== 'MP2') {
        alert("Action only allowed in Main Phase!");
        actionMenu.classList.remove('active');
        return;
    }
    
    selectedFieldCard.classList.remove('face-down');
    selectedFieldCard.classList.add('face-up');
    
    const imgUrl = selectedFieldCard.getAttribute('data-img');
    selectedFieldCard.style.backgroundImage = `url('${imgUrl}')`;
    
    const cardName = selectedFieldCard.getAttribute('data-name');
    log(`Activated Set Card: ${cardName}`);

    if(cardEffects[cardName]) { 
        cardEffects[cardName](); 
    }

    const type = selectedFieldCard.getAttribute('data-type');
    if(type.includes("Normal") && selectedFieldCard.getAttribute('data-card-category') === 'spell') {
        setTimeout(() => {
            sendToGraveyard(selectedFieldCard, 'player');
        }, 1000);
    }
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

const btn = document.getElementById('chainBtn');
const statesList = ['AUTO', 'ON', 'OFF'];
let idx = 0;
function toggleChain() {
    idx = (idx + 1) % 3; btn.className = `chain-btn state-${statesList[idx].toLowerCase()}`; btn.textContent = statesList[idx];
}