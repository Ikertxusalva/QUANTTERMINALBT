# Análisis de Ink (inklyn.app) — referencia para `app/tradingjournal`

Fecha del análisis: 17 nov 2026.

## 0. Alcance y límites

- **Fuente**: solo páginas públicas — home, `/pricing`, 5 páginas de producto, 6 herramientas gratuitas, ~80 artículos del centro de ayuda y las hojas de estilo servidas en `/login`.
- **No visto**: la app con sesión iniciada. `https://inklyn.app/accounts/new?from=picker` redirige a `/login`, así que el asistente de creación de cuenta está reconstruido desde su artículo de ayuda («Set up your first prop account») y capturas de marketing, no desde la pantalla real. Medidas exactas, micro-interacciones y estados vacíos de las pantallas privadas son inferencia.
- **Uso**: esto es una referencia funcional. Nuestra app debe tener nombre, marca, textos, iconografía y aspecto propios; lo que tomamos es el *qué hace*, no su identidad ni sus textos.
- Los presets de reglas de las firmas son datos que cada firma publica; hay que verificarlos en la web de cada firma, no copiarlos de Ink (ellos mismos avisan de que cambian).

## 1. Mapa del producto

Ink se define como «el journal para traders de prop firms (futuros, CFD y forex)». Un login, cinco partes:

| Módulo | Ruta | Qué es |
|---|---|---|
| Journal & Analytics (núcleo) | `/dashboard`, `/journal`, `/days`, `/stats`, `/strategies`, `/trades`, `/import`, `/calendar` | Registro de trades, revisión, estadísticas, simulaciones |
| Prop firm accounts | `/accounts`, `/accounts/prop-firms`, `/accounts/fee-tracker` | Cuentas con las reglas de la firma, encaje en 21 firmas, costes y payouts |
| News | `/news`, `/news/macro` | Calendario económico + tu rendimiento en días de noticia |
| inkPad | `/pad` | Notas enlazadas a trades (tipo Obsidian) |
| inkX + inkLink | `/x`, `/@usuario` | Red social de traders y página pública link-in-bio |

Otros: `/settings`, `/profile`, `/cards` (P&L cards), `/certificates`, `/checkout`, `/affiliate`, `/export`, `/themes/`. Es una PWA (se instala desde el navegador, sin tiendas, sin modo offline).

Herramientas gratuitas sin cuenta (captación): Will you pass?, Eval worth, Rule checker, Position size, Consistency, Trailing drawdown. Además directorio de firmas (`/prop-firms/<firma>`) y comparativas (`/compare/a-vs-b`).

## 2. Crear cuenta — el asistente (`/accounts/new`)

Toda operación pertenece a una cuenta. Se entra desde Accounts → «Create account» (o desde el Dashboard si no hay ninguna). `?from=picker` indica que se llegó desde el selector de cuentas de la barra superior.

Cuatro pasos con Continue / Back / «Do this later»; a la derecha, una tarjeta de la cuenta que se actualiza en vivo.

**Paso 1 — Firm**
- «Your firms» primero (con nº de cuentas), luego «All firms» (con nº de planes), con buscador.
- Salidas alternativas: «Add firm manually» (firma no listada, reglas a mano) y «Personal account» (dinero propio).

**Paso 2 — Plan & size**
- Los planes de la firma son pestañas; cada tamaño es una tarjeta con profit target, max loss, tamaño máximo y tipo de drawdown.
- Si la firma deja elegir tipo de drawdown o un add-on de consistencia al comprar, la tarjeta lleva un interruptor.
- La tarjeta elegida pasa a sólida. «Custom» salta los presets: se introduce fase y balance inicial.

**Paso 3 — Rules**
- Seis teselas precargadas. Evaluación: profit target, max loss, daily loss, max size, consistency, min days. Fondeada: días por payout y beneficio mínimo por día en lugar del target.
- Cada tesela se edita con −/+ o slider, más opciones: tipo de drawdown (EOD trailing, Intraday, Static), dónde se detiene el suelo, daily loss Soft/Hard, base de la consistencia.
- Tesela modificada = etiqueta «Edited» (clic para restaurar) y «Reset all».
- En evaluación, «Funded rules» muestra la fase fondeada en solo lectura. Las reglas que la app no puede seguir se marcan «Not tracked».

