# Bitácora de trading

Web privada, de un solo usuario, para seguir cuentas de prop firm y personales contra sus reglas.
Sin registro: se entra con una única contraseña.

## Arrancar en local

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:3000. Sin `APP_PASSWORD` la web queda abierta en desarrollo y los datos se
guardan en la carpeta `.data` (base de datos local, no se sube al repositorio).

## Configuración

Copia `.env.example` a `.env.local`:

| Variable | Para qué |
|---|---|
| `APP_PASSWORD` | Contraseña de acceso. Obligatoria en producción: sin ella la web permanece cerrada. |
| `DATABASE_URL` | Postgres (por ejemplo Supabase). Vacío = base de datos local en `.data`. |

Para publicarla en internet hace falta `DATABASE_URL`: un servidor sin disco persistente perdería
la base de datos local.

## Qué hay

- **Acceso** con contraseña única (`src/proxy.ts`, `src/lib/auth.ts`).
- **Panel**: P&L con curva y tiempo bajo el agua, balance con suelo, stop diario, calendario
  mensual con totales por semana, qué funciona por estrategia y trades recientes.
- **Cuentas**: asistente de 4 pasos, cuenta personal, firma a mano, varias iguales de golpe,
  cuenta ya en marcha, archivar, costes y payouts.
- **Motor de reglas** (`src/lib/rules`): sesión de trading, drawdown estático / fin de día /
  intradía con nivel de bloqueo, pérdida diaria, consistencia, objetivo y días por payout.
- **Importar** (`/import`): informe HTML de MetaTrader 5, exportación de cTrader (Excel, HTML o
  CSV) y CSV genérico. Vista previa antes de guardar, sin duplicados al reimportar, deshacer.
- **Journal**: lista con filtros, revisión de cada trade (nota, plan, sensación, error, sesión,
  estrategia y criterios, reglas rotas) y una página por día con plan y revisión.
- **Stats**: métricas, rachas, dónde está tu ventaja (12 agrupaciones), mapa día × hora,
  distribución de R, disciplina, coste por error e insights.
- **Estrategias** con criterios y **reglas de trading**.
- **Noticias**: calendario económico de la semana y tu resultado en días de alto impacto.
- **Notas** con plantillas, carpetas, búsqueda y enlaces `[[Título]]`.

El selector del dock elige la cuenta sobre la que se calculan Panel, Journal, Stats y Días.

Los presets de firmas están en `src/lib/presets.ts`. Son valores de partida editables en cada
cuenta: las firmas cambian sus reglas, compruébalas en su web.

### Importar

- **MT5**: pestaña Historial → clic derecho → Informe → HTML. Las horas son las del servidor del
  broker; «Nueva York +7» es lo habitual.
- **cTrader**: Historial → Exportar. La zona horaria se lee de la cabecera del archivo.

El calendario de noticias se descarga de un feed público al pulsar «Actualizar calendario» y se
guarda; el historial para «tú en días de noticia» se acumula semana a semana.

## Tests

```bash
npm test
```

El análisis funcional de referencia está en `docs/ANALISIS_INKLYN.md`.
