# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# ENCRYPTED MONOPOLY — Browser-Based Mathematics Project

**Status:** Ready for Single-Pass AI Implementation  
**Version:** 1.1  
**Product type:** Local multiplayer browser game  
**Target platform:** Desktop browser first; tablet/mobile responsive  
**Technology constraint:** HTML5, CSS3, Vanilla JavaScript (ES Modules), SVG  
**Primary language:** Indonesian  
**Project context:** Mathematics, Grade XI — composition of functions and inverse functions

---

## 0. Instructions for the AI Coding Agent

Treat this document as the source of truth for product behavior, narrative, and technical implementation. Read it completely before editing the repository.

### 0.1 Execution mode: ONE IMPLEMENTATION PHASE

The project owner wants the AI agent to implement the complete playable game in **one continuous execution task**. Do not divide delivery into separately approved phases and do not stop after planning, scaffolding, a visual prototype, or a partial demo.

Work through the necessary activities internally in this order:

1. Inspect the repository and identify reusable assets/code.
2. Validate requirements, list unresolved source-edition details, and choose safe defaults where allowed.
3. Build the complete browser application and all core gameplay systems.
4. Integrate the story, board presentation, card system, and cryptography.
5. Run automated tests, fix failures, and perform a complete manual/browser smoke test where tooling permits.
6. Finish documentation, changelog, implementation report, and run instructions.

These are internal work steps, **not separate delivery phases**. Continue from one step to the next without asking the user to approve each step. Do not stop to ask questions unless a missing input makes implementation genuinely impossible. When information is missing but a configurable implementation is possible, make a clearly documented provisional choice, keep it editable, and record it in `OPEN_QUESTIONS.md`.

At the end of the single execution task, deliver the most complete working version possible and report honestly:
- what works;
- what was tested and the result;
- what remains provisional or unverified;
- how to run the game locally.

### 0.2 Non-negotiable product rules

1. Preserve the selected classic Monopoly rule set. The narrative and encryption are presentation/learning layers; they must not introduce new gameplay rules or change movement, prices, rent, property ownership, card effects, jail, bankruptcy, or victory conditions.
2. The only intended change to alphabetic content printed on the board and card faces is to display it as numeric ciphertext. Do not encrypt operational UI controls such as buttons, settings, player balances, or accessibility labels.
3. Do not invent a different board-game mechanic, scoring system, shortcut rule, side quest, story mission, bonus, or house rule.
4. Do not silently assume unverified rule values, card effects, property prices, or card instructions. Use an editable edition profile. Mark provisional data clearly in `OPEN_QUESTIONS.md` and in the relevant data metadata.
5. Implement encryption and decryption as separate, testable modules based on composition of functions and inverse functions. Do not use a random mapping or a simple A=1, B=2 substitution as the final cipher.
6. The functions and keys must be configurable. Any sample key is for development only until approved by the project team/teacher.
7. Keep the game effects in structured data and engine logic. Never infer or execute a card effect by interpreting the visible ciphertext or the player's typed answer.
8. A card's structured effect may run only after the decryption workflow succeeds, and it must run exactly once. If the final class rules require a different verification workflow, keep it configurable.
9. Story content must be atmospheric and explanatory only. It must not create extra objectives, resources, rewards, penalties, turns, or card effects.
10. Do not claim a feature is complete unless it works and has been tested. No fake buttons, decorative controls that do nothing, placeholder transactions, or hard-coded fake player actions.
11. Use readable, beginner-friendly code with comments on important game rules and mathematical transformations.
12. Do not add a backend, login, online multiplayer, payment system, analytics, or unnecessary libraries unless explicitly requested.
13. Use original artwork and UI assets. Do not copy official logos, characters, or board/card illustrations. Game data must be based on the edition reference supplied/approved by the project team; paraphrase card wording in Indonesian while preserving its mechanical effect when appropriate.

### 0.3 Repository and delivery requirements

- Inspect the existing repository and preserve useful files. Do not delete or rewrite unrelated work.
- If no project exists, create the structure described in Section 12.
- Create or update `README.md`, `CHANGELOG.md`, `IMPLEMENTATION.md`, `OPEN_QUESTIONS.md`, and `STORY.md`.
- Ensure the finished app can be run locally using a simple development server and can be hosted as a static website.
- Do not leave core gameplay as TODOs. TODOs are acceptable only for exact edition-specific facts that cannot be verified from the supplied materials; the game must still have a clearly labelled, configurable playable baseline where possible.
- Do not finish with only a plan. The final output must include implemented source code, tests, and documentation.

---

## 1. Product Overview

### 1.1 Product name

**Encrypted Monopoly** (working title; the public title can be changed by the project team).

### 1.2 One-sentence concept

A browser-based, local multiplayer property-trading board game set in the fictional city of Cryptonia in 2099. It follows the selected classic Monopoly rules without mechanical changes. Alphabetic text printed on board spaces and card faces is shown as numeric ciphertext generated through a composition of two functions and decoded using inverse functions. A short, skippable narrative frames the experience as investors competing in Cryptonia, without introducing additional objectives or mechanics.

### 1.3 Problem and educational purpose

The project demonstrates how composition of functions and inverse functions can be applied to a practical, interactive context. Players see encoded messages and use the inverse-function process to recover the original instructions. The game remains a property-trading game; cryptography is the presentation and learning layer, not a replacement for the game rules.

### 1.4 Source-derived learning requirements

The class project worksheet asks students to:

- create a secret message (plaintext);
- define two encryption functions, `f(x)` and `g(x)`, as a composition of functions;
- calculate ciphertext;
- send ciphertext and the key to another group;
- receive and decrypt ciphertext;
- present the decryption process.

The worksheet leaves the actual `f(x)` and `g(x)` entries for the group to define. Therefore, the final formulas and keys are a project-team/teacher decision and must remain configurable in the game. The worksheet does not prescribe one specific formula.

### 1.5 In-game story: THE LOST CIPHER