**Paso 4 — Details**
- Nombre (con sugerencias), nº de cuenta (opcional: pegar o añadir luego).
- Balance: «New» o «Already trading» (balance actual, suelo de max loss actual, días ya operados).
- «How many»: hasta 20 cuentas idénticas de golpe, numeradas #1, #2…
- «Fee you paid» (opcional; se registra como coste con su fecha).
- Cómo entran los trades: importar archivo o a mano.
- Pantalla final «All set» con la tarjeta creada y tres acciones: importar trades, registrar el primer trade, añadir otra.

**Cuenta personal**: ventana modal con Mercado y tamaño → Tus reglas (stop diario, max loss, máx. contratos, cada una activable) → Detalles. Sin firma, sin target, sin consistencia, sin payouts ni costes.

**Mercado**: Futures (por defecto) o CFD & Forex. Fija los instrumentos admitidos, cómo se registra (contratos vs lotes/pips/comisión/swap) y el inicio del día de trading. Se bloquea cuando la cuenta tiene trades.

**Límite Free**: 1 cuenta activa; al añadir la segunda pide archivar una o pasar a ink+.

## 3. Motor de reglas de prop firm

Es el corazón diferencial. Todo se calcula solo con trades cerrados.

**Sesión de trading**: el día se nombra por cuándo acaba. Futuros 18:00→17:00 ET; CFD/Forex 17:00→17:00 ET. Regla: sumar 6 h (futuros) o 7 h (CFD) a la hora de Nueva York y tomar la fecha. Todo se muestra en hora de Nueva York (no hay ajuste de zona horaria). No modela festivos ni cierres anticipados.

**Balance** = balance inicial + P&L previo + neto de trades − payouts.

**Drawdown** — suelo = pico − max loss; cambia qué pico cuenta:
- *Static*: suelo fijo en inicio − max loss.
- *End of day*: pico = mayor cierre de sesión completada; la sesión en curso no mueve el suelo.
- *Intraday trailing*: estimación (mayor balance tras un trade cerrado), mostrada como «≤ $X · estimate».
- *Lock level*: dólares sobre el balance inicial donde el suelo deja de subir.
- Payouts: bajan el balance, no el suelo. Opciones: «el payout bloquea el suelo» y «los payouts no bajan el balance del drawdown» (firmas que miden sobre beneficio bruto).
- Cuenta ya en marcha: si se introduce el suelo actual, se deduce el pico exacto; si no, se marca como estimación.

**Daily loss**: suma del neto de trades cerrados en la sesión; se alcanza en ≤ −límite. Soft (pausa la sesión) o Hard (falla la cuenta); puede ser opcional. Soporta límites escalonados según crece la cuenta (aplican desde la sesión siguiente).

**Consistencia**: mejor sesión ÷ beneficio neto total × 100. Variantes: gate para pasar o para payout; medida contra beneficio total o contra el profit target; «desde el último payout»; si «exactamente el límite» cuenta como exceso. Nunca es un fallo, solo bloquea. Muestra cuánto beneficio más y cuántos días hacen falta.

**Profit target** (solo evaluación): (P&L previo + neto) ÷ target. **Min trading days**: sesiones con algún trade cerrado. **Días por payout** (fondeada): sesiones desde el último payout que superan el mínimo por día.

**Reglas diarias propias** (comprobadas automáticamente): máx. N trades por sesión, parar tras N pérdidas, sin entradas ±N min de noticia, tamaño ≤ N minis (un micro = 0,1).

**Presets**: 22 firmas listadas (Topstep, Apex, MyFundedFutures, Lucid, Alpha Futures, Tradeify, Take Profit Trader, FundedNext, TradeDay, Earn2Trade, Bulenox, FTMO, The5ers, Blue Guardian, FXIFY, BrightFunded, FundingPips, E8 Markets, Funded Trading Plus, Alpha Capital Group, Elite Trader Funding, Top One Futures). Campos por preset: plan, fase, tamaño, profit target, max loss, tipo de drawdown, lock level, daily loss (+soft/hard/opcional/escalones), consistencia, min days, fecha de verificación y URL de la fuente.

