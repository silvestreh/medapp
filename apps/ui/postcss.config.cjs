module.exports = {
  plugins: {
    autoprefixer: {},
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '320px',
        'mantine-breakpoint-sm': '640px',
        'mantine-breakpoint-md': '768px',
        'mantine-breakpoint-lg': '1024px',
      },
    },
  },
};
