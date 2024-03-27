module.exports = {
  extends: ["plugin:cypress/recommended", "prettier"],
  plugins: ["cypress"],
  env: {
    "cypress/globals": true,
  },
};
