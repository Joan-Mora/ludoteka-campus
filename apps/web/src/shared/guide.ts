/** Opens the companion guide from anywhere: 'here' explains the current building, 'tour' walks the whole campus. */
export type GuideMode = 'here' | 'tour';

export const GUIDE_EVENT = 'eq:guide';

export function openGuide(mode: GuideMode = 'here') {
  window.dispatchEvent(new CustomEvent<GuideMode>(GUIDE_EVENT, { detail: mode }));
}

export const tourSeenKey = (userId: string) => `eq.tour.${userId}`;
