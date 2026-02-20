'use strict';

import noDeadEventListener from './rules/no-dead-event-listener.mjs';

export default {
  rules: {
    'no-dead-event-listener': noDeadEventListener,
  },
};
