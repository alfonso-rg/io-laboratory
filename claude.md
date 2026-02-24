# IO Laboratory - Oligopoly Competition entre LLMs

## Instrucciones para Claude

> **OBLIGATORIO**: Al finalizar cualquier tarea (corrección, nueva funcionalidad, refactor, etc.), Claude debe:
> 1. Actualizar este archivo `CLAUDE.md` reflejando los cambios realizados (nuevas secciones, correcciones de bugs, notas técnicas, etc.)
> 2. Hacer `git add` de los ficheros modificados y un `git commit` descriptivo
> 3. Hacer `git push` para que los cambios queden en el repositorio remoto

## Resumen del Proyecto

Laboratorio web para estudiar competencia oligopolística entre LLMs. De 2 a 10 firmas controladas por modelos GPT compiten eligiendo cantidades (Cournot) o precios (Bertrand) en un juego repetido. Permite configurar diferenciación de productos, información asimétrica, comunicación entre firmas, múltiples réplicas experimentales, parámetros aleatorios y funciones de demanda alternativas.

**URLs de producción:**
- Frontend: https://io-laboratory.vercel.app
- Backend: https://io-laboratory.onrender.com
- Repositorio: https://github.com/alfonso-rg/io-laboratory

## Características Principales

### Autenticación
- **Protección por contraseña**: Acceso controlado mediante variable de entorno `APP_PASSWORD`
- Si `APP_PASSWORD` no está definida, el acceso es libre (modo desarrollo)
- La sesión se mantiene mientras el navegador esté abierto (sessionStorage)

### Modos de Competencia
- **Cournot**: Competencia en cantidades (por defecto)
- **Bertrand**: Competencia en precios

### Estructura de Mercado
- **N-polio**: Soporte para 2-10 firmas
- **Diferenciación de productos**: Parámetro γ (gamma) de 0 (productos independientes) a 1 (productos homogéneos)
- **Costes asimétricos**: Cada firma puede tener diferentes costes lineales y cuadráticos

### Análisis Económico
- **Equilibrio Nash**: Calculado analíticamente para N firmas (solo demanda lineal)
- **Equilibrio Cooperativo**: Monopolio multiplanta
- **Limit-Pricing**: Análisis basado en Zanchettin (2006) para detectar regiones de monopolio y pricing predatorio (solo duopolio)

### Funciones de Demanda
- **Lineal**: P = a - b×Q (por defecto)
- **CES**: P = A × Q^(-1/σ) (Constant Elasticity of Substitution)
- **Logit**: P = a - b × ln(Q)
- **Exponencial**: P = A × e^(-bQ)

> **Nota**: El equilibrio Nash solo se calcula analíticamente para demanda lineal. Para las demás funciones se muestra "N/A".

### Parámetros Aleatorios
- **Distribuciones soportadas**: Fixed, Uniform, Normal, Log-normal
- **Modos de variación**:
  - Fixed: Mismo valor en todas las rondas y réplicas
  - Per-replication: Se regeneran al inicio de cada réplica
  - Per-round: Se regeneran cada ronda
- **Parámetros configurables**: Demanda (a, b o A, σ), gamma (γ), costes por firma (c, d)

### Modelos LLM Disponibles

**Sin razonamiento (respuestas rápidas):**
- GPT-4o Mini - $0.15/$0.60 por 1M tokens - Chat Completions API - Rápido y económico
- GPT-4o - $2.50/$10.00 por 1M tokens - Chat Completions API - Flagship anterior
- GPT-5.2:none - $1.75/$14.00 por 1M tokens - Responses API - Razonamiento desactivado

**Con razonamiento configurable (GPT-5.2):**
- GPT-5.2:low - $1.75/$14.00 - ~1.5x tokens de razonamiento
- GPT-5.2:medium - $1.75/$14.00 - ~2.5x tokens de razonamiento
- GPT-5.2:high - $1.75/$14.00 - ~4x tokens de razonamiento
- GPT-5.2:xhigh - $1.75/$14.00 - ~8x tokens de razonamiento
- GPT-5.2 Pro - $3.50/$28.00 - Para problemas muy difíciles

