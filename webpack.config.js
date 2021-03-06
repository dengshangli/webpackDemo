const path = require('path');
const os = require('os');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const HappyPack = require('happypack');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const { NODE_ENV } = process.env;
const isProd = NODE_ENV === 'production';

function getNetworkIp() {
  let needHost = ''; // 打开的host
  try {
    // 获得网络接口列表
    const network = os.networkInterfaces();
    // eslint-disable-next-line no-restricted-syntax
    for (const dev in network) {
      if ({}.hasOwnProperty.call(network, dev)) {
        const iface = network[dev];
        for (let i = 0; i < iface.length; i += 1) {
          const alias = iface[i];
          if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
            needHost = alias.address;
          }
        }
      }
    }
  } catch (e) {
    needHost = 'localhost';
  }
  return needHost;
}

const config = {
  entry: ['./src/index.js'],
  output: {
    filename: isProd ? 'bundle@[chunkhash].js' : 'bundle.js',
  },
  mode: NODE_ENV,
  devtool: isProd ? 'none' : 'cheap-module-source-map',
  // 让控制台不显示全部构建信息，有错误时才显示
  stats: 'errors-only',
  optimization: {
    // 提取公共文件s
    splitChunks: {
      chunks: 'all', // 默认为async, all代表同步异步导入时都可以提取
    },
    // 开启js代码压缩，生产环境为true
    minimize: !!isProd,
    // 压缩器
    minimizer: [
      // js代码压缩插件,tree-shaking必须使用
      new TerserPlugin({
        // 防止开发环境使用压缩时sourceMap失效，生产环境是去除的
        sourceMap: true,
      }),
      // css代码压缩插件
      new OptimizeCSSAssetsPlugin({
        // 压缩处理器, 默认为 cssnano，webpack内置，不用安装
        // cssnano 将你的 CSS 文件做 多方面的的优化，以确保最终生成的文件 对生产环境来说体积是最小的
        // eslint-disable-next-line global-require
        cssProcessor: require('cssnano'),
        // 压缩处理器的配置
        cssProcessorOptions: { discardComments: { removeAll: true } },
        // 是否展示 log
        canPrint: true,
      }),
    ],
    // Webpack将识别出它认为没有被使用的代码，并在最初的打包步骤中给它做标记,tree-shaking有用
    usedExports: true,
  },
  resolve: {
    alias: {
      // 为某个路径取别名
      '@': path.resolve(__dirname, 'src/'),
    },
    // 在执行import语句时遇到以下文件，后缀时可以省略
    extensions: ['.js', '.jsx'],
  },
  // 必须与HtmlWebpackPlugin配合使用，否则无法使用缓存的文件，只能用dist目录下文件
  devServer: {
    //  __dirname表示当前文件绝对目录，join()用于连接目录
    contentBase: path.join(__dirname, 'dist'),
    // 配置是否启用 gzip 压缩
    compress: true,
    // 端口号
    port: 8080,
    // 启用 webpack 的模块热替换特性
    hot: true,
    // 自动打开浏览器
    open: true,
    // 域名配置，用本机ip
    host: getNetworkIp(),
    // 编译出错的时候，在浏览器页面上显示错误和警告
    overlay: true,
  },
  module: {
    rules: [
      {
        test: /\.(less|css)$/,
        use: ExtractTextPlugin.extract({
          use: [
            // 这里对css不开启模块化，防止 import './style.css' 这种类型的样式失效
            'css-loader',
            'postcss-loader',
            {
              loader: 'less-loader',
              options: {
                sourceMap: true,
              },
            },
          ],
        }),
        // 将css代码识别为有副作用，避免tree-sahking执行全局import 'styles.css'失效
        sideEffects: true,
        // 只编译node_modules文件，不模块化的情况
        include: /node_modules/,
      },
      {
        test: /\.(less|css)$/,
        use: ExtractTextPlugin.extract({
          use: [
            {
              loader: 'css-loader',
              options: {
                // 开启css模块化
                modules: { localIdentName: '[path][name]__[local]--[hash:base64:5]' },
                sourceMap: true,
              },
            },
            'postcss-loader',
            {
              loader: 'less-loader',
              options: {
                sourceMap: true,
              },
            },
          ],
        }),
        // 将css代码识别为有副作用，避免tree-sahking执行全局import 'styles.css'失效
        sideEffects: true,
        // 排除node_modules文件，模块化的情况
        exclude: /node_modules/,
      },
      {
        test: /\.(js|jsx)$/,
        loader: 'happypack/loader?id=js',
        exclude: /(node_modules|bower_components)/,
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              // 表示小于限制大小后图片转化为base64,单位Byte,1024Byte(字节)=1KB
              limit: 10240,
              name: '[name].[ext]',
              outputPath: './assets/',
            },
          },
        ],
      },
    ],
  },
  plugins: [
    // 开启多个线程构建，提升构建速度
    new HappyPack({
      id: 'js',
      loaders: [
        // 自定义loader,增加'use strict'
        // 'force-strict-loader',
        // 因为babel-loader已经有缓存功能，所以不再使用
        // 'cache-loader',
        {
          loader: 'babel-loader',
          options: {
            // 缓存编译文件，提升第二次构建速度，缓存文件：node_modules/.cache/babel-loader
            cacheDirectory: true,
          },
        },
      ],
    }),
    // 提取css代码
    new ExtractTextPlugin('bundle@[chunkhash].css'),
    // 将js、css代码插入html模板文件中
    new HtmlWebpackPlugin({
      // title: 'Hello World app',
      minify: {
        // 压缩HTML文件
        removeComments: true, // 移除HTML中的注释
        collapseWhitespace: true, // 删除空白符与换行符
        minifyCSS: true, // 压缩内联css
      },
      filename: 'index.html',
      template: path.resolve('public/index.html'),
      // favicon: './src/assets/favicon.ico',
    }),
    // 让控制台显示打包进度
    new ProgressBarPlugin(),
    // 为模块提供中间缓存，缓存默认的存放路径是: node_modules/.cache/hard-source。
    // 首次构建时间没有太大变化，但是第二次开始，构建时间大约可以节约 90%。
    // DellPlugin用于代码拆分，这个插件可以代替DellPlugin
    new HardSourceWebpackPlugin(),
    // 拷贝public里面文件到dist
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: '',
        },
      ],
    }),
  ],
};

if (isProd) {
  // 第二次构建时清除打包文件夹
  config.plugins.push(new CleanWebpackPlugin());
}

module.exports = config;
