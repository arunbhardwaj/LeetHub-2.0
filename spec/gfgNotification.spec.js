import { createSyncNotifier, HOST_ID } from '../scripts/gfg/notification.js';

function fakeDocument() {
  const body = {
    children: [],
    append(element) {
      element.parent = this;
      this.children.push(element);
    },
  };
  return {
    body,
    createElement(tagName) {
      return {
        tagName,
        style: {},
        attributes: {},
        children: [],
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        append(...elements) {
          this.children.push(...elements);
        },
        remove() {
          if (!this.parent) return;
          this.parent.children = this.parent.children.filter(child => child !== this);
          this.parent = null;
        },
      };
    },
  };
}

describe('GFG sync notification UI', () => {
  it('uses one extension-owned, non-interactive host and removes it on cleanup', () => {
    const documentObject = fakeDocument();
    let timerCallback;
    let cleared = 0;
    const notifier = createSyncNotifier(documentObject, {
      setTimer(callback) {
        timerCallback = callback;
        return 1;
      },
      clearTimer() {
        cleared++;
      },
    });

    notifier.show({ type: 'success', heading: 'Synced to GitHub', detail: 'Problem • Java' });
    const host = documentObject.body.children[0];
    expect(host.id).toBe(HOST_ID);
    expect(host.style.pointerEvents).toBe('none');
    expect(host.attributes.role).toBe('status');
    expect(host.children.map(child => child.textContent)).toEqual([
      'Synced to GitHub',
      'Problem • Java',
    ]);

    notifier.cleanup();
    expect(documentObject.body.children).toEqual([]);
    expect(cleared).toBe(1);
    timerCallback();
    expect(documentObject.body.children).toEqual([]);
  });
});
