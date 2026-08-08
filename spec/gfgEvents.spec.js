import { createEventBus } from '../scripts/gfg/events.js';

describe('GFG event bus', () => {
  it('publishes lifecycle data and supports unsubscription', () => {
    const events = createEventBus();
    const received = [];
    const unsubscribe = events.on('submission:result', value => received.push(value));

    events.emit('submission:result', { verdict: 'accepted' });
    unsubscribe();
    events.emit('submission:result', { verdict: 'wrong_answer' });

    expect(received).toEqual([{ verdict: 'accepted' }]);
  });
});
