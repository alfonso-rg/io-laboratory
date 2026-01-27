# Competencia Cournot entre Agentes de Inteligencia Artificial: Diseño Experimental y Metodología

## 1. Introducción y Motivación

### 1.1 Contexto

Los modelos de lenguaje de gran escala (Large Language Models, LLMs) han demostrado capacidades emergentes en razonamiento estratégico, toma de decisiones y resolución de problemas complejos. Esta investigación explora cómo estos agentes de inteligencia artificial se comportan en entornos de competencia oligopolística, específicamente en el marco clásico del duopolio de Cournot.

### 1.2 Preguntas de Investigación

1. ¿Convergen los LLMs hacia el equilibrio de Nash en competencia Cournot repetida?
2. ¿Emergen comportamientos colusivos o cooperativos entre agentes LLM?
3. ¿Cómo afectan las asimetrías en costes al comportamiento estratégico de los LLMs?
4. ¿Existen diferencias significativas entre distintos modelos de LLM en su aproximación al equilibrio?
5. ¿Cómo evoluciona el comportamiento estratégico a lo largo de múltiples rondas?

### 1.3 Contribuciones

- Desarrollo de una plataforma experimental para estudiar interacciones estratégicas entre LLMs
- Evidencia empírica sobre el comportamiento de LLMs en juegos de teoría de juegos clásicos
- Comparación del rendimiento de diferentes arquitecturas de LLM en contextos de decisión económica
- Marco metodológico replicable para futuras investigaciones en economía computacional

---

## 2. Marco Teórico

### 2.1 El Modelo de Cournot

El modelo de Cournot (1838) describe la competencia entre firmas que eligen simultáneamente cantidades de producción. En nuestro diseño experimental, implementamos una versión generalizada con costes asimétricos.

#### 2.1.1 Función de Demanda Inversa

La demanda del mercado sigue una especificación lineal:

$$P(Q) = a - bQ$$

donde:
- $P$ es el precio de mercado
- $Q = q_1 + q_2$ es la cantidad total producida
- $a > 0$ es el intercepto de demanda (disposición máxima a pagar)
- $b > 0$ es la pendiente de demanda (sensibilidad precio-cantidad)

#### 2.1.2 Estructura de Costes

Cada firma $i \in \{1, 2\}$ enfrenta una función de costes cuadrática:

$$C_i(q_i) = c_i \cdot q_i + d_i \cdot q_i^2$$

donde:
- $c_i \geq 0$ es el coste marginal lineal
- $d_i \geq 0$ es el componente de costes marginales crecientes

Esta especificación permite:
- Costes marginales constantes cuando $d_i = 0$
- Costes marginales crecientes cuando $d_i > 0$
- Asimetrías entre firmas cuando $c_1 \neq c_2$ o $d_1 \neq d_2$

#### 2.1.3 Función de Beneficios

El beneficio de cada firma es:

$$\pi_i = P(Q) \cdot q_i - C_i(q_i) = (a - b(q_1 + q_2)) \cdot q_i - c_i \cdot q_i - d_i \cdot q_i^2$$

#### 2.1.4 Equilibrio de Nash

Maximizando beneficios, las condiciones de primer orden son:

$$\frac{\partial \pi_i}{\partial q_i} = a - c_i - 2(b + d_i)q_i - bq_j = 0$$

Resolviendo el sistema de ecuaciones, el equilibrio de Nash es:

$$q_1^* = \frac{\alpha_1 \beta_2 - b\alpha_2}{\beta_1 \beta_2 - b^2}$$

$$q_2^* = \frac{\alpha_2 \beta_1 - b\alpha_1}{\beta_1 \beta_2 - b^2}$$

donde $\alpha_i = a - c_i$ y $\beta_i = 2(b + d_i)$.

**Caso simétrico simplificado** ($c_1 = c_2 = c$, $d_1 = d_2 = 0$):

$$q^* = \frac{a - c}{3b}$$

