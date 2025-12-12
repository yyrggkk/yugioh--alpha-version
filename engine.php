<?php
// ==========================================
// 1. DATA CONFIGURATION
// ==========================================
$cardDB = [
    'raigeki' => [
        'name' => 'Raigeki', 'type' => 'Spell / Normal', 'atk' => '-', 'def' => '-',
        'desc' => 'Destroy all monsters your opponent controls.',
        'img' => 'https://images.ygoprodeck.com/images/cards/12580477.jpg', 'category' => 'spell'
    ],
    'blueeyes' => [
        'name' => 'Blue-Eyes White Dragon', 'type' => 'Dragon / Normal', 'atk' => 3000, 'def' => 2500,
        'desc' => 'This legendary dragon is a powerful engine of destruction.',
        'img' => 'https://images.ygoprodeck.com/images/cards/89631139.jpg', 'category' => 'monster'
    ],
    'darkmagician' => [
        'name' => 'Dark Magician', 'type' => 'Spellcaster / Normal', 'atk' => 2500, 'def' => 2100,
        'desc' => 'The ultimate wizard in terms of attack and defense.',
        'img' => 'https://images.ygoprodeck.com/images/cards/46986414.jpg', 'category' => 'monster'
    ],
    'pot' => [
        'name' => 'Pot of Greed', 'type' => 'Spell / Normal', 'atk' => '-', 'def' => '-',
        'desc' => 'Draw 2 cards.',
        'img' => 'https://images.ygoprodeck.com/images/cards/55144522.jpg', 'category' => 'spell'
    ],
];

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

// Initial Field State (Populated so you can see cards)
$playerMonsters = [
    0 => null,
    1 => null,
    2 => null
];
$playerSpells = [
    0 => null,
    1 => null,
    2 => null
];
$playerGY = [];
$playerExDeck = []; // 0 Cards

// Opponent Field - Let's add some monsters to test Raigeki
$oppMonsters = [
    0 => $cardDB['blueeyes'], // Added for testing
    1 => $cardDB['darkmagician'], // Added for testing
    2 => null
];
$oppSpells = [
    0 => null,
    1 => null,
    2 => null
];
$oppGY = [];
$oppExDeck = []; // 0 Cards

// Hands start empty (will draw via JS on load)
$playerHand = [];
$oppHand = [];

// ==========================================
// 3. RENDER FUNCTION
// ==========================================
function renderCardHTML($slotData, $isHand = false) {
    if (!$slotData || empty($slotData)) return '';
    $card = isset($slotData['card']) ? $slotData['card'] : $slotData;
    $state = isset($slotData['state']) ? $slotData['state'] : 'face-up pos-atk'; // Default for opponent test cards
    $classes = $isHand ? 'hand-card' : 'card ' . $state;
    
    $attr = ' data-name="' . htmlspecialchars($card['name']) . '"';
    $attr .= ' data-type="' . htmlspecialchars($card['type']) . '"';
    $attr .= ' data-atk="' . htmlspecialchars($card['atk']) . '"';
    $attr .= ' data-def="' . htmlspecialchars($card['def']) . '"';
    $attr .= ' data-desc="' . htmlspecialchars($card['desc']) . '"';
    $attr .= ' data-img="' . htmlspecialchars($card['img']) . '"';
    $attr .= ' data-card-category="' . htmlspecialchars($card['category']) . '"';

    $style = '';
    // Show image if Face-Up OR if it's in Hand
    if ($isHand || strpos($state, 'face-up') !== false) {
        $style = ' style="background-image: url(\'' . $card['img'] . '\');"';
    }

    $statsHTML = '';
    // Show stats if it's a Monster AND Face-Up AND not in Hand
    if (!$isHand && $card['category'] === 'monster' && strpos($state, 'face-up') !== false) {
        $statsHTML = '<div class="stats-bar"><span class="stat-val stat-atk">' . $card['atk'] . '</span><span class="stat-val stat-def">' . $card['def'] . '</span></div>';
    }

    return "<div class=\"$classes\" $attr $style>$statsHTML</div>";
}
?>