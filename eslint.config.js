import unjs from 'eslint-config-unjs'

export default unjs({
  ignores: ['node_modules', '.output', 'static', 'temp'],
  rules: {
    'unicorn/no-anonymous-default-export': 0,
  },
})
