const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readCloseToTrayPreference = (state: unknown): boolean =>
  isRecord(state) && typeof state.closeToTray === 'boolean' ? state.closeToTray : true;

export const writeCloseToTrayPreference = <T extends object>(state: T, enabled: boolean): T & { closeToTray: boolean } => ({
  ...state,
  closeToTray: enabled,
}) as T & { closeToTray: boolean };
