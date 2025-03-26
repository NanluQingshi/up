


本节我们继续来探究 React19 的其它新特性，如果你用过 NextJS，可能下面很多新特性对你来说可能并不陌生，因为 NextJS 早早就把它们嵌入进来了。

首先我们先来聊一下 React 包含了哪些版本。在 NPM 中可以搜索到 [React 版本信息](https://www.npmjs.com/package/react?activeTab=versions)：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ec805646d44a4d338bbafb9d774798d2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1614&h=804&s=119360&e=png&b=ffffff" alt="image.png" width="90%" /></p>

左侧 Version 代表版本号，其中例如 `19.0.0-beta-26f2496093-20240514` 由 `版本号-Tag-Hash-发布时间` 组成，其中 Hash 是根据包内容生成的。

在右侧我们可以看到 Tag 标签包含了很多类别，让我们来分别解释一下这些 Tag 的含义，按照稳定程度先后顺序排列：


- `experimental`：基于 React 仓库主分支来发布的，包含了许多不稳定的功能以及 Api。
- `cancary`：与 `experimental` 类似同样是基于 React 仓库主分支来发布的，但相比于 `experimental` 更加稳定，你可以将 cancary 视为更新更频繁的 `latest` 版本。
- `beta`：这个阶段的版本包含即将发布的功能，但仍在进行测试和改进。通常比 canary 和 experimental 更稳定，但可能还存在一些问题。
- `next`：类似于 beta，但通常表示该版本已经非常接近最终发布，用于最后的调整和优化。
- `rc (Release Candidate)`：这是候选发布版本，意味着版本已经基本稳定，功能完整，主要集中在修复关键 bug 和进行最终测试。这是在正式发布前的最后阶段。
- `latest`：这是 npm 包的默认标签，通常指向最新的稳定版本。当我们安装一个包而没有指定版本号时，npm 会自动选择标记为 `latest` 的版本。

你可以通过 `npm install react@标签` 来指定安装某一 Tag 下的最新版本，例如我想安装 RC：


```js
npm install react@rc
```

此时就可以看到对应版本的 React 被我们安装进来了：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df8e0a11dce849518810e48064389ea1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=954&h=578&s=85461&e=png&b=1e1e1e" alt="image.png" width="70%" /></p>

[最近](https://react.dev/blog/2024/04/25/react-19) React 发布了 19 RC 版本，这意味着离正式发布主版本（`latest`）已经不远了！同时 React 也发布了 [18.3](https://github.com/facebook/react/blob/main/CHANGELOG.md#1830-april-25-2024) 主版本，相比于 18.2 版本增加了一些 Warnings，用来帮助我们更丝滑的升级到 19 版本。

本节让我们一起来看一下 React19 有哪些新特性以及这些新特性会对状态管理库带来哪些影响。


# React19 新特性



![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/40a0919438824ce3b7ba005769b68890~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1458&h=824&s=959456&e=png&b=131819)

我们这里按照 [React Conf 2024](https://www.youtube.com/watch?v=T8TZQ6k4SLE) 的顺序来进行讲解，当然其实还有一些小的优化例如更好的错误提示等等，这里我们只看重要的内容，并包含可以实践的例子。


## Server Actions

Server Actions 允许 Client Component 调用在服务端中执行的异步函数。这句话是什么意思呢，我们先来看一个例子来演示 Server Actions 的优势。

> Demo 代码见仓库：


回忆一下如果没有 Server Actions 我们在提交表单时需要怎么做，首先我们创建 `/api/todos` 路由用来模拟请求 `todos` 数据以及提交表单后更新 `todos` 数据，分别对应 `GET` 和 `POST` 请求：


```js
import { NextResponse } from 'next/server'

const TODOS = [
  { id: 0, text: '吃饭' },
  { id: 1, text: '睡觉' },
]

async function wait() {
  return new Promise((r) => {
    // 等待 1s 钟模拟请求时延
    setTimeout(r, 1000)
  })
}

export const GET = async () => {
  await wait()
  return NextResponse.json({ todos: TODOS })
}

export const POST = async (request) => {
  const formData = await request.formData()
  const todo = formData.get('todo')
  await wait()
  TODOS.push({
    id: TODOS.length,
    text: todo,
  })
  return NextResponse.json({ todos: TODOS })
}
```

然后我们来编写一下客户端逻辑：


```js
'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [todos, setTodos] = useState([])

  useEffect(() => {
    fetch('/api/todos')
      .then((res) => res.json())
      .then(({ todos }) => setTodos(todos))
  }, [])

  async function onSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    
    // 清空表单数据
    event.currentTarget.reset()

    // 提交表单
    const response = await fetch('/api/todos', {
      method: 'POST',
      body: formData,
    })
    const { todos } = await response.json()

    // 更新状态
    setTodos(todos)
  }

  return (
    <main>
      <form onSubmit={onSubmit}>
        <input type="text" name="todo" />
        <button type="submit">提交</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </main>
  )
}
```


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ae3f11c310434b2f9206d385a316bb4c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=396&h=248&s=61539&e=gif&f=39&b=fcfbfe" alt="20240602183545_rec_.gif" width="30%" /></p>

也就是说当应用加载时我们请求 `/api/todos` 来获取初始 `todos` 数据，当点击按钮后提交表单更新 `todos` 状态。

那如果换成 Server Actions 应该怎么写呢？

我们可以新增一个 `action.js` 文件：


```js
'use server'

import { revalidatePath } from 'next/cache'

const TODOS = [
  { id: 0, text: '吃饭' },
  { id: 1, text: '睡觉' },
]

async function wait() {
  return new Promise((r) => {
    // 等待 1s 钟模拟请求时延
    setTimeout(r, 1000)
  })
}

export const getTodos = async () => {
  await wait()
  return TODOS
}

export const formAction = async (formData) => {
  const todo = formData.get('todo')
  await wait()
  TODOS.push({
    id: TODOS.length,
    text: todo,
  })
  revalidatePath('/')
  return TODOS
}
```

然后在 Server Component 引入并作为 `action` props 传入即可：


```js
import { formAction, getTodos } from './actions'

export default async function Home() {
  const todos = await getTodos()

  return (
    <main>
      <form action={formAction}>
        <input type="text" name="todo" />
        <button type="submit">提交</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </main>
  )
}
```


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/94595a262fdd4c0795ab3accc41d9703~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=420&h=244&s=81651&e=gif&f=68&b=fdfcff" alt="20240610224549_rec_.gif" width="30%" /></p>

内部其实是 Server Actions 帮助我们处理了前后端交互的模板代码，简化了操作。


## useActionState

`useActionState` 用来根据表单 action 的结果来更新状态，


```js
import { useActionState } from 'react'

async function increment(previousState, formData) {
  return previousState + 1
}

function StatefulForm() {
  const [state, formAction] = useActionState(increment, 0)
  return (
    <form>
      {state}
      <button formAction={formAction}>+1</button>
    </form>
  )
}
```

在这个例子中 `state` 的初始状态就是传入到 `useActionState` 的第二个参数 0，当我们点击按钮提交表单之后，返回结果会作为 `formData` 传入，从而更新 `state` 为 `increment` 函数的计算结果。



## Preloading APIs

在页面初始加载时告诉浏览器需要的资源可以显著提高页面的性能，[参考例如](https://medium.com/reloading/preload-prefetch-and-priorities-in-chrome-776165961bbf) Shopify preload 字体，从而获得了 [1.2s（50%）](https://x.com/addyosmani/status/843250968267382789)文字渲染优化，并且完全解决了页面字体抖动的问题。


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9212eac2cba64b28a41f26351cd11fc1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=972&h=392&s=232927&e=png&b=2e2a2f)


Treebo，印度最大的旅馆网站之一在将图片和主要的 bundles preload 之后在 FP 和 TTI 分别减少了 1s。


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c707ce7b43614826921e1f33223e0fb2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2878&h=1442&s=2062113&e=png&b=f8f6f6)



从 React19 开始我们可以借助 React 轻松实现这一点：

```js
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'  

function MyComponent() {  
  preinit('https://.../path/to/some/script.js', {as: 'script' }) // loads and executes this script eagerly  
  preload('https://.../path/to/font.woff', { as: 'font' }) // preloads this font  
  preload('https://.../path/to/stylesheet.css', { as: 'style' }) // preloads this stylesheet  
  prefetchDNS('https://...') // when you may not actually request anything from this host  
  preconnect('https://...') // when you will request something but aren't sure what  
}
```

上面预加载的资源会正确被 React 插入到 HTML 中：

```html
<html>  
  <head>  
    <!-- links/scripts are prioritized by their utility to early loading, not call order -->  
    <link rel="prefetch-dns" href="https://...">  
    <link rel="preconnect" href="https://...">  
    <link rel="preload" as="font" href="https://.../path/to/font.woff">  
    <link rel="preload" as="style" href="https://.../path/to/stylesheet.css">  
    <script async="" src="https://.../path/to/some/script.js"></script>  
    </head>  
  <body>  
    ...  
  </body>  
</html>
```

接下来让我们看一个实际的例子（https://github.com/L-Qun/state-management-collection/tree/main/examples/react19/preload )：


```js
export default function Home() {
  return (
    <>
      {new Array(1000).fill(0).map(() => (
        <p className="font-operator">1111</p>
      ))}
    </>
  )
}
```

我们在这里引入了额外的字体，为了更加明显，我们可以在 Chrome Devtools Network 面板降低网络速度：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c3cc89fecff4c5083c9935134de6799~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1390&h=1626&s=431645&e=png&b=ffffff" alt="image.png" width="70%" /></p>

然后我们会发现字体出现一闪而过的现象，尤其是网络状况比较差时会更加明显，这是因为字体文件由 CSS 引入，需要等待 CSS 被解析之后才会进行加载，所以出现一闪而过的现象：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9eb50906fbbf4709a1b444f5d297f92c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=272&h=560&s=26287&e=gif&f=24&b=fdfcff" alt="20240611141148_rec_.gif" width="20%" /></p>

借助 React19 的 `preload` 可以轻松解决这个问题：


```js
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

export default function Home() {
  preload(
    'http://localhost:3000/_next/static/media/vtu73by4O2gEBcvBuLgeu.3b7789cf.woff',
    {
      as: 'font',
    },
  )

  return (
    <>
      {new Array(1000).fill(0).map(() => (
        <p className="font-operator">1111</p>
      ))}
    </>
  )
}
```


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5079306349aa43f6b0081e4fd811b747~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=280&h=788&s=40901&e=gif&f=34&b=fdfcff" alt="20240611141757_rec_.gif" width="20%" /></p>

此时页面不会再出现一闪而过的现象了，同时我们也可以看到 `preload` 标签被正确的加到了 `<head>` 中。


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/47be40e3f55e44429f5740afd64491b9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1894&h=542&s=211771&e=png&b=fefafa)


## 异步 transitions

在 React18 中新增了 `useTransition`/`startTransition`，

-   在re-render之前不会block用户的交互：由于useTransition会开启并发更新并降低当前render的优先级，因此用户无需等到render完成即可继续交互：

<img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/88ee08a6874d4bfa9032d8ad774a4099~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=912&h=796&s=227775&e=gif&f=77&b=f4f4fa" alt="" width="49%" />

<img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b57ec45a20084782972ec1336870c677~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=908&h=800&s=214903&e=gif&f=63&b=f6f6fb" alt="" width="49%" />

-   在切换期间仍然保持之前的UI：举个例子，当你跳转到另一个页面，而另一个页面还没有加载完，这时候就会出现空白的状态，因此可以借助useTransition稍微停留在上一个页面，等待下一个页面加载完再渲染：

<img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03b9ad15d5a34840a7e96e957fecaef6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=992&h=804&s=124720&e=gif&f=59&b=f7f6fb" alt="" width="49%" />

<img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ed636dba855c45b59c5afb4300ff650d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=984&h=792&s=89082&e=gif&f=36&b=f7f6fb" alt="" width="49%" />

在使用useTransition之前，当点击Posts时会渲染Suspense的fallback，当使用useTransition之后，会在Posts数据加载完之前停留一会，这样会带来更好的用户体验。

而这个过程不支持在传入异步函数，例如我们希望在获取数据之后跳转

React19 在 `transitions` 中添加了 async 支持，从而方便处理状态更新，例如：


```js
// 使用 Actions 中的待定状态  
function UpdateName({}) {  
  const [name, setName] = useState("");  
  const [error, setError] = useState(null);  
  const [isPending, startTransition] = useTransition();  

  const handleSubmit = () => {  
    startTransition(async () => {  
      const error = await updateName(name);  
      if (error) {  
        setError(error);  
        return;  
      }  
      redirect("/path");  
    })  
  };  

  return (  
    <div>  
      <input value={name} onChange={(event) => setName(event.target.value)} /> 
      <button onClick={handleSubmit} disabled={isPending}>  
        Update  
      </button>  
      {error && <p>{error}</p>}  
    </div>  
  );  
}
```




## RSC（React Server Components）

在 [“RSC（React Server Component）与 Tanstack Query”](https://juejin.cn/book/7311970169411567626/section/7335385403954266138) 一章中我们介绍了 RSC 相关的概念，感兴趣的同学可以翻阅该章节进行查看，这里就不额外重复了。



## use 

在 [Jotai 和 React Suspense：异步状态管理的优雅实践](https://juejin.cn/book/7311970169411567626/section/7312837845570617382) 一章中我们也已经介绍过了 `use` hook，因此这里我们不再赘述。

## useOptimistic

首先介绍一个概念 —— `乐观更新`，乐观更新就是在没有从服务器得到响应之前，就先更新用户界面的方法。举个实际的 🌰：



![20240427124350_rec_.gif](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/de7932b6e7f848af9699d99dd2e5d51a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1922&h=1078&s=14054306&e=gif&f=94&b=c2bbac)

比如说当我们在刷抖音视频时遇到喜欢的视频会点赞或者收藏，同时**立刻**展示点赞/收藏的动画效果，但是如果此时需要等到请求成功后才展示对于用户来说体验是非常差的，所以实际在这种场景的策略是只要当用户发生点赞/收藏行为时我们就给他展示交互成功的动效，这就是乐观更新。如果请求失败了我们再给他回滚先前的状态，也就是未点赞/未收藏对应的 Icon，这时用户可以重新进行操作。

React19 给我们提供了新的 Api —— [`useOptimistic`](https://react.dev/reference/react/useOptimistic)，可以用来乐观更新 UI，比如来看下面这个 React 官方提供的[例子](https://codesandbox.io/p/sandbox/nostalgic-cdn-hsvs2d?file=%2Fsrc%2FApp.js&utm_medium=sandpack)：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4e8bde310c0344c799eff0eee9322d5c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=480&h=328&s=156828&e=gif&f=83&b=fdfcff" alt="20240601181002_rec_.gif" width="30%" /></p>


```js
function Thread({ messages, sendMessage }) {
  const formRef = useRef();
  async function formAction(formData) {
    addOptimisticMessage(formData.get("message"));
    formRef.current.reset();
    await sendMessage(formData);
  }
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage) => [
      ...state,
      {
        text: newMessage,
        sending: true
      }
    ]
  );

  return (
    <>
      {optimisticMessages.map((message, index) => (
        <div key={index}>
          {message.text}
          {!!message.sending && <small> (Sending...)</small>}
        </div>
      ))}
      <form action={formAction} ref={formRef}>
        <input type="text" name="message" placeholder="Hello!" />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

当我们点击 send 按钮时可以看到 UI 被立即更新了，而非等到状态返回后才更新状态。使用方式也比较好理解，传入 `useOptimistic` 的第一个参数会作为 `optimisticMessages` 的初始值，当我们提交表单的时候把数据发送给 `useOptimistic` 来进行乐观更新，也就是传入到 `useOptimistic` 第二个函数参数中，从而更新 `optimisticMessages`。



## ref 作为 prop


从 React19 开始，`forwardRef` 会被废弃和移除。取而代之的是你可以直接将 `ref` 作为 `prop` 传入到组件中，例如：


```js
function MyInput({placeholder, ref}) {  
  return <input placeholder={placeholder} ref={ref} />  
}  
//...  
<MyInput ref={ref} />
```

为了方便我们做迁移，React 将会发布代码更改器自动帮助我们来修改老的写法。



## useFormStatus

`useFormStatus` 提供了上次表单提交的状态信息，例如：


```js
import { useFormStatus } from 'react-dom'
import action from './actions'

function Submit() {
  const status = useFormStatus()
  return <button disabled={status.pending}>提交</button>
}

export default function App() {
  return (
    <form action={action}>
      <Submit />
    </form>
  )
}
```

通常当我们已经提交了表单，我们需要禁用按钮或者提示用户一些信息，此时我们就可以借助 `useFormStatus` 方便的获取表单提交的状态信息。




## Metadata

由于决定 `metadata` 内容的地方可能距离 `<head>` 标签非常远，因此在之前你可能需要手动插入或者借助 [react-helmet](https://github.com/nfl/react-helmet) 来实现。而现在 React 提供了原生的支持：


```js
function BlogPost({post}) {
  return ( 
    <article> 
      <h1>{post.title}</h1> 
      <title>{post.title}</title> 
      <meta name="author" content="Josh" /> 
      <link rel="author" href="https://twitter.com/joshcstory/" /> 
      <meta name="keywords" content={post.keywords} /> 
      <p> Eee equals em-see-squared... </p> </article> 
  ); 
}
```

当 React 看到 `<title>`、`<link>` 和 `<meta>` 时，会自动将它们提升到 `<head>` 标签里，并且无论 CSR、SSR、Streaming、RSC 都能够很好的支持。这意味着我们再也不需要 react-helmet 库了。






# React19 对状态管理库生态的影响

## RSC

在状态管理库中可能会实现 React Context，用来在组件树中进行使用，比如 Jotai 内部会利用 React Context 来传递 Store：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7542bdf71fff48eebbd80244de437b7c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1198&h=1416&s=299928&e=png&b=1e1e1e" alt="image.png" width="80%" /></p>

随着 React RSC 的推出，如果顶部没有包含 `"use client"` 标识则会默认被当成服务端组件而报错。因此状态管理库包括其它包含了 React 组件的开源库，例如 [ant-design](https://github.com/ant-design/ant-design)（你可以看它的打包产物），都需要在打包产物中增加 `"use client"` 标识。

以 Rollup 为例，通常这个问题可以借助 [`rollup-plugin-preserve-directives`](https://www.npmjs.com/package/rollup-plugin-preserve-directives) 或者 [`rollup-plugin-banner2`](https://www.npmjs.com/package/rollup-plugin-banner2) plugin 来解决：

- `rollup-plugin-preserve-directives`：原理是避免 rollup 默认移除代码顶部 `'use client'` 标识。需要确保已经开启了 `preserveModules`，同时需要保证在源码顶部已经增加 `'use client'`，使用：


```js
import preserveDirectives from "rollup-plugin-preserve-directives";

export default {
  output: {
    preserveModules: true,
  },
  plugins: [preserveDirectives()],
};
```


- `rollup-plugin-banner2`：用来在打包 JS 之前在顶部插入内容，不需要在源代码中增加 `'use client'` 标识，用法：


```js
import banner2 from "rollup-plugin-banner2";

export default {
  plugins: [banner2(() => "use client")]
};
```

即一个是在打包中保留 `'use client'` 声明，另一个则是在打包中增加 `'use client'`。

## use


借助 `use` hook，使得状态管理库获得了可以读取异步数据的能力。比如 Jotai async read atom 的[例子](https://codesandbox.io/p/sandbox/jotai-use-vs48q8)：

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8df2c37df81f40b09ef777681c93029a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=184&h=128&s=379587&e=gif&f=14&b=fdfdfd" alt="QQ20240219-185745-HD.gif" width="20%" /></p>



```js
const anAtom = atom(async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(10);
    }, 2000);
  });
});

const Display = () => {
  const value = useAtomValue(anAtom);
  return <div>value: {value}</div>;
};

export default function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <Display />
    </Suspense>
  );
}
```
在这个例子中，我们向 `atom` 传入了一个异步的函数，并在 `Display` 组件中读取数据，可以看到，等待 2s 后展示了正确的 `value`，这背后正是借助了 React use，从而使得 Jotai 获得了读取异步状态的能力。









