jest.mock('@tarojs/taro', () => {
  return require('./tests/mocks/taro').default;
});