**Con razonamiento FIJO (no configurable):**
- GPT-5 Nano - $0.05/$0.40 - Razonamiento "Average" incorporado (más lento de lo esperado)
- GPT-5 Mini - $0.25/$2.00 - Razonamiento "High" incorporado (similar a GPT-5.2:high)

> **Nota importante:** GPT-5-nano y GPT-5-mini son modelos GPT-5 "legacy" con razonamiento incorporado que NO se puede desactivar. Aunque son más baratos, pueden ser más lentos que GPT-5.2:none o GPT-4o-mini.

**Google Gemini (Free tier con límites de rate):**
- Gemini 2.5 Flash Lite - Gratis - 10 RPM
- Gemini 2.5 Flash - Gratis - 5 RPM
- Gemini 3 Flash - Gratis - 5 RPM
- Gemini 3.5 Pro - $1.25/$5.00 por 1M tokens (premium, futuro)

> **Nota**: Los modelos Gemini gratuitos tienen límites estrictos de requests por minuto. El sistema implementa rate limiting automático.

### Estimación de Costes
- Estimación automática de tokens y coste antes de ejecutar experimentos
- Basada en número de rondas, réplicas, firmas, comunicación y modelo seleccionado
- **Multiplicadores de razonamiento para GPT-5.2**: Los modelos con reasoning generan tokens adicionales de razonamiento que se facturan como output. Multiplicadores aproximados:
  - none: 1× (sin tokens de razonamiento adicionales)
  - low: 1.5×
  - medium: 2.5×
  - high: 4×
  - xhigh: 8×
- Advertencia visual cuando se usan modelos con reasoning indicando que los costes son aproximados

## Modelo Económico

### Demanda Lineal Diferenciada (Singh & Vives)

**Demanda inversa:**
```
p_i = α - q_i - γ * Σ(q_j, j≠i)
```

**Demanda directa (Bertrand):**
```
q_i = (1/(1-γ²)) * [α - p_i - γ(α - p_j)]
```

### Demanda CES (Constant Elasticity of Substitution)

**Precio de mercado:**
```
P = A × Q^(-1/σ)
```
Donde:
- A: Parámetro de escala
- σ: Elasticidad de sustitución (σ > 1 = sustitutos, σ < 1 = complementos)
- Q: Cantidad total de mercado

### Demanda Logit

**Precio de mercado:**
```
P = a - b × ln(Q)
```
Donde:
- a: Intercepto (precio base cuando Q=1)
- b: Coeficiente de precio (sensibilidad logarítmica)
- Q: Cantidad total de mercado

### Demanda Exponencial

**Precio de mercado:**
```
P = A × e^(-bQ)
```
Donde:
- A: Parámetro de escala (precio máximo en Q=0)
- b: Tasa de decaimiento
- Q: Cantidad total de mercado

> **Nota**: El equilibrio Nash solo tiene solución analítica cerrada para demanda lineal. Para isoelástica, CES, logit y exponencial se muestra "N/A" en la interfaz.

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
│   │   │   ├── CournotService.ts    # Lógica del juego N-poly
│   │   │   └── ParameterService.ts  # Generación de parámetros aleatorios
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
- **Función de demanda**: Lineal (P = a - b×Q) o CES (P = A×Q^(-1/ε))
- Parámetros de demanda según tipo seleccionado
- Costes por firma (c_i, d_i) - cards dinámicas con colores
- Selección de modelos LLM por firma con precios
- Número de rondas y réplicas
- **Estimación de coste** del experimento
- Visualización de equilibrios Nash y Cooperativo (N/A para isoelástica)
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
- **Prompts personalizados**:
  - Botón "View Default Prompt" para ver el prompt que se enviará al LLM según la configuración actual
  - Selector de firma para previsualizar prompt por firma
  - La vista previa muestra `[random ~ Distribución(params)]` cuando un parámetro está aleatorizado
  - Editor de system prompt con variables disponibles
  - Botón "Copy to Editor" para personalizar el prompt predefinido
