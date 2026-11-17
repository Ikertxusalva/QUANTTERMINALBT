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

- Acceso con contraseña única (`src/proxy.ts`, `src/lib/auth.ts`).
- Cuentas: asistente de 4 pasos (firma → plan y tamaño → reglas → detalles), cuenta personal,
  firma a mano, varias cuentas iguales de golpe, cuenta ya en marcha, archivar.
- Motor de reglas (`src/lib/rules`): sesión de trading, drawdown estático / fin de día / intradía
  con nivel de bloqueo, pérdida diaria, consistencia, objetivo y días por payout.
- Registro manual de trades y de costes y payouts por cuenta.
- Panel con totales, cuentas que requieren atención y últimos trades.

Los presets de firmas están en `src/lib/presets.ts`. Son valores de partida editables en cada
cuenta: las firmas cambian sus reglas, compruébalas en su web.

## Tests

```bash
npm test
```

El análisis funcional de referencia está en `docs/ANALISIS_INKLYN.md`.
