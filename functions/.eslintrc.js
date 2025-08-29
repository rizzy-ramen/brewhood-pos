module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "quotes": "off",
    "max-len": "off",
    "camelcase": "off",
    "comma-dangle": "off",
    "object-curly-spacing": "off",
    "indent": "off",
    "arrow-parens": "off",
    "no-trailing-spaces": "off",
    "no-unused-vars": "warn"
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
};