**Prop firms (encaje)**: reproduce las reglas de cada plan sobre tus trades de los últimos 30 días → «You'd pass» / «Would stop you» con la regla causante. Mínimo 10 trades. Filtros por tamaño, tipo de pérdida, sin daily loss, sin consistencia, pago único, solo los que pasaría; lista/tarjetas/comparar.

**Fee tracker**: entradas Eval fee, Reset, Activation, Subscription, Payout (y Other). Net = Paid out − Spent. Muestra neto total y por cuenta, gráfico de totales acumulados, «road to even», libro mayor filtrable con exportación CSV, renovaciones con recordatorio (nunca registra sola; pregunta «Renewed? Log $…»).

**«Needs you»** (alertas del Dashboard): cuenta al 80 % del max loss, cerca del límite diario, target superado, lista para payout, payout bloqueado por consistencia.

## 4. Entrada de trades (conexiones)

No hay conexión directa a brokers por API: todo es importación de archivos o registro manual. La app nunca envía órdenes.

| Origen | Formato | Notas |
|---|---|---|
| Tradovate | CSV «Performance» (recomendado) o «Orders» | No trae comisiones; pide la zona horaria del archivo |
| TopstepX | CSV, una fila = un trade | Incluye comisiones y zona horaria |
| MetaTrader 5 | Informe HTML del historial | Solo cuentas CFD/Forex, MT5 en inglés, cuenta USD Hedge; pide hora del servidor (por defecto NY+7) |
| CSV genérico | NinjaTrader, Rithmic y otros | Detecta el formato por las columnas |
| Manual | «Log trade» | Como resultado (rápido) o con fills exactos |

Comportamientos a replicar:
- **Fills → trades**: un trade va de plano a plano. Escalar es un trade; un giro cierra uno y abre otro; posición abierta espera.
- **P&L propio**: ticks × valor del tick, menos comisiones; se contrasta al céntimo con el del broker y si no cuadra no se importa nada.
- **Vista previa «Check before importing»**: ejecuta la importación sin guardar y muestra nuevos, duplicados, fechas y P&L.
- **Todo o nada**, nombrando la fila culpable. **Idempotente** por id de fill. Rechaza mezclar dos formatos en el mismo rango de fechas.
- **Deshacer importación** durante 24 h. Lista de «posibles duplicados» (mismo instrumento, lado y tamaño, a menos de un minuto y un tick).
- **Log trade**: instrumento (recuerda el último), Long/Short, resultado en $ o puntos, contratos, comisiones autocompletadas del último trade, riesgo (1R: importe, presets $100/$250/$500 o stop en puntos), hora, cuenta, gráficos (pegar imagen o enlace de TradingView), y el journal. Tarjeta de Net P&L en vivo y «cómo queda la cuenta tras este trade». Atajo ⌘/Ctrl+Enter.
- **Varias cuentas a la vez** (copy trading, de pago): mismo trade a N cuentas, cada una con su tamaño; se guardan todas o ninguna.

## 5. Journal

- **Lista de trades**: tabla (símbolo, lado, cuenta, origen, cantidad, entrada/salida media, P&L, abierto, cerrado) o galería por semanas. Filtros por chips: All, Wins, Losses, Needs review, Imported, By hand y los 3 tags más usados. 50 por página.
- **Página de trade**: cabecera con origen (Imported · Tradovate / By hand / Imported · edited), Net P&L grande con bruto y comisiones, R, contratos, puntos, riesgo, % cuenta; nota A+/A/B/C/D; imágenes (3 gratis / 5 de pago, se elimina el EXIF); fills; **Review** (¿seguiste el plan? Sí/Parcial/No · cómo te sentiste · error principal · nota); tags, sesión, estrategia con criterios, reglas seguidas/rotas; estado de la cuenta tras el trade; «tus trades de esta hora». Navegación J/K entre pendientes de revisar.
- **Sesiones etiquetadas** (Asia, London, New York, solape, NY Lunch): las elige el usuario, editables en ajustes. Distintas de la sesión de reglas.
- **Días** (`/days`): una página por día con tres fases — Plan (sesgo, instrumento, hasta 12 niveles clave, hasta 8 escenarios «si → entonces», capturas), Trade (marcar cada trade on/off plan), Review (¿el plan fue correcto?, «dijiste / el mercado hizo», próxima vez). Autoguardado. Marca «escrito tras la apertura». Racha de planificación.
- **P&L cards**: imagen o vídeo compartible de un trade, día, semana, mes, año o total; formato horizontal o story; fondos propios; exporta PNG/MP4/GIF.
- **Recap mensual**: «película» resumen del mes.
- **Metas** (Personal): tipos $, racha, % y recuento; automáticas (leen datos del journal) o manuales; se juzgan una vez al día.

