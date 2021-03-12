module.exports = {
  skipFiles: ["interfaces", "tests", "lib", "storage"],
  mocha: {
    grep: "@skip-on-coverage",
    invert: true,
  },
};
