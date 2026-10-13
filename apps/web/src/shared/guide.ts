/** Opens the companion guide from anywhere: 'here' explains the current building, 'tour' walks the whole campus. */
export type GuideMode = 'here' | 'tour';

export const GUIDE_EVENT = 'eq:guide';

export function openGuide(mode: GuideMode = 'here') {
  window.dispatchEvent(new CustomEvent<GuideMode>(GUIDE_EVENT, { detail: mode }));
}

/** Starts the global voice commands (the microphone in the top bar). */
export const VOICE_EVENT = 'eq:voice';

export function startVoice() {
  window.dispatchEvent(new Event(VOICE_EVENT));
}

export const tourSeenKey = (userId: string) => `eq.tour.${userId}`;
