import type { AccountRules, Market, Phase } from "./rules/types.ts";

export interface PresetSize {
  /** Account size in dollars. */
  size: number;
  rules: AccountRules;
}

export interface PresetPlan {
  name: string;
  phase: Exclude<Phase, "personal">;
  sizes: PresetSize[];
}

export interface FirmPreset {
  id: string;
  name: string;
  market: Market;
  /** Where the numbers come from. Firms change their rules: always confirm. */
  sources: string[];
  plans: PresetPlan[];
}

const usd = (n: number) => n * 100;

function topstepCombine(size: number, target: number, maxLoss: number, daily: number): PresetSize {
  return {
    size,
    rules: {
      profitTarget: usd(target),
      maxLoss: usd(maxLoss),
      drawdownType: "eod",
      lockLevel: 0,
      dailyLoss: usd(daily),
      dailyLossMode: "soft",
      consistencyPct: 55,
      consistencyBasis: "target",
    },
  };
}

function topstepXfa(size: number, maxLoss: number, daily: number, consistency: boolean): PresetSize {
  return {
    size,
    rules: {
      maxLoss: usd(maxLoss),
      drawdownType: "eod",
      lockLevel: 0,
      payoutLocksFloor: true,
      dailyLoss: usd(daily),
      dailyLossMode: "soft",
      ...(consistency
        ? { payoutDays: 3, consistencyPct: 40, consistencySinceLastPayout: true }
        : { payoutDays: 5, minProfitPerDay: usd(150) }),
    },
  };
}

/**
 * Starting presets. Every value is copied onto the account and stays editable there.
 * Add firms here as they are needed.
 */
export const FIRMS: FirmPreset[] = [
  {
    id: "topstep",
    name: "Topstep",
    market: "futures",
    sources: [
      "https://help.topstep.com/en/articles/8284197-trading-combine-parameters",
      "https://help.topstep.com/en/articles/8284215-express-funded-account-parameters",
    ],
    plans: [
      {
        name: "Trading Combine",
        phase: "evaluation",
        sizes: [
          topstepCombine(50_000, 3000, 2000, 1000),
          topstepCombine(100_000, 6000, 3000, 2000),
          topstepCombine(150_000, 9000, 4500, 3000),
        ],
      },
      {
        name: "XFA Standard",
        phase: "funded",
        sizes: [
          topstepXfa(50_000, 2000, 1000, false),
          topstepXfa(100_000, 3000, 2000, false),
          topstepXfa(150_000, 4500, 3000, false),
        ],
      },
      {
        name: "XFA Consistency",
        phase: "funded",
        sizes: [
          topstepXfa(50_000, 2000, 1000, true),
          topstepXfa(100_000, 3000, 2000, true),
          topstepXfa(150_000, 4500, 3000, true),
        ],
      },
    ],
  },
];

export const DRAWDOWN_LABEL: Record<string, string> = {
  static: "Estático",
  eod: "Fin de día",
  intraday: "Intradía",
};

export const PHASE_LABEL: Record<Phase, string> = {
  evaluation: "Evaluación",
  funded: "Fondeada",
  personal: "Personal",
};
