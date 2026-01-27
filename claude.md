# IO Laboratory - Oligopoly Competition entre LLMs

## Resumen del Proyecto

Laboratorio web para estudiar competencia oligopolística entre LLMs. De 2 a 10 firmas controladas por modelos GPT compiten eligiendo cantidades (Cournot) o precios (Bertrand) en un juego repetido. Permite configurar diferenciación de productos, información asimétrica, comunicación entre firmas, y múltiples réplicas experimentales.

**URLs de producción:**
- Frontend: https://io-laboratory.vercel.app
- Backend: https://io-laboratory.onrender.com
- Repositorio: https://github.com/alfonso-rg/io-laboratory

## Características Principales

### Modos de Competencia
- **Cournot**: Competencia en cantidades (por defecto)
- **Bertrand**: Competencia en precios

### Estructura de Mercado
- **N-polio**: Soporte para 2-10 firmas
- **Diferenciación de productos**: Parámetro γ (gamma) de 0 (productos independientes) a 1 (productos homogéneos)
- **Costes asimétricos**: Cada firma puede tener diferentes costes lineales y cuadráticos

### Análisis Económico
- **Equilibrio Nash**: Calculado analíticamente para N firmas
- **Equilibrio Cooperativo**: Monopolio multiplanta
- **Limit-Pricing**: Análisis basado en Zanchettin (2006) para detectar regiones de monopolio y pricing predatorio (solo duopolio)

### Modelos LLM Disponibles
- GPT-5 Nano (por defecto) - $0.05/$0.40 por 1M tokens
- GPT-5 Mini - $0.25/$2.00 por 1M tokens
- GPT-5 - $1.25/$10.00 por 1M tokens
- GPT-5.2 - $1.75/$14.00 por 1M tokens
- GPT-4o - $2.50/$10.00 por 1M tokens
- GPT-4o Mini - $0.15/$0.60 por 1M tokens

### Estimación de Costes
- Estimación automática de tokens y coste antes de ejecutar experimentos
- Basada en número de rondas, réplicas, firmas, comunicación y modelo seleccionado

## Modelo Económico

### Demanda Diferenciada (Singh & Vives)

**Demanda inversa:**
```
p_i = α - q_i - γ * Σ(q_j, j≠i)
```

**Demanda directa (Bertrand):**
```
q_i = (1/(1-γ²)) * [α - p_i - γ(α - p_j)]
```

### Costes
```
C_i(q_i) = c_i * q_i + d_i * q_i²
```

### Equilibrio Nash Cournot (N firmas)

Sistema lineal resuelto por eliminación gaussiana:
```
FOC: α_i - 2(b + d_i)q_i - γb*Σq_j = 0
donde α_i = a - c_i
```

### Equilibrio Nash Bertrand (N firmas, diferenciado)

Para productos diferenciados (γ < 1), sistema lineal en precios.
Para productos homogéneos (γ = 1), precio = coste marginal mínimo.

### Análisis Limit-Pricing (Zanchettin 2006)

Solo para duopolio:
```
a = (α₁ - c₁) - (α₂ - c₂)    // índice asimetría normalizado

Regiones:
- Normal:        a < 1 - γ/(2-γ²)
- Limit-pricing: 1 - γ/(2-γ²) ≤ a < 1 - γ/2
- Monopolio:     a ≥ 1 - γ/2
```