- **Parámetros Aleatorios**:
  - Modo de variación (fixed, per-replication, per-round)
  - Configuración de distribuciones para parámetros de demanda
  - Configuración de distribuciones para gamma (γ)
  - Configuración de distribuciones para costes por firma

### 3. Visualización del Juego (GameBoard.tsx)
- Estado de cada firma (pensando/decidido) - N cards con colores
- Panel de comunicación en tiempo real
- Gráfico de cantidades/precios por ronda - N líneas
- Tabla de resultados dinámica
- Resumen de réplicas completadas

### 4. Panel de Administración (AdminPanel.tsx)
- Lista de juegos con modo y número de firmas
- **Filtros avanzados**:
  - Por número de firmas (2-10)
  - Por comunicación habilitada/deshabilitada
  - Por modo de competencia (Cournot/Bertrand)
  - Por rango de fechas
- **Selección múltiple y operaciones en lote**:
  - Checkbox para seleccionar juegos individualmente o todos en página
  - Selección persistente al cambiar de página
  - Eliminación en lote (máximo 100 juegos)
  - Exportación en lote a CSV combinado (máximo 50 juegos)
- **Vista detallada de cada juego**:
  - Configuración completa (modo, γ, demanda, costes)
  - Tipo de demanda y especificaciones de parámetros (distribuciones)
  - Firmas con modelos e info disclosure
  - Equilibrios teóricos
  - Resumen de resultados
  - **Ronda por ronda expandible**:
    - **Parámetros realizados** (valores concretos usados en cada ronda)
    - Logs de comunicación
    - Decisiones con razonamiento
    - **Prompts enviados a cada LLM** (auditoría)
  - Prompts personalizados usados
  - Timestamps

### 5. Persistencia (MongoDB)
- Configuración completa del juego (N-poly, Bertrand, γ, demanda)
- **Especificaciones de parámetros** (distribuciones configuradas)
- Todas las réplicas con sus rondas
- **Parámetros realizados por ronda** (valores concretos usados)
- **Prompts enviados a cada LLM por ronda** (auditoría)
- Mensajes de comunicación
- Equilibrios teóricos
- Resúmenes estadísticos

## Cómo Ejecutar Localmente

