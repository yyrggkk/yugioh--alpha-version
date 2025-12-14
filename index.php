<?php require_once 'engine.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Master Duel Interface</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;700&display=swap');
        :root { --neon-blue: #00d4ff; --neon-red: #ff3333; --sidebar-bg: rgba(0, 15, 30, 0.95); --sidebar-header-bg: rgba(0, 80, 160, 0.6); --zone-border-width: 2px; --zone-width: 100px; --card-back-url: url('https://ms.yugipedia.com//thumb/e/e5/Back-EN.png/250px-Back-EN.png'); --stat-active-atk: #ffcc00; --stat-active-def: #00d4ff; --stat-inactive: #888; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: #050510; background-image: linear-gradient(rgba(0, 10, 20, 0.9), rgba(0, 10, 20, 0.9)), url('https://i.imgur.com/8Q5k5Zt.png'); background-size: cover; height: 100vh; overflow: hidden; font-family: 'Orbitron', sans-serif; display: flex; justify-content: center; align-items: center; }
        
        .hud-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; display: flex; flex-direction: column; justify-content: space-between; }
        .top-hud, .bottom-hud { display: flex; padding: 20px; align-items: center; }
        .top-hud { justify-content: flex-end; } .bottom-hud { justify-content: flex-start; }
        .profile-container { display: flex; align-items: center; gap: 10px; background: rgba(0, 0, 0, 0.6); padding: 5px; border-radius: 8px; border: 1px solid #444; pointer-events: auto; transition: all 0.3s; }
        .profile-container.targetable { border-color: #ff3333; box-shadow: 0 0 20px #ff3333; cursor: crosshair; transform: scale(1.05); }
        .top-hud .profile-container { border-color: #500; box-shadow: 0 0 10px rgba(255, 0, 0, 0.2); }
        .bottom-hud .profile-container { border-color: #005; box-shadow: 0 0 10px rgba(0, 200, 255, 0.2); }
        .lp-display { background: #000; padding: 10px 20px; border-radius: 4px; min-width: 150px; text-align: right; border: 1px solid #333; }
        .lp-label { font-size: 12px; color: #aaa; margin-right: 5px; } .lp-value { font-size: 28px; color: #ffd700; font-weight: 900; letter-spacing: 1px; }
        .avatar { width: 70px; height: 70px; background: #222; border: 2px solid #555; border-radius: 4px; overflow: hidden; } .avatar img { width: 100%; height: 100%; object-fit: cover; }
        
        .sidebar-left { position: absolute; left: 20px; top: 50%; transform: translateY(-55%); width: 280px; display: flex; flex-direction: column; gap: 10px; z-index: 600; font-family: 'Roboto', sans-serif; }
        .panel { background: var(--sidebar-bg); border: 1px solid var(--neon-blue); border-radius: 4px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 212, 255, 0.1); }
        .panel-header { background: var(--sidebar-header-bg); color: #fff; padding: 5px 10px; font-size: 14px; font-weight: bold; border-bottom: 1px solid var(--neon-blue); font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        
        .card-details-body { padding: 10px; display: flex; gap: 10px; min-height: 200px; }
        .detail-img { width: 90px; height: 130px; background-color: #111; background-size: cover; border: 1px solid #555; position: relative; flex-shrink: 0; }
        .detail-img.empty::after { content: 'NO CARD'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #444; font-size: 10px; text-align: center; width: 100%; }
        
        .detail-info { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #ccc; }
        .info-header { border-bottom: 1px solid #444; padding-bottom: 4px; margin-bottom: 4px; }
        .card-name { font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 2px; line-height: 1.2; }
        .card-meta { display: flex; gap: 8px; font-size: 10px; color: #aaa; align-items: center; }
        
        .attr-icon { width: 16px; height: 16px; border-radius: 50%; display: inline-block; background: #555; text-align: center; line-height: 16px; font-weight: bold; font-size: 9px; color: #000; }
        .attr-LIGHT { background: #ffeeaa; } .attr-DARK { background: #aa55cc; } .attr-EARTH { background: #dca45c; }
        .attr-WATER { background: #66ccff; } .attr-FIRE { background: #ff5533; } .attr-WIND { background: #55aa77; }
        
        .level-stars { color: #ffd700; letter-spacing: 1px; font-size: 12px; }
        
        .info-row { display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 2px; }
        .info-label { color: var(--neon-blue); } .info-val { color: #fff; font-weight: bold; }
        
        .description-box { font-size: 10px; line-height: 1.3; color: #ddd; height: 80px; overflow-y: auto; margin-top: 5px; border: 1px solid #333; padding: 5px; background: rgba(0,0,0,0.3); white-space: pre-wrap; }
        .log-body { height: 120px; overflow-y: auto; padding: 5px 10px; font-size: 12px; color: #fff; }
        .log-entry { margin-bottom: 4px; border-bottom: 1px solid #333; padding-bottom: 2px; } .log-entry span { color: var(--neon-blue); }

        .opponent-hand-container { position: fixed; top: -15px; left: 0; width: 100%; display: flex; justify-content: center; gap: 5px; z-index: 90; pointer-events: none; }
        .opponent-hand-card { width: 70px; height: 100px; background-image: var(--card-back-url); background-size: cover; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.5); border: 1px solid #444; transition: all 0.3s; }
        
        /* FIX: Hand Container Height 0 + Overflow Visible ensures it doesn't block clicks above it */
        .hand-container { 
    position: fixed; 
    bottom: 0; 
    left: 0; 
    width: 100%; 
    height: 160px; /* Sufficient height for cards */
    display: flex; 
    justify-content: center; 
    align-items: flex-end; /* Align cards to bottom */
    gap: 5px; 
    z-index: 200; 
    padding-bottom: 15px; 
    pointer-events: none; /* KEY FIX: Clicks pass through empty space */
}

/* FIX: Re-enable pointer events for the cards themselves */
.hand-card { width: 100px; height: 146px; background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 5px; border: 1px solid #555; box-shadow: -2px 2px 10px rgba(0,0,0,0.5); transition: transform 0.2s; cursor: pointer; 
    background-color: #222; 
    pointer-events: auto; /* KEY FIX: Cards remain clickable */
    transform-origin: bottom center;
}

.hand-card:hover { 
    transform: translateY(-40px) scale(1.2); 
    z-index: 210; 
    border-color: #fff; 
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.4); 
}
        .board-wrapper { perspective: 1000px; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
        .game-board { display: grid; grid-template-columns: repeat(5, var(--zone-width)); grid-template-rows: 130px 130px 80px 130px 130px; gap: 15px; transform: rotateX(40deg) scale(0.9) translateY(-120px); transform-style: preserve-3d; }
        
        /* FIX: Zones need position relative and Z-index management */
        .zone { width: 100%; height: 100%; border-radius: 8px; position: relative; display: flex; justify-content: center; align-items: center; transition: all 0.3s ease; }
        .zone::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 8px; opacity: 0.6; box-shadow: inset 0 0 15px rgba(0,0,0,0.8); pointer-events: none; }
        
        .opp-zone { border: var(--zone-border-width) solid var(--neon-red); } .opp-zone::after { background: rgba(255, 50, 50, 0.05); box-shadow: 0 0 10px var(--neon-red); }
        
        /* FIX: Elevate Player Zone Z-Index and use TranslateZ to pop it above overlaps */
        .player-zone { border: var(--zone-border-width) solid var(--neon-blue); z-index: 50; transform: translateZ(1px); transform-style: preserve-3d; } 
        .player-zone::after { background: rgba(0, 212, 255, 0.05); box-shadow: 0 0 10px var(--neon-blue); }
        
        .opp-zone.monster-zone.targetable { border-color: #ffcc00; box-shadow: 0 0 15px #ffcc00; cursor: crosshair; }
        .zone-counter { position: absolute; bottom: -5px; right: -5px; background: rgba(0, 0, 0, 0.9); color: #fff; border: 1px solid #777; border-radius: 4px; padding: 2px 6px; font-size: 14px; font-weight: bold; box-shadow: 0 0 5px rgba(0,0,0,0.5); z-index: 20; transform: translateZ(5px); }

        .phase-bar-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) translateZ(20px); width: 140%; display: flex; justify-content: center; align-items: center; pointer-events: none; }
        .phase-content { display: flex; align-items: center; width: 100%; justify-content: center; position: relative; pointer-events: none; /* Ensure strip doesn't block */ }
        .phase-strip { height: 40px; background: linear-gradient(90deg, transparent 0%, rgba(0, 40, 60, 0.9) 20%, rgba(0, 40, 60, 0.9) 80%, transparent 100%); border-top: 1px solid var(--neon-blue); border-bottom: 1px solid var(--neon-blue); flex-grow: 1; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; letter-spacing: 4px; text-shadow: 0 0 10px var(--neon-blue); position: relative; box-shadow: 0 0 15px rgba(0, 212, 255, 0.3); transition: color 0.3s; pointer-events: auto; }
        .phase-circle { width: 50px; height: 50px; border-radius: 50%; background: #000; border: 2px solid var(--neon-blue); color: var(--neon-blue); display: flex; justify-content: center; align-items: center; font-weight: bold; box-shadow: 0 0 15px var(--neon-blue); z-index: 2; pointer-events: auto; cursor: pointer; position: relative;}
        .phase-strip.opponent-turn { color: var(--neon-red); text-shadow: 0 0 10px var(--neon-red); border-color: var(--neon-red); }
        .phase-strip.opponent-turn::before { content: "OPPONENT'S "; margin-right: 10px; }
        .phase-menu { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 110%; height: 60px; background: rgba(0, 10, 25, 0.95); border: 2px solid var(--neon-blue); border-radius: 30px; box-shadow: 0 0 20px rgba(0, 212, 255, 0.4); z-index: 300; display: none; flex-direction: row; justify-content: center; align-items: center; gap: 15px; pointer-events: auto; }
        .phase-menu.active { display: flex; }
        .phase-item { padding: 8px 12px; color: #fff; font-weight: bold; font-size: 14px; cursor: pointer; border: 1px solid transparent; border-radius: 4px; transition: all 0.2s; }
        .phase-item:hover:not(.disabled) { background: var(--neon-blue); color: #000; box-shadow: 0 0 10px var(--neon-blue); }
        .phase-item.disabled { color: #555; cursor: default; }

        .card { width: 68px; height: 99px; border-radius: 4px; box-shadow: 0 3px 6px rgba(0,0,0,0.9); background-size: cover; background-position: center; background-repeat: no-repeat; position: relative; transform-style: preserve-3d; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: flex; flex-direction: column; justify-content: flex-end; background-color: #222; pointer-events: auto !important; /* Force Clickable */ }
        .card.face-down { background-image: var(--card-back-url); border: 1px solid #444; }
        .card.face-up { border: 1px solid #fff; box-shadow: 0 0 8px rgba(255, 255, 255, 0.2); }
        .card.pos-atk { transform: rotate(0deg); }
        .card.pos-def { transform: rotate(270deg); }
        .player-zone .card { cursor: pointer; }
        .opp-zone .card.face-up { cursor: pointer; }
        .player-zone .card:hover, .opp-zone .card.face-up:hover { filter: brightness(1.2); border-color: #ffff00; }
        .gy-zone, .ex-deck-zone, .deck-zone { cursor: pointer; }
        .gy-zone:hover, .ex-deck-zone:hover, .deck-zone:hover { box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.2); }
        .stats-bar { width: 100%; height: 16px; background: rgba(0, 0, 0, 0.85); display: flex; justify-content: space-around; align-items: center; font-size: 9px; font-weight: 900; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; opacity: 0; }
        .card.face-up .stats-bar { opacity: 1; }
        .stat-val { transition: all 0.3s; }
        .card.pos-atk .stat-atk { color: var(--stat-active-atk); text-shadow: 0 0 5px var(--stat-active-atk); }
        .card.pos-atk .stat-def { color: var(--stat-inactive); }
        .card.pos-def .stat-def { color: var(--stat-active-def); text-shadow: 0 0 5px var(--stat-active-def); }
        .card.pos-def .stat-atk { color: var(--stat-inactive); }

        .chain-toggle-container { position: fixed; bottom: 30px; right: 30px; z-index: 300; display: flex; flex-direction: column; align-items: center; }
        .chain-btn { width: 55px; height: 55px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #444, #111); border: 2px solid var(--neon-blue); box-shadow: 0 0 10px var(--neon-blue), inset 0 0 10px var(--neon-blue); display: flex; justify-content: center; align-items: center; color: #fff; font-weight: 900; font-family: 'Orbitron', sans-serif; font-size: 13px; cursor: pointer; text-shadow: 0 0 5px var(--neon-blue); transition: all 0.2s ease; user-select: none; }
        .chain-btn.state-auto { color: #fff; border-color: var(--neon-blue); }
        .chain-btn.state-on { color: #fff; border-color: #ffcc00; box-shadow: 0 0 10px #ffcc00, inset 0 0 10px #ffcc00; text-shadow: 0 0 5px #ffcc00; }
        .chain-btn.state-off { color: #888; border-color: #555; box-shadow: none; text-shadow: none; }

        .action-menu { position: fixed; background: rgba(0, 20, 40, 0.95); border: 1px solid var(--neon-blue); border-radius: 6px; box-shadow: 0 0 15px rgba(0, 212, 255, 0.3); z-index: 300; display: none; flex-direction: column; min-width: 120px; padding: 5px 0; }
        .action-menu.active { display: flex; }
        .action-btn { background: transparent; border: none; color: #fff; padding: 10px 15px; text-align: left; cursor: pointer; font-family: 'Roboto', sans-serif; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s; }
        .action-btn:last-child { border-bottom: none; }
        .action-btn:hover { background: rgba(0, 212, 255, 0.2); color: var(--neon-blue); }
        .action-btn.battle-option { color: #ff3333; font-weight: bold; }
        .action-btn.battle-option:hover { background: rgba(255, 50, 50, 0.2); color: #fff; }

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 500; display: none; justify-content: flex-end; align-items: center; backdrop-filter: blur(5px); padding-right: 5%; }
        .modal-overlay.active { display: flex; }
        .modal-content { width: 60%; max-width: 900px; height: 80%; background: rgba(10, 15, 25, 0.95); border: 2px solid var(--neon-blue); box-shadow: 0 0 30px rgba(0, 212, 255, 0.2); border-radius: 8px; display: flex; flex-direction: column; }
        .modal-header { padding: 15px 20px; background: linear-gradient(90deg, rgba(0, 50, 100, 0.5), transparent); border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
        .modal-title { color: #fff; font-weight: bold; font-size: 18px; letter-spacing: 1px; }
        .close-btn { color: #888; font-size: 24px; cursor: pointer; transition: color 0.2s; }
        .close-btn:hover { color: #fff; }
        .modal-body { flex: 1; padding: 20px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); grid-gap: 15px; align-content: start; }
        .list-card { width: 100%; aspect-ratio: 0.69; background-size: cover; background-position: center; border-radius: 4px; border: 1px solid #555; cursor: pointer; transition: transform 0.2s; }
        .list-card:hover { transform: scale(1.1); border-color: #fff; z-index: 2; box-shadow: 0 0 10px rgba(255,255,255,0.3); }

        .surrender-btn { position: fixed; top: 20px; left: 20px; z-index: 700; background: rgba(50, 0, 0, 0.8); border: 2px solid #ff3333; color: #ff3333; padding: 8px 15px; font-family: 'Orbitron', sans-serif; font-weight: bold; font-size: 12px; cursor: pointer; border-radius: 4px; transition: all 0.2s; text-transform: uppercase; box-shadow: 0 0 10px rgba(255, 0, 0, 0.3); }
        .surrender-btn:hover { background: rgba(255, 0, 0, 0.2); box-shadow: 0 0 15px #ff3333; color: white; }
        .debug-btn { position: fixed; top: 60px; left: 20px; z-index: 1000; padding: 5px; background: #333; color: white; cursor: pointer; border: 1px solid #666; font-size: 10px; }
        .draw-card-anim { position: absolute; width: 68px; height: 99px; background-image: var(--card-back-url); background-size: cover; border-radius: 4px; box-shadow: 0 0 10px white; z-index: 500; transition: all 0.8s ease-in-out; }
    </style>
</head>
<body>
    <button class="surrender-btn" onclick="alert('You Surrendered')">SURRENDER</button>
    <button class="debug-btn" onclick="switchTurn()">DEBUG: SWITCH TURN</button>

    <div class="modal-overlay" id="listModal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-title" id="listTitle">Graveyard</span>
                <span class="close-btn" onclick="closeList()">&times;</span>
            </div>
            <div class="modal-body" id="listGrid"></div>
        </div>
    </div>

    <div id="actionMenu" class="action-menu"></div>

    <div class="hud-layer">
        <div class="top-hud">
            <div class="profile-container" id="oppAvatarContainer">
                <div class="lp-display"><span class="lp-label">LP</span><span class="lp-value" id="opp-lp-val">8000</span></div>
                <div class="avatar"><img src="https://via.placeholder.com/70x70/330000/ff3333?text=OPP" alt="Opponent"></div>
            </div>
        </div>
        <div class="bottom-hud">
            <div class="profile-container">
                <div class="avatar"><img src="https://via.placeholder.com/70x70/000033/00d4ff?text=YOU" alt="Player"></div>
                <div class="lp-display"><span class="lp-label">LP</span><span class="lp-value" id="player-lp-val">8000</span></div>
            </div>
        </div>
    </div>

    <div class="chain-toggle-container">
        <div class="chain-btn state-auto" id="chainBtn" onclick="toggleChain()">AUTO</div>
    </div>

    <div class="sidebar-left">
        <div class="panel">
            <div class="panel-header">CARD DETAILS</div>
            <div class="card-details-body">
                <div class="detail-img empty" id="detailImg"></div>
                <div class="detail-info">
                    
                    <div class="info-header">
                        <div class="card-name" id="detailName"></div>
                        <div class="card-meta">
                            <span id="detailAttrIcon" class="attr-icon"></span>
                            <span id="detailLevel" class="level-stars"></span>
                        </div>
                    </div>

                    <div class="info-row"><span class="info-label">Type</span><span class="info-val" id="detailType"></span></div>
                    <div class="info-row"><span class="info-label">ATK</span><span class="info-val" id="detailAtk"></span></div>
                    <div class="info-row"><span class="info-label">DEF</span><span class="info-val" id="detailDef"></span></div>
                    
                    <div class="description-box" id="detailDesc">Select a card to view details.</div>
                </div>
            </div>
        </div>
        <div class="panel">
            <div class="panel-header">DUEL LOG</div>
            <div class="log-body" id="logBody">
                <div class="log-entry"><span>System:</span> Duel Started.</div>
            </div>
        </div>
    </div>

    <div class="opponent-hand-container"></div>

    <div class="board-wrapper">
        <div class="game-board">
            
            <div class="zone opp-zone deck-zone">
                <div class="card face-down pos-atk"></div>
                <div class="zone-counter" id="opp-deck-count"><?php echo count($oppDeck); ?></div>
            </div>
            
            <?php foreach($oppSpells as $slot): ?>
                <div class="zone opp-zone spell-trap-zone"><?php echo renderCardHTML($slot); ?></div>
            <?php endforeach; ?>
            
            <div class="zone opp-zone ex-deck-zone">
                <div class="card face-down pos-atk"></div>
                <div class="zone-counter" id="opp-ex-count">0</div>
            </div>

            <div class="zone opp-zone gy-zone" id="oppGY">
                <?php if(!empty($oppGY)): ?><?php echo renderCardHTML(['card' => end($oppGY), 'state' => 'face-up pos-atk']); ?><?php endif; ?>
                <div class="zone-counter" id="opp-gy-count"><?php echo count($oppGY); ?></div>
            </div>
            
            <?php foreach($oppMonsters as $slot): ?>
                <div class="zone opp-zone monster-zone"><?php echo renderCardHTML($slot); ?></div>
            <?php endforeach; ?>
            
            <div class="zone opp-zone field-zone"></div>
            
            <div></div><div></div><div></div><div></div><div></div>
            <div class="phase-bar-overlay">
                <div class="phase-content">
                    <div class="phase-circle" id="phaseBtn" onclick="togglePhaseMenu()">DP</div>
                    <div class="phase-strip" id="phaseText">DRAW PHASE</div>
                    <div class="phase-circle">180</div>
                    <div class="phase-menu" id="phaseMenu">
                        <div class="phase-item disabled" id="ph-DP">DP</div>
                        <div class="phase-item disabled" id="ph-SP">SP</div>
                        <div class="phase-item" id="ph-MP1" onclick="setPhase('MP1')">MP1</div>
                        <div class="phase-item" id="ph-BP" onclick="setPhase('BP')">BP</div>
                        <div class="phase-item" id="ph-MP2" onclick="setPhase('MP2')">MP2</div>
                        <div class="phase-item" id="ph-EP" onclick="setPhase('EP')">EP</div>
                    </div>
                </div>
            </div>

            <div class="zone player-zone field-zone"></div>

            <?php foreach($playerMonsters as $i => $slot): ?>
                <div class="zone player-zone monster-zone" id="p-m<?php echo $i+1; ?>">
                    <?php echo renderCardHTML($slot); ?>
                </div>
            <?php endforeach; ?>
            
            <div class="zone player-zone gy-zone" id="playerGY">
                <?php if(!empty($playerGY)): ?><?php echo renderCardHTML(['card' => end($playerGY), 'state' => 'face-up pos-atk']); ?><?php endif; ?>
                <div class="zone-counter" id="player-gy-count"><?php echo count($playerGY); ?></div>
            </div>

            <div class="zone player-zone ex-deck-zone" id="playerEx">
                <div class="card face-down pos-atk"></div>
                <div class="zone-counter" id="player-ex-count">0</div>
            </div>
            
            <?php foreach($playerSpells as $i => $slot): ?>
                <div class="zone player-zone spell-trap-zone" id="p-s<?php echo $i+1; ?>">
                    <?php echo renderCardHTML($slot); ?>
                </div>
            <?php endforeach; ?>
            
            <div class="zone player-zone deck-zone" id="playerDeck">
                <div class="card face-down pos-atk"></div>
                <div class="zone-counter" id="player-deck-count"><?php echo count($playerDeck); ?></div>
            </div>

        </div>
    </div>

    <div class="hand-container" id="playerHand"></div>
    <script>
        let playerDeckData = <?php echo json_encode($playerDeck); ?>;
        let playerHandData = []; 
        let playerGYData = <?php echo json_encode($playerGY); ?>;
        let playerExData = [];
        let oppDeckData = <?php echo json_encode($oppDeck); ?>;
        let oppHandData = [];
        let oppGYData = <?php echo json_encode($oppGY); ?>;
        let oppExData = [];
    </script>
    <script src="main.js"></script>
</body>
</html>