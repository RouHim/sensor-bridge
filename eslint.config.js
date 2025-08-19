import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      // Error prevention (catches issues like duplicate functions)
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-duplicate-imports': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      
      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      
      // Async/Promise best practices  
      'no-async-promise-executor': 'error',
      'require-await': 'warn',
      
      // Import/Export
      'no-undef': 'error',
      
      // Style consistency (matching existing project style)
      'indent': ['error', 4], // Project uses 4-space indentation
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      
      // Prevent common mistakes
      'no-console': 'off', // Allow console for debugging
      'no-debugger': 'warn',
      'no-alert': 'warn'
    }
  }
];