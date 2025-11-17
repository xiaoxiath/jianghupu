export type GameEventType = '战斗' | '机缘' | '社交' | '交易' | '陷阱' | '幻境';

export type EventResult = {
  description: string;
  player_stats?: { hp?: number; mp?: number; };
  player_attributes?: { strength?: number; constitution?: number; intelligence?: number; agility?: number; };
  player_mood?: string;
 data?: any; // For carrying extra payload, e.g., trade details
};

export interface EventChoice {
 text: string;
  action: string;
  result?: EventResult;
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  title: string;
  description: string;
  trigger: ((state: any, helpers: any) => boolean | Promise<boolean>);
  choices?: EventChoice[];
  once?: boolean;
}