### 2.2 Juegos Repetidos y Colusión

En un juego repetido con horizonte finito conocido, la teoría predice que el equilibrio de Nash del juego de una ronda se jugará en cada período (inducción hacia atrás). Sin embargo, la literatura experimental muestra que:

1. Los jugadores humanos frecuentemente logran resultados más cooperativos
2. La comunicación implícita a través de acciones pasadas puede facilitar coordinación
3. El número de repeticiones afecta la probabilidad de colusión

Nuestra investigación examina si los LLMs exhiben patrones similares.

---

## 3. Diseño Experimental

### 3.1 Configuración Base

| Parámetro | Valor por Defecto | Descripción |
|-----------|-------------------|-------------|
| $a$ | 100 | Intercepto de demanda |
| $b$ | 1 | Pendiente de demanda |
| $c_1$, $c_2$ | 10 | Costes marginales lineales |
| $d_1$, $d_2$ | 0 | Costes marginales cuadráticos |
| Rondas | 10 | Número de repeticiones |

Con estos parámetros:
- Equilibrio de Nash: $q^* = 30$ por firma
- Precio de equilibrio: $P^* = 40$
- Beneficio de equilibrio: $\pi^* = 900$ por firma

### 3.2 Tratamientos Experimentales

#### Tratamiento 1: Caso Simétrico Base
- Parámetros por defecto
- Objetivo: Establecer línea base de comportamiento

#### Tratamiento 2: Asimetría en Costes
- $c_1 = 10$, $c_2 = 20$
- Objetivo: Estudiar comportamiento con ventaja competitiva

#### Tratamiento 3: Costes Marginales Crecientes
- $d_1 = d_2 = 0.1$
- Objetivo: Examinar efecto de restricciones de capacidad

#### Tratamiento 4: Horizonte Largo
- 50 rondas en lugar de 10
- Objetivo: Estudiar aprendizaje y convergencia a largo plazo

#### Tratamiento 5: Comparación entre Modelos
- Firma 1: GPT-4o vs Firma 2: GPT-3.5-turbo
- Objetivo: Evaluar diferencias en sofisticación estratégica

### 3.3 Variables Dependientes

1. **Cantidad producida** ($q_{it}$): Decisión de cada firma en cada ronda
2. **Desviación del Nash**: $|q_{it} - q_i^*|$
3. **Beneficio realizado**: $\pi_{it}$
4. **Índice de colusión**: $(Q^m - Q_t) / (Q^m - Q^N)$ donde $Q^m$ es cantidad de monopolio
5. **Volatilidad**: Desviación estándar de cantidades en últimas N rondas

### 3.4 Información Disponible para los Agentes

Cada LLM recibe:

1. **Conocimiento del juego**:
   - Función de demanda completa
   - Su propia estructura de costes
   - Fórmula de cálculo de beneficios
   - Número total de rondas

2. **Historial de rondas anteriores**:
   - Cantidades elegidas por ambas firmas
   - Precio de mercado resultante
   - Beneficios de ambas firmas

3. **No reciben**:
   - Costes del oponente (información privada)
   - Cálculo explícito del equilibrio de Nash
   - Instrucciones estratégicas específicas

---

## 4. Implementación Técnica

### 4.1 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Configuración│  │Visualización│  │     Resultados      │ │
│  │  HomePage   │  │  GameBoard  │  │    GameResults      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                                  │
│                    Socket.io                                │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                      SERVIDOR (Node.js)                     │
│                          │                                  │
│  ┌───────────────────────┴────────────────────────────┐    │
│  │               CournotService                        │    │
│  │         (Orquestación del juego)                   │    │
│  └───────────────────────┬────────────────────────────┘    │
│            ┌─────────────┴─────────────┐                   │
│            │                           │                    │
│  ┌─────────┴─────────┐    ┌───────────┴──────────┐        │
│  │   LLMService      │    │  EconomicsService    │        │
│  │ (OpenAI API)      │    │  (Cálculos Nash)     │        │
│  └─────────┬─────────┘    └──────────────────────┘        │
│            │                                                │
│            ▼                                                │
│     ┌──────────────┐                                       │
│     │   OpenAI     │                                       │
│     │   GPT-4o     │                                       │
│     └──────────────┘                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    MongoDB                           │   │
│  │              (Persistencia de resultados)           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Flujo de Ejecución

