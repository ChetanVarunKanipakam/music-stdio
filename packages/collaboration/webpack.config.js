const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const path = require('path');

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    static: path.join(__dirname, 'public'),
    port: 3005,
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
      name: 'collaboration',
      filename: 'remoteEntry.js',
      exposes: {
        './Bridge': './src/Bridge', // The Logic Hook
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        '@music-studio/shared': { singleton: true ,requiredVersion:false},
      },
    }),
  ],
};