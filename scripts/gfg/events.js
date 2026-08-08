export const GfgEvent = Object.freeze({
  SUBMISSION_START: 'submission:start',
  SUBMISSION_JUDGING: 'submission:judging',
  SUBMISSION_RESULT: 'submission:result',
});

export function createEventBus() {
  const listeners = new Map();

  return Object.freeze({
    on(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);

      return () => {
        typeListeners.delete(listener);
        if (typeListeners.size === 0) listeners.delete(type);
      };
    },

    emit(type, detail) {
      for (const listener of listeners.get(type) ?? []) listener(detail);
    },
  });
}
