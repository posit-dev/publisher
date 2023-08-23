module.exports = {
  env: {
    browser: true,
    es2021: true
  },

  extends: [
    // Core rules for common problems
    // https://eslint.org/docs/latest/use/configure/configuration-files#using-eslintrecommended
    'eslint:recommended',

    // Typescript recommended rules
    // https://typescript-eslint.io/linting/configs#recommended-configurations
    'plugin:@typescript-eslint/recommended',

    // Includes vue3-essential and vue3-strongly-recommended
    // https://eslint.vuejs.org/user-guide/#bundle-configurations
    'plugin:vue/vue3-recommended'
  ],

  overrides: [
    {
      env: {
        node: true
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script'
      }
    }
  ],

  parserOptions: {
    ecmaVersion: 'latest',
    parser: '@typescript-eslint/parser',
    sourceType: 'module'
  },

  plugins: [
    '@typescript-eslint',
    'vue'
  ],

  rules: {
    indent: [
      'error',
      2
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    quotes: [
      'error',
      'single'
    ],
    semi: [
      'error',
      'always'
    ]
  }
};