**Story title:** `THE LOST CIPHER`  
**World:** Cryptonia, a fictional futuristic city in the year 2099.  
**Tagline:** *Setiap wilayah menyimpan kode. Setiap keputusan membangun kekuasaan.*

#### Official story premise

Pada tahun 2099, Cryptonia menjadi kota perdagangan dan pusat kepemilikan aset paling penting di dunia. Untuk menjaga catatan kota, seluruh nama wilayah, dokumen kepemilikan, dan pesan-pesan tertentu disimpan menggunakan sistem kriptografi berbasis komposisi fungsi.

Para pemain berperan sebagai investor yang memperoleh izin untuk memasuki pasar properti Cryptonia. Mereka harus membeli dan mengembangkan wilayah, mengelola uang, membayar kewajiban, serta bersaing dengan investor lain. Namun, informasi pada papan dan kartu kota ditampilkan sebagai rangkaian angka terenkripsi. Pemain perlu memahami proses dekripsi menggunakan fungsi invers untuk membaca pesan pada kartu.

Persaingan berakhir mengikuti aturan Monopoli yang dipilih: pemain yang masih mampu bertahan secara finansial menjadi investor terakhir yang menguasai aset. Tidak ada misi rahasia, pertarungan, level, poin tambahan, atau tujuan baru.

#### Narrative beats and placement

1. **Opening prologue (before player setup):** show the story title, year 2099, a short introduction to Cryptonia, and why city information is encoded. Provide `Mulai` and `Lewati` controls. The prologue must be short and skippable.
2. **Investor registration (new-game setup):** frame player-name and token selection as registration of investors. This is visual wording only; setup rules do not change.
3. **Game introduction (when the board opens):** explain that players are entering Cryptonia's property market and that all board/card wording is encoded. Show the selected encryption formula/key guide in the learning panel.
4. **During turns:** use restrained flavor text in the activity log, such as an asset-registration confirmation or a city-ledger update. Never add a new action or delay a turn with mandatory dialogue.
5. **Chance cards:** frame the deck as intercepted opportunity signals. The card's actual instruction remains encoded and must preserve the configured classic card effect.
6. **Community Chest cards:** frame the deck as records from Cryptonia's public archive. The card's actual instruction remains encoded and must preserve the configured classic card effect.
7. **Jail space:** visually theme the jail as Cryptonia's security detention center, while retaining the exact jail rules and decisions from the selected edition profile.
8. **Bankruptcy:** describe the player as having lost the ability to meet financial obligations and their assets being settled according to the selected rules. Do not add a new penalty.
9. **Ending:** show a short ending for the winner: the surviving investor becomes the leading asset holder of Cryptonia. Show a neutral message for other players. The winner and end condition must be determined only by the Monopoly engine.

#### Story and encryption boundary

- The opening prologue, explanatory story panels, player setup, buttons, help text, and accessibility text remain readable Indonesian so players can understand the premise and operate the game.
- Alphabetic titles/names/descriptions printed **on board spaces and on the face/content of Chance and Community Chest cards** must be displayed as numeric ciphertext.
- Numeric game values (cash, rent, property price, dice values, tax amounts) remain normal numbers and must never be confused with ciphertext.
- Do not reveal a card's plaintext in the story wrapper, preview, activity log, browser title, or accessible text before the player completes the decryption step. Screen readers may receive a neutral label such as “kartu terenkripsi” until decoding succeeds.
- Once decoding is successful, reveal the card's Indonesian plaintext/instruction and execute the already-defined structured effect. Story flavor must not paraphrase the mechanical instruction in a way that reveals it early.

#### Tone and visual direction

Use a mysterious but approachable futuristic city atmosphere: dark navy/charcoal surfaces, restrained cyan/blue highlights with a warm amber/orange accent, subtle grid/map motifs, encrypted number strings, archive/signal motifs, and clean readable typography. Keep the board recognizable as a classic Monopoly-style square board. Avoid horror, combat, weapons, excessive cyberpunk clutter, or long cinematic sequences. Prioritize legibility and short transitions over spectacle.


---

## 2. Goals and Non-Goals

### 2.1 Product goals

- Deliver a complete, playable classic-style Monopoly game in a modern web browser in one continuous AI implementation task.
- Present the game inside the `THE LOST CIPHER` story world: Cryptonia, a fictional futuristic city in 2099.
- Support 2–8 human players taking turns on the same device (hot-seat/local multiplayer).
- Keep the gameplay flow recognizable: roll dice, move, resolve the space, buy or auction property, pay rent/tax, draw cards, build, trade, mortgage, go to jail, and eventually win by being the last solvent player.
- Replace alphabetic wording on game-board spaces and card faces with numeric ciphertext.
- Use an explicit composition of two functions and the corresponding inverse functions.
- Provide a clear manual decryption workflow so the mathematics is meaningful to players.
- Keep content, function keys, story text, and edition-specific rules easy to edit without changing the core engine.
- Include a short opening prologue, light in-game narrative flavor, themed card-deck context, and an ending screen. Story must never change the game rules.
- Run without a server-side database or user account.

### 2.2 Non-goals for the first release

- Online multiplayer or matchmaking.
- Player accounts, registration, cloud saves, chat, rankings, or social features.
- Computer-controlled opponents (AI players).
- 3D graphics or physics simulation.
- Replacing Monopoly with a new game or adding custom economic rules.
- Adding narrative missions, quests, combat, story rewards, or penalties; the Cryptonia story is flavor only.
- Using the game for real-money transactions or gambling.
- Production-grade cryptographic security. This is an educational cipher demonstration, not a way to protect confidential information.

---

## 3. Target Users and Main Use Case

### 3.1 Users

- **Student/player:** joins a local game, rolls dice, moves a token, manages money/property, and decodes displayed card instructions.
- **Game host:** creates a session on one device, enters player names and tokens, and manages turns.
- **Teacher/evaluator:** reviews the encryption formula, inverse formula, sample calculations, and the relationship between ciphertext and plaintext.

