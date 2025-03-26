在本章节中我们一起来实现项目的搭建部分，👉戳：[项目地址](https://github.com/q-u-n/state-management-collection)。

由于我们会实现多个包，因此采用 `monorepo` 的方式来管理所有包的实现，方便大家学习以及复用相关配置。



## 目录结构

```js
.
├── .changeset // Changesets 配置，后面章节会介绍
├── .github // github配置项，包含了CI配置
│   └── workflows
├── examples // 一些事例
│   ├── jotai
│   ├── react-query
│   ├── valtio
│   └── zustand
├── packages // monorepo包入口
│   ├── jotai
│   ├── react-query
│   ├── shared // 公共包
│   ├── valtio
│   └── zustand
├── website // 文档站
├── .eslintignore
├── .eslintrc.json
├── .gitignore
├── .prettierignore
├── babel.config.js
├── jest.config.ts // jest配置项
├── jest.preset.js // jest预设值
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.MD
├── rollup.config.js
└── tsconfig.json
```

上面包含了整个项目的目录项，接下来我们依次对各个重要配置项进行介绍。


## Typescript 配置

首先在根目录配置统一的 `tsconfig.json` 文件：


```js
{
  "compilerOptions": {
    "module": "esnext", // 使用最新的 JavaScript 标准模块语法
    "esModuleInterop": true, // 实现对非 ECMAScript 模块（例如，CommonJS 模块）的默认导入
    "strict": true, // 启用所有严格类型检查选项，有助于发现潜在的类型错误，提高代码质量
    "target": "esnext", // 编译后的 JavaScript 代码的 ECMAScript 目标版本
    "moduleResolution": "bundler", // 指定了模块解析策略，这里目的是希望交由 rollup 来配置
    "noEmit": true, // 执行类型检查，但不会输出任何编译后的代码，因为编译交由 rollup 来做了
    "jsx": "react-jsx" // 指定了如何处理 JSX 语法
  }
}
```

然后在每个子包的 `tsconfig.json` 文件继承根目录配置文件，例如 zustand：


```js
{
  "extends": "../../tsconfig.json", // 继承根目录配置文件
  "compilerOptions": { // 编译选项
    "paths": { // 设置应用别名
      "zustand": ["./src/index.ts"],
      "zustand/*": ["./src/*.ts"],
    },
  },
  "include": ["src"], // 限定类型检查范围
}
```

我们这里可以借助 `tsc` 来进行类型的检查，同时因为开启了 noEmit 不会输出任何编译后的代码，在各个子包的 `package.json` 中增加以下配置：


```js
"scripts": {
  "typecheck": "tsc"
},
```

同时为了方便一键完成全部子包的检查，我们在根目录下的 `package.json` 文件中增加命令：


```js
"scripts": {
  "typecheck:ci": "pnpm -r --parallel run typecheck",
},
```

其中 `-r` 代表命令将递归地在所有子包中执行，`--parallel` 代表所有子包中的 `typecheck` 命令将并行执行，而不是依次执行。这可以加快整个过程。

  

## Rollup 配置

通常在一个 JavaScript 库会包含以下几种格式的打包产物，以满足不同开发者的需求：

-  TypeScript 定义（`.d.ts`文件）
-  UMD（Universal Module Definition）
-  CJS（CommonJS）
-  MJS（ECMAScript 模块）

因此，在 Rollup 配置时我们需要确保打包出的产物包含上述四种，同时在各个包的 `package.json` 中 `exports` 字段正确配置：


```js
"exports": {
  ".": {
    "import": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.mjs"
    },
    "require": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.cjs"
    }
  }
},
```

也就是说，当用 `import` 形式导入内容时应该去 `./dist/index.mjs` 目录下索引，如果通过 `require` 形式导入内容时则去 `./dist/index.cjs` 目录下索引。

由于项目是一个 monorepo 形式来组织 zustand、jotai、valtio、react-query 实现，因此我们需要一种手段来控制分别打包各个子包：


```js
"scripts": {
  "build:jotai": "rollup -c --package jotai",
  "build:zustand": "rollup -c --package zustand",
  "build:valtio": "rollup -c --package valtio",
  "build:react-query": "rollup -c --package react-query"
}
```

我们在 `package.json` 中增加了四个命令，分别用来控制打包各个库，其中 `-c` 用来指定 Rollup 打包时所使用的配置文件，默认使用当前目录下名为 `rollup.config.js` 的文件作为配置文件。`--package` 用来动态控制打包哪个包，在 `rollup.config.js` 中可以正确根据不同的参数来控制打包哪个包：


```js
// rollup.config.js
module.exports = (args) => {
  console.log(args.package); // jotai
}
```

为了方便一键执行全部打包命令，我们借助 [concurrently](https://github.com/open-cli-tools/concurrently)：


```js
"build": "concurrently 'pnpm:build:*'",
```

即运行 `pnpm run build` 会同时运行 `package.json` 文件中所有以 `build:` 开头的 `scripts` 脚本，完成 zustand、jotai、valtio、react-query 的打包。


接下来让我们正式开始配置 `rollup.config.js` 文件：


```js
function createDeclarationConfig(input, output) {
  return {
    input: `${input}/src/index.ts`,
    output: {
      dir: output,
    },
    plugins: [],
  }
}

function createESMConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'esm' },
    plugins: [],
  }
}

function createCommonJSConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'cjs' },
    plugins: [],
  }
}

function createUMDConfig(input, output, name) {
  return {
    input,
    output: { file: output, format: 'umd', name },
    plugins: [],
  }
}



module.exports = (args) => {
  const packageName = args.package

  const input = `packages/${packageName}`
  const output = `packages/${packageName}/dist`

  return [
    createDeclarationConfig(input, output),
    createESMConfig(`${input}/src/index.ts`, `${output}/index.mjs`),
    createCommonJSConfig(`${input}/src/index.ts`, `${output}/index.cjs.js`),
    createUMDConfig(
      `${input}/src/index.ts`,
      `${output}/index.umd.js`,
      packageName,
    ),
  ]
}
```

在 `rollup.config.js` 导出了一个函数，该函数返回了一个数组，用于生成多个不同类型的构建产物。同时我们创建了四个函数，用来分别对应生成 TypeScript 定义、UMD、CJS、MJS 产物。然后我们根据 `package` 输入项来控制打包入口 `input` 和打包产物输入路径 `output`。

最后让我们完善 `plugin` 部分，`plugin` 增强了 Rollup 的功能，并使得构建过程更加灵活和强大，我们来简单介绍一下几个用到的 plugin。

- `rollup-plugin-dts`：用于处理 TypeScript 的类型声明文件（`*.d.ts`）。
- `@rollup/plugin-node-resolve`：用于帮助 Rollup 解析第三方模块的导入。在 JavaScript 中，当你使用 `import` 语句导入模块时，需要一个机制来定位和加载这些模块。
- `@rollup/plugin-babel`：用于集成 Babel 编译器到 Rollup 打包过程。
- `@rollup/plugin-commonjs`：主要作用是将 CommonJS 模块转换为 ES6 模块。这个插件对于处理那些以 CommonJS 格式编写的第三方模块（通常是在 Node.js 环境中使用的模块）非常有用。


```js
const createBabelConfig = require('./babel.config.js')
const resolve = require('@rollup/plugin-node-resolve')
const babelPlugin = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const { dts } = require('rollup-plugin-dts')

const extensions = ['.ts', '.tsx']

function getBabelOptions() {
  return {
    ...createBabelConfig,
    extensions,
    babelHelpers: 'bundled',
    comments: false,
  }
}

function createDeclarationConfig(input, output) {
  return {
    input,
    output: {
      file: output,
      format: 'es',
    },
    plugins: [dts()],
  }
}

function createESMConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'esm' },
    plugins: [
      resolve({ extensions }),
      commonjs(),
      babelPlugin(getBabelOptions()),
    ],
  }
}

function createCommonJSConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'cjs' },
    plugins: [
      resolve({ extensions }),
      commonjs(),
      babelPlugin(getBabelOptions()),
    ],
  }
}

function createUMDConfig(input, output, name) {
  return {
    input,
    output: { file: output, format: 'umd', name },
    plugins: [
      resolve({ extensions }),
      commonjs(),
      babelPlugin(getBabelOptions()),
    ],
  }
}
```

同时，我们也需要增加一个 `babel.config.js` 文件：


```js
module.exports = {
  babelrc: false,
  ignore: ['/node_modules/'],
  presets: [['@babel/preset-env', { loose: true, modules: false }]],
  plugins: [
    [
      '@babel/plugin-transform-react-jsx',
      {
        runtime: 'automatic',
      },
    ],
    ['@babel/plugin-transform-typescript', { isTSX: true }],
  ],
}
```

我们来分别解释每个选项的作用：

- `babelrc: false`：告诉 Babel 不要使用任何外部的`.babelrc`配置文件，从而避免配置冲突。
- `ignore: ['/node_modules/']`：指定了 Babel 应该忽略的文件路径，通常情况下 `node_modules` 目录包含第三方库，这些库通常已经被编译，不需要 Babel 再次编译。
- `presets`：Babel 预设的集合，用于告诉 Babel 使用哪些特性。其中：`@babel/preset-env` 会根据你的目标环境（比如特定版本的浏览器或Node.js）自动决定哪些 JavaScript 新特性需要被转换，哪些可以保留。这意味着它可以避免不必要的转换，使得最终的代码更加精简和高效。
  - `loose: true`：这个选项会启用“宽松”模式，生成的代码会更简洁、更快
  - `modules: false`：这个选项阻止 Babel 将 ES6 模块语法转换为其他模块类型（如 CommonJS），这里会交由 Rollup 来处理。

- `plugins`：定义了一组 Babel 插件，用于转换特定的 JavaScript 特性或语法。其中：
  - `@babel/plugin-transform-react-jsx`：这个插件用于转换 JSX 语法（通常用于 React）。`runtime: 'automatic'`选项自动导入必要的 JSX 转换而不需要手动导入 React。
  - `@babel/plugin-transform-typescript`：这个插件添加了对 TypeScript 的支持。`isTSX: true`指定插件应该支持 TSX 文件（TypeScript 中的 JSX）。



## Jest 配置

Jest 是一个流行的 JavaScript 测试框架，在项目中会使用 Jest 来完成全部测试，在本节中我们先完成 Jest 的基本配置。

类似上面的 typescript 配置，我们在根目录下定义 `jest.preset.js` 文件，用来在各个子目录的 Jest 配置文件中重用：


```js
const config = {
  testMatch: ['**/__tests__/**/*.[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'jsdom',
  testTimeout: 35000,
}

module.exports = config
```

然后，在各个子包下配置 `jest.config.ts` 文件继承根目录 `jest.preset.js` 文件：

```js
export default {
  displayName: 'zustand',
  preset: '../../jest.preset.js',
}
```

最后，我们在根目录下配置 `jest.config.ts` 文件：


```js
export default {
  projects: [
    '<rootDir>/packages/zustand',
    '<rootDir>/packages/jotai',
    '<rootDir>/packages/valtio',
    '<rootDir>/packages/react-query',
  ], // Jest 会同时处理 projects 中指定的所有项目
}
```

`projects` 选项允许你同时运行多个不同项目中的测试，非常适合在 Monorepo 结构中使用。



最后我们在根目录 `package.json` 文件中配置测试命令：


```js
"scripts": {
  "test": "jest --passWithNoTests --config jest.config.ts"
},
```

其中，`--passWithNoTests` 避免当没有任何测试项时报错，`--config` 指定 Jest 的配置文件。




##  持续集成（CI）

持续集成（CI）的主要目标是在每次代码提交后，自动执行构建和测试流程，以迅速发现集成过程中的错误。这种实践通过提前捕获问题，大大提升了软件的质量和稳定性。

在这个框架下，`GitHub Actions` 作为一个集成的 CI/CD 解决方案，提供了自动化这一流程的工具。它允许开发者根据特定事件（如推送或拉取请求）定制化工作流程，自动执行构建、测试和部署任务，从而使持续集成的实施变得更加简便和高效。

1. 创建 `.github/workflows` 目录。
2. 在 `.github/workflows` 目录下创建文件：
- `test.yml`：用于跑各个包的单元测试；
- `lint-and-type.yml`：用于执行类型、Eslint 和 Prettier 检验。
3. 编写文件内容：

`test.yml`：

```yml
name: ci # workflow名称，用来在 GitHub Actions 界面中标识不同的 workflow

on: # 定义了触发工作流的事件
  push:
    branches: [main] # 代码推送到 main 分支触发
  pull_request:
    types: [opened, synchronize] # PR 时首次被创建（open）以及有新的提交（synchronize）时触发

jobs:
  test:
    runs-on: ubuntu-latest # 指定运行环境，意味着该 job 会在 GitHub 托管的最新的 Ubuntu Linux 环境下运行
    steps:
      - name: Checkout
        uses: actions/checkout@v4 # 用来将代码库的最新版本下载到 workflow 的运行的环境中
      - name: Setup pnpm
        uses: pnpm/action-setup@v2 # 设置 pnpm
        with:
          version: 8 # 使用8版本
      - name: Setup Node
        uses: actions/setup-node@v4 # 设置nodejs环境并配置pnpm缓存
        with:
          node-version: '18'
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile --prefer-offline # 安装依赖
      - name: Run Tests
        run: pnpm run test # 跑单元测试脚本
```


其中，`uses` 关键字用于指定要在步骤中使用的 Action。这可以是一个公开的 [Actions](https://github.com/marketplace?type=actions)（例如 `actions/checkout@v4`），也可以是创建属于你的 [Actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions)。


`lint-and-type.yml`：

```yml
name: lint

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile --prefer-offline
      - name: Prettier
        run: pnpm run prettier:ci
      - name: Lint
        run: pnpm run eslint:ci
      - name: Type
        run: pnpm run typecheck
```

这部分和上面基本类似，不同点在于 `lint-and-type.yml` 会分别进行 Prettier、Lint 和 Type 检验。

4. 推送代码到 `main` 分支，点击 Actions 按钮可以看到历史触发的所有工作流：


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0165ff6306b741ef89aefdb044a28409~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2872&h=1364&s=338436&e=png&b=ffffff)

5. 点击左侧，可以看具体某个 workflow 对应的所有历史执行情况：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/418db8e4285b4830b0a016619e79cfaf~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2872&h=1250&s=287984&e=png&b=ffffff)

6. 如果某个 workflow 执行失败希望查看具体运行日志，可以点击对应 commit 的名字，进入到详情页面：


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b3e50f00cf00498d81ee21360c923b4d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2874&h=1206&s=285042&e=png&b=ffffff)



![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39610c1bc0264586abb74984a893e5db~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2878&h=1426&s=238868&e=png&b=ffffff)

7. 点击左侧 Jobs 下的按钮可以查看具体的执行日志：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c990ac8a7cbb41a4bad41b1309b792e8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2876&h=1328&s=186558&e=png&b=25292e)

其中每一个步骤（step）都对应于工作流中定义的一个任务，展开可以看到输出的运行日志：


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef30cb9e5889433f847fb44675346fc5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2066&h=886&s=238143&e=png&b=272b30)




## 总结

在本章节中我们讲解了项目搭建部分，包括 TypeScript 设置、Rollup 打包配置以及 Jest 测试配置。此外，也介绍了如何利用 GitHub Actions 实现项目的 CI 部分，完成项目的单元测试、代码风格和类型检查。


