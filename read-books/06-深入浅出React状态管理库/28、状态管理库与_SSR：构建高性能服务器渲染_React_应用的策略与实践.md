本节我们会介绍 SSR 的基本概念，并从 0-1 手动搭建一个极简版的 SSR Demo，基于这个 Demo 之上我们会演示状态管理库与 SSR 结合时会遇到什么样的问题，以及如何解决。接下来让我们一起来看一下当状态管理库遇到 SSR 会碰撞出什么样的火花吧。

# SSR

## 服务端渲染 (SSR，Server Side Rendering) 概念

当我们谈到服务端渲染时我们不得不首先介绍一下客户端渲染（CSR，Client Side Rendering），CSR 指拿到的 HTML 只有基本的框架，并没有实际的内容。也就是说你请求到的 HTML 可能是这样的：


```js
<!DOCTYPE html>
<html>
  <body>
    <div id="root"></div>
    <script src="/static/js/bundle.js"></script>
  </body>
</html>
```

即我们收到的 HTML 只包含了一个空的 div 标签。用户一开始是白屏的，然后会下载并解析 JS，然后此时会渲染出来一个骨架屏，也就是我们经常看到的加载中的 UI，然后浏览器继续请求数据，等到数据请求回来之后渲染到页面上。我们可以用一个图来表示这个过程：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ff8ba1d496074ea78258ce02c2d13836~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1106&h=1284&s=106329&e=png&b=ffffff" alt="image.png" width="80%" /></p>

试想一下这个过程会有什么问题？

- SEO 不友好，由于 CSR 前端的内容都是 JS 来渲染的，因此爬虫爬到的都是空的 HTML。
- 首屏时延较长，在上图中可以看到，在请求回 JS 文件并加载之前用户看到的都是白屏的页面。

**那 SSR 是什么呢？**

我们上面说 CSR 拿到的 HTML 是空白的，而 SSR 拿到的则是完整的 HTML 内容。

首先用户向服务端发出请求后，服务端（通常是 Node 层）会向后端做数据请求，接下来会使用 React Api `renderToString` 渲染出完整的 HTML 并返回给前端，前端当读到 script 标签时会去请求 JS 文件，最后等到 JS 文件返回并加载后会完成 hydration 的过程，用图来表示整个过程：



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/271e6d5e770c4175b589e748e6eb4f2e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1394&h=1260&s=135498&e=png&b=ffffff" alt="image.png" width="90%" /></p>