1. **Configuración**: El investigador establece parámetros del juego
2. **Cálculo de Nash**: El sistema calcula el equilibrio teórico
3. **Inicio del juego**: Se crea sesión con ID único
4. **Por cada ronda**:
   a. Se construye el prompt con historial para cada firma
   b. Se envían solicitudes simultáneas a la API de OpenAI
   c. Se parsean las respuestas (cantidad + razonamiento opcional)
   d. Se calculan precio y beneficios
   e. Se emiten resultados via Socket.io
   f. Se almacena en base de datos
5. **Finalización**: Se calcula resumen y estadísticas

### 4.3 Diseño de Prompts

#### System Prompt (Instrucciones base)

```
You are Firm {1|2} in a Cournot quantity competition game.

GAME RULES:
- You compete with another firm in the same market
- Each round, both firms simultaneously choose a production quantity
- Market price is determined by total quantity: P = {a} - {b} * (q1 + q2)
- Your cost function: C(q) = {c} * q [+ {d} * q²]
- Your profit = (Market Price × Your Quantity) - Your Cost

YOUR OBJECTIVE:
Maximize your total profit over {N} rounds.

STRATEGY CONSIDERATIONS:
- If you produce more, market price falls (hurting both firms)
- If you produce less, you earn less revenue but keep price higher
- The other firm is also an AI trying to maximize its profit
- Past behavior of the opponent may inform your expectations

RESPONSE FORMAT:
- First line: ONLY the quantity you want to produce (a non-negative number)
- Following lines (optional): Your reasoning
```

#### Round Prompt (Cada ronda)

```
ROUND {t} of {N}

PREVIOUS ROUNDS:
────────────────────────────────────────────────────────
Round | Your Q | Their Q | Price  | Your Profit | Their Profit
────────────────────────────────────────────────────────
   1  |  30.0  |   32.0  |  38.0  |      840.0  |       896.0
   2  |  28.0  |   30.0  |  42.0  |      896.0  |       960.0
  ...
────────────────────────────────────────────────────────

Your cumulative profit: {sum}
Their cumulative profit: {sum}

What quantity will you produce this round?
Remember: First line must be ONLY the quantity (a number).
```

### 4.4 Procesamiento de Respuestas

El sistema extrae la cantidad de la primera línea de la respuesta del LLM:

```typescript
parseResponse(response: string): { quantity: number, reasoning?: string } {
  const lines = response.trim().split('\n');
  const firstLine = lines[0].trim();
  const match = firstLine.match(/^[\d.]+/);

  if (!match) {
    // Fallback: buscar cualquier número en la respuesta
    const anyNumber = response.match(/(\d+\.?\d*)/);
    if (anyNumber) return { quantity: parseFloat(anyNumber[1]) };
    throw new Error('Could not parse quantity');
  }

  return {
    quantity: parseFloat(match[0]),
    reasoning: lines.slice(1).join('\n').trim() || undefined
  };
}
```

### 4.5 Parámetros de la API de OpenAI

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| model | gpt-4o / gpt-4o-mini | Modelos con mejor razonamiento |
| temperature | 0.7 | Balance entre consistencia y variabilidad |
| max_tokens | 500 | Suficiente para decisión y razonamiento |

---

## 5. Recolección y Análisis de Datos

### 5.1 Estructura de Datos

Cada juego genera un registro con:

```json
{
  "gameId": "uuid",
  "config": {
    "demandIntercept": 100,
    "demandSlope": 1,
    "firm1LinearCost": 10,
    "firm1QuadraticCost": 0,
    "firm2LinearCost": 10,
    "firm2QuadraticCost": 0,
    "totalRounds": 10,
    "firm1Model": "gpt-4o",
    "firm2Model": "gpt-4o"
  },
  "rounds": [
    {
      "roundNumber": 1,
      "firm1Quantity": 30.5,
      "firm2Quantity": 29.0,
      "totalQuantity": 59.5,
      "marketPrice": 40.5,
      "firm1Profit": 927.75,
      "firm2Profit": 872.5,
      "firm1Reasoning": "...",
      "firm2Reasoning": "...",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "nashEquilibrium": {
    "firm1Quantity": 30,
    "firm2Quantity": 30,
    "marketPrice": 40,
    "firm1Profit": 900,
    "firm2Profit": 900
  },
  "summary": {
    "totalFirm1Profit": 9150,
    "totalFirm2Profit": 8920,
    "avgFirm1Quantity": 30.2,
    "avgFirm2Quantity": 29.5,
    "nashDeviation": {
      "firm1QuantityDeviation": 0.2,
      "firm2QuantityDeviation": 0.5
    }
  }
}
```

### 5.2 Métricas de Análisis

#### 5.2.1 Convergencia al Equilibrio

$$\text{Desviación promedio} = \frac{1}{T} \sum_{t=1}^{T} \frac{|q_{1t} - q_1^*| + |q_{2t} - q_2^*|}{2}$$

#### 5.2.2 Índice de Colusión

El índice de colusión mide qué tan cerca están las firmas del resultado colusivo (monopolio conjunto) versus el competitivo (Nash):

$$CI_t = \frac{Q^{Nash} - Q_t}{Q^{Nash} - Q^{Monopolio}}$$

donde:
- $CI = 0$: Comportamiento de Nash
- $CI = 1$: Colusión perfecta (monopolio)
- $CI < 0$: Competencia más agresiva que Nash

#### 5.2.3 Eficiencia

$$\text{Eficiencia} = \frac{\pi_1^{real} + \pi_2^{real}}{\pi_1^{Nash} + \pi_2^{Nash}}$$

#### 5.2.4 Análisis de Series Temporales

- Test de raíz unitaria (Dickey-Fuller) para estacionariedad
- Análisis de autocorrelación en cantidades
- Detección de patrones de aprendizaje

### 5.3 Análisis Cualitativo

El razonamiento opcional proporcionado por los LLMs permite:

1. Identificar estrategias explícitas mencionadas
2. Detectar referencias a comportamiento del oponente
3. Analizar sofisticación del razonamiento económico
4. Comparar justificaciones entre modelos

---

## 6. Validación y Robustez

### 6.1 Verificación del Cálculo de Nash

El sistema verifica automáticamente el equilibrio calculado:

```typescript
// Test con parámetros conocidos
// a=100, b=1, c1=c2=10, d1=d2=0
// Esperado: q*=30, P*=40, π*=900

const config = {
  demandIntercept: 100,
  demandSlope: 1,
  firm1LinearCost: 10,
  firm2LinearCost: 10,
  firm1QuadraticCost: 0,
  firm2QuadraticCost: 0
};

const nash = EconomicsService.calculateNashEquilibrium(config);
assert(nash.firm1Quantity === 30);
assert(nash.marketPrice === 40);
assert(nash.firm1Profit === 900);
```

### 6.2 Replicabilidad

- Todos los parámetros de configuración se almacenan
- Las respuestas raw de los LLMs se guardan
- Seeds aleatorios documentados (temperature del LLM)
- Código fuente disponible para replicación

### 6.3 Limitaciones

1. **Variabilidad del LLM**: Las respuestas pueden variar entre ejecuciones
2. **Dependencia del prompt**: Resultados sensibles a formulación exacta
3. **Costes de API**: Limitación en número de repeticiones
4. **Versiones del modelo**: Los modelos de OpenAI se actualizan periódicamente

---

## 7. Protocolo Experimental