```bash
# Terminal 1 - Server
cd io-laboratory/server
npm install
copy .env.example .env   # Editar: OPENAI_API_KEY, GOOGLE_API_KEY (opcional), MONGODB_URI
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
GOOGLE_API_KEY=...           # Opcional, para modelos Gemini
CLIENT_URL=http://localhost:5173
NODE_ENV=development
APP_PASSWORD=...             # Opcional, contraseña de acceso (si no se define, acceso libre)
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

### Autenticación
- `GET /api/auth/status` - Verifica si la autenticación está habilitada
  - Response: `{ authRequired: boolean }`
- `POST /api/auth/verify` - Verifica la contraseña
  - Body: `{ password: string }`
  - Response: `{ success: boolean }`

### Admin
- `GET /api/health` - Health check
- `GET /api/admin/games` - Lista juegos (paginado con filtros)
  - Query params:
    - `page`: número de página
    - `limit`: juegos por página
    - `numFirms`: filtrar por número de firmas (2-10)
    - `communication`: `true` | `false` | `all` - filtrar por comunicación
    - `competitionMode`: `cournot` | `bertrand` | `all` - filtrar por modo
    - `dateFrom`: fecha inicio (YYYY-MM-DD)
    - `dateTo`: fecha fin (YYYY-MM-DD)
- `GET /api/admin/games/:gameId` - Detalle completo de juego (incluye prompts)
- `GET /api/admin/games/:gameId/export` - Exportar juego a CSV
  - Query params:
    - `format`: `rounds` (por ronda) | `summary` (por réplica)
    - `reasoning`: `true` | `false` - Incluir razonamientos de LLMs
    - `chat`: `true` | `false` - Incluir mensajes de comunicación
- `DELETE /api/admin/games/:gameId` - Eliminar juego individual
- `DELETE /api/admin/games/bulk` - Eliminar múltiples juegos
  - Body: `{ gameIds: string[] }` (máximo 100)
  - Response: `{ deletedCount, requestedCount }`
- `POST /api/admin/games/bulk-export` - Exportar múltiples juegos a CSV combinado
  - Body: `{ gameIds: string[], format: 'rounds'|'summary', includeReasoning: boolean, includeChat: boolean }` (máximo 50)
  - Response: CSV con columna `GameId` para identificar cada juego
- `GET /api/admin/stats` - Estadísticas agregadas

## Archivos Clave para Modificaciones

| Tarea | Archivo |
|-------|---------|
| Cambiar modelo económico | `server/src/services/EconomicsService.ts` |
| Modificar prompts LLM | `server/src/services/LLMService.ts` |
| Añadir modelos LLM | `client/src/types/game.ts` (AVAILABLE_MODELS) |
| Cambiar lógica de juego | `server/src/services/CournotService.ts` |
| Parámetros aleatorios | `server/src/services/ParameterService.ts` |
| Modificar UI configuración | `client/src/components/HomePage.tsx` |
| Modificar opciones avanzadas | `client/src/components/AdvancedSettings.tsx` |
| Modificar visualización | `client/src/components/game/GameBoard.tsx` |
| Cambiar esquema BD | `server/src/models/GameResult.ts` |
| Colores de firmas | `client/src/types/game.ts` (FIRM_COLORS) |

## Tipos Importantes

```typescript
// Modo de competencia
type CompetitionMode = 'cournot' | 'bertrand';

// Tipos de distribución para parámetros aleatorios
type DistributionType = 'fixed' | 'uniform' | 'normal' | 'lognormal';

// Especificación de parámetro (fijo o aleatorio)
interface ParameterSpec {
  type: DistributionType;
  value?: number;      // Para 'fixed'
  min?: number;        // Para 'uniform'
  max?: number;        // Para 'uniform'
  mean?: number;       // Para 'normal' y 'lognormal'
  stdDev?: number;     // Para 'normal' y 'lognormal'
}

// Tipos de función de demanda
type DemandFunctionType = 'linear' | 'ces' | 'logit' | 'exponential';

// Configuración de demanda lineal
interface LinearDemandConfig {
  type: 'linear';
  intercept: ParameterSpec;  // a
  slope: ParameterSpec;      // b
}

// Configuración de demanda CES
interface CESDemandConfig {
  type: 'ces';
  scale: ParameterSpec;                  // A
  substitutionElasticity: ParameterSpec; // σ
}

// Configuración de demanda Logit
interface LogitDemandConfig {
  type: 'logit';
  intercept: ParameterSpec;        // a
  priceCoefficient: ParameterSpec; // b
}

// Configuración de demanda Exponencial
interface ExponentialDemandConfig {
  type: 'exponential';
  scale: ParameterSpec;     // A
  decayRate: ParameterSpec; // b
}

type DemandConfig = LinearDemandConfig | CESDemandConfig | LogitDemandConfig | ExponentialDemandConfig;

