const createDevLog = (config) => (...args) => {
  if (!config.PRODUCTION) console.log(...args);
};

export { createDevLog }
