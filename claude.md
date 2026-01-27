# IO Laboratory - Cournot Competition entre LLMs

## Resumen del Proyecto

Laboratorio web para estudiar competencia Cournot entre LLMs. Dos firmas controladas por modelos de OpenAI compiten eligiendo cantidades de producción en un juego repetido. Permite configurar información asimétrica, comunicación entre firmas, y múltiples réplicas experimentales.

**URLs de producción:**
- Frontend: https://io-laboratory.vercel.app
- Backend: https://io-laboratory.onrender.com
- Repositorio: https://github.com/alfonso-rg/io-laboratory

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

**Equilibrio Cooperativo (Monopolio Multiplanta):**
- Con costes cuadráticos: se reparte producción según costes marginales
- Con costes lineales: produce solo la planta más eficiente

**Parámetros por defecto:** a=100, b=1, c1=c2=10, d1=d2=0
- Nash: q*=30, P*=40, π*=900
- Cooperativo: Q*=45, P*=55, π_total=2025

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
│   │   │   ├── EconomicsService.ts  # Cálculos Nash, cooperativo, payoffs
│   │   │   ├── LLMService.ts        # OpenAI integration + comunicación
│   │   │   └── CournotService.ts    # Lógica del juego + réplicas
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
    │       ├── HomePage.tsx           # Configuración principal
    │       ├── AdvancedSettings.tsx   # Opciones avanzadas
    │       ├── game/
    │       │   ├── GameBoard.tsx      # Visualización en vivo
    │       │   └── QuantityChart.tsx  # Gráfico Recharts
    │       ├── results/
    │       │   └── GameResults.tsx    # Resumen final
    │       └── admin/
    │           └── AdminPanel.tsx     # Histórico de juegos
    └── package.json
```

## Funcionalidades Principales

### 1. Configuración del Juego (HomePage.tsx)
- Parámetros de demanda (a, b)
- Costes por firma (c1, c2, d1, d2)
- Selección de modelos LLM por firma
- Número de rondas
- Visualización de equilibrios Nash y Cooperativo

### 2. Opciones Avanzadas (AdvancedSettings.tsx)
- **Número de réplicas**: Ejecutar múltiples juegos independientes
- **Disclosure de información por firma**:
  - Revelar función de demanda
  - Revelar costes propios
  - Revelar costes del rival
  - Indicar que rival es LLM
  - Describir rival como humano
- **Comunicación entre firmas**:
  - Habilitar diálogo pre-decisión
  - Número de mensajes por ronda
- **Prompts personalizados**: Editor de system prompt

### 3. Visualización del Juego (GameBoard.tsx)
- Estado de cada firma (pensando/decidido)
- Panel de comunicación en tiempo real
- Gráfico de cantidades por ronda
- Tabla de resultados
- Resumen de réplicas completadas

### 4. Persistencia (MongoDB)
- Configuración completa del juego
- Todas las réplicas con sus rondas
- Mensajes de comunicación
- Equilibrios teóricos
- Resúmenes estadísticos

## Cómo Ejecutar Localmente

```bash
# Terminal 1 - Server
cd io-laboratory/server
npm install
copy .env.example .env   # Editar: OPENAI_API_KEY, MONGODB_URI
npm run dev              # Puerto 3001

# Terminal 2 - Client
cd io-laboratory/client
npm install
npm run dev              # Puerto 5173
```

Abrir http://localhost:5173

## Variables de Entorno

**Server (.env):**
```
PORT=3001
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=sk-...
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**Client (.env):**
```
VITE_SOCKET_URL=http://localhost:3001
```

## Eventos Socket.io

**Cliente → Servidor:**
- `configure-game` - Envía CournotConfig
- `start-game` - Inicia el juego
- `pause-game` / `resume-game` / `reset-game`

**Servidor → Cliente:**
- `game-state` - Estado completo del juego
- `replication-started` - Nueva réplica iniciada
- `replication-complete` - Réplica terminada con resumen
- `round-started` - Nueva ronda
- `communication-started` - Fase de comunicación iniciada
- `communication-message` - Mensaje de una firma
- `communication-complete` - Fase de comunicación terminada
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
| Modificar opciones avanzadas | `client/src/components/AdvancedSettings.tsx` |
| Modificar visualización | `client/src/components/game/GameBoard.tsx` |
| Cambiar esquema BD | `server/src/models/GameResult.ts` |

## Tipos Importantes

```typescript
// Configuración del juego
interface CournotConfig {
  demandIntercept: number;      // a
  demandSlope: number;          // b
  firm1LinearCost: number;      // c1
  firm1QuadraticCost: number;   // d1
  firm2LinearCost: number;      // c2
  firm2QuadraticCost: number;   // d2
  totalRounds: number;
  numReplications: number;
  firm1Model: string;
  firm2Model: string;
  firm1Info: InformationDisclosure;
  firm2Info: InformationDisclosure;
  communication: CommunicationSettings;
  customSystemPrompt?: string;
}

// Disclosure de información
interface InformationDisclosure {
  revealDemandFunction: boolean;
  revealOwnCosts: boolean;
  revealRivalCosts: boolean;
  revealRivalIsLLM: boolean;
  describeRivalAsHuman: boolean;
}

// Comunicación
interface CommunicationSettings {
  allowCommunication: boolean;
  messagesPerRound: number;
}

// Resultado de réplica
interface ReplicationResult {
  replicationNumber: number;
  rounds: RoundResult[];
  summary: { totalFirm1Profit, totalFirm2Profit, avgFirm1Quantity, avgFirm2Quantity, avgMarketPrice };
  startedAt: Date;
  completedAt: Date;
}
```

## Despliegue

- **Frontend**: Vercel (auto-deploy desde main)
- **Backend**: Render (auto-deploy desde main)
- **Base de datos**: MongoDB Atlas

Al hacer push a main, ambos servicios se despliegan automáticamente.

## Notas Técnicas

- MongoDB es opcional (el servidor funciona sin él, solo no persiste)
- Los LLMs deciden simultáneamente (Promise.all)
- La comunicación ocurre secuencialmente (Firma 1, Firma 2, Firma 1...)
- El historial de rondas se incluye en cada prompt
- El primer línea de respuesta LLM debe ser solo el número (cantidad)
- Las réplicas se ejecutan secuencialmente, no en paralelo

## Próximas Mejoras Posibles

- [ ] Exportar resultados a CSV/Excel
- [ ] Gráficos comparativos entre réplicas
- [ ] Más modelos LLM (Anthropic, Google)
- [ ] Modo Stackelberg (líder-seguidor)
- [ ] Competencia en precios (Bertrand)
- [ ] Tests automatizados
