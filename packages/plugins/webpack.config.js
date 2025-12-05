const HtmlWebpackPlugin = require('html-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const path = require('path');

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    static: path.join(__dirname, 'public'),
    port: 3002, // <--- Port 3002
    headers: { "Access-Control-Allow-Origin": "*" },
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: "babel-loader",
        options: {
          presets: [
            require.resolve("@babel/preset-env"),
            require.resolve("@babel/preset-react"),
          ],
        },
        exclude: (modulePath) =>
          modulePath.includes("node_modules") &&
          !modulePath.replace(/\\/g, "/").includes("/@music-studio/"),
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.js$/,
        loader: "babel-loader",
        type: "javascript/auto",   // <-- The key
        options: {
          presets: [
            require.resolve("@babel/preset-env"),
            require.resolve("@babel/preset-react")
          ],
        },
      }
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'plugins',
      filename: 'remoteEntry.js',
      exposes: {
         './Delay': './src/Delay',
        './Reverb': './src/Reverb', // Expose the Reverb Module
      },
      shared: {
        react: { singleton: true, requiredVersion: false },
        'react-dom': { singleton: true, requiredVersion: false },
        '@music-studio/shared': { singleton: true, requiredVersion: false },
      },
    }),
    new HtmlWebpackPlugin({ template: './public/index.html' }),
  ],
};