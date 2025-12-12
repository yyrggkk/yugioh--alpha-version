<?php
// ==========================================
// 1. DATA CONFIGURATION
// ==========================================

// Raw Data from your source (simulating a DB or API response)
$rawDB = [
    'raigeki' => [
        "id" => 12580477, "name" => "Raigeki", "type" => "Spell Card", 
        "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Destroy all monsters your opponent controls.", 
        "race" => "Normal", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/12580477.jpg"
    ],
    'blueeyes' => [
        "id" => 89631139, "name" => "Blue-Eyes White Dragon", 
        "typeline" => ["Dragon","Normal"], "type" => "Normal Monster", 
        "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "This legendary dragon is a powerful engine of destruction. Virtually invincible, very few have faced this awesome creature and lived to tell the tale.", 
        "race" => "Dragon", "atk" => 3000, "def" => 2500, "level" => 8, "attribute" => "LIGHT", 
        "archetype" => "Blue-Eyes", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/89631139.jpg"
    ],
    'darkmagician' => [
        "id" => 46986414, "name" => "Dark Magician", 
        "typeline" => ["Spellcaster","Normal"], "type" => "Normal Monster", 
        "humanReadableCardType" => "Normal Monster", "frameType" => "normal", 
        "desc" => "''The ultimate wizard in terms of attack and defense.''", 
        "race" => "Spellcaster", "atk" => 2500, "def" => 2100, "level" => 7, "attribute" => "DARK", 
        "archetype" => "Dark Magician", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/46986414.jpg"
    ],
    'pot' => [
        "id" => 55144522, "name" => "Pot of Greed", "type" => "Spell Card", 
        "humanReadableCardType" => "Normal Spell", "frameType" => "spell", 
        "desc" => "Draw 2 cards.", "race" => "Normal", 
        "archetype" => "Greed", 
        "image_url" => "https://images.ygoprodeck.com/images/cards/55144522.jpg"
    ]
];

// Pre-processing to normalize data for the Game Engine
$cardDB = [];
foreach ($rawDB as $key => $card) {
    // 1. Determine Category (Monster vs Spell/Trap) based on frameType
    $category = 'monster';
    if (in_array($card['frameType'], ['spell', 'trap'])) {
        $category = 'spell';
    }

    // 2. Map fields to ensure engine compatibility
    $cardDB[$key] = array_merge($card, [
        'category' => $category,
        'img'      => $card['image_url'], // Map image_url to img
        'atk'      => isset($card['atk']) ? $card['atk'] : 0, // Default 0 for spells
        'def'      => isset($card['def']) ? $card['def'] : 0,
        'level'    => isset($card['level']) ? $card['level'] : 0,
        'attribute'=> isset($card['attribute']) ? $card['attribute'] : '',
        'race'     => isset($card['race']) ? $card['race'] : '',
        // Format Type string like "Dragon / Normal"
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

// Initial Decks
$playerDeck = buildRandomDeck($cardDB, 15);
$oppDeck    = buildRandomDeck($cardDB, 15);

// Initial Field State
$playerMonsters = [0 => null, 1 => null, 2 => null];
$playerSpells   = [0 => null, 1 => null, 2 => null];
$playerGY       = [];
$playerExDeck   = [];

// Opponent Field - Testing Setup
$oppMonsters = [
    0 => $cardDB['blueeyes'],
    1 => $cardDB['darkmagician'],
    2 => null
];
$oppSpells = [0 => null, 1 => null, 2 => null];
$oppGY = [];
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