什么是 hydration 呢，让我们来看看 [Dan](https://github.com/gaearon) 怎么说吧：

> Hydration is like watering the “dry” HTML with the “water” of interactivity and event handlers.
> 
> 水合作用就像用交互性和事件处理程序的“水”浇灌“干”的 HTML。

用人话说是什么意思呢，就是说虽然 Node 中间层给我们返回了 HTML，但是此时还没有为 DOM 节点绑定交互事件，也就是说此时页面是不可被交互的，经过 hydration 之后整个应用从不可被交互变成了可交互了，我们可以看一个例子：

hydration 以前：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/af629380d7384023891ebc020c00bb14~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=152&h=116&s=39063&e=gif&f=37&b=faf9fc" alt="20240616084326_rec_.gif" width="20%" /></p>

也就是说此时点击按钮并没有反应。

hydration 之后：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5f1b73fbf50e47eb908aa0df98b7021e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=152&h=112&s=30054&e=gif&f=31&b=faf9fc" alt="20240616084227_rec_.gif" width="20%" /></p>


虽然说 SSR 对首屏更友好以及有利于 SEO 的特点，但是同时我们引入了 Node 中间层，这意味着我们需要有更高的开发成本，以及服务器资源的成本。接下来让我们手写一个 SSR 应用。


## 手写一个 SSR



为了方便大家理解状态管理库与 SSR 之间的关系，我们准备了一个极简 SSR 例子，该例子会使用 Koa 作为 Node 中间层来渲染 SSR，如果你没接触过 Koa 也没关系，本案例非常简单。完整代码参见仓库：https://github.com/L-Qun/state-management-collection/tree/main/examples/ssr/simple-ssr-demo

整个项目的目录结构如下：


```js
simple-ssr-demo       
├─ config   
├─ client      
├─ server       
├─ package-lock.json       
└─ package.json     
```

其中：

- `config`：webpack 相关配置放置的目录。
- `client`：客户端的代码放置的目录。
- `server`：服务端相关代码放置的目录。

首先我们需要安装相关的依赖：


```js
npm i react react-dom koa koa-static
npm i @babel/preset-env @babel/preset-react babel-loader webpack webpack-cli -D
```

其中：

- react react-dom 用来编写 React 相关代码。
- koa 用来编写 Node 中间层。
- koa-static 是一个用于 koa 框架的中间件，用来为 koa 应用提供静态文件服务，这样我们就可以在客户端来拿到打包好的 JS 资源。
- webpack webpack-cli 用于打包。
- @babel/preset-env @babel/preset-react babel-loader 用来把 React 代码转换为浏览器兼容的 JavaScript 代码。


接下来我们来实现一下 webpack 配置部分，由于我们项目中包含了客户端部分和服务端部分，因此我们需要区分不同的 webpack 配置，我们在这里分别用 `webpack.client.config.js` 和 `webpack.server.config.js` 文件来配置。

路径相关的配置放到了 `path.js` 文件：


```js
// config/paths.js
const path = require('path')

const resolve = (...args) => path.resolve(__dirname, '..', ...args)

const paths = {
  clientOutputPath: resolve('build/client'),
  serverOutputPath: resolve('build/server'),

  clientEntryPath: resolve('client/index.js'),
  serverEntryPath: resolve('server/index.js'),
}

module.exports = paths
```

共同配置部分放到了 `webpack.base.config.js` 文件中：

```js
// config/webpack.base.config.js
const mode = process.env.NODE_ENV || 'development'

module.exports = {
  mode,
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
}
```

客户端代码打包配置：

```js
// config/client
const paths = require('./paths')
const base = require('./webpack.base.config')

module.exports = {
  ...base,
  name: 'client',
  target: 'web',
  entry: paths.clientEntryPath,
  output: {
    path: paths.clientOutputPath,
    filename: '[name].js',
    publicPath: '/',
  },
}
```

客户端代码入口在 `client/index.index` 中，打包输出到 `build/client` 目录下。

服务端代码打包配置：

```js
// config/server
const paths = require('./paths')
const base = require('./webpack.base.config')

module.exports = {
  ...base,
  name: 'server',
  target: 'node',
  entry: paths.serverEntryPath,
  output: {
    path: paths.serverOutputPath,
    filename: '[name].js',
    publicPath: '/',
  },
}
```

服务端代码入口在 `server/index.index` 中，打包输出到 `build/server` 目录下。

然后我们需要在 `package.json` 中增加打包的命令：


```js
"scripts": {
  "build:server": "webpack --config config/webpack.server.config.js",
  "build:client": "webpack --config config/webpack.client.config.js",
  "start": "npm run build:client && npm run build:server && node build/server/main.js"
},
```

当我们执行 `build:server` 时对应打包服务端代码，执行 `build:client` 时打包客户端代码，最后我们用 `start` 将它们串联起来并启动应用。

接下来我们来实现业务代码，首先我们需要创建一个 Koa 服务器，用于提供静态文件服务和处理 SSR 渲染，监听在 3000 端口：


```js
// server/index.js
import Koa from 'koa'
import serve from 'koa-static'
import path from 'path'

import renderer from './renderer'

const app = new Koa()

// 提供静态文件服务
app.use(serve(path.resolve(__dirname, '../client')))

// 处理 SSR 渲染
app.use(renderer)

app.listen(3000, () => {
  console.log('服务监听在3000端口')
})
```


接下来我们来实现 SSR 渲染逻辑以及客户端代码，我们上面讲了 SSR 的基本流程，我们可以对这个流程抽象简化成下图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/76942b2eddbd45d3a44eb8b6ac02e59e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1272&h=1248&s=91730&e=png&b=ffffff" alt="image.png" width="70%" /></p>


也就是说：

- 在 SSR 渲染逻辑中我们需要准备数据、`renderToString` 渲染、填充 HTML 并返回。
- 在客户端需要调用 React 的 `hydrateRoot` 逻辑完成 hydration 过程。



首先我们编写一下 `renderer` 函数：

```js
// renderer
import { renderToString } from 'react-dom/server'

import App from '../client/App'

const renderer = async (ctx) => {
  // 渲染
  const htmlMarkup = renderToString(<App />)

  // 插入并返回 HTML
  ctx.body = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div id="root">${htmlMarkup}</div>
        <script src="/main.js"></script>
      </body>
    </html>
  `
}

