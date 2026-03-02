const defaultState = {
  user: null,
  session: {
    token: '',
    isLogin: false
  },
  cartCount: 0,
  systemConfig: {},
  networkStatus: {
    isConnected: true,
    networkType: 'unknown'
  }
};

let state = Object.assign({}, defaultState);
const listeners = {};
let seed = 1;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getState() {
  return deepClone(state);
}

function setState(nextState) {
  state = deepClone(nextState || defaultState);
  notify();
  return getState();
}

function patch(partial) {
  state = Object.assign({}, state, partial || {});
  notify();
  return getState();
}

function subscribe(listener) {
  const id = seed++;
  listeners[id] = listener;
  return function unsubscribe() {
    delete listeners[id];
  };
}

function notify() {
  Object.keys(listeners).forEach((id) => {
    try {
      listeners[id](getState());
    } catch (e) {
      // ignore listener errors to keep store stable
    }
  });
}

function reset() {
  setState(defaultState);
}

module.exports = {
  getState,
  setState,
  patch,
  subscribe,
  reset,
  defaultState: deepClone(defaultState)
};