## 6. Estadísticas

Una sola función calcula todas las métricas para que Dashboard, Stats y estrategias coincidan.

**Definiciones**
- Win/loss/breakeven según una «banda de breakeven» configurable ($0 por defecto).
- Win rate = wins ÷ (wins + losses), sin breakevens.
- Profit factor = ganado ÷ perdido. Expectancy = neto ÷ trades.
- R = neto del trade ÷ riesgo fijado. R/trade = media de R. Avg RR (winners) = R medio de ganadores, como 1:X.
- Max drawdown = mayor caída desde un máximo del P&L acumulado (no del balance).

**Dashboard**: P&L «hero» (Today/Week/Month/All; alterna $ / R / %; desglose al mantener pulsado), barras por día, últimos 10 trades, tarjetas Today, Balance con línea de suelo, Daily stop, «Your shape» (radar de 6 ejes), dial de sesión por medias horas, anillos de metas, calendario de P&L con total semanal y marca de noticias, «Needs you». Bloques reordenables y ocultables. Modo «ocultar importes» (••••).

**Stats → Overview**: neto + curva de equity, bloque de drawdown (máx., actual, más largo, a nuevo máximo, recuperación), win rate, PF, Avg RR, hold medio, rachas y extremos, **Where your edge is** (13 agrupaciones: día, sesión, hora, símbolo, estrategia, frecuencia, hold time, tamaño, mes, semana del mes, long/short, sentimientos, errores; medido en neto, win % o R; tocar una fila filtra toda la página; <10 trades = «Small»), mapa de calor día × hora, distribución de R, **Discipline** (reglas seguidas vs rotas y su coste), coste por error.

**Otros**: Insights (compara dos grupos de trades; exige ≥10 por grupo y diferencia ≥25 % del trade medio o ≥10 puntos de win rate; «Early signal» / «Established»), Compare (dos periodos, estrategias, cuentas, instrumentos, tags o sesiones), Tags, **What if** (sandbox de reglas, mejor stop/target diario), **Your next 50 trades** (Monte Carlo: 1.000 repeticiones de tus trades → rango probable, peor caída, probabilidad de tocar el suelo).

**Estrategias**: nombre + lista de criterios de setup marcables en cada trade; tarjeta con neto, R total, R/trade, win rate; «Edge finder» (hasta 5 criterios combinados); por criterio; dónde funciona.

## 7. News, inkPad, inkX

- **News**: calendario semanal de impacto alto/medio con previsión y anterior, filtro por divisa, regla de noticias de tu firma marcada en cada dato, recordatorio; «tú en días de noticia» (P&L por minutos desde la publicación); panorama macro (régimen crecimiento/inflación, Fed vs 2 años, curva). Datos de FRED.
- **inkPad**: notas, carpetas, tags, plantillas (plan pre-mercado, revisión, ficha de setup, registro de errores), nota diaria autogenerada, Playbook (setups/reglas/errores con stats en vivo), `[[enlaces]]` y backlinks, bloques incrustados de trade/stat/calendario, grafo y vistas 3D, importación desde Obsidian, modo foco.
- **inkX**: feed de planes/trades/payouts, grupos con canales y salas de voz, DMs, historias de 24 h, tarjetas de trade que salen del journal. **inkLink**: página pública con insignias, estado en vivo, fondo de vídeo, música y efectos.

## 8. Free vs de pago (ink+)

Precio: Free $0 · ink+ $19/mes o $190/año · prueba de 3 días sin tarjeta · pagos con Paddle. Al volver a Free no se borra nada: lo extra queda en solo lectura y las secciones de pago se muestran difuminadas.

