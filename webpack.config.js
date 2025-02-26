const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

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
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
      filename: 'index.html',
      inject: 'head',
      scriptLoading: 'defer'
    }),
    {
      apply: (compiler) => {
        compiler.hooks.compilation.tap('CopyInitLogging', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'CopyInitLogging',
              stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
            },
            (assets) => {
              const source = fs.readFileSync(path.resolve(__dirname, 'src/renderer/init-logging.js'), 'utf8');
              const newAsset = new compiler.webpack.sources.RawSource(source);
              compilation.emitAsset('init-logging.js', newAsset);
            }
          );
        });
      }
    }
  ],
  watch: process.env.NODE_ENV === 'development'
} 