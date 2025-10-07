export const OPEN_ASK_AI_EVENT = 'open-ask-ai';

type AskAIDetail = {
  query?: string;
};

export function triggerOpenAskAI(detail: AskAIDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AskAIDetail>(OPEN_ASK_AI_EVENT, { detail }));
}
