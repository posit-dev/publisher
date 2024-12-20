# Contributing

## Testing

The home webview uses [Vitest](https://vitest.dev/) for testing.

Use `npm test` to run the tests.

### Code Coverage

Vitest is configured to generate a code coverage report. The configuration can
be found in the `vite.config.ts` file under `test`.

Thresholds are set based on our current coverage. CI will fail if thresholds are
not met or if they need to be updated from Vitest's
[`coverage.thresholds.autoUpdate`](https://vitest.dev/config/#coverage-thresholds-autoupdate)
feature.

Failures in CI are to encourage including unit tests, but with the understanding
that 100% coverage is not always possible or necessary thresholds can be
adjusted in pull requests as needed.