### 7.1 Procedimiento Estándar

1. **Preparación**:
   - Verificar conexión a API de OpenAI
   - Confirmar base de datos operativa
   - Documentar versión del modelo utilizado

2. **Ejecución por tratamiento**:
   - Mínimo 30 juegos por configuración
   - Registro de timestamp de cada sesión
   - Monitoreo de errores de API

3. **Post-procesamiento**:
   - Exportación de datos a formato CSV/JSON
   - Verificación de integridad de datos
   - Cálculo de estadísticas descriptivas

### 7.2 Consideraciones Éticas

- No hay participantes humanos en este diseño
- Los LLMs no tienen intereses propios que proteger
- Transparencia en metodología y resultados
- Código abierto para escrutinio

---

## 8. Resultados Esperados y Hipótesis

### H1: Convergencia al Nash
Los LLMs convergerán gradualmente hacia el equilibrio de Nash a medida que acumulan experiencia.

### H2: Heterogeneidad entre Modelos
Modelos más avanzados (GPT-4o) mostrarán menor desviación del Nash que modelos anteriores (GPT-3.5).

### H3: Ausencia de Colusión Explícita
Sin comunicación directa, los LLMs no lograrán sostener resultados colusivos significativos.

### H4: Sensibilidad a Asimetrías
Las firmas con menores costes producirán cantidades mayores, consistente con la teoría.

---

## 9. Extensiones Futuras

1. **Otros juegos**: Bertrand, Stackelberg, subastas
2. **Más jugadores**: Oligopolio con N firmas
3. **Información incompleta**: Costes desconocidos
4. **Comunicación**: Permitir mensajes entre agentes
5. **Otros LLMs**: Claude, Gemini, Llama, modelos open-source

---

## Apéndice A: Instalación y Uso del Software

### Requisitos
- Node.js 18+
- MongoDB (opcional)
- Clave API de OpenAI

### Instalación

```bash
# Clonar repositorio
git clone [repository-url]
cd io-laboratory

# Servidor
cd server
npm install
copy .env.example .env  # Añadir OPENAI_API_KEY
npm run dev

# Cliente (nueva terminal)
cd client
npm install
npm run dev
```

### Acceso
- Interfaz web: http://localhost:5173
- API: http://localhost:3001/api

---

## Apéndice B: Estructura de Archivos del Proyecto

```
io-laboratory/
├── server/
│   ├── src/
│   │   ├── index.ts                 # Punto de entrada
│   │   ├── types.ts                 # Definiciones TypeScript
│   │   ├── config/
│   │   │   ├── database.ts          # Conexión MongoDB
│   │   │   └── logger.ts            # Sistema de logs
│   │   ├── models/
│   │   │   └── GameResult.ts        # Schema de resultados
│   │   ├── services/
│   │   │   ├── EconomicsService.ts  # Cálculos económicos
│   │   │   ├── LLMService.ts        # Integración OpenAI
│   │   │   └── CournotService.ts    # Lógica del juego
│   │   ├── socket/
│   │   │   └── gameHandlers.ts      # Eventos tiempo real
│   │   └── routes/
│   │       └── admin.ts             # API administrativa
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.tsx                  # Componente principal
│   │   ├── stores/gameStore.ts      # Estado global
│   │   ├── hooks/useSocket.ts       # Conexión Socket.io
│   │   └── components/              # Interfaz de usuario
│   └── package.json
├── claude.md                         # Documentación técnica
├── metodologia_working_paper.md      # Este documento
└── README.md                         # Guía rápida
```

---

## Referencias

Cournot, A. (1838). *Recherches sur les principes mathématiques de la théorie des richesses*. Paris: Hachette.

Fudenberg, D., & Tirole, J. (1991). *Game Theory*. MIT Press.

OpenAI. (2024). GPT-4 Technical Report. *arXiv preprint*.

Tirole, J. (1988). *The Theory of Industrial Organization*. MIT Press.