// Valores realizados para una ronda
interface RealizedParameters {
  demand: {
    type: DemandFunctionType;
    intercept?: number;            // Lineal, Logit
    slope?: number;                // Lineal
    scale?: number;                // CES, Exponencial
    substitutionElasticity?: number; // CES
    priceCoefficient?: number;     // Logit
    decayRate?: number;            // Exponencial
  };
  gamma?: number;
  firmCosts: {
    firmId: number;
    linearCost: number;
    quadraticCost: number;
  }[];
}

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

  // Demanda legacy (para retrocompatibilidad)
  demandIntercept: number;      // a
  demandSlope: number;          // b

  // Nueva configuración de demanda (alternativa)
  demandFunction?: DemandConfig;

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

  // Parámetros aleatorios
  gammaSpec?: ParameterSpec;
  firmCostSpecs?: { linearCost: ParameterSpec; quadraticCost: ParameterSpec }[];
  parameterVariation?: 'fixed' | 'per-replication' | 'per-round';
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
  calculable: boolean;      // false para demanda isoelástica
  message?: string;         // Mensaje si no es calculable
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

## Coherencia de Parámetros Aleatorios en Prompts

Cuando se usan parámetros aleatorios, es crítico que el prompt enviado al LLM refleje los valores **realizados** (sorteados), no los valores del config (especificación de distribución):

- **Servidor (`LLMService.generateSystemPrompt`)**: Usa `realizedParams` para todos los valores del prompt (costes propios, costes rivales, demanda, gamma). Si `realizedParams` no existe (sin aleatorización), usa los valores fijos del config. El bloque de custom prompt también usa los valores realizados via `demandIntercept`/`demandSlope` (calculados desde `realizedParams`).
- **Servidor (`LLMService.getCommunicationMessage`)**: Recibe y pasa `realizedParams` a `generateSystemPrompt` para que la fase de comunicación también use valores realizados coherentes con la fase de decisión.
- **Cliente (vista previa en `AdvancedSettings`)**: No puede mostrar valores realizados (aún no sorteados), por eso muestra `[random ~ Distribución(params)]` para parámetros aleatorios, indicando claramente al investigador que el valor variará en cada juego/ronda.
- **Ejemplo de respuesta en el prompt**: No debe contener números concretos (ancla al LLM). Usa `[your chosen quantity]` / `[your chosen price]` como placeholder.

## Notas Técnicas

### Integración OpenAI
- **Responses API**: Usada por TODOS los modelos GPT-5 (nano, mini, 5.2, 5.2-pro)
  - GPT-5.2: Soporta `reasoning: { effort: "none"|"low"|"medium"|"high"|"xhigh" }`
  - GPT-5-nano/mini: NO soportan parámetro `reasoning` (tienen razonamiento fijo incorporado)
  - GPT-5-nano/mini: NO soportan `temperature` (error si se incluye)
- **Chat Completions API**: Usada solo por GPT-4o y GPT-4o-mini
  - Usa `max_tokens` y soporta `temperature: 0.7`

### Integración Google Gemini
- Usa `@google/generative-ai` SDK
- Requiere `GOOGLE_API_KEY` en variables de entorno (opcional)
- **Rate limiting automático**:
  - Gemini 2.5 Flash Lite: 10 RPM
  - Otros modelos: 5 RPM
- El sistema espera automáticamente entre llamadas para no exceder límites

### Arquitectura
- MongoDB es opcional (el servidor funciona sin él, solo no persiste)
- El servidor verifica conexión MongoDB antes de queries (`mongoose.connection.readyState`)
- Los LLMs deciden simultáneamente (Promise.all para N firmas)
- La comunicación ocurre secuencialmente (Firma 1, 2, ..., N, 1, 2...)
- El historial de rondas se incluye en cada prompt (memoria del juego)
- La primera línea de respuesta LLM debe ser solo el número (cantidad o precio)
- Las réplicas se ejecutan secuencialmente, no en paralelo
- Los prompts se almacenan para auditoría en cada FirmRoundResult

### Frontend
- AdminPanel detecta automáticamente URL de producción (Render) vs desarrollo
- Soporte completo para N firmas (2-10) en GameBoard, GameResults y tablas
- El equilibrio Bertrand con γ=1 es precio = coste marginal mínimo
- El cálculo N-poly usa eliminación gaussiana con pivoteo parcial

