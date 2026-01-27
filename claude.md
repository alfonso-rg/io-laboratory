# IO Laboratory - Cournot Competition entre LLMs

## Resumen del Proyecto

Laboratorio web para estudiar competencia Cournot entre LLMs. Dos firmas controladas por modelos de OpenAI compiten eligiendo cantidades de producción en un juego repetido.

## Modelo Económico

**Demanda inversa lineal:**
```
P(Q) = a - b*Q    donde Q = q1 + q2
```

**Costes asimétricos con término cuadrático:**
```
C_i(q_i) = c_i * q_i + d_i * q_i²
```

**Beneficio:**
```
π_i = P(Q) * q_i - C_i(q_i)
```

**Equilibrio de Nash (fórmula general):**
```
q1* = (α1*β2 - b*α2) / (β1*β2 - b²)
q2* = (α2*β1 - b*α1) / (β1*β2 - b²)

donde: α_i = a - c_i,  β_i = 2*(b + d_i)
```

**Caso simétrico (d1=d2=0, c1=c2=c):**
```
q* = (a - c) / (3b)
```

**Parámetros por defecto:** a=100, b=1, c1=c2=10, d1=d2=0
- Nash: q*=30, P*=40, π*=900

## Estructura del Proyecto

```
io-laboratory/
├── server/                 # Backend Node.js + Express + Socket.io
│   ├── src/
│   │   ├── index.ts        # Entry point (puerto 3001)
│   │   ├── types.ts        # Tipos TypeScript compartidos
│   │   ├── config/
│   │   │   ├── database.ts # Conexión MongoDB
│   │   │   └── logger.ts   # Winston logger
│   │   ├── models/
│   │   │   ├── GameResult.ts    # Schema para persistencia
│   │   │   └── GlobalConfig.ts  # Config global
│   │   ├── services/
│   │   │   ├── EconomicsService.ts  # Cálculos Nash, payoffs
│   │   │   ├── LLMService.ts        # OpenAI integration
│   │   │   └── CournotService.ts    # Lógica del juego
│   │   ├── socket/
│   │   │   └── gameHandlers.ts      # Eventos Socket.io
│   │   └── routes/
│   │       └── admin.ts             # API REST admin
│   └── package.json
│
└── client/                 # Frontend React + Vite + Tailwind
    ├── src/
    │   ├── App.tsx         # Routing principal
    │   ├── main.tsx        # Entry point
    │   ├── types/game.ts   # Tipos cliente
    │   ├── stores/
    │   │   └── gameStore.ts    # Zustand store
    │   ├── hooks/
    │   │   └── useSocket.ts    # Hook Socket.io
    │   └── components/
    │       ├── HomePage.tsx           # Configuración
    │       ├── game/
    │       │   ├── GameBoard.tsx      # Visualización en vivo
    │       │   └── QuantityChart.tsx  # Gráfico Recharts
    │       ├── results/
    │       │   └── GameResults.tsx    # Resumen final
    │       └── admin/
    │           └── AdminPanel.tsx     # Histórico de juegos
    └── package.json
```

## Cómo Ejecutar

```bash
# Terminal 1 - Server
cd io-laboratory/server
npm install
copy .env.example .env   # Editar y añadir OPENAI_API_KEY
npm run dev              # Puerto 3001

# Terminal 2 - Client
cd io-laboratory/client
npm install
npm run dev              # Puerto 5173
```

Abrir http://localhost:5173

## Eventos Socket.io

**Cliente → Servidor:**
- `configure-game` - Envía CournotConfig
- `start-game` - Inicia el juego
- `pause-game` / `resume-game` / `reset-game`

**Servidor → Cliente:**
- `game-state` - Estado completo del juego
- `round-started` - Nueva ronda
- `llm-thinking` - LLM procesando
- `firm-decision` - Decisión de una firma
- `round-complete` - Resultados de ronda
- `game-over` - Juego terminado
- `error` - Error

## API REST

- `GET /api/health` - Health check
- `GET /api/admin/games` - Lista juegos (paginado)
- `GET /api/admin/games/:gameId` - Detalle de juego
- `DELETE /api/admin/games/:gameId` - Eliminar juego
- `GET /api/admin/stats` - Estadísticas agregadas

## Archivos Clave para Modificaciones

| Tarea | Archivo |
|-------|---------|
| Cambiar modelo económico | `server/src/services/EconomicsService.ts` |
| Modificar prompts LLM | `server/src/services/LLMService.ts` |
| Añadir modelos LLM | `client/src/types/game.ts` (AVAILABLE_MODELS) |
| Cambiar lógica de juego | `server/src/services/CournotService.ts` |
| Modificar UI configuración | `client/src/components/HomePage.tsx` |
| Modificar visualización | `client/src/components/game/GameBoard.tsx` |

## Dependencias Principales

**Server:** express, socket.io, mongoose, openai, winston
**Client:** react, zustand, socket.io-client, recharts, tailwindcss

## Notas Técnicas

- MongoDB es opcional (el servidor funciona sin él, solo no persiste)
- Los LLMs deciden simultáneamente (Promise.all)
- El historial de rondas se incluye en cada prompt
- El primer línea de respuesta LLM debe ser solo el número (cantidad)
