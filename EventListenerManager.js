/*
 license: The MIT License, Copyright (c) 2018 YUKI "Piro" Hiroshi
 original:
   https://github.com/piroor/webextensions-lib-event-listener-manager
*/

'use strict';

const TIMEOUT = 2000;

export default class EventListenerManager {
  constructor() {
    this._listeners = new Set();
    this._stacksOnListenerAdded = new WeakMap();
  }

  addListener(listener) {
    const listeners = this._listeners;
    if (!listeners.has(listener)) {
      listeners.add(listener);
      this._stacksOnListenerAdded.set(listener, new Error().stack);
    }
  }

  removeListener(listener) {
    this._listeners.delete(listener);
    this._stacksOnListenerAdded.delete(listener);
  }

  removeAllListeners() {
    this._listeners.clear();
    this._stacksOnListenerAdded.clear();
  }

  // We hope to process results synchronously if possibly,
  // so this method must not be "async".
  dispatch(...args) {
    const listeners = Array.from(this._listeners);
    const results = listeners.map(listener => {
      const timer = setTimeout(() => {
        const listenerAddedStack = this._stacksOnListenerAdded.get(listener);
        console.log(`listener does not respond in ${TIMEOUT}ms.\n${listenerAddedStack}\n\n${new Error().stack}`);
      }, TIMEOUT);
      try {
        const result = listener(...args);
        if (result instanceof Promise)
          return result
            .catch(e => {
              console.log(e);
            })
            .then(result => {
              clearTimeout(timer);
              return result;
            });
        clearTimeout(timer);
        return result;
      }
      catch(e) {
        console.log(e);
        clearTimeout(timer);
      }
    });
    if (results.some(result => result instanceof Promise))
      return Promise.all(results).then(this.normalizeResults);
    else
      return this.normalizeResults(results);
  }

  normalizeResults(results) {
    if (results.length == 1)
      return results[0];
    for (const result of results) {
      if (result === false)
        return false;
    }
    return true;
  }
}
