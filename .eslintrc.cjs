module.exports = {
  root: true,
  parser: '@typescript-eslint/parser', // Sử dụng TypeScript parser
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:tailwindcss/recommended',
    'next/core-web-vitals',
  ],
  plugins: [
    'react',
    'react-hooks',
    'jsx-a11y',
    '@typescript-eslint',
    'import',
    'prettier',
    'tailwindcss',
  ],
  rules: {
    'prettier/prettier': 'error', // Hiển thị lỗi nếu Prettier không tuân thủ
    'react/react-in-jsx-scope': 'off', // Không cần import React trong Next.js
    'jsx-a11y/anchor-is-valid': 'off', // Bỏ qua lỗi liên quan đến thẻ <Link> của Next.js
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Không bắt buộc khai báo kiểu trả về
    'tailwindcss/no-custom-classname': 'off', // Bỏ qua lỗi về custom class
    '@typescript-eslint/no-require-import': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
  },
};
