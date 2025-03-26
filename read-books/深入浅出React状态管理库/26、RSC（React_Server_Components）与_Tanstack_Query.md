为什么要增加一节来讲 RSC（React Server Component）呢？在 TanStack Query [源代码](https://github.com/TanStack/query/blob/main/packages/react-query/src/useBaseQuery.ts)中我们可以发现上方包含了 `'use client'` 标识：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/779ed040bf884cacb3ae9a5db1fc78cd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1368&h=748&s=170687&e=png&b=ffffff" alt="image.png" width="70%" /></p>

这其实是为了区分服务端组件（Server Component）和客户端组件（Client Component），那这一节我们就来讲一下什么是 RSC 以及我们会在之前代码的基础之上进一步支持 RSC。



## 认识 React Server Components

### Server Components 与 Client Components

React Server Components 是一种新的范式，这个概念早在 2020 年就被 React 官方所[提出](https://legacy.reactjs.org/blog/2020/12/21/data-fetching-with-react-server-components.html)。谈到它你可能会联想到 NextJS，其实 RSC 是 React 的能力，不仅仅在 NextJS，[Waku](https://github.com/dai-shi/waku) 也同样支持了 RSC，它的作者同样也是我们早已非常熟悉的 [Daishi Kato](https://github.com/dai-shi)。


React Server Components 允许我们可以在服务端中运行组件，这样我们就可以直接在组件中实现服务器逻辑，比如查询数据库、与后端服务直接交互等等，同时可以编写出更简洁的逻辑。

让我们用一个 Demo 来演示 Server Component 的优势：

> 点击查看 Demo：https://github.com/L-Qun/state-management-collection/tree/main/examples/react-query/rsc

通常如果我们想要在页面中进行异步请求，我们需要这样做（当然正如我们在[前面章节](https://juejin.cn/book/7311970169411567626/section/7318564163163258918)中提到在做异步请求时需要考虑更多因素）：


```ts
export default function ClientPage() {
  const [todos, setTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setTodos([])
    setError(false)

    const controller = new AbortController()

    fetch('https://jsonplaceholder.typicode.com/todos', {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        setTodos(data)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(true)
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  if (loading) return <div>loading...</div>

  if (error) return <div>Error</div>

  return (
    <>
      <h1>Client Page</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </>
  )
}
```

即在 `useEffect` 中发起请求，等到数据请求回来后更新数据。而有了 Server Components 之后一切都变得更加简单：

```ts
export default async function ServerPage() {
  const todos = await fetch('https://jsonplaceholder.typicode.com/todos').then(
    (res) => res.json() as Promise<any[]>,
  )

  return (
    <>
      <h1>Server Page</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </>
  )
}
```

我们可以像执行一个异步函数一样，在函数前增加 `async` 从而变成异步的，同时 `await` 等待数据返回结果。当然正如它的名字一样，Server Components 只运行在服务端，我们可以在 `ServerPage` 组件中增加一些 `console` 进行验证：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f0b354c7cc843d4b6572e6eb18dd261~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1260&h=1490&s=207776&e=png&b=1f1f1f" alt="image.png" width="70%" /></p>

而客户端组件则会同时运行在客户端和服务端：



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/89bb163a73d24d358b2b6485cb45a131~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1530&h=1720&s=393405&e=png&b=fefefe" alt="image.png" width="70%" /></p>


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c16865d7d9b407c920203a25b36f759~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=758&h=518&s=50122&e=png&b=202020" alt="image.png" width="50%" /></p>


我们用一个表格来总结一下：

<div align="center">

|  | 在服务端渲染 | 在客户端渲染 |
| --- | --- | --- |
| Server Component | ✅ |  |
| Client Component | ✅ | ✅ |

</div>

Server Component 另一个很大的优势就是减少 bundle size 从而提高性能。我们来看一个实际的例子，假设现在有一个 `bigFunc` 函数（这个函数可能来源于我们自身的项目或者三方库），内部包含了大量的 JS 逻辑，然后我们将这个函数分别加入到 `ServerPage` 和 `ClientPage` 组件中运行。当我们切换到 `/server` 时我们搜不到任何 `bigFunc` 的代码：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1e193ed74eeb4c40aa86ccf12e1d616b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2876&h=1624&s=576005&e=png&b=fefdfd)

当我们切换到 `/client` 再去搜索 `bigFunc`：


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/444594dcbded427ebf607d6433233008~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2880&h=1626&s=927844&e=png&b=fefdfd)

可以发现这时候可以被搜索到了，这意味着在 `ClientPage` 组件中运行的 `bigFunc` 函数会被打包进来。

我们可以总结一下 Server Components 的优势：

**更简洁**：Server Components 可以直接从后端获取数据，不需要通过 API 客户端代码来处理。这使得数据处理逻辑更直接，也更容易维护。

**安全性**：因为 Server Components 只运行在服务端，所以可以直接使用 secret key 或者从数据库中获取数据，但在客户端不会看到这些代码，例如：


```js
async function ServerComponent() {
  const user = await db.users.find({ name: "John" })

  return <p>{user.name}</p>
}
```

**性能**：

- 缓存：因为 Server Components 运行在服务端，因此我们可以在用户请求时缓存数据，以便在不同请求之间进行复用。

- 减少打包体积：因为 Server Components 只运行在服务端，所以客户端不需要加载执行这些组件的 JavaScript 代码，因此这可以极大地减少打包体积，从而提高 TTI 等性能指标。

- 页面加载速度：用户请求时看到的就是完整的 HTML 内容，这意味着用户不需要等待 JS 的加载从而可以更早地看到页面内容，同时也有利于 SEO。



可能你会思考，既然 Server Components 这么好用，那为什么我们不把逻辑都放到 Server Components 中呢？比如当我们在 Server Components 中引入 `useState` 来控制状态：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/48fe2dffce994de8ab299d0d670a0ec1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1340&h=620&s=106186&e=png&b=1e1e1e" alt="image.png" width="70%" /></p>

你会发现 NextJS 给你报了错误，这意味着使用 Server Components 无法获得可交互性，例如当用户发生点击事件更新状态等等。因此我们可以在绝大部分场景中使用 Server Components 来获取上面的优势，而仅在少部分需要交互的场景中使用 Client Components。



### `'use client'`

组件默认会被当作 Server Component，如果我们希望它是 Client Component，我们需要在顶部加上 `'use client'` 标识。


如果组件 re-render，子组件也会 re-render，因此 React 团队有一个限制是客户端组件只能引入客户端组件而不能引入服务端组件，假设我们此时 React 组件树是这样的：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/95763444fa654eb9a155ee61f23f8e99~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1542&h=1082&s=99441&e=png&b=ffffff" alt="image.png" width="70%" /></p>

在 `Content` 组件中声明了 `'use client'`，则 `Content` 会作为客户端边界（client boundary）：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d1bba2f3fbea43f784ed076de260de3d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1570&h=1184&s=121296&e=png&b=ffffff" alt="image.png" width="70%" /></p>

也就是说即使 ComponentA、ComponentB、ComponentC 没有声明  `'use client'`，它们也会作为客户端组件而存在。

可能你会觉得有些困惑，这是否限制过大了，比如如果我需要在应用顶层使用状态，那么这是否意味着所有子孙组件都需要变为客户端组件？让我们来看一个例子：


```js
'use client'

import { createContext, useContext, useState } from 'react';

import Header from '@/components/Header';
import Content from '@/components/Content';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
});


export default function HomePage() {
  const [theme, setTheme] = useState('light');
  
  const toggleTheme = () => { 
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
  }

  return ( 
    <ThemeContext.Provider value={{ theme, setTheme: toggleTheme }}> 
      <Header />
      <Content />
    </ThemeContext.Provider> 
  )
}
```

在这个例子中我们需要使用状态来切换主题色，通常我们会使用 React Context 来实现这个能力，因此我们需要在应用顶层包裹 `ThemeContext.Provider` 来保证在各个组件中可以正确获取到主题色从而做相应的处理。为了使用这个能力我们把 `HomePage` 组件变为了客户端组件，相应的这里的 `Header`、`MainContent` 也同样会变为客户端组件。

为了避免这样，我们可以将状态部分独立出来，其它客户端组件部分作为 Props 的形式传入：


```js
'use client'

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

然后在 HomePage 中引入即可：


```js
import Header from '@/components/Header';
import Content from '@/components/Content';
import ThemeProvider from '@/components/ThemeProvider';

function Homepage() {
  return (
    <ThemeProvider>
      <Header />
      <Content />
    </ThemeProvider>
  );
}
```

这样我们就不需要再在 `Homepage` 中声明 `'use client'` 了。



## 改造 TanStack Query

如果我们在源码中增加 `'use client'` 声明并运行 `pnpm run build` 进行打包会发现下面这个 warning：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ae02744c37184bce80e33cbc6669aaba~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2412&h=240&s=88977&e=png&b=292d35)

这是告诉你 `'use client'` 在打包中被忽略了，也就是不包含在打包产物中。这样是没有任何作用的，因为我们希望产物中包含 `'use client'` 而不仅仅在源代码里包含，因为在业务中真正使用的时候是引入的打包产物。

通常这个问题可以借助 [`rollup-plugin-preserve-directives`](https://www.npmjs.com/package/rollup-plugin-preserve-directives) 或者 [`rollup-plugin-banner2`](https://www.npmjs.com/package/rollup-plugin-banner2) plugin 来解决：

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

即一个是在打包中保留 `'use client'` 声明，另一个则是在打包中增加 `'use client'`。当然这两种方式都可以，我们这里为了方便选择了第二种方案。




## 总结

在本节中我们介绍了 RSC（React Server Component），并在我们之前对 TanStack Query 实现的基础之上进一步兼容了 RSC 能力。由于篇幅原因我们并没有深入 RSC 原理，如果你对这部分感兴趣可以阅读之前 [dan](https://github.com/gaearon) 写的[文章](https://github.com/reactwg/server-components/discussions/5)。

在下一节中我们会实现 TanStack Query DevTools，揭示 UI DevTools 是如何来实现的。