export default renderer
```


接下来我们来编写一下客户端代码：


```js
// client/index.js
import { hydrateRoot } from 'react-dom/client'
import App from './App'

hydrateRoot(document.getElementById('root'), <App />)
```


```js
// client/App.js
import { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <>
      <div>count: {count}</div>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </>
  )
}
```
我们来看一下效果：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85a521b9096749f19993ff7d99ca8636~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=172&h=108&s=29849&e=gif&f=27&b=fbfafd" alt="20240616042133_rec_.gif" width="20%" /></p>

然后我们打开 Chrome DevTools Preview 可以看到是有内容的：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5fc15df05a1f492380c7d94720806b7d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=980&h=896&s=88220&e=png&b=fefefe" alt="image.png" width="70%" /></p>

也就是说我们 SSR 成功的返回了内容。

# 状态管理库与 SSR（以 Zustand 为例）

为了演示状态管理库与 SSR 的问题，我们需要对上面的代码进行一些改造，增加在 SSR 过程中获取数据部分：



> 点击查看完整代码：https://github.com/L-Qun/state-management-collection/tree/main/examples/ssr/ssr-issues

```js
import { renderToString } from 'react-dom/server'

import App from '../client/App'
import { useStore } from '../client/store'

let count = 0
// 模拟请求延时
const wait = (time) => new Promise((r) => setTimeout(r, time))
const todos = ['吃饭', '睡觉', '打豆豆']
// 在不同的请求中延迟不同
const delayTime = [5000, 3000, 1000]

