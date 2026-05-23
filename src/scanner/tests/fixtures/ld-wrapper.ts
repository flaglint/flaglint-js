// Fixture: wrapper function calls — detected when wrappers config is set.
declare function flagPredicate<T>(flagKey: string, defaultValue: T): T;
declare function getDynamicKey(): string;

export const showBanner = flagPredicate('show-banner', false);
export const enableDarkMode = flagPredicate('enable-dark-mode', true);
export const dynamicFlag = flagPredicate(getDynamicKey(), false);
