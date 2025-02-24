// This is a config file for the `wait-on` package.
// Used by the `startConnect` Cypress command.
module.exports = {
  // Connect will respond with a 402 status code when the license is invalid.
  // We want to allow Connect to load in that case.
  validateStatus: function (status) {
    return (status >= 200 && status < 300) || status == 402;
  },
};
