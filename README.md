# Yu-Gi-Oh! Web Game Engine

A web-based implementation of a Yu-Gi-Oh! Trading Card Game engine, aimed at replicating the visual experience of "Master Duel" using web technologies (PHP, HTML, CSS, JS).

## Project Idea
The goal is to create a fully functional browser-based card game interface that handles game state, card interactions, and logic enforcement. It leverages a backend data structure for card definitions and initial state, coupled with a rich frontend for player interaction.

## Features Currently Implemented

### 1. Game Engine Core (PHP)
- **Card Database**: Hardcoded database primarily featuring classic Era cards (Blue-Eyes, Dark Magician, etc.) with support for:
   - Monsters (Normal)
   - Spells (Normal, Quick-Play, Continuous, Equip)
   - Traps (Normal)
- **Deck Building**: Logic to generate random decks and initialize specific testing decks.
- **State Initialization**: Setup for Player and Opponent fields (Hand, Deck, GY, Extra Deck).

### 2. User Interface (Frontend)
- **3D Game Board**: CSS-driven 3D perspective field with distinct zones:
  - Monster Zones
  - Spell/Trap Zones
  - Deck, Graveyard, and Extra Deck Zones
- **Visual Style**: "Master Duel" inspired neon aesthetics, including:
  - Holographic-style borders and glow effects.
  - Dynamic backgrounds.
  - Orbitron fonts for a sci-fi feel.
- **Card Rendering**:
  - Support for Face-up (Attack/Defense) and Face-down positions.
  - Visual distinction for targetable elements.

### 3. Interactive Elements
- **HUD**: Heads-up display showing User/Opponent Avatars and Life Points.
- **Phase Control**: Interactive Phase Bar (Draw Phase to End Phase) with visual indicators for the current turn.
- **Chain System UI**: Toggle button for Chain response settings (Auto/On/Off).
- **Card Inspection**: Sidebar panel displaying detailed card information (Image, Description, Stats) on hover/selection.
- **Log System**: Space for a dual log to track game actions.

### 4. Mechanics Support
- **Trap Cards**: Implementation of Normal Traps with "Set" mechanics (face-down) and activation restrictions (cannot activate turn set).
- **Battle Phase**: Basic structure for battle interactions.
- **Surrender/Debug**: Utilities for testing and game flow control.
