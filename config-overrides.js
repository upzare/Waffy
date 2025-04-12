const { override } = require('customize-cra')

const overrideEntry = (config) => {
  config.entry = {
    main: './src/index',
    popup: './src/popup/index',
    sidepanel: './src/sidepanel/index',
    settings: './src/settings/index',
    background: './src/lib/Background',
    content: './src/lib/Content'
  }

  return config
}

const overrideOutput = (config) => {
  config.output = {
    ...config.output,
    filename: 'static/js/[name].js',
    chunkFilename: 'static/js/[name].js',
  }

  return config
}

module.exports = {
  webpack: (config) => override(overrideEntry, overrideOutput)(config),
}