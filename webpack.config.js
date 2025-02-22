const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/renderer/index.js',
  devtool: 'source-map',
  target: 'electron-renderer',
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: './'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              insert: function insertIntoTarget(element, options) {
                console.log('[Style Loader] Inserting styles');
                document.head.appendChild(element);
              }
            }
          },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                config: path.resolve(__dirname, 'postcss.config.js'),
              }
            },
          }
        ]
      },
      {
        test: /\.(wav|mp3)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/sounds/[name][ext]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  watch: process.env.NODE_ENV === 'development'
} 