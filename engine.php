<?php
// ==========================================
// 1. DATA CONFIGURATION
// ==========================================

// Raw Data from YGOPRODeck API
$rawDB = [
    // Monsters
    // Level 8
    'blueeyes' => [
        "id" => 89631139, "name" => "Blue-Eyes White Dragon", "typeline" => ["Dragon","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "This legendary dragon is a powerful engine of destruction.", "race" => "Dragon", "atk" => 3000, "def" => 2500, "level" => 8, "attribute" => "LIGHT", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/89631139.jpg"
    ],
    
    // Level 7
    'darkmagician' => [
        "id" => 46986414, "name" => "Dark Magician", "typeline" => ["Spellcaster","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "The ultimate wizard in terms of attack and defense.", "race" => "Spellcaster", "atk" => 2500, "def" => 2100, "level" => 7, "attribute" => "DARK", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/46986414.jpg"
    ],

    // Level 6
    'summonedskull' => [
        "id" => 70781052, "name" => "Summoned Skull", "typeline" => ["Fiend","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "A fiend with dark powers for confusing the enemy. Among the Fiend-Type monsters, this monster boasts considerable force.", 
        "race" => "Fiend", "atk" => 2500, "def" => 1200, "level" => 6, "attribute" => "DARK", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/70781052.jpg"
    ],

    // Level 5
    'curseofdragon' => [
        "id" => 28279543, "name" => "Curse of Dragon", "typeline" => ["Dragon","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "A wicked dragon that taps into dark forces to execute a powerful flame attack.", 
        "race" => "Dragon", "atk" => 2000, "def" => 1500, "level" => 5, "attribute" => "DARK", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/28279543.jpg"
    ],

    // Level 4
    'geminielf' => [
        "id" => 69140098, "name" => "Gemini Elf", "typeline" => ["Spellcaster","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "Elf twins that alternate their attacks.", 
        "race" => "Spellcaster", "atk" => 1900, "def" => 900, "level" => 4, "attribute" => "EARTH", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/69140098.jpg"
    ],
    'celticguardian' => [
        "id" => 91152256, "name" => "Celtic Guardian", "typeline" => ["Warrior","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "An elf who learned to wield a sword, he baffles enemies with lightning-fast attacks.", 
        "race" => "Warrior", "atk" => 1400, "def" => 1200, "level" => 4, "attribute" => "EARTH", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/91152256.jpg"
    ],
    'mysticalelf' => [
        "id" => 15025844, "name" => "Mystical Elf", "typeline" => ["Spellcaster","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "A delicate elf that lacks offense, but has a terrific defense backed by mystical power.", 
        "race" => "Spellcaster", "atk" => 800, "def" => 2000, "level" => 4, "attribute" => "LIGHT", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/15025844.jpg"
    ],

    // Level 3
    'silverfang' => [
        "id" => 90357090, "name" => "Silver Fang", "typeline" => ["Beast","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "A snow wolf that's beautiful to the eye, but absolutely vicious in battle.", 
        "race" => "Beast", "atk" => 1200, "def" => 800, "level" => 3, "attribute" => "EARTH", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/90357090.jpg"
    ],
    'mammothgraveyard' => [
        "id" => 40374923, "name" => "Mammoth Graveyard", "typeline" => ["Dinosaur","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "A mammoth that protects the graves of its pack and is absolutely merciless when facing grave-robbers.", 
        "race" => "Dinosaur", "atk" => 1200, "def" => 800, "level" => 3, "attribute" => "EARTH", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/40374923.jpg"
    ],
    'beaverwarrior' => [
        "id" => 32452818, "name" => "Beaver Warrior", "typeline" => ["Beast-Warrior","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "What this creature lacks in size it makes up for in defense when battling in the prairie.", 
        "race" => "Beast-Warrior", "atk" => 1200, "def" => 1500, "level" => 3, "attribute" => "EARTH", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/32452818.jpg"
    ],

    // Level 2
    'basicinsect' => [
        "id" => 89091560, "name" => "Basic Insect", "typeline" => ["Insect","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "Usually found traveling in swarms, this creature's ideal environment is the forest.", 
        "race" => "Insect", "atk" => 500, "def" => 700, "level" => 2, "attribute" => "EARTH", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/89091579.jpg"
    ],

    // Level 1
    'petitangel' => [
        "id" => 38142739, "name" => "Petit Angel", "typeline" => ["Fairy","Normal"], "type" => "Normal Monster", "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "A quick-moving and tiny fairy that's very difficult to hit.", 
        "race" => "Fairy", "atk" => 600, "def" => 900, "level" => 1, "attribute" => "LIGHT", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/38142739.jpg"
    ],
    //spells
    // Normal spells
    'raigeki' => [
        "id" => 12580477, "name" => "Raigeki", "type" => "Spell Card", "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Destroy all monsters your opponent controls.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/12580477.jpg",
        "subType" => "Normal", "speed" => 1
    ],
    'pot' => [
        "id" => 55144522, "name" => "Pot of Greed", "type" => "Spell Card", "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Draw 2 cards.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/55144522.jpg",
        "subType" => "Normal", "speed" => 1
    ],
    'monsterreborn' => [
        "id" => 83764718, "name" => "Monster Reborn", "type" => "Spell Card", "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Target 1 monster in either GY; Special Summon it.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/83764718.jpg",
        "subType" => "Normal", "speed" => 1
    ],
    'dianketo' => [
        "id" => 84257639, "name" => "Dian Keto the Cure Master", "type" => "Spell Card", "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Increase your Life Points by 1000 points.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/84257639.jpg",
        "subType" => "Normal", "speed" => 1
    ],
    'ookazi' => [
        "id" => 19523799, "name" => "Ookazi", "type" => "Spell Card", "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Inflict 800 damage to your opponent.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/19523799.jpg",
        "subType" => "Normal", "speed" => 1
    ],
    'hinotama' => [
        "id" => 46130346, "name" => "Hinotama", "type" => "Spell Card", "humanReadableCardType" => "Normal Spell", "frameType" => "spell",
        "desc" => "Inflict 500 damage to your opponent.", "race" => "Normal",
        "image_url" => "https://images.ygoprodeck.com/images/cards/46130346.jpg",
        "subType" => "Normal", "speed" => 1
    ],
    
    // Equip Spells
    'axeofdespair' => [
        "id" => 40619825, "name" => "Axe of Despair", "type" => "Spell Card", "humanReadableCardType" => "Equip Spell", "frameType" => "spell", 
        "desc" => "The equipped monster gains 1000 ATK. When this card is sent from the field to the GY: You can Tribute 1 monster; place this card on top of your Deck.", "race" => "Equip", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/40619825.jpg",
        "subType" => "Equip", "speed" => 1
    ],
    'malevolentnuzzler' => [
        "id" => 99597615, "name" => "Malevolent Nuzzler", "type" => "Spell Card", "humanReadableCardType" => "Equip Spell", "frameType" => "spell", 
        "desc" => "The equipped monster gains 700 ATK. When this card is sent from the field to the Graveyard: You can pay 500 LP; place this card on the top of your Deck.", "race" => "Equip", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/99597615.jpg",
        "subType" => "Equip", "speed" => 1
    ],
    'blackpendant' => [
        "id" => 65169794, "name" => "Black Pendant", "type" => "Spell Card", "humanReadableCardType" => "Equip Spell", "frameType" => "spell", 
        "desc" => "The equipped monster gains 500 ATK. When this card is sent from the field to the Graveyard: Inflict 500 damage to your opponent.", "race" => "Equip", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/65169794.jpg",
        "subType" => "Equip", "speed" => 1
    ],


    // Quick-Play Spells
    'mst' => [
        "id" => 5318639, "name" => "Mystical Space Typhoon", "type" => "Spell Card", "humanReadableCardType" => "Quick-Play Spell", "frameType" => "spell", 
        "desc" => "Target 1 Spell/Trap on the field; destroy that target.", "race" => "Quick-Play", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/5318639.jpg",
        "subType" => "Quick-Play", "speed" => 2
    ],
    'rushrecklessly' => [
        "id" => 70046172, "name" => "Rush Recklessly", "type" => "Spell Card", "humanReadableCardType" => "Quick-Play Spell", "frameType" => "spell", 
        "desc" => "Target 1 face-up monster on the field; it gains 700 ATK until the end of this turn.", "race" => "Quick-Play", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/70046172.jpg",
        "subType" => "Quick-Play", "speed" => 2
    ],

    // Continuous Spells
    'bannerofcourage' => [
        "id" => 10012614, "name" => "Banner of Courage", "type" => "Spell Card", "humanReadableCardType" => "Continuous Spell", "frameType" => "spell", 
        "desc" => "All monsters you control gain 200 ATK during your Battle Phase only.", "race" => "Continuous", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/10012614.jpg",
        "subType" => "Continuous", "speed" => 1
    ],
    'burningland' => [
        "id" => 24294108, "name" => "Burning Land", "type" => "Spell Card", "humanReadableCardType" => "Continuous Spell", "frameType" => "spell", 
        "desc" => "During each player's Standby Phase: The turn player takes 500 damage.", "race" => "Continuous", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/24294108.jpg",
        "subType" => "Continuous", "speed" => 1
    ],
    //traps
    //normal trap
    'reinforcements' => [
        "id" => 17814387, "name" => "Reinforcements", "type" => "Trap Card", "humanReadableCardType" => "Normal Trap", "frameType" => "trap", 
        "desc" => "Target 1 face-up monster on the field; it gains 500 ATK until the end of this turn.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/17814387.jpg",
        "subType" => "Normal", "speed" => 2
    ],
    'justdesserts' => [
        "id" => 24068492, "name" => "Just Desserts", "type" => "Trap Card", "humanReadableCardType" => "Normal Trap", "frameType" => "trap", 
        "desc" => "Inflict 500 damage to your opponent for each monster they control.", "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/24068492.jpg",
        "subType" => "Normal", "speed" => 2
    ],
    // Continuous Traps
    'callofthehaunted' => [
        "id" => 97077563, "name" => "Call of the Haunted", "type" => "Trap Card", "humanReadableCardType" => "Continuous Trap", "frameType" => "trap", 
        "desc" => "Activate this card by targeting 1 monster in your GY; Special Summon that target in Attack Position. When this card leaves the field, destroy that monster. When that monster is destroyed, destroy this card.", "race" => "Continuous", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/97077563.jpg",
        "subType" => "Continuous", "speed" => 2
    ],
    'spellbindingcircle' => [
        "id" => 18807108, "name" => "Spellbinding Circle", "type" => "Trap Card", "humanReadableCardType" => "Continuous Trap", "frameType" => "trap", 
        "desc" => "Activate this card by targeting 1 monster your opponent controls; it cannot attack or change its battle position. When that monster is destroyed, destroy this card.", "race" => "Continuous", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/18807108.jpg",
        "subType" => "Continuous", "speed" => 2
    ],
];

// Pre-processing to normalize data for the Game Engine
$cardDB = [];
foreach ($rawDB as $key => $card) {
    $category = 'monster';
    if (in_array($card['frameType'], ['spell', 'trap'])) {
        $category = 'spell';
    }

    $cardDB[$key] = array_merge($card, [
        'category' => $category,
        'img'      => $card['image_url'],
        'atk'      => isset($card['atk']) ? $card['atk'] : '',
        'def'      => isset($card['def']) ? $card['def'] : '',
        'level'    => isset($card['level']) ? $card['level'] : '',
        'attribute'=> isset($card['attribute']) ? $card['attribute'] : '',
        'race'     => isset($card['race']) ? $card['race'] : '',
        'full_type'=> isset($card['typeline']) ? implode(' / ', $card['typeline']) : $card['humanReadableCardType']
    ]);
}

// ==========================================
// 2. GAME STATE (PHP Variables)
// ==========================================

function buildRandomDeck($db, $count) {
    $deck = [];
    $keys = array_keys($db);
    for ($i = 0; $i < $count; $i++) {
        $deck[] = $db[$keys[array_rand($keys)]];
    }
    return $deck;
}

// Build Full Decks (3 of each card for testing)
function buildFullDeck($db) {
    $deck = [];
    foreach ($db as $card) {
        for ($i = 0; $i < 3; $i++) {
            $deck[] = $card;
        }
    }
    shuffle($deck);
    return $deck;
}
// // Build Decks with 20 cards now
$playerDeck = [
    $cardDB['geminielf'],
    $cardDB['raigeki'],
    $cardDB['dianketo'],
    $cardDB['ookazi'],
    $cardDB['mst'],
    $cardDB['mst'],
    $cardDB['bannerofcourage'],
    $cardDB['burningland'],
    $cardDB['axeofdespair'],
    $cardDB['malevolentnuzzler'],
    $cardDB['rushrecklessly'],
    $cardDB['geminielf'],
    $cardDB['spellbindingcircle'],
    $cardDB['justdesserts'],
    $cardDB['mst'],
    $cardDB['geminielf'],
    $cardDB['mst'],
    $cardDB['pot'],
    $cardDB['monsterreborn'],
    $cardDB['reinforcements'],
    $cardDB['callofthehaunted'],
    
    
];
$oppDeck    = buildRandomDeck($cardDB, 20);

// Initial Field State
$playerMonsters = [0 => null, 1 => null, 2 => null];
$playerSpells   = [0 => null, 1 => null, 2 => null];
$playerGY       = [];
$playerExDeck   = [];

// Opponent Field - Testing Setup (Giving them some strong classic monsters)
$oppMonsters = [
    0 => $cardDB['blueeyes'],
    1 => $cardDB['summonedskull'],
    2 => null
];
$oppSpells = [0 => null, 1 => $cardDB['bannerofcourage'], 2 => null];
$oppGY = [$cardDB['summonedskull']];
$oppExDeck = [];

$playerHand = [];
$oppHand = [];

// ==========================================
// 3. RENDER FUNCTION
// ==========================================
function renderCardHTML($slotData, $isHand = false) {
    if (!$slotData || empty($slotData)) return '';
    $card = isset($slotData['card']) ? $slotData['card'] : $slotData;
    $state = isset($slotData['state']) ? $slotData['state'] : 'face-up pos-atk';
    $classes = $isHand ? 'hand-card' : 'card ' . $state;
    
    // Core Attributes
    $attr = ' data-name="' . htmlspecialchars($card['name']) . '"';
    $attr .= ' data-id="' . htmlspecialchars($card['id']) . '"';
    $attr .= ' data-type="' . htmlspecialchars($card['full_type']) . '"';
    $attr .= ' data-atk="' . htmlspecialchars($card['atk']) . '"';
    $attr .= ' data-def="' . htmlspecialchars($card['def']) . '"';
    $attr .= ' data-desc="' . htmlspecialchars($card['desc']) . '"';
    $attr .= ' data-img="' . htmlspecialchars($card['img']) . '"';
    $attr .= ' data-card-category="' . htmlspecialchars($card['category']) . '"';
    
    // New Extended Attributes
    $attr .= ' data-level="' . htmlspecialchars($card['level']) . '"';
    $attr .= ' data-attribute="' . htmlspecialchars($card['attribute']) . '"';
    $attr .= ' data-race="' . htmlspecialchars($card['race']) . '"';
    // Rules Engine Data
    $attr .= ' data-sub-type="' . (isset($card['subType']) ? $card['subType'] : '') . '"';
    $attr .= ' data-speed="' . (isset($card['speed']) ? $card['speed'] : '') . '"';
    $attr .= ' data-summon-logic="' . (isset($card['summonLogic']) ? $card['summonLogic'] : '') . '"';

    $style = '';
    if ($isHand || strpos($state, 'face-up') !== false) {
        $style = ' style="background-image: url(\'' . $card['img'] . '\');"';
    }

    $statsHTML = '';
    if (!$isHand && $card['category'] === 'monster' && strpos($state, 'face-up') !== false) {
        $statsHTML = '<div class="stats-bar"><span class="stat-val stat-atk">' . $card['atk'] . '</span><span class="stat-val stat-def">' . $card['def'] . '</span></div>';
    }

    return "<div class=\"$classes\" $attr $style>$statsHTML</div>";
}
?>