### Parámetros por defecto
- a=100, b=1, c1=c2=10, d1=d2=0, γ=1 (homogéneo)
- Nash Cournot (2 firmas): q*=30, P*=40, π*=900
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
│   │   │   ├── EconomicsService.ts  # Cálculos Nash N-poly, Bertrand, limit-pricing
│   │   │   ├── LLMService.ts        # OpenAI integration + comunicación
│   │   │   └── CournotService.ts    # Lógica del juego N-poly
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
    │   ├── types/game.ts   # Tipos cliente + FIRM_COLORS + AVAILABLE_MODELS
    │   ├── stores/
    │   │   └── gameStore.ts    # Zustand store
    │   ├── hooks/
    │   │   └── useSocket.ts    # Hook Socket.io
    │   └── components/
    │       ├── HomePage.tsx           # Configuración principal + N firmas + γ
    │       ├── AdvancedSettings.tsx   # Opciones avanzadas por firma
    │       ├── game/
    │       │   ├── GameBoard.tsx      # Visualización en vivo N firmas
    │       │   └── QuantityChart.tsx  # Gráfico Recharts N líneas
    │       ├── results/
    │       │   └── GameResults.tsx    # Resumen final
    │       └── admin/
    │           └── AdminPanel.tsx     # Histórico detallado + prompts
    └── package.json
```

## Funcionalidades Principales

### 1. Configuración del Juego (HomePage.tsx)
- **Modo de competencia**: Cournot (cantidades) o Bertrand (precios)
- **Número de firmas**: Slider 2-10
- **Diferenciación de productos**: Slider γ (0-1)
- Parámetros de demanda (a, b)
- Costes por firma (c_i, d_i) - cards dinámicas con colores
- Selección de modelos LLM por firma con precios
- Número de rondas y réplicas
- **Estimación de coste** del experimento
- Visualización de equilibrios Nash y Cooperativo
- **Panel Limit-Pricing** (solo duopolio con γ < 1)

### 2. Opciones Avanzadas (AdvancedSettings.tsx)
- **Disclosure de información por firma** (dinámico para N firmas):
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
- Estado de cada firma (pensando/decidido) - N cards con colores
- Panel de comunicación en tiempo real
- Gráfico de cantidades/precios por ronda - N líneas
- Tabla de resultados dinámica
- Resumen de réplicas completadas

### 4. Panel de Administración (AdminPanel.tsx)
- Lista de juegos con modo y número de firmas
- **Vista detallada de cada juego**:
  - Configuración completa (modo, γ, demanda, costes)
  - Firmas con modelos e info disclosure
  - Equilibrios teóricos
  - Resumen de resultados
  - **Ronda por ronda expandible**:
    - Logs de comunicación
    - Decisiones con razonamiento
    - **Prompts enviados a cada LLM** (auditoría)
  - Prompts personalizados usados
  - Timestamps

### 5. Persistencia (MongoDB)
- Configuración completa del juego (N-poly, Bertrand, γ)
- Todas las réplicas con sus rondas
- **Prompts enviados a cada LLM por ronda** (auditoría)
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
- `configure-game` - Envía CournotConfig (soporta N-poly, Bertrand)
- `start-game` - Inicia el juego
- `pause-game` / `resume-game` / `reset-game`

**Servidor → Cliente:**
- `game-state` - Estado completo del juego
- `replication-started` - Nueva réplica iniciada
- `replication-complete` - Réplica terminada con resumen
- `round-started` - Nueva ronda
- `communication-started` - Fase de comunicación iniciada
- `communication-message` - Mensaje de una firma (firm: 1-10)
- `communication-complete` - Fase de comunicación terminada
- `llm-thinking` - LLM procesando (firm: 1-10)
- `firm-decision` - Decisión de una firma (quantity y/o price)
- `round-complete` - Resultados de ronda (incluye firmResults[])
- `game-over` - Juego terminado
- `error` - Error

## API REST

- `GET /api/health` - Health check
- `GET /api/admin/games` - Lista juegos (paginado)
- `GET /api/admin/games/:gameId` - Detalle completo de juego (incluye prompts)
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
| Colores de firmas | `client/src/types/game.ts` (FIRM_COLORS) |

## Tipos Importantes

```typescript
// Modo de competencia
type CompetitionMode = 'cournot' | 'bertrand';

// Config de firma individual
interface FirmConfig {
  id: number;
  linearCost: number;      // c_i
  quadraticCost: number;   // d_i
  model: string;
  info: InformationDisclosure;
}

