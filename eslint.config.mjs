import antfu from '@antfu/eslint-config'

export default antfu(
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
    },
    formatters: true,
    ignores: [
      '.DS_Store',
      '.vscode',
      '*.code-workspace',
      '*.log',
      'node_modules',
      'package-lock.json',
      'eslint.config.mjs',
      'resource/**',
      'types/**',
      'interfaces/**',
      'enums/**',
      //'public/**'
    ],
    rules: {
      // semi: "error",
    },
    stylistic: {
      overrides: {
        // 'style/curly': ['error', 'multi-line', 'consistent'],
        'style/function-call-spacing': ['error', 'never'],
        'style/member-delimiter-style': ['error', {
          multiline: {
            delimiter: 'none',
          },
          multilineDetection: 'brackets',
          overrides: {
            interface: {
              multiline: {
                delimiter: 'none',
              },
            },
          },
          singleline: {
            delimiter: 'semi',
          },
        }],
      },
    },
  },
  {
    files: ['**/*.js', '*.js'], // adjust to your frontend paths
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    }
  }
)
