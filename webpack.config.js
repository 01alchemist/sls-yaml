const fs = require("fs-extra");
const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const PrettierPlugin = require("prettier-webpack-plugin");
const pkg = require("./package.json");
const tsConfig = require("./tsconfig.json");

const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";
const isDevMode = mode === "development";
const prodEntries = {
  index: ["./src/index.ts"]
};

const outDir = "dist";
const entries = isDevMode
  ? {
      ...prodEntries,
      index: ["webpack/hot/poll?1000", "./src/index.ts"]
    }
  : prodEntries;

fs.removeSync(path.resolve(__dirname, outDir));

const buildNum = () => {
  if (process.env.CI) {
    const build = `-build[${process.env.CIRCLE_BUILD_NUM}]`;
    if (process.env.CIRCLE_BRANCH === "master") {
      return build;
    }
    if (process.env.CIRCLE_BRANCH === "develop") {
      return `${build}(dev)`;
    }
    return `${build}(pr:${process.env.CIRCLE_PR_NUMBER})`;
  }
  return "-(local)";
};

// Make ts path resolvers for webpack
const { baseUrl } = tsConfig.compilerOptions;
const tsPaths = tsConfig.compilerOptions.paths;
const resolvedTsPaths = {};
Object.keys(tsPaths).forEach(pathName => {
  const [tsPath] = tsPaths[pathName];
  let cleanPathName = pathName.replace(/\*/gi, "");
  cleanPathName =
    cleanPathName[cleanPathName.length - 1] === "/"
      ? cleanPathName.substring(0, cleanPathName.length - 1)
      : cleanPathName;
  const resolvedPath = path.resolve(
    __dirname,
    baseUrl,
    tsPath.replace(/\*/gi, "")
  );
  resolvedTsPaths[cleanPathName] = resolvedPath;
});

console.info("TypeScript resolved paths");
console.info("👇");
console.info(resolvedTsPaths);

module.exports = {
  target: "node",
  mode,
  node: {
    __dirname: false,
    __filename: false
  },
  context: __dirname,
  entry: entries,
  externals: [
    nodeExternals({
      whitelist: ["webpack/hot/poll?1000"]
    })
  ],
  devtool: "source-map",
  optimization: {
    minimize: false
  },
  devServer: {
    hot: true,
    contentBase: path.resolve(__dirname),
    publicPath: "/"
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      ...resolvedTsPaths
    }
  },
  plugins: [
    ...(isDevMode ? [] : [new CleanWebpackPlugin()]),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(pkg.version + buildNum())
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.NamedModulesPlugin(),
    new PrettierPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          transpileOnly: false
        }
      }
    ]
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, outDir),
    devtoolModuleFilenameTemplate(info) {
      return path.resolve(__dirname, encodeURI(info.resourcePath));
    },
    library: "[name]",
    libraryTarget: "umd"
  }
};
