import unjs from 'eslint-config-unjs'

export default unjs({
  ignores: ['dist', 'node_modules', 'temp'],
  rules: {
    'unicorn/no-anonymous-default-export': 0,
  },
})