// Configuración del juego (extendida)
interface CournotConfig {
  // Modo y estructura
  competitionMode?: CompetitionMode;  // default: 'cournot'
  numFirms?: number;                   // default: 2
  gamma?: number;                      // default: 1 (homogéneo)
  firms?: FirmConfig[];                // Para N > 2

  // Demanda
  demandIntercept: number;      // a
  demandSlope: number;          // b

  // Costes legacy (duopolio)
  firm1LinearCost: number;      // c1
  firm1QuadraticCost: number;   // d1
  firm2LinearCost: number;      // c2
  firm2QuadraticCost: number;   // d2

  // Juego
  totalRounds: number;
  numReplications: number;

  // LLMs legacy (duopolio)
  firm1Model: string;
  firm2Model: string;
  firm1Info: InformationDisclosure;
  firm2Info: InformationDisclosure;

  // Comunicación
  communication: CommunicationSettings;
  customSystemPrompt?: string;
}

// Resultado de firma individual por ronda
interface FirmRoundResult {
  firmId: number;
  quantity: number;
  price?: number;        // Para Bertrand
  profit: number;
  reasoning?: string;
  systemPrompt?: string; // Para auditoría
  roundPrompt?: string;  // Para auditoría
}

// Equilibrio N firmas
interface NPolyEquilibrium {
  competitionMode: CompetitionMode;
  firms: { firmId: number; quantity: number; price?: number; profit: number }[];
  totalQuantity: number;
  marketPrices: number[];
  avgMarketPrice: number;
  totalProfit: number;
}

// Análisis limit-pricing (solo duopolio)
interface LimitPricingAnalysis {
  asymmetryIndex: number;           // a normalizado
  limitPricingThresholdLow: number; // 1 - γ/(2-γ²)
  limitPricingThresholdHigh: number;// 1 - γ/2
  isInLimitPricingRegion: boolean;
  isInMonopolyRegion: boolean;
  dominantFirm?: number;
  analysisMessage: string;
}
```

## Despliegue

- **Frontend**: Vercel (auto-deploy desde main)
- **Backend**: Render (auto-deploy desde main)
- **Base de datos**: MongoDB Atlas

Al hacer push a main, ambos servicios se despliegan automáticamente.

## Notas Técnicas

- MongoDB es opcional (el servidor funciona sin él, solo no persiste)
- Los LLMs deciden simultáneamente (Promise.all para N firmas)
- La comunicación ocurre secuencialmente (Firma 1, 2, ..., N, 1, 2...)
- El historial de rondas se incluye en cada prompt
- El primer línea de respuesta LLM debe ser solo el número (cantidad o precio)
- Las réplicas se ejecutan secuencialmente, no en paralelo
- Los prompts se almacenan para auditoría en cada FirmRoundResult
- El equilibrio Bertrand con γ=1 es precio = coste marginal mínimo
- El cálculo N-poly usa eliminación gaussiana con pivoteo parcial

## Retrocompatibilidad

- CournotConfig mantiene campos legacy (firm1LinearCost, etc.)
- Si no se especifica `numFirms`, se asume duopolio (2)
- Si no se especifica `gamma`, se asume productos homogéneos (1)
- Si no se especifica `competitionMode`, se asume 'cournot'
- Los juegos antiguos en MongoDB siguen funcionando

## Próximas Mejoras Posibles

- [ ] Exportar resultados a CSV/Excel
- [ ] Gráficos comparativos entre réplicas
- [ ] Más modelos LLM (Anthropic, Google)
- [ ] Modo Stackelberg (líder-seguidor)
- [x] ~~Competencia en precios (Bertrand)~~ ✓ Implementado
- [x] ~~N-polio (más de 2 firmas)~~ ✓ Implementado
- [x] ~~Diferenciación de productos~~ ✓ Implementado
- [ ] Tests automatizados