| Área | Free | ink+ |
|---|---|---|
| Cuentas activas | 1 (archivadas ilimitadas) | Ilimitadas |
| Trades e importaciones | Ilimitados | Ilimitados, a cualquier cuenta |
| Un trade a varias cuentas | — | Sí |
| Estrategias activas | 1 | Ilimitadas |
| Metas activas | 3 | Ilimitadas |
| Imágenes por trade / capturas por día | 3 | 5 |
| Almacenamiento de notas | 100 MB | 2 GB |
| Reglas de prop firm, daily rules, fee tracker | Sí | Sí + insights del fee tracker |
| Stats básicas (neto, equity, drawdown, win rate, PF, R, rachas) | Historial completo | Cualquier rango + tocar fila para filtrar |
| Where your edge is (13 agrupaciones) | — | Sí |
| Hold medio, mapa día×hora, distribución de R, próximos 50 trades, «¿compensa aguantar más?» | — | Sí |
| Discipline y coste por error | — | Sí |
| Compare y Tags | — | Sí |
| Estrategias: neto, R total, edge finder, por criterio | — | Sí |
| Insights | El más fuerte, 1 fijado | Todos, 3 fijados |
| Página de día | Plan, revisión, veredicto, racha | + precisión del plan, on/off plan, «dijiste / mercado hizo» |
| Dashboard | Hero, edge, balance con suelo, daily stop, hoy, calendario | + max drawdown %, Your shape, dial de sesión, avg win/loss, expectancy |
| Encaje en prop firms | Estimación de qué planes pasarías | + margen, repetición, coste estimado al primer payout |
| Recap mensual | Solo la apertura | Película completa, compartir y descargar |
| P&L cards | Trade y día | + semana, mes, año, total y efectos |
| Fondos propios | 5 imágenes + 1 vídeo | 20 + 10 |
| Temas | Black, Dark, Light, todas las paletas | + cristal líquido, Marketplace, fondos de vídeo |
| inkPad | Notas, carpetas, tags, importación Obsidian básica | + nota diaria, Playbook, reviews, enlaces, bloques, grafo, modo foco |
| inkX grupos propios | 1 (100 miembros, 5 canales) | Ilimitados (25 canales) |
| inkLink | 2 imágenes, música, color de acento | 6 imágenes/vídeos, todos los efectos, ocultar marca |

**Para nosotros**: construimos el nivel de pago completo, sin candados. Aun así conviene mantener un único punto de «capacidades» en el código por si más adelante se quiere segmentar.

## 9. UI y sistema visual

**Stack observado**: Next.js (App Router) en Vercel, Tailwind CSS v4, componentes con `data-slot` (estilo shadcn/ui), Supabase (auth con Google + email/contraseña), Sentry, Paddle.

**Tipografía**: Geist (texto) y Geist Mono (cifras). Secundarias cargadas para tarjetas y notas: Inter, JetBrains Mono, Newsreader (serif), Roboto. Tamaños de marketing: h1 76 px, h2 56 px, cuerpo 18 px; en la app el cuerpo ronda 14,5 px.

**Forma**: radios 12 px (tarjetas, inputs, botones), 10/14/16 px en variantes, 999 px para píldoras y chips. Botón primario claro sobre fondo oscuro (`#F4F4F4` con texto `#050505`), secundario transparente. Inputs `#0F0F0F` con borde interior blanco al 12 %.

**Principio de color**: interfaz casi monocroma; el color se reserva para el P&L. Bordes y superficies se derivan de un único canal «hi» (blanco en oscuro, casi negro en claro) con opacidad baja (4–18 %).

Tokens por tema:

| Token | Black (por defecto) | Dark | Light |
|---|---|---|---|
| Fondo `bg` | `#050505` | `#171717` | `#EDEDED` |
| Panel | `#0D0D0D` | blanco 4 % | `#FFFFFF` |
| Elevado `raised` | `#141414` | blanco 6 % | `#FAFAFA` |
| Chip | `#1A1A1A` | blanco 8 % | `#F0F0F0` |
| Overlay (diálogos, menús) | — | `#1F1F1F` | `#FFFFFF` |
| Línea | blanco 7 % | blanco 8 % | negro 7 % |
| Línea fuerte | blanco 18 % | blanco 18 % | negro 18 % |
| Texto | `#EDEDED` | `#EDEDED` | `#111111` |
| Texto 2 | `#A3A3A3` | `#B3B3B3` | `#525252` |
| Texto 3 | `#8A8A8A` | `#9A9A9A` | `#6B6B6B` |
| Texto 4 | `#525252` | `#525252` | `#A3A3A3` |
| Ganancia `up` | `#A8D4B6` | `#A8D4B6` | `#3D7353` |
| Pérdida `down` | `#D98B80` | `#E0A097` | `#AD4D3C` |
| Aviso `warn` | `#D9A77A` | `#D9A77A` | `#96591A` |