const renderer = async (ctx) => {
  // 请求数据
  const data = await wait(1000).then(() => todos[count])
  await wait(delayTime[count]) // 模拟其它请求
  useStore.setState({ todo: data }) // 填充 Store

  // 渲染
  const htmlMarkup = renderToString(<App />)

  // 插入并返回 HTML
  ctx.body = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div id="root">${htmlMarkup}</div>
        <script src="/main.js"></script>
      </body>
    </html>
  `
}

export default renderer
```

在这部分我们通过 `wait` 函数来模拟在 SSR 时获取数据的时延，对于不同的请求我们用 `count` 来标记，并返回不同的 `todo` 数据。比如对于第一次请求，我们返回 `'吃饭'`，第二次请求返回 `'睡觉'`。


试想一下 SSR 应用结合状态管理库会面临什么问题：

**每个请求都需要对应一个 Store**

我们知道通常我们会创建一个 Store 用来存放一些全局的状态，在客户端这通常没有问题，因为在客户端只对应一个用户，Store 就是保存这个用户需要的全部数据。但是在 SSR 的时候这个情况就变得更加复杂了，因为在 SSR 中会有多个用户同时请求服务器，那用同一个 Store 来保存所有用户很显然不合适。

我们在这里通过两个浏览器 Tab 来模拟多个用户同时请求的过程：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/380c306c878f4b0689dcccdb65f5dff1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1108&h=504&s=210786&e=gif&f=134&b=fdfcff" alt="20240616021511_rec_.gif" width="50%" /></p>

可以看到预期来说对于不同的用户先后应该返回`“吃饭”`以及`“睡觉”`，而在上面这个例子中我们可以看到都返回了`“吃饭”`，这很显然是有问题的。

用一个图来表示这个过程：



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/619ad08707e34fe799aa79e49505927b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1652&h=726&s=114576&e=png&b=ffffff" alt="image.png" width="90%" /></p>

整个过程先后顺序是这样的：

- A 和 B 先后请求了服务器，期望获得不同数据的 SSR 页面。
- 接下来服务器收到了请求，先后去异步请求这些数据（这里是 Mock 的）。
- 然后填充 Store “睡觉”。
- 接下来填充 Store “吃饭”。
- 返回 A、B 用户 “吃饭” 对应的 SSR。

也就是说填充和使用 Store 的顺序并不一定与请求的先后完全顺序一致，这也就导致了从用户侧看到的数据可能会存在问题。





**状态需要传递给前端，并在前端填入到 Store 中**

让我们再来通过一个例子来演示这个问题：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/28d8b387e3854e149268043826f58bf8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1064&h=428&s=210635&e=gif&f=184&b=fcfbfe" alt="20240616021732_rec_.gif" width="50%" /></p>

可以看到，首先在页面中展示了吃饭，随后吃饭消失了！这是因为在前端 hydration 的时候会重新渲染一遍，此时 Store 是没有数据的。

---

那我们如何解决这两个问题呢？

- 我们需要为每次请求都创建一个 Store，这样不同的 Store 可以用来存放对应请求的相关数据。同时我们还需要 React Context 来创建 Provider，对于每个请求的 Store 我们通过 React Context 在组件树中进行分发，这样在渲染的过程中无论在组件树中哪个节点都能正确的拿到本次请求对应的 Store。
- 我们需要将数据序列化（serialize）到前端，并填充到 Store 中。

我们根据这些分析来改造一下上面的代码：

> 点击查看完整代码：https://github.com/L-Qun/state-management-collection/tree/main/examples/ssr/ssr-zustand

首先我们需要

- 封装创建 Store 的函数 `createTodoStore`。
- 基于 React Context 分发 Store 的 Provider。
- 在组件中基于分发后 Store 的 Hook。


```js
import { createContext, useRef, useContext } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

// 创建 Store
export const createTodoStore = (todo) => {
  return createStore()((set) => ({
    todo,
  }))
}

// 创建 React Context，用来分发 Store
export const TodoStoreContext = createContext(undefined)

// 需要将这个 Provider 包裹在组件外面用来创建 Store、填充数据
export const TodoStoreProvider = ({ children, todo }) => {
  const storeRef = useRef()
  if (!storeRef.current) {
    storeRef.current = createTodoStore(todo)
  }

  return (
    <TodoStoreContext.Provider value={storeRef.current}>
      {children}
    </TodoStoreContext.Provider>
  )
}

// 在组件中使用该 Hook
export const useTodoStore = (selector) => {
  const todoStoreContext = useContext(TodoStoreContext)

  if (!todoStoreContext) {
    throw new Error(`缺少向 TodoStoreProvider 传入 Store`)
  }

  return useStore(todoStoreContext, selector)
}
```

然后我们需要改造一下 `renderer` 函数：


```js
const renderer = async (ctx) => {
  // 请求数据
  const data = await wait(1000).then(() => todos[count])
  await wait(delayTime[count++]) // 模拟其它请求

  // 渲染
  const htmlMarkup = renderToString(
+   <TodoStoreProvider todo={data}>
      <App />
+   </TodoStoreProvider>,
  )

  // 插入并返回 HTML
  ctx.body = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div id="root">${htmlMarkup}</div>
 +      <script>
 +        window.__STORE__ = ${JSON.stringify({ todo: data })} 
 +      </script>
        <script src="/main.js"></script>
      </body>
    </html>
  `
}
```

可以看到我们增加了 `TodoStoreProvider` 用来传入数据，以及增加了额外的 `script` 用来序列化数据到前端，并挂在 `window.__STORE__` 上，当然你可以替换为任何其它的变量名。最后我们来改造一下前端：


```js
import { hydrateRoot } from 'react-dom/client'
import App from './App'
import { TodoStoreProvider } from './store'

hydrateRoot(
  document.getElementById('root'),
+ <TodoStoreProvider todo={window.__STORE__.todo}>
    <App />
+ </TodoStoreProvider>,
)
```

也就是说我们会从 `window.__STORE__` 拿到数据并填充到 Store 中，

我们来看一下现在的效果：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f9efdde47d134338891d873b862875f7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1104&h=476&s=183857&e=gif&f=115&b=fdfcff" alt="20240616034520_rec_.gif" width="50%" /></p>

可以发现我们现在不会再出现状态出错的问题了，因为我们为每次请求创建了自己的 Store。同时也不会再出现出现在前端 hydration 后状态消失的问题了！

如果我们在控制台打印 `window.__STORE__` 可以看到后端给前端传过来的数据：


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/378687c5080d44ceabfe5adda3de90fb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1740&h=296&s=55894&e=png&b=ffffff)


可以看到对于 Zustand 来说 SSR 比较麻烦，需要做比较多的事情，本质原因还是因为 Zustand 并没有将所有状态集中存放在一起，而是单独存放的，每次在调用 `create` 的时候都会创建单独的 Store。
  


# 总结



本节首先介绍了 SSR 的基本概念，然后带领大家搭建了 SSR 的 Demo。之后以 Zustand 为例讲解了状态管理库遇到 SSR 会遇到什么样的问题，以及如何解决它。

