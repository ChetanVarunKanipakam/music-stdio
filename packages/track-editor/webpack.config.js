const HtmlWebpackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const path = require("path");

module.exports = {
  entry: "./src/index",
  mode: "development",

  output: {
    publicPath: "auto",
  },

  devServer: {
    static: path.join(__dirname, "public"),
    port: 3001,
    historyApiFallback: true,
    headers: { "Access-Control-Allow-Origin": "*" },
  },

  resolve: {
    extensions: [".js", ".jsx"],
    alias: {
      // This forces Webpack to point to the exact same file on disk
      "@music-studio/shared": path.resolve(__dirname, "../shared/src/index.js"),
    },
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
      },{
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
      name: "trackEditor",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
      },
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
        "@music-studio/shared": { singleton: true ,requiredVersion: false},
      },
    }),
    new HtmlWebpackPlugin({ template: "./public/index.html" }),
  ],
};
