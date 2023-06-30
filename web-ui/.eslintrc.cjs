module.exports = {
  // https://eslint.org/docs/user-guide/configuring#configuration-cascading-and-hierarchy
  // This option interrupts the configuration hierarchy at this file
  // Remove this if you have an higher level ESLint config file (it usually happens into a monorepos)
  root: true,

  // https://eslint.vuejs.org/user-guide/#how-to-use-a-custom-parser
  // Must use parserOptions instead of "parser" to allow vue-eslint-parser to keep working
  // `parser: 'vue-eslint-parser'` is already included with any 'plugin:vue/**' config and should be omitted
  parserOptions: {
    parser: require.resolve('@typescript-eslint/parser'),
    extraFileExtensions: [ '.vue' ]
  },

  env: {
    browser: true,
    es2021: true,
    node: true,
    'vue/setup-compiler-macros': true
  },

  // Rules order is important, please avoid shuffling them
  extends: [
    // Base ESLint recommended rules
    'eslint:recommended',

    // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin#usage
    // ESLint typescript rules
    'plugin:@typescript-eslint/recommended',

    // Uncomment any of the lines below to choose desired strictness,
    // but leave only one uncommented!
    // See https://eslint.vuejs.org/rules/#available-rules
    'plugin:vue/vue3-essential', // Priority A: Essential (Error Prevention)
    'plugin:vue/vue3-strongly-recommended', // Priority B: Strongly Recommended (Improving Readability)
    'plugin:vue/vue3-recommended', // Priority C: Recommended (Minimizing Arbitrary Choices and Cognitive Overhead)

    // brought over from connect
    // 'plugin:vuejs-accessibility/recommended',

    'standard'
  ],

  plugins: [
    // required to apply rules which need type information
    '@typescript-eslint',

    // https://eslint.vuejs.org/user-guide/#why-doesn-t-it-work-on-vue-files
    // required to lint *.vue files
    'vue',

    // brought over from connect
    // 'vuejs-accessibility'
  ],

  globals: {
    ga: 'readonly', // Google Analytics
    cordova: 'readonly',
    __statics: 'readonly',
    __QUASAR_SSR__: 'readonly',
    __QUASAR_SSR_SERVER__: 'readonly',
    __QUASAR_SSR_CLIENT__: 'readonly',
    __QUASAR_SSR_PWA__: 'readonly',
    process: 'readonly',
    Capacitor: 'readonly',
    chrome: 'readonly'
  },

  // add your custom rules here
  rules: {
    // allow async-await
    'generator-star-spacing': 'off',
    // allow paren-less arrow functions
    'arrow-parens': 'off',
    'one-var': 'off',
    'no-void': 'off',
    'multiline-ternary': 'off',

    'import/first': 'off',
    'import/namespace': 'error',
    'import/default': 'error',
    'import/export': 'error',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': 'off',

    // The core 'import/named' rules
    // does not work with type definitions
    'import/named': 'off',

    'prefer-promise-reject-errors': 'off',

    quotes: ['warn', 'single', { avoidEscape: true }],

    // this rule, if on, would require explicit return type on the `render` function
    '@typescript-eslint/explicit-function-return-type': 'off',

    // in plain CommonJS modules, you can't use `import foo = require('foo')` to pass this rule, so it has to be disabled
    '@typescript-eslint/no-var-requires': 'off',

    // The core 'no-unused-vars' rules (in the eslint:recommended ruleset)
    // does not work with type definitions
    'no-unused-vars': 'off',

    // allow debugger during development only
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

    // from Connect project:
    // VUE project
    // manually-enabled rules
    // 'vuejs-accessibility/label-has-for': [
    //   2,
    //   {
    //     components: ['Label'],
    //     required: {
    //       every: ['id'],
    //     },
    //     allowChildren: false,
    //   },
    // ],

    // All styling warnings within vue style guide should be promoted to
    // errors, since that is our pattern with prettier

    // Vue Priority C: Recommended
    'vue/attributes-order': 'error',
    'vue/no-v-html': 'off',
    'vue/order-in-components': 'error',
    'vue/this-in-template': 'error',

    // Vue Priority B: Strongly Recommended
    'vue/attribute-hyphenation': 'error',
    'vue/html-closing-bracket-newline': 'error',
    'vue/html-closing-bracket-spacing': 'error',
    'vue/html-end-tags': 'error',
    'vue/html-indent': 'error',
    'vue/html-quotes': 'error',
    'vue/html-self-closing': 'error',
    'vue/max-attributes-per-line': 'error',
    'vue/multiline-html-element-content-newline': 'error',
    'vue/mustache-interpolation-spacing': 'error',
    'vue/no-multi-spaces': 'error',
    'vue/no-spaces-around-equal-signs-in-attribute': 'error',
    'vue/no-template-shadow': 'error',
    'vue/prop-name-casing': ['error', 'camelCase'],
    'vue/require-default-prop': 'error',
    'vue/require-prop-types': 'error',
    'vue/singleline-html-element-content-newline': 'error',
    'vue/v-bind-style': 'error',
    'vue/v-on-style': 'error',

    // Vue Priority A: Essential (Error Prevention)
    'vue/no-async-in-computed-properties': 'error',
    'vue/no-dupe-keys': 'error',
    'vue/no-duplicate-attributes': 'error',
    'vue/no-parsing-error': 'error',
    'vue/no-reserved-keys': 'error',
    'vue/no-shared-component-data': 'error',
    'vue/no-side-effects-in-computed-properties': 'error',
    'vue/no-template-key': 'error',
    'vue/no-textarea-mustache': 'error',
    'vue/no-unused-components': 'error',
    'vue/no-unused-vars': 'error',
    'vue/no-use-v-if-with-v-for': 'error',
    'vue/require-component-is': 'error',
    'vue/require-prop-type-constructor': 'error',
    'vue/require-render-return': 'error',
    'vue/require-v-for-key': 'error',
    'vue/require-valid-default-prop': 'error',
    'vue/return-in-computed-property': 'error',
    'vue/use-v-on-exact': 'error',
    'vue/valid-template-root': 'error',
    'vue/valid-v-bind': 'error',
    'vue/valid-v-cloak': 'error',
    'vue/valid-v-else-if': 'error',
    'vue/valid-v-else': 'error',
    'vue/valid-v-for': 'error',
    'vue/valid-v-html': 'error',
    'vue/valid-v-if': 'error',
    'vue/valid-v-model': 'error',
    'vue/valid-v-on': 'error',
    'vue/valid-v-once': 'error',
    'vue/valid-v-pre': 'error',
    'vue/valid-v-show': 'error',
    'vue/valid-v-text': 'error',

    // Vue Uncategorized Priority
    'vue/camelcase': 'error',
    'vue/comma-dangle': 'error',
    'vue/component-definition-name-casing': ['error', 'PascalCase'],
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/component-tags-order': ['error', { 'order': ['template', 'script', 'style']}],
    'vue/match-component-file-name': 'off', // can't enforce b/c of files named: index.vue
    'vue/max-len': ['error', {
      'code': 100,
      'ignoreComments': true,
      'ignoreTrailingComments': true,
      'ignoreUrls': true,
      'ignoreStrings': true,
      'ignoreTemplateLiterals': true,
      'ignoreRegExpLiterals': true,
      'ignoreHTMLAttributeValues': true,
      'ignoreHTMLTextContents': true,
    }],
    'vue/no-deprecated-scope-attribute': 'error',
    'vue/no-deprecated-slot-attribute': 'error',
    'vue/no-deprecated-slot-scope-attribute': 'error',
    'vue/no-reserved-component-names': 'error',
    'vue/require-name-property': 'error',
    'vue/v-on-function-call': ['error', 'never'],
    'vue/v-slot-style': ['error', {
      'atComponent': 'v-slot',
      'default': 'shorthand',
      'named': 'shorthand',
    }],
    'vue/valid-v-slot': 'error',
    // 'vuejs-accessibility/no-onchange': 0,
    // 'vuejs-accessibility/interactive-supports-focus': ['warn'],

    // Verifies that all named imports are part of the set of named
    // exports in the referenced module.
    'import/named': ['error'],
    // Enforces names exist at the time they are dereferenced,
    // when imported as a full namespace
    // (i.e. import * as foo from './foo'; foo.bar();
    // will report if bar is not exported by ./foo.).
    'import/namespace': ['error'],
    'prefer-const': ['error'],

    'eqeqeq': ['error', 'smart'],

    'valid-jsdoc': [
      'error',
      {
        'requireReturn': false,
        'requireParamDescription': false,
        'requireReturnDescription': false,
      },
    ],
    'no-var': 'error',

    'accessor-pairs': 'error',
    'complexity': 'warn',
    'global-require': 'error',
    'handle-callback-err': 'error',
    'lines-around-directive': 'error',
    'no-alert': 'error',
    'no-caller': 'error',
    'no-catch-shadow': 'error',
    'no-confusing-arrow': 'error',
    'no-div-regex': 'error',
    'no-empty': [
      'error',
      {
        'allowEmptyCatch': true,
      },
    ],
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-extra-label': 'error',
    'no-implicit-coercion': [
      'error',
      {
        'boolean': false,
        'number': false,
        'string': false,
      },
    ],
    'no-implicit-globals': 'error',
    'no-implied-eval': 'error',
    'no-inner-declarations': ['error', 'functions'],
    'no-iterator': 'error',
    'no-label-var': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-mixed-requires': 'error',
    'no-multi-str': 'error',
    'no-native-reassign': 'error',
    'no-negated-in-lhs': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-require': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-path-concat': 'error',
    'no-process-exit': 'error',
    'no-proto': 'error',
    'no-restricted-globals': 'error',
    'no-restricted-imports': 'error',
    'no-restricted-modules': 'error',
    'no-restricted-properties': 'error',
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-shadow-restricted-names': 'error',
    'no-sync': 'error',
    'no-template-curly-in-string': 'error',
    'no-undef-init': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-useless-call': 'error',
    'no-useless-computed-key': 'error',
    'no-useless-concat': 'error',
    'no-useless-constructor': 'error',
    'no-useless-rename': 'error',
    'no-void': 'error',
    'no-with': 'error',
    'prefer-numeric-literals': 'error',
    'prefer-spread': 'error',
    'radix': 'error',
    'strict': 'error',
    'symbol-description': 'error',
    'yoda': ['error', 'never'],
    'no-shadow': [
      'error',
      {
        'builtinGlobals': true,
        'hoist': 'functions',
      },
    ],
    'array-callback-return': 'error',
    'curly': 'error',

    // Stylistic ESLint Rules (replaces prettier rules):
    'array-bracket-newline': ['error', { 'multiline': true, 'minItems': null }],  // default
    'array-bracket-spacing': ['error', 'never'], // default
    'array-element-newline': ['error', 'consistent'],
    'block-spacing': ['error', 'always'], // default
    'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],  // default
    'camelcase': ['error', {'properties': 'always', 'ignoreDestructuring': false, 'ignoreImports': false}], // default
    'capitalized-comments': 'off',
    'comma-dangle': [
      'error',
      {
        'arrays': 'only-multiline',
        'objects': 'only-multiline',
        'imports': 'only-multiline',
        'exports': 'only-multiline',
        'functions': 'only-multiline',
      },
    ],
    'comma-spacing': ['error', { 'before': false, 'after': true }], // default
    'comma-style': ['error', 'last'], // default
    'computed-property-spacing': ['error', 'never', { 'enforceForClassMembers': true }],
    'consistent-this': 'off',
    'eol-last': ['error', 'always'], // default
    'func-call-spacing': ['error', 'never'], // default
    'func-name-matching': 'off',
    'func-names': 'off',
    'func-style': 'off',
    'function-call-argument-newline': ['error', 'consistent'],
    'function-paren-newline': ['error', 'multiline-arguments'],
    'id-blacklist': 'off',
    'id-length': 'off',
    'id-match': 'off',
    'implicit-arrow-linebreak': ['error', 'beside'], // default
    'indent': ['error', 2, {'SwitchCase': 1}],
    'jsx-quotes': 'off',
    'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true, 'mode': 'strict' }], // default
    'keyword-spacing': ['error', { 'before': true, 'after': true }], // default
    'line-comment-position': 'off',
    'linebreak-style': ['error', 'unix'], // default
    'lines-around-comment': 'off',
    'lines-between-class-members': 'off',
    'max-depth': ['error', { 'max': 4 }], // default
    'max-len': 'off', // enforced by 'vue/max-len'
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'max-nested-callbacks': ['error', { 'max': 7 } ],
    'max-params': ['error', { 'max': 7 }],
    'max-statements': 'off',
    'max-statements-per-line': 'off',
    'multiline-comment-style': 'off',
    'multiline-ternary': ['error', 'always-multiline'], // default
    'new-cap': 'off',
    'new-parens': ['error', 'always'], // default
    'newline-per-chained-call': ['error', { 'ignoreChainWithDepth': 2 }], // default
    'no-array-constructor': 'off',
    'no-bitwise': 'off',
    'no-continue': 'off',
    'no-inline-comments': 'off',
    'no-lonely-if': 'error', // default
    'no-mixed-operators': 'off',
    'no-mixed-spaces-and-tabs': 'error',
    'no-multi-assign': 'error',
    'no-multiple-empty-lines': ['error', { 'max': 1 }],
    'no-negated-condition': 'off',
    'no-nested-ternary': 'off',
    'no-new-object': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',
    'no-tabs': ['error', { 'allowIndentationTabs': false }], // default
    'no-ternary': 'off',
    'no-trailing-spaces': ['error', { 'skipBlankLines': false, 'ignoreComments': false }], // default
    'no-underscore-dangle': 'off',
    'no-unneeded-ternary': 'error' ,
    'no-whitespace-before-property': 'error',
    'nonblock-statement-body-position': 'off',
    'object-curly-newline': ['error', { 'consistent': true }], // default
    'object-curly-spacing': ['error', 'always'],
    'object-property-newline': 'off',
    'one-var': 'off',
    'one-var-declaration-per-line': 'off',
    'operator-assignment': ['error', 'always'], // default
    'operator-linebreak': 'off',
    'padded-blocks': ['error', 'never'],
    'padding-line-between-statements': 'off',
    'prefer-exponentiation-operator': 'off',
    'prefer-object-spread': 'error',
    'quote-props': ['error', 'as-needed'],
    'quotes': [
      'error',
      'single',
      { 'allowTemplateLiterals': true, 'avoidEscape': false },
    ],
    'semi': ['error', 'always'], // default
    'semi-spacing': ['error', {'before': false, 'after': true}], // default
    'semi-style': ['error', 'last'], //default
    'sort-keys': 'off',
    'sort-vars': 'off',
    'space-before-blocks': 'off',
    'space-before-function-paren': ['error', 'never'],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', {'words': true, 'nonwords': false}],
    'spaced-comment': ['error', 'always'],
    'switch-colon-spacing': ['error', {'after': true, 'before': false}],
    'template-tag-spacing': 'error',
    'unicode-bom': 'off',
    'wrap-regex': 'off',

    // Enabled Non-Stylistic ESLint Rules:
    'arrow-parens': ['error', 'as-needed'],
    'arrow-spacing': ['error', { 'before': true, 'after': true }], // default
    'block-scoped-var': 'error',
    'dot-notation': 'error',
    'no-duplicate-imports': 'off',
    'no-else-return': ['error', {'allowElseIf': true}],
    'no-eq-null': 'error',
    'no-multi-spaces': ['error', { 'ignoreEOLComments': false }],
    'no-throw-literal': 'error',
    'no-useless-return': 'error',
    'prefer-template': 'error',

    // Disabled Non-Stylistic ESLint Rules:
    'arrow-body-style': 'off',
    'class-methods-use-this': 'off',
    'consistent-return': 'off',
    'default-case': 'off',
    'guard-for-in': 'off',
    'init-declarations': 'off',
    'no-empty-function': 'off',
    'no-invalid-this': 'off',
    'no-magic-numbers': 'off',
    'no-param-reassign': 'off',
    'no-process-env': 'off',
    'no-prototype-builtins': 'off',
    'no-script-url': 'off',
    'no-sequences': 'off',
    'no-undefined': 'off',
    'no-unused-expressions': 'off',
    'no-use-before-define': 'off',
    'no-useless-escape': 'off',
    'no-warning-comments': 'off',
    'object-shorthand': 'off',
    'prefer-arrow-callback': 'off',
    'prefer-rest-params': 'off',
    'sort-imports': 'off',
    'vars-on-top': 'off',
    'wrap-iife': 'off',
  }
}
