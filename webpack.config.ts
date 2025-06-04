import fs from "fs";
import path from 'path';
import webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import ZipPlugin from "zip-webpack-plugin";
import LicensePlugin from "webpack-license-plugin";
import ReactRefreshTypeScript from 'react-refresh-typescript';

const MANIFEST = JSON.parse(fs.readFileSync(path.join(process.cwd(), "./public", "manifest.json"), "utf8"));

const PUBLIC_PATH = "/";

const alias = {
  css: path.resolve(process.cwd(), "src/stylesheets"),
};

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

const isDevelopment = process.env.NODE_ENV !== "production";

const config: webpack.Configuration = {
  mode: (process.env.NODE_ENV === "production" ? "production" : "development"),

  entry: {
    background: path.join(process.cwd(), "src", "lib", "Background.ts"),
    content: path.join(process.cwd(), "src", "lib", "Content.ts"),
    settings: path.join(process.cwd(), "src", "settings", "index.tsx"),
    main: path.join(process.cwd(), "src", "panel", "index.tsx"),
  },

  output: {
    filename: "[name].bundle.js",
    path: path.resolve(process.cwd(), 'build'),
    clean: true,
    publicPath: PUBLIC_PATH,
  },

  module: {
    rules: [
      {
        test: /\.module.css$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              esModule: true,
              modules: {
                namedExport: false,
                exportLocalsConvention: "camel-case-only"
              },
            },
          }
        ],
        exclude: /node_modules/,
      },
      {
        test: new RegExp('.(' + fileExtensions.join('|') + ')$'),
        type: "asset/resource",
        exclude: /node_modules/,
        loader: "file-loader",
        options: {
          name: "[path][name].[ext]",
        },
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        // loader: "ts-loader",
        use: [
          {
            loader: "ts-loader",
            options: {
              getCustomTransformers: () => ({
                before: [isDevelopment && ReactRefreshTypeScript()].filter(
                  Boolean
                ),
              }),
              transpileOnly: isDevelopment,
            },
          },
        ],
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "source-map-loader",
          },
          {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env"],
                ["@babel/preset-react"]
              ],
              plugins: [
                !isDevelopment && ["@babel/plugin-transform-react-jsx", { "runtime": "automatic" }],
                isDevelopment && ["@babel/plugin-transform-react-jsx-development", { "runtime": "automatic" }],
                isDevelopment && ["react-refresh/babel"],
              ].filter(Boolean),
            },
          },
        ],
      },
    ],
  },
  resolve: {
    alias: alias,
    extensions: fileExtensions
      .map((extension) => "." + extension)
      .concat([".js", ".jsx", ".ts", ".tsx", ".css"]),
  },
  plugins: [
    isDevelopment && new ReactRefreshWebpackPlugin(),
    new CleanWebpackPlugin({ verbose: false }),
    new webpack.ProgressPlugin(),
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
    new ZipPlugin({
      filename: `${MANIFEST.name}-${MANIFEST.version}.zip`,
      path: path.join(process.cwd(), ".output"),
    }),
    // new LicensePlugin({
    //   outputFilename: "licenses.json",
    // }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(process.cwd(), "public"),
          to: path.join(process.cwd(), 'build'),
          force: true,
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: path.join(process.cwd(), "src", "panel", "panel.html"),
      filename: "panel.html",
      chunks: ["main"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(process.cwd(), "src", "settings", "settings.html"),
      filename: "settings.html",
      chunks: ["settings"],
      cache: false,
    }),
  ].filter(Boolean),
  infrastructureLogging: {
    level: "info",
  },
  performance: {
    hints: isDevelopment && false,
  }
};

if (process.env.NODE_ENV === "development") {
  config.devtool = "source-map";
} else {
  config.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        // terserOptions: {
        //   format: {
        //     comments: false,
        //   },
        // },
      }),
    ],
    splitChunks: {
      chunks: "async",
      minSize: 20000,
      minRemainingSize: 0,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        core: {
          test: /[\\/]node_modules[\\/](@babel|@ungap|property-information|trough|css-loader|style-to|react[/])/,
          name: "core",
          chunks: "all",
        },
        // style: {
        //   test: /\.module.css$/,
        //   name: "style",
        //   chunks: "all",
        // },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  };
}

export default config;