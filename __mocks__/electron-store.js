class Store {
  constructor(options) {
    this.options = options;
    this.store = new Map();
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
  }
}

module.exports = Store; 