### Fórmula de Demanda Directa Bertrand (Singh & Vives 1984)

Para n firmas con demanda lineal diferenciada, la demanda directa correcta es:
```
q_i = [a(1-γ) - p_i(1+(n-2)γ) + γΣ_{j≠i} p_j] / [b(1-γ)(1+(n-1)γ)]
```
Esta fórmula se usa en dos lugares de `EconomicsService.ts`:
1. `calculateNashBertrandNFirms`: para obtener cantidades a partir de precios de equilibrio
2. `calculateNPolyRoundResult`: para obtener cantidades a partir de precios decididos por los LLMs

**Limitaciones del equilibrio Nash Bertrand:**
- Solo calculable analíticamente con demanda lineal y costes lineales (d_i = 0)
- Con d_i > 0: la FOC produce un sistema no lineal → devuelve `calculable: false`
- Con γ = 1 (homogéneo) y d_i = 0: precio = min(c_i), q_total = (a - p)/b

### Resumen de Réplicas (N firmas)
`ReplicationResult.summary` contiene:
- Campos legacy `totalFirm1Profit`, `avgFirm1Quantity`, etc. (siempre presentes, solo firmas 1 y 2)
- Campo extendido `firmSummaries[]` con `{firmId, totalProfit, avgQuantity}` para todas las firmas (presente cuando hay `firmResults` en las rondas)

### Exportación CSV (N firmas)
- **Formato `rounds`**: Columnas dinámicas para N firmas (`Firm1_Decision`, `Firm1_Profit`, ..., `FirmN_Decision`, `FirmN_Profit`). Para Bertrand, la columna Decision exporta el precio (no la cantidad derivada).
- **Formato `summary`**: Columnas dinámicas para N firmas (`AvgFirm1Decision`, `TotalFirm1Profit`, ...). Usa `firmSummaries` para firmas 3+, con fallback a campos legacy para firmas 1-2.
- **Bulk export**: Usa el máximo número de firmas de todos los juegos seleccionados para definir las columnas.

## Retrocompatibilidad

- CournotConfig mantiene campos legacy (firm1LinearCost, demandIntercept, etc.)
- Si no se especifica `numFirms`, se asume duopolio (2)
- Si no se especifica `gamma`, se asume productos homogéneos (1)
- Si no se especifica `competitionMode`, se asume 'cournot'
- Si no se especifica `demandFunction`, se asume demanda lineal con valores de `demandIntercept`/`demandSlope`
- Si no se especifica `parameterVariation`, se asume 'fixed'
- Los juegos antiguos en MongoDB siguen funcionando

## Próximas Mejoras Posibles

- [ ] Gráficos comparativos entre réplicas
- [ ] Más modelos LLM (Anthropic)
- [ ] Modo Stackelberg (líder-seguidor)
- [ ] Tests automatizados
- [x] ~~Competencia en precios (Bertrand)~~ ✓ Implementado
- [x] ~~N-polio (más de 2 firmas)~~ ✓ Implementado
- [x] ~~Diferenciación de productos~~ ✓ Implementado
- [x] ~~Parámetros aleatorios~~ ✓ Implementado (Uniform, Normal, Log-normal)
- [x] ~~Demanda isoelástica~~ ✓ Implementado
- [x] ~~Exportar resultados a CSV~~ ✓ Implementado (con razonamientos y comunicación)
- [x] ~~Google Gemini~~ ✓ Implementado (modelos gratuitos con rate limiting)
- [x] ~~Más funciones de demanda~~ ✓ Implementado (CES, Logit, Exponencial)
- [x] ~~Filtros y operaciones en lote en Admin Panel~~ ✓ Implementado (filtros, selección múltiple, eliminación/exportación en lote)