### 3.2 Primary user journey

1. Open the game in a browser and see the `THE LOST CIPHER` title screen.
2. Read or skip the short Cryptonia prologue.
3. Select **New Game**.
3. Add 2–8 players, enter names, and choose a token for each player.
4. Review the selected rule profile and encryption formula.
5. Start the game. All players begin at the start/GO space with the starting money defined by the selected edition profile.
6. The active player rolls two dice.
7. The token moves around the board and the engine resolves the landed space.
8. If a card is drawn, its message is shown only as numeric ciphertext. The player uses the manual decoder workflow to enter the recovered plaintext.
9. When the decryption is correct, the card instruction is revealed and its structured effect is executed.
10. The turn ends according to the rules. Play continues until the selected end condition is reached.
11. Show the winner and a summary of assets/cash.

---

## 4. Platform, Scope, and Product Decisions

### 4.1 Platform

- Desktop-first browser experience, optimized for current Chrome and Microsoft Edge.
- Responsive layout for tablet and smaller screens. A desktop/laptop is the primary play environment because the board and player panels need space.
- Static website. No backend is required for the MVP.
- Use a local development server during development because browser module loading may be restricted when opening ES modules directly using a `file://` URL.

### 4.2 MVP defaults

Use these defaults unless the project owner changes them:

- 2–8 local human players.
- One shared device; players take turns.
- Two standard six-sided dice.
- Classic 40-space board layout.
- Standard property, rent, auction, building, mortgage, jail, card, and bankruptcy systems.
- Manual card decryption is enabled by default.
- No online mode and no AI opponents.
- Indonesian UI labels for menus and controls. The alphabetic words that are part of the game board/card content are encrypted.

### 4.3 Edition profile is required

“Classic Monopoly” has multiple editions. Some details (for example taxes, card text/effects, prices, token set, and player limits) can vary by edition. The project owner must select one reference edition or supply the exact board/card data to be used.

Implement an `edition-profile` data file with configurable values such as:

- board space order and names;
- property purchase prices;
- rent schedules;
- house/hotel construction cost;
- mortgage and unmortgage values;
- starting cash and salary for passing GO;
- taxes and fees;
- jail fine and jail release settings;
- card deck entries and card effects;
- supply limits for houses and hotels.

If an item has not been confirmed from the selected reference edition, mark it as unresolved in `OPEN_QUESTIONS.md`; do not guess and describe it as official.

---

## 5. Functional Requirements — Game Setup and Turn Flow

### 5.1 Main menu

The main menu must contain:

- New Game
- Story: The Lost Cipher (view/replay prologue)
- How to Play / Rules
- Encryption & Decryption Guide
- Continue Game (only if a valid local save exists)
- Settings

All menu labels and interface controls remain readable Indonesian. The encryption requirement applies to the alphabetic content printed on the board and card faces, not to usability controls such as “Lempar Dadu”, “Beli”, “Tolak”, or “Dekripsi”.

### 5.2 New-game setup

- Allow 2–8 players.
- Require a non-empty player name for every player.
- Allow each player to select a unique token from the available token set.
- Prevent two players from selecting the same token unless the setting explicitly allows it.
- Show the selected edition profile and encryption key/profile before starting.
- Treat player setup as “Investor Registration” in the story presentation, while keeping ordinary player-name and token controls.
- Validate that the board, property data, card data, and encryption settings are loadable.
- Do not start a game with invalid or incomplete required data. Explain the problem in plain Indonesian.

### 5.3 Turn lifecycle

The active player turn must follow a state machine. Suggested states:

`WAITING_FOR_ROLL` → `ROLLING` → `MOVING` → `RESOLVING_SPACE` → `PLAYER_DECISION` (if needed) → `END_TURN` → next player.

Special states may be added for card decryption, auctions, jail decisions, property management, and bankruptcy. The game engine must prevent the player from performing actions that are invalid in the current state.

### 5.4 Dice and movement

- Roll two independent six-sided dice.
- Show both dice values and total.
- Animate the token movement one space at a time or with an equally clear movement animation.
- Movement proceeds in the configured board direction (classic profile: clockwise).
- Correctly detect passing or landing on GO and apply the selected profile's salary rule exactly once per qualifying movement.
- A movement caused by a card must use the same movement-resolution logic and must not duplicate salary or space effects.
- Track consecutive doubles during a turn and apply the selected profile's jail rule.
- Dice randomness must be encapsulated in one function so a deterministic/test mode can replace it during automated testing.

### 5.5 End-turn rules

- A player cannot end a turn while a required decision, payment, auction, card decoding step, or bankruptcy settlement remains unresolved.
- If the player rolls doubles, grant another roll only when the rules permit it.
- If the player is sent to jail, end the turn immediately when the selected rules require it.
- Prevent accidental double processing of the same turn.

---

## 6. Functional Requirements — Board and Spaces

### 6.1 Board layout

- Render a square board with the 40 spaces positioned around the outer perimeter.
- Corners are visually larger than standard spaces.
- The center area may display the game title, current-player status, dice result, and card/decryption panel. The background may use a subtle Cryptonia city-map/archive motif, but must not obscure board cells or change the 40-space layout.
- The board must remain legible at desktop dimensions. On narrower screens, allow controlled scaling or a board-focused layout without hiding critical actions.
- Every space must have a stable ID independent of its displayed ciphertext.
- The game board must be data-driven. Do not hard-code space effects into individual DOM elements.

### 6.2 Space types

Support configurable space types:

- GO / Start;
- purchasable color-group property;
- railroad/station;
- utility;
- Chance deck draw;
- Community Chest / Dana Umum deck draw;
- tax/fee;
- jail / just visiting;
- go to jail;
- free parking (apply the selected classic profile's rule; do not automatically create a cash jackpot unless the selected rule profile explicitly says so).

### 6.3 Space text encryption

- Any alphabetic title/name/description on the board is rendered as ciphertext.
- Non-text game values such as purchase price, rent, tax amount, and house cost remain visible as numeric values, because those are game values rather than alphabetic wording.
- The underlying data must retain a stable `spaceId` and structured type/effect so the game works even when the player cannot read the ciphertext.
- Do not expose plaintext in the player-facing board UI by default.

---

## 7. Functional Requirements — Properties and Economy

### 7.1 Property ownership

Each purchasable property must track:

- owner player ID or unowned state;
- purchase price;
- base rent and rent levels;
- color group or property category;
- mortgage state;
- house count and hotel state;
- mortgage value and unmortgage cost;
- relevant deed metadata.

### 7.2 Buying property

- When a player lands on an unowned purchasable space, offer the choice to buy at the configured purchase price or decline.
- Do not allow purchase if the player cannot afford it.
- If the player declines, initiate an auction according to the selected rule profile.
- Transfer money to the bank and update ownership atomically.
- Show a clear confirmation of the property acquired and new balance.

### 7.3 Rent

- When a player lands on property owned by another player, calculate rent from the property's current state and its deed configuration.
- Apply monopoly/color-group rules, house/hotel level, railroad count, and utility dice-multiplier rules as appropriate to the selected edition.
- No rent is paid when the property is mortgaged if the selected rules specify that behavior.
- If the owner is in jail, rent collection must still follow the selected rules.
- If the visitor cannot pay, start the payment/bankruptcy resolution flow rather than allowing a negative balance without handling it.

### 7.4 Color groups and building

- Detect when a player owns every property in a color group.
- Apply the undeveloped monopoly rent rule specified by the edition profile.
- Permit houses only when the player owns the complete color group and all required conditions are met.
- Enforce even building: houses in one color group must be distributed evenly according to the selected rules.
- Enforce the configured maximum houses per property before a hotel can be purchased.
- Enforce physical supply limits (classic standard reference commonly uses 32 houses and 12 hotels; make limits configurable).
- Enforce hotel exchange/building requirements from the edition profile.
- Selling buildings must follow the selected rules, including reverse/even selling and configured sale value.
- Do not allow buildings on mortgaged properties or otherwise violate the selected rule profile.

### 7.5 Trading

- Allow player-to-player trades only when the selected rules permit them.
- A trade can contain cash, eligible properties, and eligible get-out-of-jail-free cards if supported by the selected rules.
- Validate ownership and mortgage/building restrictions before accepting a trade.
- Require both parties to confirm before execution.
- Apply all changes atomically; reject the trade if any asset is no longer available.

### 7.6 Mortgages

- Allow eligible properties to be mortgaged for the configured mortgage value.
- Apply mortgage restrictions to rent and building as defined by the selected edition.
- Allow unmortgage with the configured repayment and interest/fee.
- Prevent illegal sales/transfers or building actions involving mortgaged property.

### 7.7 Bank and money

- Maintain a single bank ledger and per-player cash balance.
- Every transfer must record payer, recipient, amount, reason, and timestamp/turn index in the local game log.
- Reject negative transfer amounts and invalid recipients.
- Show balance changes clearly.
- Do not silently create or destroy money except where the configured rules explicitly require a bank payment/receipt.

---

## 8. Functional Requirements — Cards and Decryption

### 8.1 Card decks

Support two separate shuffled decks:

- Chance / Kesempatan, framed narratively as intercepted opportunity signals;
- Community Chest / Dana Umum, framed narratively as records from Cryptonia’s public archive.

These are story labels only. The configured classic deck order, card count, card effects, and rules remain unchanged.

Use the selected reference edition's card count and effects. A common classic Hasbro reference lists 16 Chance cards and 16 Community Chest cards; make deck size configurable and verify it against the selected edition.

Each card record must contain structured fields, at minimum:

```json
{
  "id": "chance-01",
  "deck": "chance",
  "plaintext": "TEXT PROVIDED OR APPROVED BY THE PROJECT TEAM",
  "effect": {
    "type": "PAY_BANK",
    "amount": 50
  },
  "repeatable": false
}
```

The example above is a schema example only, not an official card or prescribed amount. Do not ship this placeholder as a real card.

### 8.2 Card draw flow

1. Draw the next card from the relevant shuffled deck.
2. Pause normal turn progression.
3. Show the card face with ciphertext only. Do not reveal the plaintext on the initial player-facing view.
4. Provide a manual decryption area and a “Periksa Jawaban” action.
5. The player enters the recovered plaintext.
6. Normalize only non-semantic formatting differences (for example uppercase/lowercase and repeated spaces) before comparing. Do not accept a different instruction with a different meaning.
7. If incorrect, explain that the answer does not match and allow another attempt without applying the effect.
8. If correct, reveal the plaintext and a short decoded confirmation, then apply the card's structured effect exactly once.
9. Return to the appropriate game state.

### 8.3 Manual/assisted modes

- **Manual mode (default):** player decodes using the inverse-function explanation and enters the plaintext.
- **Assisted mode (optional setting):** a built-in decoder can reveal the result after the player chooses to use assistance. Clearly label it as assistance; do not enable by default.
- Any “reveal answer” teacher/demo option must be behind an explicit setting and must not be the first action shown to players.

### 8.4 Card effect engine

Card effects must be structured and independent from the displayed words. Implement extensible effect handlers for the card effects required by the selected edition, such as:

- move to a specific board space;
- move forward/backward a number of spaces;
- collect money from the bank;
- pay money to the bank;
- collect money from each other player;
- pay each other player;
- go directly to jail;
- get out of jail free;
- repairs/fees based on houses or hotels;
- move to a nearest station/utility and calculate rent as the rules prescribe.

Only implement effect types actually used by the supplied/approved card dataset. Unsupported effects must be reported, not ignored.

### 8.5 Deck behavior

- Shuffle each deck at game start using a standard Fisher–Yates shuffle.
- Draw cards in deck order.
- Support “Get Out of Jail Free” card retention and return-to-deck behavior according to the selected rules.
- Do not reshuffle a deck at an arbitrary time if the selected rules require a retained card to remain outside the deck.
- Prevent a card effect from executing twice due to repeated clicks or rerenders.

---

## 9. Cryptography Requirements — Composition and Inverse Functions

### 9.1 Scope

This is a simple educational numeric cipher for the school project. It must demonstrate composition of two functions and the reverse process through inverse functions. It is not intended for securing real private data.

### 9.2 Alphabet mapping

Use the standard 26-letter Latin alphabet:

- `A = 0`, `B = 1`, …, `Z = 25`.
- Normalize alphabetic input to uppercase before encryption.
- Convert a decoded value from 0–25 back to A–Z.

Indonesian text uses the A–Z alphabet. If unsupported characters appear, preserve spaces, punctuation, and digits as separators/literal characters unless the project team defines another mapping. Do not silently discard characters.

### 9.3 Composition model

Implement two configurable functions. A recommended affine-function template is:

- `f(x) = (a*x + b) mod 26`
- `g(x) = (c*x + d) mod 26`
- Encryption: `E(x) = g(f(x))`

For this template to be reversible, `a` and `c` must each be relatively prime to 26. Validate this with a greatest-common-divisor check. Reject invalid key configurations with a readable error.

The inverse process must reverse the order of composition:

- `E⁻¹(y) = f⁻¹(g⁻¹(y))`
- Compute modular multiplicative inverses rather than guessing them.
- Confirm `E⁻¹(E(x)) = x` for all 26 alphabet values before accepting a key.

The project team may supply other functions if they are suitable bijections and have valid inverses. Keep the engine modular so the mapping is not coupled to the affine template.

### 9.4 Numeric ciphertext presentation

- After encryption, display each encoded letter as a two-digit number from `01` to `26` (where the numeric representation is encrypted value + 1).
- Separate letters with spaces and separate original words with `/` or another unambiguous word separator.
- Preserve punctuation in a consistent readable way.
- Keep numeric game values (such as money, prices, rent, dice results) as normal game numbers; do not treat them as alphabetic text to encrypt.
- The ciphertext display must not accidentally combine with visible game amounts in a way that makes the sequence ambiguous.
- The player-facing board and card must not show plaintext alongside ciphertext by default.

### 9.5 Key configuration

Store the final approved configuration in one file, for example `src/data/encryption-config.js` or `src/data/encryption-config.json`:

```js
export const encryptionConfig = {
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  modulus: 26,
  mapping: "A_TO_0",
  functionF: { type: "AFFINE", a: null, b: null },
  functionG: { type: "AFFINE", a: null, b: null },
  compositionOrder: "G_AFTER_F",
  displayOffset: 1,
  approved: false
};
```

Do not start a classroom game if required key values are missing or `approved` is false, unless an explicit development/demo mode is active.

### 9.6 Development-only example key

The following is an example configuration to test the software pipeline only. It is not the final class key unless the team/teacher approves it:

- `f(x) = (5x + 8) mod 26`
- `g(x) = (7x + 3) mod 26`
- `E(x) = g(f(x)) = (9x + 7) mod 26`
- `E⁻¹(y) = (3y + 5) mod 26`
- With display offset `+1`, `A` becomes `08`.

Required test: decrypting `08` with the example inverse must return `A`.

### 9.7 Decryption explanation panel

Provide a compact “Cara Dekripsi” panel with:

- the approved `f(x)` and `g(x)` formulas;
- the composition order;
- the derived inverse formulas;
- alphabet-to-number mapping;
- one worked example;
- input/output area for a ciphertext test.

Avoid presenting a formula that does not match the configured key.

### 9.8 Plaintext handling

- Keep plaintext in the local content data so the game can generate ciphertext consistently.
- The player-facing component should render ciphertext only until successful decryption or explicit assistance is used.
- Do not log plaintext to the visible game log before the card is decoded.
- This is visual/educational obfuscation, not robust security: a user inspecting source files or browser developer tools may be able to find data. The README must state this limitation.

---

## 10. UI/UX Requirements

### 10.1 Visual direction

- Recognizable classic board-game layout, with a clean contemporary interface.
- Clear contrast between board spaces, player tokens, owned properties, and special spaces.
- Use color-group colors as visual identifiers; do not rely on color alone. Add icons, borders, or category labels.
- Numeric ciphertext must be legible and use a monospaced or tabular-number font treatment.
- Avoid excessive animations that delay turns.
- Use original generic illustrations/icons. Do not use official brand logos, characters, or copied artwork unless the project owner supplies assets they have permission to use.

### 10.2 Main game screen

Required visible areas:

- central board;
- current player and turn indicator;
- dice and roll button;
- player list with cash balance;
- property/asset summary;
- action panel for the current space;
- card/decryption dialog when a card is drawn;
- activity log for payments and important actions;
- settings/help access.

### 10.3 Required dialogs/panels

- buy property confirmation;
- auction panel;
- pay rent/tax confirmation;
- card ciphertext and decryption panel;
- jail options;
- build/sell house or hotel panel;
- mortgage/unmortgage panel;
- trade proposal and confirmation;
- bankruptcy settlement;
- game-over/winner summary.

### 10.4 Story presentation requirements

- Create an opening title/prologue screen for `THE LOST CIPHER` with the year 2099 and the Cryptonia premise. The player can start or skip it.
- The prologue should be concise (approximately 3 short screens or one short panel) and must not block returning players; provide a setting to replay it.
- Add small optional flavor lines to setup, property purchase, payment, card draw, jail, bankruptcy, and game-over screens. Flavor lines must be cosmetic and must not reveal undecoded card instructions.
- Use “Cryptonia”, “investor”, “city archive”, and “opportunity signal” consistently. Avoid introducing extra named factions, characters, quest chains, or lore that implies additional gameplay.
- Add an ending screen for the winner and a neutral closing message for other players. The game's winner is calculated exclusively by the game engine.
- Provide `Lewati` or close controls for story panels wherever possible. No mandatory multi-paragraph dialogue between turns.
- Store story strings separately in `data/story.json` or an equivalent module so the project team can edit the story without changing game logic.

### 10.5 Interaction principles

- Every button must have a real action and a disabled state when the action is invalid.
- Confirm important irreversible actions such as accepting a trade or selling/mortgaging property.
- Do not rely on browser alerts for core game flow; use in-game dialogs.
- Keep all important information available without requiring hover.
- Ensure keyboard focus is visible and dialogs can be closed safely when appropriate.

---

## 11. Save, State, and Data Integrity

### 11.1 Local save

- Save the current game state in `localStorage` after completed state transitions.
- Include a save schema version so future code changes can migrate or invalidate incompatible saves safely.
- Provide Continue and New Game options.
- Validate loaded saves before using them. If invalid, explain the issue and offer to start a new game rather than crashing.

### 11.2 State model

Keep one canonical game state object. Suggested top-level shape:

```js
{
  schemaVersion: 1,
  gameId: "local-session",
  editionProfileId: "classic-configurable",
  currentPlayerIndex: 0,
  turnNumber: 1,
  phase: "WAITING_FOR_ROLL",
  players: [],
  board: [],
  decks: { chance: [], communityChest: [] },
  bank: { balance: null },
  history: [],
  settings: {}
}
```

This is a structural example. Define exact field types in code and validate state updates centrally.

### 11.3 Transaction integrity

- Every payment, purchase, rent transfer, auction result, mortgage, and trade must be validated before state mutation.
- A single action must either complete fully or not change state.
- Keep a concise local history of completed actions for debugging and player transparency.

---

## 12. Technical Architecture and Suggested Project Structure

Use Vanilla JavaScript with ES Modules. CSS Grid/Flexbox and SVG are sufficient for the board and tokens. Avoid a large frontend framework for the MVP.

Suggested structure:

```text
encrypted-monopoly/
├── index.html
├── README.md
├── PRD.md
├── DESIGN.md
├── IMPLEMENTATION.md
├── CHANGELOG.md
├── OPEN_QUESTIONS.md
├── STORY.md
├── assets/
│   ├── icons/
│   ├── images/
│   └── sounds/
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── board.css
│   ├── components.css
│   └── animations.css
├── src/
│   ├── main.js
│   ├── app.js
│   ├── core/
│   │   ├── game-state.js
│   │   ├── game-engine.js
│   │   ├── turn-manager.js
│   │   ├── movement-engine.js
│   │   ├── space-resolver.js
│   │   ├── economy-engine.js
│   │   ├── property-engine.js
│   │   ├── auction-engine.js
│   │   ├── building-engine.js
│   │   ├── mortgage-engine.js
│   │   ├── trade-engine.js
│   │   ├── jail-engine.js
│   │   ├── bankruptcy-engine.js
│   │   └── card-engine.js
│   ├── crypto/
│   │   ├── alphabet.js
│   │   ├── modular-math.js
│   │   ├── encryption.js
│   │   ├── decryption.js
│   │   └── crypto-validation.js
│   ├── ui/
│   │   ├── render-board.js
│   │   ├── render-players.js
│   │   ├── render-actions.js
│   │   ├── render-cards.js
│   │   ├── render-dialogs.js
│   │   ├── render-log.js
│   │   └── render-story.js
│   ├── storage/
│   │   ├── local-save.js
│   │   └── save-validation.js
│   └── utils/
│       ├── random.js
│       ├── formatters.js
│       └── validators.js
├── data/
│   ├── edition-profile.json
│   ├── board-spaces.json
│   ├── properties.json
│   ├── chance-cards.json
│   ├── community-chest-cards.json
│   ├── story.json
│   └── encryption-config.json
└── tests/
    ├── crypto.test.js
    ├── movement.test.js
    ├── economy.test.js
    ├── property.test.js
    ├── cards.test.js
    └── jail-bankruptcy.test.js
```

The agent may adjust filenames if the repository already has a better structure, but must preserve separation between game rules, data, cryptography, UI, and persistence.

### 12.1 Architecture rules

- Core game logic must not directly manipulate DOM elements.
- UI must call engine functions and render the resulting state.
- Data files must define board spaces, property values, card content, rule profiles, and story strings.
- Story rendering must be presentation-only and must not directly mutate game state.
- Encryption must be a pure transformation where possible: same plaintext and key produce the same ciphertext.
- Use stable IDs, not visible labels, to identify spaces, properties, and cards.
- Use a single central state update pathway; do not mutate state from arbitrary UI components.
- Keep dice randomness injectable for repeatable tests.

---

## 13. Non-Functional Requirements

### 13.1 Performance

- Initial game screen should load quickly on an ordinary school laptop.
- Board movement and UI updates should remain smooth without requiring a powerful GPU.
- Avoid large image assets and unnecessary animation libraries.
- Do not rerender/rebuild the entire board for every minor balance change if a targeted update is sufficient.

### 13.2 Reliability

- No uncaught errors during a complete game flow.
- No duplicate card effects or double payments.
- Invalid actions must not corrupt state.
- A page refresh should recover the last valid autosave or offer a safe recovery path.

### 13.3 Compatibility

- Support current Chrome and Edge desktop releases.
- The board should remain usable on a tablet-sized viewport.
- Do not require installation of a desktop application.

### 13.4 Privacy

- No user account or personal data collection.
- Player names are stored only in the local browser save unless the user clears them.
- No analytics or external tracking in the MVP.

### 13.5 Accessibility

- Buttons have meaningful labels.
- Text and ciphertext have sufficient contrast.
- Do not encode meaning by color alone.
- Provide keyboard focus styles.
- Respect reduced-motion preference where practical.

---

## 14. Acceptance Criteria

The MVP is considered complete only when all required criteria below pass.

### 14.1 Setup and board

- [ ] User can create a game with 2–8 players.
- [ ] Player names and unique tokens validate correctly.
- [ ] The board contains the configured 40 spaces in the correct order for the chosen reference edition.
- [ ] All board spaces have stable IDs and valid space types.
- [ ] Every alphabetic board label is displayed as ciphertext; the UI controls remain readable.
- [ ] Numeric game values remain correct and readable.

### 14.2 Core gameplay

- [ ] Two dice produce values from 1 through 6 and the token moves by their sum.
- [ ] Passing/landing on GO applies the configured salary exactly once.
- [ ] Unowned property can be bought at the configured price.
- [ ] Declining an unowned property starts an auction if required by the selected rules.
- [ ] Landing on an opponent's property calculates the correct rent.
- [ ] Color-group ownership and rent rules work.
- [ ] Even house construction and hotel rules are enforced.
- [ ] Mortgage and unmortgage actions calculate the correct values.
- [ ] Player-to-player trades validate ownership and restrictions.
- [ ] Chance and Community Chest draws select from separate decks.
- [ ] Jail entry, jail stay/release, doubles, and fees follow the selected rule profile.
- [ ] Bankruptcy settles debts and removes/transfer assets according to who is owed.
- [ ] The winner is determined by the configured end condition.
- [ ] Free Parking does not award a jackpot unless the selected rule profile explicitly defines one.

### 14.3 Cards and cryptography

- [ ] Each configured card displays ciphertext, not plaintext, by default.
- [ ] Card effect is stored as structured data and does not depend on parsing visible text.
- [ ] Invalid encryption keys are rejected.
- [ ] The configured composition is applied in the correct order.
- [ ] Inverse functions reverse the composition order correctly.
- [ ] All 26 letters pass round-trip tests: decrypt(encrypt(letter)) returns the original letter.
- [ ] Spaces and punctuation are preserved according to the defined format.
- [ ] A player can enter a decoded card message and receive correct/incorrect feedback.
- [ ] The card effect is applied exactly once after successful decoding.
- [ ] Changing the approved key updates ciphertext consistently without changing game effects.

### 14.4 Story integration

- [ ] The title screen presents `THE LOST CIPHER` and a short Cryptonia prologue.
- [ ] The prologue can be skipped and replayed from the menu/settings.
- [ ] New-game setup uses investor-themed presentation without changing player setup rules.
- [ ] Chance and Community Chest decks have distinct story framing without changing their card effects or deck behavior.
- [ ] Jail, bankruptcy, and winner screens use consistent Cryptonia flavor text without changing their rules.
- [ ] No story text reveals a card's plaintext before successful decryption.
- [ ] No story event adds a bonus, penalty, mission, resource, score, or extra turn.
- [ ] All narrative text is stored separately from game engine logic.

### 14.5 Save and stability

- [ ] A game can be saved and resumed in the same browser.
- [ ] Invalid or outdated saves fail safely.
- [ ] No action creates a negative balance without starting the correct debt-resolution flow.
- [ ] No core button is decorative or non-functional.
- [ ] A full game can be played from setup to winner without a crash.

---

## 15. Testing Plan

### 15.1 Unit tests

Cryptography:

- Validate that function multipliers are invertible modulo 26.
- Test the modular inverse calculation.
- Test `E(x) = g(f(x))` using known examples.
- Test `E⁻¹(E(x)) = x` for all 26 letters.
- Test mixed text containing spaces, punctuation, and digits.
- Test invalid/missing key configuration.

Game rules:

- Movement around the last board space and wrapping to GO.
- GO salary applied once when passing or landing.
- Rent calculation for unowned, owned, mortgaged, and improved properties.
- House-building evenness.
- Railroad and utility rent calculations.
- Auction turn order and winner.
- Jail entry after configured doubles condition.
- Jail release through every supported method.
- Card effects for every configured effect type.
- Bankruptcy when debt is owed to the bank versus another player.

### 15.2 Integration tests

- New game → roll → move → buy property → next player's turn.
- Land on another player's property → rent payment → next state.
- Draw card → manual decryption → correct answer → effect applied once.
- Draw card → wrong answer → no effect applied.
- Build houses → rent increases according to configured deed.
- Mortgage property → rent behavior changes as configured.
- Bankruptcy → asset settlement → winner check.
- Save → refresh → resume.

### 15.3 Manual QA

Test on Chrome and Edge at common laptop resolutions. Also check tablet layout. Test a complete game with at least two players and a larger test with four players.

---

## 16. Single-Phase Implementation Plan (Mandatory)

### 16.1 Delivery model

The project must be delivered as **one implementation phase / one continuous agent task**. The agent may organize its work internally into the workstreams below, but must not stop after each workstream, request approval, or present each as a separate milestone requiring user confirmation.

The agent must complete all feasible work in the same execution context. If context or tool limits prevent a perfect result, prioritize a working complete gameplay loop and core rules, then document the exact remaining gaps. Never claim unfinished features are complete.

### 16.2 Internal work sequence (do not pause for approval)

1. **Inspect and bootstrap**
   - Inspect repository, toolchain, browser support, and existing files.
   - Create/repair the Vanilla HTML/CSS/JavaScript project scaffold.
   - Add `README.md`, `CHANGELOG.md`, `IMPLEMENTATION.md`, `OPEN_QUESTIONS.md`, and `STORY.md`.

2. **Create validated game data**
   - Build the 40-space board data for the selected/provisional classic profile.
   - Build property/deed configuration, two card decks, card effect definitions, and editable rule profile.
   - Mark any unverified edition-specific data as provisional and list it in `OPEN_QUESTIONS.md`.
   - Ensure every required space/card has a valid stable ID and structured effect.

3. **Build the complete game engine**
   - Implement setup, player state, dice, movement, turns, GO handling, space resolution, property purchase, auctions, rent, groups, building, mortgage, trading (if included in selected edition), jail, card effects, payments, bankruptcy, and victory.
   - Centralize state transitions and transactions.
   - Do not substitute a visual-only mock for any required gameplay system.

4. **Build cryptography and decoder**
   - Implement configurable composition of functions, inverse composition, key validation, numeric formatting, and plaintext checking.
   - Validate all 26 letters with round-trip tests before activating the configured key.
   - Keep a clearly labelled development key if the class key is not yet supplied; do not claim it is teacher-approved.

5. **Build the complete UI and story**
   - Implement title screen, skippable/replayable prologue, investor registration setup, 40-space board, player panels, actions, cards, decryption dialog, property dialogs, auctions, jail, trading, bankruptcy, help, settings, and end screen.
   - Apply the Cryptonia theme consistently.
   - Ensure board and card alphabetic content displays ciphertext; keep functional UI readable.

6. **Integrate persistence and responsive behavior**
   - Implement local save/resume with version validation.
   - Ensure refresh recovery is safe.
   - Verify desktop-first layout and usable tablet layout.

7. **Test and repair**
   - Run unit tests and integration tests.
   - Run the application in a browser if available.
   - Test a full game path from new game to game over, including at least one successful card decryption and one incorrect answer.
   - Fix discovered defects before reporting completion.

8. **Final handoff**
   - Update README run instructions, changelog, implementation report, test results, known limitations, and edition-data verification status.
   - Provide concise instructions for running locally and hosting as a static site.

### 16.3 Definition of done for the one phase

The single phase is complete only when:

- The game launches in a modern desktop browser.
- A local game can be created and played by the configured player count.
- The full configured board and core Monopoly systems function, not just the visuals.
- Both card decks work through the decryption flow and structured effects.
- The composition/inverse cipher passes all 26-letter round-trip tests.
- The Cryptonia story appears at the intended points and does not affect game mechanics.
- Save/resume works or any limitation is clearly documented.
- Tests and manual verification are reported honestly.
- Any remaining source-edition uncertainty is explicitly documented and does not get presented as verified official data.

### 16.4 Final agent response format

At the end, report:

1. **Implemented:** main systems delivered.
2. **How to run:** exact local command or method.
3. **Testing:** tests run and pass/fail summary.
4. **Provisional items:** any unverified board/card/rule data and where to edit it.
5. **Known limitations:** only real remaining issues.

Do not respond with only a plan, a mockup, or a request for the user to approve the next phase.

---

## 17. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| AI invents rules or card effects | Treat the selected edition profile and supplied card dataset as authoritative; put unknowns in `OPEN_QUESTIONS.md`. |
| Encryption formula is not reversible | Validate modular inverses and test all 26 letters before enabling the game. |
| Card text is hidden but players cannot understand it | Require a manual decryption workflow and a clear worked example. |
| Ciphertext is confused with prices or money | Use fixed two-digit letter codes and clear separators; keep game values in separate UI fields. |
| Game state becomes inconsistent after a payment | Centralize transactions and apply state changes atomically. |
| AI creates a visually convincing but incomplete game | Use acceptance criteria and integration tests; do not equate visual completion with gameplay completion. |
| Different Monopoly editions use different values/rules | Make the edition profile configurable and confirm the source edition before finalizing data. |
| Browser refresh loses the game | Autosave validated state locally and include schema versioning. |
| Story changes gameplay accidentally | Keep story strings/UI flavor separate from game engine state and test that no narrative event mutates money, ownership, turns, or victory conditions. |
| Story reveals card instructions before decoding | Keep card plaintext out of the pre-decryption UI, story copy, activity log, and accessible labels. |

---

## 18. Open Decisions That Must Not Be Guessed

The AI agent must record these in `OPEN_QUESTIONS.md` and use clearly labelled development data until confirmed:

1. **Reference edition:** Which physical/classic Monopoly edition is the source of truth?
2. **Board content:** Are the property names and spaces copied from a particular edition, translated, or replaced with school/local place names?
3. **Card dataset:** Will the team provide card photos/text, or approve original Indonesian paraphrases with equivalent game effects?
4. **Final encryption functions:** What exact `f(x)` and `g(x)` will the group present to the teacher?
5. **Cipher display:** Confirm whether word separators should be `/`, spaces, or another format.
6. **Decryption mode:** Manual-only for the project demonstration, or manual plus optional assisted reveal?
7. **Starting values:** Confirm starting cash, GO salary, tax amounts, jail fees, prices, rents, and building costs from the chosen edition.
8. **Token set:** Which original/simple tokens should be included in the project?
9. **Game end condition:** Use last-player-standing standard play, or a teacher-approved time limit? Do not add a time-limit mode unless approved.

Do not repeatedly ask the user the same question if the answer already exists in project files or conversation context.

---

## 19. References and Source Boundaries

### Class project source

- *Lembar Kerja Proyek: Kriptografi — Enkripsi End to End Sederhana*, Mathematics Grade XI, provided by the project owner. It establishes the project workflow of plaintext, two functions `f(x)` and `g(x)`, composition, ciphertext, key exchange, and decryption with inverse functions. It does not specify the group's final formulas.

### Monopoly rules/product reference

- Hasbro, *Monopoly Classic Game* product instructions: https://instructions.hasbro.com/en-in/instruction/monopoly-game
- Hasbro, *Monopoly Vintage* rules PDF: https://www.hasbro.com/common/instruct/Monopoly_Vintage.pdf

Use the selected physical edition/rule sheet as the final authority for actual board values and card effects. This PRD intentionally does not reproduce official card wording or artwork. Use assets/content supplied by the project owner or original approved paraphrases, and avoid using official logos or artwork without permission.

---

## 20. Definition of Done

The project is done only when:

- the selected edition profile is confirmed;
- the game follows that profile's rules rather than approximating them;
- board/card alphabetic text is encoded using the approved composition function;
- inverse functions correctly decrypt all supported letters;
- manual card decryption works before the effect is executed;
- all acceptance criteria and critical tests pass;
- a complete game can be played from setup through the final winner screen;
- README, CHANGELOG, IMPLEMENTATION, and test report are up to date;
- all known limitations and unconfirmed items are disclosed.

**End of PRD.**