Con apariencia personalizada el tema Dark usa `#121212 / #1A1A1A / #222222 / #262626`. Las P&L cards tienen paleta propia: fondo `#060608`, up `#78B89A`, down `#DD7568`. Acentos de marca en marketing: coral `#E0705A` / `#D0574F` y amarillo `#D8C25A`.

**Paletas de P&L** (solo colorean cifra de P&L, líneas de gráfico, cuadrados de últimos trades, días del calendario y dial): Mono (por defecto), Sage & clay, Classic, Cold, Neon, Ocean, Custom (colores propios de ganancia, pérdida y breakeven).

**Panel de Apariencia** (tecla A; hoja sobre la página con vista previa al pasar el cursor):
- Tema: Light, Black, Dark, Auto.
- Fondo: ninguno, Flow, Moon, Ink, o imágenes propias.
- Tarjetas: Solid, Glass, Clear, Window.
- Días del calendario: Number, Tint, Edge, Heat, con intensidad.
- Botones: acabado (Ink, Line, Frost, Raised, Chrome, Glow), forma y tacto de pulsación.
- Layout: variante del hero, saludo, dock de navegación arriba o abajo.
- Componentes: reordenar y ocultar bloques del Dashboard.
- Movimiento: luz de cursor, legibilidad sobre imágenes, reducir movimiento.
- Temas guardables, compartibles por código, programables por horario de mercado, y Marketplace.

**Navegación**: dock (arriba o abajo) con Dashboard, Journal, Stats, Accounts, News, etc.; selector de cuenta en la barra superior (muestra el margen de cada cuenta); botón «Log trade» siempre accesible; menú de avatar con Settings, Appearance, ocultar importes y atajos (`?`). En móvil, barra inferior.

**Ajustes**: cuenta y suscripción, ocultar importes, banda de breakeven, noticias mostradas y divisas, comunidad/perfil, sesiones de trading, reglas de trading, reglas diarias, ayuda, zona de peligro (borrar cuenta).

**Patrones de UX que merece la pena adoptar**
- Nunca mostrar un número inventado: si falta dato, «—» y el motivo.
- Marcar estimaciones como tales («≤ $X · estimate») y muestras pequeñas («Small», «early read»).
- Todo en dólares y con una frase que diga qué hacer.
- Cada cálculo documentado con un ejemplo numérico.

## 10. Propuesta para `app/tradingjournal`

**Modelo de datos mínimo**: `accounts` (mercado, fase, balance inicial, P&L previo, estado activo/archivado, reglas propias), `firm_presets` (firma, plan, fase, tamaño, reglas, fuente, fecha de verificación), `instruments` (tick size, tick value, mercado), `imports`, `fills`, `trades` (con origen y grupo de copia), `trade_reviews`, `tags` (tipo: libre, sentimiento, error), `sessions`, `strategies` + `criteria` + `trade_criteria`, `rules` + `trade_rules`, `daily_rules`, `days` (plan, niveles, escenarios, revisión), `ledger_entries` (costes y payouts), `goals`, `appearance`.

**Orden de construcción sugerido**
1. Base: auth, tokens de tema, layout con dock y selector de cuenta.
2. Cuentas: asistente de 4 pasos, cuenta personal, presets, archivado.
3. Motor de reglas como librería pura con tests (sesión, drawdown, daily loss, consistencia, target, días de payout).
4. Trades: registro manual, luego importadores (Tradovate, TopstepX, CSV genérico, MT5) con vista previa, idempotencia y deshacer.
5. Dashboard y calendario.
6. Journal: página de trade, revisión, días.
7. Stats completas, estrategias, discipline, insights, compare.
8. Fee tracker y encaje en prop firms.
9. What if y Monte Carlo.
10. Apariencia avanzada, P&L cards, recap.
11. News, notas y parte social (los módulos más grandes y menos ligados al tracking de cuentas).
