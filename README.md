# IO Laboratory - Cournot Competition

A web laboratory for studying Cournot competition between LLMs (Large Language Models).

## Overview

This project implements a Cournot duopoly game where two LLM-powered firms compete by choosing production quantities. The game features:

- **Inverse demand function**: P(Q) = a - b*Q where Q = q1 + q2
- **Asymmetric cost functions**: C_i(q_i) = c_i * q_i + d_i * q_i^2
- **Repeated game**: N rounds with visible history
- **Nash equilibrium calculation**: Theoretical benchmark for comparison

## Project Structure

```
io-laboratory/
├── server/           # Backend (Node.js, Express, Socket.io)
│   └── src/
│       ├── services/
│       │   ├── EconomicsService.ts  # Nash equilibrium, payoff calculations
│       │   ├── LLMService.ts        # OpenAI integration
│       │   └── CournotService.ts    # Game logic
│       ├── socket/
│       │   └── gameHandlers.ts      # Real-time game events
│       └── routes/
│           └── admin.ts             # Admin API
│
└── client/           # Frontend (React, Vite, Tailwind)
    └── src/
        ├── components/
        │   ├── HomePage.tsx         # Configuration UI
        │   ├── game/
        │   │   └── GameBoard.tsx    # Live game visualization
        │   └── results/
        │       └── GameResults.tsx  # Final summary
        └── stores/
            └── gameStore.ts         # Zustand state management
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (optional, for persistence)
- OpenAI API key

### Server Setup

```bash
cd server
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

npm run dev
```

### Client Setup

```bash
cd client
npm install
npm run dev
```

## Usage

1. Open http://localhost:5173 in your browser
2. Configure game parameters:
   - Demand function (a, b)
   - Cost functions for both firms (c1, d1, c2, d2)
   - Number of rounds
   - LLM models for each firm
3. Review the theoretical Nash equilibrium
4. Click "Start Game" to begin
5. Watch the LLMs compete in real-time
6. Analyze results when the game completes

## Default Parameters

- a = 100 (demand intercept)
- b = 1 (demand slope)
- c1 = c2 = 10 (linear costs)
- d1 = d2 = 0 (quadratic costs)

With these parameters:
- Nash equilibrium quantity: q* = 30 each
- Nash equilibrium price: P* = 40
- Nash equilibrium profit: π* = 900 each

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/admin/games` - List all games (paginated)
- `GET /api/admin/games/:gameId` - Get specific game
- `DELETE /api/admin/games/:gameId` - Delete a game
- `GET /api/admin/stats` - Get aggregate statistics

## Socket.io Events

### Client to Server
- `configure-game` - Set game parameters
- `start-game` - Begin the game
- `pause-game` - Pause current game
- `resume-game` - Resume paused game
- `reset-game` - Reset to configuration

### Server to Client
- `game-state` - Full game state update
- `round-started` - New round beginning
- `llm-thinking` - LLM is processing
- `firm-decision` - A firm made its decision
- `round-complete` - Round finished with results
- `game-over` - Game completed
- `error` - Error occurred

## License

MIT
