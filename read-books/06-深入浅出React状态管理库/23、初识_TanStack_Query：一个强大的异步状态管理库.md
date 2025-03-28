> 本文基于 TanStack Query V5 版本进行讲解。

在正式开始内容介绍之前，我们先了解一个冷知识。TanStack Query 原名 React Query，从 V4 版本开始就更名为了 TanStack Query，当然它的其它产品也统一到了 TanStack 品牌之下：



<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2a01b67dc7624eff8ef566ea83d9ffff~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=304&h=590&s=49326&e=png&b=ffffff" alt="image.png" width="25%" /></p>


[有些人](https://www.reddit.com/r/webdev/comments/yh220e/does_the_reactquery_tanstack_rebranding_seem/)对此提出了质疑，是否他是因为自恋才把库改为自己的名字（作者名为 Tanner），当然绝大部分人表示了理解。

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4c5b6aa8bd274ef78f44eb057f58e5c0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2298&h=318&s=91695&e=png&b=f8f9fa)


但归根结底作者及开发团队正在扩展到其它框架，如 Vue、Svelte、Solid 等等，这就是为什么需要脱离 React 而变更为 TanStack 的真正原因。



在上一章中通过一个渐进式的例子帮助我们理解了 TanStack Query 的价值，在本章让我们系统性地来学习 TanStack Query。TanStack Query 使用起来并不复杂，但功能非常多。因此，本节不会详细介绍每一个细节，重在介绍 TanStack Query 能帮我们解决哪些问题。同时对每个例子我们都配备了对应的直接可调试的 codesandbox 代码，方便大家更好地进行学习。

    


## 快速入门

### 第一个例子

接下来让我们通过一个事例来快速入门 TanStack Query：


> 点击查看 Demo：https://codesandbox.io/p/sandbox/basic-7r3wgw?file=%2Fsrc%2FApp.js%3A1%2C1-42%2C1


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/845a4ba2f7ab4cba9fc891c16be1fa77~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=216&h=260&s=78071&e=gif&f=74&b=fcfbfe" alt="20240505145015_rec_.gif" width="20%" /></p>


```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTodos, postTodo } from "./mock";

export default function Todos() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["todos"], 
    queryFn: getTodos
  });

  const mutation = useMutation({
    mutationFn: postTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  if (query.isPending) return <div>加载中...</div>;
  if (query.error) return <div>发生错误: {query.error.message}</div>;

  return (
    <div>
      <ul>
        {query.data?.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>

      <button
        disabled={mutation.isPending}
        onClick={() => {
          mutation.mutate({
            id: 3,
            title: "打豆豆",
          });
        }}
      >
        Add Todo
      </button>
    </div>
  );
}
```

我们通过上面的例子展示了 TanStack Query 两个重要的概念，即 `查询（Query）` 和 `突变（Mutation）`。查询代表从某个地方获取数据，而突变则代表发起数据变更操作（如增加、修改、删除等）。
 


在这个例子中，我们首先使用 `useQueryClient` 来获取 `queryClient`，通过 `queryClient` 使得我们可以直接与缓存进行交互，例如使缓存失效。

通过 `useQuery` 来获取数据，当加载数据时，我们可以通过 `isPending` 属性来判断是否数据正在加载中，从而去展示加载时的 UI。其中，我们向 `useQuery` 中传入了 `queryKey` 和 `queryFn`，`queryKey` 用来作为该查询的标识，而 `queryFn` 对应为获取数据的函数。

同时，我们也提供了一个按钮用来增加待办事项，对应的我们需要借助 `useMutation` 来实现，其中我们向 `useMutation` 传入了两个参数 —— `mutationFn` 和 `onSuccess`，`mutationFn` 为触发变更的函数，这里是 `postTodo` 用来增加办事项添，当待办事项添加成功后会触发 `onSuccess` 回调，通过调用 `queryClient.invalidateQueries` 来使待办事项查询无效，从而重新获取最新的待办事项列表。



### QueryClientProvider

使用 TanStack Query 的起点，也就是第一步，我们必须要通过 `QueryClient` 创建一个实例并传入到  `QueryClientProvider` 中。



```js
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 创建一个`QueryClient`实例
const queryClient = new QueryClient()

function App() {
  return (
    // 将该实例传入到QueryClientProvider中 
    <QueryClientProvider client={queryClient}>
      <Todos />
    </QueryClientProvider>
  )
}
```

这样我们才可以在组件中通过 `useQueryClient` 来拿到这个实例，否则就会报错。




### 查询状态


```js
const result = useQuery({ queryKey: ['todos'], queryFn: fetchTodoList })
```

`result` 包含了查询过程需要的全部信息。可以在[实际例子](https://codesandbox.io/p/sandbox/use-query-state-nl8l62?file=%2Fsrc%2FApp.js%3A6%2C66)中查看不同阶段的变化。下面这些状态描述了请求不同阶段对应的状态：

- `isPending` / `status === 'pending'`：还没有数据。
- `isError` / `status === 'error'`：请求出错了。
- `isSuccess` / `status === 'success'`：请求成功并且数据可用状态。
- `isFetching` / `fetchStatus === 'fetching'`：正在请求数据中。
- `isPaused` / `fetchStatus === 'paused'`：请求暂停中。
- `fetchStatus === 'idle'`：当前没有任何请求，处于空闲中。



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/23e450f6d8294b14b73eead995708f03~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1052&h=858&s=142246&e=png&b=ffffff" alt="image.png" width="70%" /></p>


可用看到 TanStack Query 使用了两个变量来维护请求相关的状态，那这两个有什么区别呢？

`status` 用来描述是否请求到了数据。
`fetchStatus` 用来描述 `queryFn` 是否正在执行中。

- 当一个请求 `status` 为 `'success'` 时对应 `fetchStatus` 通常为 `'idle'`，但 `fetchStatus` 也有可能为 `'fetching'` 如果正在重新获取数据。
- 当一个请求正在进行时 `status` 为 `'pending'` 同时 `fetchStatus` 为 `'fetching'`，但 `fetchStatus` 也有可能为 `'paused'` 如果网络连接中断。

其它状态：

- `data`：请求返回的数据。
- `error`：请求失败时对应的错误对象。



### 查询去重


> 点击查看 Demo：https://codesandbox.io/p/sandbox/deduplication-cqttgd?file=%2Fsrc%2FApp.js%3A45%2C14



![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8bf7a6bb36314115beb3b0ab1b1062df~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2440&h=824&s=177675&e=png&b=ffffff)


```js
function Header() {
  const { data, isPending } = useQuery({
    queryKey: ["todo"],
    queryFn,
  });
  if (isPending) return <div>Loading...</div>;
  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}

function Footer() {
  const { data, isPending } = useQuery({
    queryKey: ["todo"],
    queryFn,
  });
  if (isPending) return <div>Loading...</div>;
  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

假设页面包含了 `<Header />` 和 `<Footer />` 组件，这两个组件都需要向服务端进行请求同样的数据，通常如果我们直接在 `useEffect` 中调用 `fetch` 则会发起两次请求，而 TanStack Query 会发现这两次请求对应的相同的 `queryKey`，则将这两次相同的请求进行去重，合并为一次请求。




### 如何更高效地编写 Query Keys

Query Keys 是 TanStack Query 非常重要的核心概念，它必须是一个数组，TanStack Query 会基于 Query Keys 来管理缓存，并在依赖项更新时自动触发重新获取。TanStack Query 会对 Query Keys 进行哈希处理，将数组全部内容计算成一个值作为该 Query 的映射（这一部分我们会在下一节源码部分去介绍如何实现），对 Query Keys 哈希后的结果是确定的。比如：

这些是相等的，即在同一个对象中的顺序不影响哈希后的结果：

```js
useQuery({ queryKey: ['todos', { status, page }], ... })
useQuery({ queryKey: ['todos', { page, status }], ...})
useQuery({ queryKey: ['todos', { page, status, other: undefined }], ... })
```

这些则是不相等的，因为在 `queryKey` 中的顺序不同：

```js
useQuery({ queryKey: ['todos', status, page], ... })
useQuery({ queryKey: ['todos', page, status], ...})
useQuery({ queryKey: ['todos', undefined, page, status], ...})
```

TanStack Query 会根据 `queryKey` 生成唯一的映射，因此其实只需要做到能够正确区分 key - data 的映射关系即可。这里推荐一种我比较喜欢的写法，例如在不同 URL 时我们可以怎么来写 Query Key：


```js
/todos -> ['todos']
/todos/1 -> ['todos', todo.id]
/todos/2/tasks -> ['todos', todo.id, 'tasks']
/todos?authorId=3 -> ['todos', { authorId: 3 }]
```

也就是说每当有新的 `"/"` 时，都可以看作是数组新的元素，对于 `"?"` 我们则把它们放到一个对象中。


### 默认配置项

TanStack Query 默认做了很多大胆的默认配置项，比如出错后 TanStack Query 会帮助我们自动进行重试，这个重试次数是 3 次。


当然这些是合理且必要的，因为这些配置项都采用了最佳实践，能够使得我们开箱即用，满足我们绝大部分日常开发场景的同时获得更好的用户体验。接下来让我们了解 TanStack Query 做了哪些默认的配置，你可以在 `new QueryClient` 或者 `useQuery` 中设置参数从而覆盖默认配置。

例如在 `QueryClient` 中增加参数，该配置会对所有查询生效：


```js
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 10, // 重试次数为10
    },
  },
});
```

或者如果你只希望更改某个查询参数，可以在对应的 `useQuery` 中增加参数：


```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
  retry: 10, // 重试次数为10
});
```


#### staleTime

通常当我们完成一个查询，该查询立刻会变成 `stale（过期）`状态，我们来观察下面这个例子：


> 点击查看 Demo：https://codesandbox.io/p/sandbox/paginated-kt3n7x?file=%2Fsrc%2FApp.js%3A10%2C2


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ec32d5d889274107afdfabde2a88ad2b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1204&h=592&s=196589&e=gif&f=76&b=fcfbfe" alt="20240504191751_rec_.gif" width="70%" /></p>

有些同学会有一些疑惑，既然这个数据已经“过期了”，那为什么缓存仍然有效？缓存和 `stale` 的关系是什么？比如在上面例子中当我们点击返回上一页时，是可以立即展示数据的。

其实过期不代表缓存不能用，而是说，可以看到虽然立即展示了数据，但仍然会发起新的请求：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ceb46ed190774b28bd1dee60bb59fa2b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1300&h=872&s=179384&e=gif&f=73&b=fdfcff" alt="20240504193607_rec_.gif" width="70%" /></p>

当然这很合理，数据过期了我们就需要重新请求新的数据。通常情况下数据不会那么快过期，此时我们可以增加 `staleTime` 参数来修改它的过期时间：


```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
+ staleTime: 10000,
});
```


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80efc5da0d82469ebd9524e2fde9da81~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1236&h=724&s=402874&e=gif&f=141&b=fdfcff" alt="20240504194231_rec_.gif" width="70%" /></p>

可以看到，此时返回上一页就没有额外的请求了。

TanStack Query 也帮我们做了更多的优化，比如浏览器重新聚焦以及网络重新连接都会重新发起请求，让我们分别来看一下。

- **浏览器窗口重新聚焦**

什么叫浏览器窗口重新聚焦呢？比如说当我们切换到浏览器的其它 Tab 再回来，或者切出浏览器，比如用户在看抖音 Web 时切到了微信再切回抖音 Web 时都会重新发起请求：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/763aec308c46456c80f8452e29e9b522~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1256&h=764&s=434173&e=gif&f=93&b=fdfcff" alt="20240504200108_rec_.gif" width="70%" /></p>


在上图中可以看到，当我们切换到了其它页面再切换回来之后在没有任何操作的前提下发起了新的网络请求，当然我们也可以通过设置上面提到的 `staleTime` 来避免网络请求，这很合理，既然数据没有过期自然也就不需要重新请求了。

我们也可以设置 `refetchOnWindowFocus: false` 来直接禁止这个功能：

```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
+ refetchOnWindowFocus: false
});
```


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/21049f58b7b04cb6a1b465951ab363dd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1244&h=736&s=349435&e=gif&f=55&b=fdfcff" alt="20240504200315_rec_.gif" width="70%" /></p>

可以看到，浏览器重新聚焦时已经没有额外的网络请求了。

- **网络重新连接**

当用户网络断开重连时，TanStack Query 会认为当前的数据已经失效，从而帮助我们自动重新获取数据，我们可以借助 Chrome DevTools 来进行模拟：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b6dac7efdf354479ab18eec96e48a1d4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1292&h=808&s=130451&e=gif&f=45&b=fdfcff" alt="20240504195036_rec_.gif" width="70%" /></p>

TanStack Query DevTools 有一个非常方便的能力，也就是 `Mock offline behavior` 按钮可以方便地帮助我们模拟网络**连接/断开**的场景，在上面的图中可以看到当网络重连时 TanStack Query 会自动帮助我们请求数据。同样的也可以通过设置 `staleTime` 来避免网络请求。我们也可以设置 `refetchOnReconnect: false` 来禁止这个功能：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/21bb2a98cea34f7dae9851376de7e033~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1168&h=764&s=82393&e=gif&f=22&b=fcfbfe" alt="20240504195421_rec_.gif" width="70%" /></p>


```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
+ refetchOnReconnect: false
});
```

可以看到，网络重新连接时已经没有额外的网络请求了。



#### gcTime


当然也需要一个机制来删除缓存中没用的查询数据，从而避免内存泄露，而这个删除时间，也就是 `gcTime` 的默认值为 `1000 * 60 * 5`。我们还是来观察上面这个例子：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/paginated-kt3n7x?file=%2Fsrc%2FApp.js%3A10%2C2



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d883600f6670474689b2cbb240fe3b5d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1044&h=344&s=183141&e=gif&f=92&b=fdfcff" alt="20240504190320_rec_.gif" width="70%" /></p>

可以看到，当我们返回上一页时不需要重新去拉取数据，而是直接从缓存中拿取。你可以等待 5 分钟缓存过期后观察是否会重新请求数据，当然我们也可以直接修改 `gcTime` 参数来观察缓存立即失效效果：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/527e71aa140f4a2b9aa8756fd5bd4d0d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1008&h=384&s=254380&e=gif&f=99&b=fdfcff" alt="20240504190714_rec_.gif" width="70%" /></p>

```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
+ gcTime: 0,
});
```

可以看到，此时即使返回上一页也需要重新拉取数据，因为缓存立即失效了。



#### retry

当 `useQuery` 请求发生了错误，TanStack Query 会默认帮助我们进行重试，默认重试次数为 3，我们也可以传入 `retry` 参数来控制重试次数。


```js
const result = useQuery({
  queryKey: ['todos', 1],
  queryFn: fetchTodoListPage,
  retry: 10, // 重试次数为10
})
```

观察下面的例子：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1d3b78ff36c64294960d3c5e52e82287~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=608&h=544&s=129673&e=gif&f=117&b=fcfbfe" alt="20240504202220_rec_.gif" width="40%" /></p>

> 点击查看 Demo：https://codesandbox.io/p/sandbox/error-retry-48c7h8?file=%2Fsrc%2FApp.js%3A14%2C20



```js
import { useQuery } from "@tanstack/react-query";

const TODOS = [
  { id: 1, title: "TODO 1" },
  { id: 2, title: "TODO 2" },
  { id: 3, title: "TODO 3" },
];

let retryCount = 0;

const queryFn = (duration) => {
  retryCount++;
  console.log("retry count:", retryCount);
  if (retryCount <= 3) {
    return Promise.reject();
  }
  return new Promise((resolve) => setTimeout(() => resolve(TODOS), duration));
};

export default function App() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["todos"],
    queryFn,
  });

  if (isPending) return <div>Loading...</div>;

  if (isError) return <div>出错啦！</div>

  return (
    <div className="App">
      {data.map((todo) => (
        <div key={todo.id}>title: {todo.title}</div>
      ))}
    </div>
  );
}
```

这里我们通过 `Promise.reject` 模拟了请求出错的情况，并用 `retryCount` 来记录重试次数，你也可以手动调整来观察 TanStack Query 默认行为。


#### retryDelay

在上面的例子中，我们可以看到当请求失败时并没有立即重试（控制台没有立刻打印东西），这是因为在每次失败后 TanStack Query 都会等待一个时间之后才会发起下一次重试。

官网并没有提到默认的重试等待时间是多少，我们可以直接翻阅[源码](https://github.com/TanStack/query/blob/3ab92bc97eb468f897faf9e3cf5f68cd3e691015/packages/query-core/src/retryer.ts#L46)来查看该设置：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/951adac9f6ef4ee7aac4e13f3228b918~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=768&h=146&s=30388&e=png&b=ffffff" alt="image.png" width="70%" /></p>

其中 `failureCount` 代表失败次数，`**` 代表幂运算，比如 `2 ** 3` 等于 8，`**` 的优先级要高于 `*`。

可以看到，随着失败次数的增加，重试等待时间也随之增加，直到不超过 30 秒。当然，失败次数增加，花费更多时间来等待重试机制也非常合理。我们也可以传入 `retryDelay` 来覆盖该默认配置。

```js
const result = useQuery({
  queryKey: ['todos', 1],
  queryFn: fetchTodoListPage,
  retryDelay: 2000
})
```

### [Suspense](https://tanstack.com/query/v5/docs/framework/react/guides/suspense)

在前面的例子中我们使用了 `useQuery` 获取状态，包括了 `isPending` 可以用来判断是否加载中，进而展示加载中对应的样式，伪代码如下：


```js
const { isPending } = useQuery({
  queryKey,
  queryFn,
})

if (isPending) {
  <Loading />
}

// 加载好数据后渲染的内容
return xxx
```

当然我觉得这种写法很丑陋，同时必须要等待 UI 渲染完才能进行异步请求。更好的写法是结合 `Suspense` 来做，这样我们可以将异步请求前置到渲染阶段发出，同时避免写出 `if (isPending) return xxx` 这样的代码。

在 TanStack Query V5 之前我们需要向 `useQuery` 的配置项中传入 `suspense: true` 代表开启 Suspense 模式，而在 V5 中设计了新的 Api，同时也意味着 TanStack Query 结合 Suspense 的用法也进入了**稳定阶段**。


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/08c2504f0e154bb39127b12c04a39b2c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=852&h=458&s=83995&e=png&b=fefefe" alt="image.png" width="70%" /></p>

TanStack Query 为每个 Api 设计了对应的 Suspense 版本，而使用方式也基本一致。让我们来看一个实际的例子：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/suspense-vwyhv6?file=%2Fsrc%2FApp.js%3A38%2C7


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a65d628c5da3422b8fc47b45dc557189~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1032&h=328&s=102896&e=gif&f=47&b=fdfcff" alt="20240428172959_rec_.gif" width="70%" /></p>


```js
function TodoList() {
  const [page, setPage] = useState(1);

  // 使用`useSuspenseQuery`替换`useQuery`
  const { data } = useSuspenseQuery({
    queryKey: ['projects', page],
    queryFn: () => fetchData(page)
  });

  return (
    <>
      <ul>
        {data.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <button onClick={() => setPage((page) => (page - 1))}>-</button>
      <span> {page} </span>
      <button onClick={() => setPage((page) => (page + 1))}>+</button>
    </>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TodoList />
    </Suspense>
  );
}
```






## 一些日常开发常用场景和解决方案

TanStack Query 提供了高度的封装，因此使用起来非常简单。但其功能非常多，并且文档是英文的，大家在日常开发过程中可能比较难以直接从 TanStack Query 官网中找到合适的解决方案，因此本节的设计重点来解决这个问题，更全面地突出了 TanStack Query 能帮助我们解决哪些问题，并包含了大量的可以直接调试的案例。

在日常开发中可以遵循下面的方式：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/267157269907439a87fe19cabed6df0c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1046&h=174&s=18312&e=png&b=ffffff" alt="image.png" width="70%" /></p>

即接到一个需求，我们可以在小册中根据标题快速找到解决方案，以及通过我们提供的 codesandbox 例子进行调试以及更深入的理解，对于更细节的参数可以根据小册的指引快速找到官网对应章节进行翻阅。



### [预加载（prefetching）](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)

TanStack Query 提供了一个非常有用的功能称为**预加载（prefetching），这允许开发者在数据使用之前就提前加载它**。这种方式可以显著提高用户体验，因为它减少了用户等待数据加载的时间。在用户与应用互动时，数据可以即时显示，因为它已经被加载并缓存在后台。

例如：

- 预测用户行为：我们发现用户大概率会做某些操作，比如当用户鼠标悬停在按钮或链接上时我们可以认为该用户大概率会点击这个按钮，从而可以预先加载对应的数据来优化用户体验。
- 减少瀑布流（waterfall）：通常可能我们会遇到这样一种场景，即一个资源的加载依赖于另一个资源，因此最终内容到达的节点取决于前置内容的的完成，因此我们就可以预加载前置内容从而减少整体时间。

让我们来看下面这个例子：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cea26987a7e3412ab828c30c616e689e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1204&h=1308&s=130052&e=gif&f=31&b=fdfcff" alt="20240421173624_rec_.gif" width="70%" /></p>


```js
const fetchData = async () => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos`
  );
  const data = await res.json()
  return data;
}

function Detail() {
  const { data, isPending } = useQuery({
    queryKey: ['todo'],
    queryFn: fetchData
  })
  if (isPending) return <div>loading...</div>
  return (
    <ul>
      {data.map((todo) => (
        <li>{todo.title}</li>
      ))}
    </ul>
  )
}

export default function App() {
  const [isShowDetail, setIsShowDetail] = useState(false)
  return (
    <>
      <button onClick={() => setIsShowDetail(true)}>show detail</button>
      {isShowDetail && <Detail />}
    </>
  );
}
```

在这个例子中默认不展示 `<Detail />` 组件，当我们点击按钮后开始渲染 `<Detail />` 组件，此时开始请求数据。但是当用户将鼠标移动到按钮时我们可以认为他后续大概率会点击，因此针对这个例子我们可以做一个优化，即当用户将鼠标移动到按钮的位置时我们就做一个预请求数据：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/prefetching-nk4ywz?file=%2Fsrc%2FApp.js%3A16%2C22


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f64dc43ffdc848dd9b19c05cfb7be660~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=996&h=920&s=125052&e=gif&f=49&b=fdfcff" alt="20240421174218_rec_.gif" width="50%" /></p>


```js
export default function App() {
  const queryClient = useQueryClient()
  const [isShowDetail, setIsShowDetail] = useState(false)

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ['todos'],
      queryFn: fetchData,
      staleTime: 60000,
    })
  }

  return (
    <>
      <button onMouseEnter={prefetch} onClick={() => setIsShowDetail(true)}>show detail</button>
      {isShowDetail && <Detail />}
    </>
  );
}
```

可以观察到，当我们将鼠标移动到按钮处时就已经发出了网络请求，因此此时当用户点击按钮之后会更早地看到内容。这里设置了 `staleTime` 过期时间为 60000，如果不设置则表现为每次鼠标移入都会做一次预请求。







### [占位查询数据（Placeholder Query Data）](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data)

这个能力允许 Query 的表现像它本来就有数据一样，举一个实际的场景：



<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e47efbfaf54e404583b10676e18902f4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1676&h=1212&s=84531&e=png&b=ffffff" alt="image.png" width="70%" /></p>

当我们浏览博客时通常已经获取了一部分的文章标题和内容，因此当用户点击某个博客查看具体内容时，我们可以快速地先将这部分内容渲染出来，等到数据请求回来之后再加载剩余部分。

基本使用，可以传入 `placeholderData` 用来提供基本的占位数据：


```js
function Todos() {
  const result = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/todos'),
    placeholderData: placeholderTodos,
  })
}
```

注意⚠️：如果使用了 `placeholderData`，那 `status` 就不会展示为 `pending` 状态，而是一开始就展示为 `success`。






### [初始查询数据（Initial Query Data）](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data)
  
与上面 Placeholder Query Data 不同的是，Initial Query Data 会填充缓存数据。有多种方式填充缓存数据：

- 声明式：

    - 我们可以在 `useQuery` 中增加一个额外的参数 `initialData` 来填充缓存。


```js
const result = useQuery({
  queryKey: ['todos'],
  queryFn: () => fetch('/todos'),
  initialData: initialTodos,
})
```

- 命令式

    - 使用我们前面提到的 `queryClient.prefetchQuery` 来预加载数据。
    - 使用 `queryClient.setQueryData` 来直接手动填充缓存数据。



### [查询取消（Query Cancellation）](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)



在上一章中我们详细介绍了如何利用 `AbortController` 来取消一次请求，TanStack Query 在背后也是利用 `AbortController` 来做到这一点的（我们会在后续源码实现章节中来实现这个能力）。对于一个请求，如果不需要关心它的结果，我们就可以取消这次请求，这样有助于减少服务端资源消耗、节省带宽以及提高性能。通常我们不需要手动关心请求的取消，TanStack 会在 `queryFn` 执行的时候传入 `signal`，我们需要做的只是将 `signal` 作为请求的参数传入即可。

我们来看一个例子：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/af5ca1d8ee2a4e7dbfd673953bd7a991~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1064&h=648&s=194519&e=gif&f=87&b=fdfcff" alt="20240501185304_rec_.gif" width="50%" /></p>


```js
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const fetchData = async () => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos?_delay=3000&_limit=5`,
  );
  const data = await res.json()
  return data;
}

function TodoList() {
  const { isPending, error, data } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetchData()
  });

  if (isPending) return <div>Loading...</div>;

  if (error) return <div>发生了错误</div>;

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}

export default function App() {
  const [isShow, setIsShow] = useState(true)
  return (
    <>
      {isShow && <TodoList />}
      <button onClick={() => setIsShow(false)}>cancel</button>
    </>
  )
}
```

在这个例子中，我们通过 `isShow` 来控制 `<TodoList />` 组件是否展示，当我们点击按钮时 `<TodoList />` 组件被卸载，而观察右侧网络面板我们发现当组件卸载时理论上请求没有被取消，而是继续等待请求的返回，无疑这会造成更多的不必要的资源消耗，因此我们可以通过 TanStack Query 提供的 `signal` 来优化：



> 点击查看 Demo：https://codesandbox.io/p/sandbox/query-cancellation-r4rf34?file=%2Fsrc%2FApp.js%3A9%2C2


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8840423b8cfb476eb2635dcde1f0cb53~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1096&h=640&s=141317&e=gif&f=61&b=fdfcff" alt="20240501185711_rec_.gif" width="50%" /></p>

```js
const fetchData = async () => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos?_delay=3000&_limit=5`,
+   { signal }
  );
  const data = await res.json()
  return data;
}

function TodoList() {
  const { isPending, error, data } = useQuery({
    queryKey: ['todos'],
-   queryFn: () => fetchData()
+   queryFn: ({ signal }) => fetchData(signal)
  });

  if (isPending) return <div>Loading...</div>;

  if (error) return <div>发生了错误</div>;

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

可以看到，我们只需要将 TanStack Query 提供给我们的 `signal` 作为 `fetch` 的参数传入即可达到目的。


### [并行请求（Parallel Queries）](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries)

通常我们在开发应用时通常需要请求多个后端接口，例如：


```js
const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
```

有时候我们可能需要等全部数据都返回后再展示 UI，这时候就可以借助 TanStack Query 提供的 `useQueries` 来处理：


```js
const parallerQueries = useQueries({
  queries: [
    { queryKey: ['users'], queryFn: fetchUsers },
    { queryKey: ['teams'], queryFn: fetchTeams },
    { queryKey: ['projects'], queryFn: fetchProjects }
  ]
})
```

借助 `useQueries` 也可以动态生成查询：


```js
const userQueries = useQueries({
  queries: users.map((user) => {
    return {
      queryKey: ['user', user.id],
      queryFn: () => fetchUserById(user.id),
    }
  }),
})
```

比如这里查询数量依赖于 `users` 数量，而每次 re-render 时  `users` 数组长度可能发生变化，基于 `useQueries` 可以方便地批量生成 `queries`。


### [依赖请求（Dependent Queries）](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries#usequery-dependent-query)

有时候我们查询可能需要依赖于上一次查询的结果，然后才能执行，可以通过 `enabled` 来轻松实现这一点，当 `enabled` 为 true 时代表可以进行查询了。例如：


```js
const { data: user } = useQuery({
  queryKey: ['user', email],
  queryFn: getUserByEmail,
})

const userId = user?.id

const {
  status,
  fetchStatus,
  data: projects,
} = useQuery({
  queryKey: ['projects', userId],
  queryFn: getProjectsByUser,
  // 直到`userId`存在时才会执行这个查询
  enabled: !!userId,
})
```

在该例子中，我们首先通过 `useQuery` 查询用户的数据，接下来根据 `user` 的数据去请求 `projects` 的数据，很显然对于 `projects` 数据的请求依赖了 `user` 数据的获取，因此我们可以简单地增加属性 `enabled: !!userId` 来控制依赖关系。





### 分页查询（Paginated Queries）

正如上一章所说通常我们不会一次性把全部数据请求回来，而是进入不同页码时才请求对应的数据。

> 点击查看 Demo：https://codesandbox.io/p/sandbox/paginated-kt3n7x?file=%2Fsrc%2FApp.js%3A10%2C2


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8bf405cdc4ce4957982ace98a818dae5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1056&h=340&s=144065&e=gif&f=67&b=fdfcff" alt="20240424222258_rec_.gif" width="60%" /></p>

```js
const fetchData = async (page) => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5&_page=${page}`
  );
  const data = await res.json()
  return data;
}

export default function TodoList() {
  const [page, setPage] = useState(1);

  const { isPending, error, data } = useQuery({
    queryKey: ['projects', page],
    queryFn: () => fetchData(page)
  });

  if (isPending) return <div>Loading...</div>;

  if (error) return <div>发生了错误</div>;

  return (
    <>
      <ul>
        {data.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <button onClick={() => setPage((page) => (page - 1))}>-</button>
      <span> {page} </span>
      <button onClick={() => setPage((page) => (page + 1))}>+</button>
    </>
  );
}
```

即我们只需要简单地把页面序号加入到 `queryKey` 里即可。但是我们可以发现，每次进入新的页面时都会展示 loading...，这样其实对于用户的体验并不是很好，我们可以保留上一次的数据，直至新的数据返回：

> https://codesandbox.io/p/sandbox/paginated-keeppreviousdata-zkzrym?file=%2Fsrc%2FApp.js%3A18%2C39

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39b1962f7936480fa3dffd735ddae6d7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1056&h=360&s=140844&e=gif&f=81&b=fdfcff" alt="20240424222941_rec_.gif" width="50%" /></p>


```js
const fetchData = async (page) => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5&_page=${page}`
  );
  const data = await res.json()
  return data;
}

export default function TodoList() {
  const [page, setPage] = useState(1);

  const { isPending, error, data } = useQuery({
    queryKey: ['projects', page],
    queryFn: () => fetchData(page),
+   placeholderData: keepPreviousData,
  });

  if (isPending) return <div>Loading...</div>;

  if (error) return <div>发生了错误</div>;

  return (
    <>
      <ul>
        {data.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <button onClick={() => setPage((page) => (page - 1))}>-</button>
      <span> {page} </span>
      <button onClick={() => setPage((page) => (page + 1))}>+</button>
    </>
  );
}

```


### [无限查询（Infinite Queries）](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)

另一个比较常见的模式是无限查询，比如说每当我们下拉到页面底部时都会去请求新的数据，例如：

![20240424234722_rec_.gif](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7e4f80c5cc294f45a0c6715fe46bb9cb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=1080&s=9728001&e=gif&f=57&b=fcfbfe)

这种场景借助 TanStack Query 的 `useInfiniteQuery` 可以轻松实现，相比于 `useQuery` 而言，`useInfiniteQuery` 会自动管理数据的追加，将新加载的数据页与旧数据进行合并，而不需要手动操作。让我们来看一个例子：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/infinite-query-ts9ckz?file=%2Fsrc%2FApp.js%3A26%2C37



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/55483093e45e42858472d3f07c2fa3b2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1060&h=1320&s=2756352&e=gif&f=123&b=fdfcff" alt="20240505203821_rec_.gif" width="50%" /></p>


```js
import { useEffect, Fragment } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchData = async ({ pageParam }) => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=15&_page=${pageParam}`
  );
  const data = await res.json();
  return data;
};

export default function App() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["todos"],
      queryFn: fetchData,
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) => {
        const nextPage = allPages.length + 1;
        return nextPage;
      },
    });

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.offsetHeight;
      // 距离底部小于某个阈值就发起请求
      if (documentHeight - scrolled > 10) {
        return;
      }
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  return (
    <div>
      {data?.pages.map((page, i) => (
        <Fragment key={i}>
          {page.map((post) => (
            <h3 key={post.id}>{post.title}</h3>
          ))}
        </Fragment>
      ))}
      {isFetchingNextPage && <p>Loading more...</p>}
    </div>
  );
}
```

整个流程如下：

1. 首先类似于 `useQuery`，`useInfiniteQuery` 会调用 `queryFn` 获取第一屏数据，其中 `initialPageParam` 会作为初始参数 `pageParam` 传入到 `queryFn` 中。
2. 当滚动到底部时调用 `fetchNextPage` 函数。
3. 调用 `getNextPageParam` 计算下一次的查询信息，也就是 `pageParam` 的值，其中 `lastPage` 和 `allPages` 分别对应上一次和先前所有的请求数据。
4. 调用 `queryFn` 获取下一屏数据。



### [乐观更新（Optimistic Updates）](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

什么是乐观更新呢？乐观更新就是在没有从服务器得到响应之前，就先更新用户界面的方法。举个实际的 🌰：



![20240427124350_rec_.gif](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/de7932b6e7f848af9699d99dd2e5d51a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1922&h=1078&s=14054306&e=gif&f=94&b=c2bbac)

比如说当我们在刷抖音视频时遇到喜欢的视频会点赞或者收藏，同时**立刻**展示点赞/收藏的动画效果，但是如果此时需要等到请求成功后才展示对于用户来说体验是非常差的，所以实际在这种场景的策略是只要当用户发生点赞/收藏行为时我们就给他展示交互成功的动效，这就是乐观更新。如果请求失败了我们再给他回滚先前的状态，也就是未点赞/未收藏对应的 Icon，这时用户可以重新进行操作。

让我们来通过代码演示一下：

> 点击查看完整 Demo：https://codesandbox.io/p/sandbox/optimistic-update-01-4w8y22?file=%2Fsrc%2FApp.js%3A16%2C5-16%2C14

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9eb617a91f3341f5b83e7a5d7c18bbd5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=92&h=100&s=57485&e=gif&f=63&b=fcfbfe" alt="20240427221708_rec_.gif" width="8%" /></p>




```js
function App() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['video'],
    queryFn: fetchVideo
  })

  // 使用useMutation钩子进行点赞操作
  const { mutate } = useMutation({
    mutationFn: postVideo,
    onSuccess: () => {
      // 确保再次获取最新的数据
      queryClient.invalidateQueries(['video']);
    },
  });

  if (isPending) return <div>Loading...</div>

  return (
    <div onClick={() => mutate()}>
      {data.liked ? '❤️' : '🖤'}
      <div>{data.count}</div>
    </div>
  );
}
```

在这个例子中，我们可以很明显地感觉到当点赞时需要等待一段时间才会更新状态，也就是说需要等待异步请求返回后才更新状态。这种对于用户来说体验是非常糟糕的，最佳实践应该是当我们点击时立刻更新状态，例如：

> 点击查看完整 Demo：https://codesandbox.io/p/sandbox/optimistic-update-45s4ch?file=%2Fsrc%2FApp.js%3A27%2C10


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/206032184d814b19ad975461348600e2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=92&h=116&s=34926&e=gif&f=36&b=fcfbfe" alt="20240427221218_rec_.gif" width="8%" /></p>


```js
onMutate: async () => {
  // 获取当前的缓存数据
  const previousData = queryClient.getQueryData(["video"]);

  // 乐观更新，假设点赞成功
  queryClient.setQueryData(["video"], {
    ...previousData,
    liked: !previousData.liked,
    count: previousData.liked
      ? previousData.count - 1
      : previousData.count + 1,
  });

  return { previousData };
},
```

其中我们向 `useMutation` 中额外新增了 `onMutate` 回调函数，该函数会在 `mutationFn` 执行之前被触发，用来做一些突变前的准备工作，比如修改本地状态。`setQueryData` 用来更新或者预填充某个查询的缓存数据，可以看到在变更点赞状态之前我们手动调用了 `setQueryData` 来更新点赞的状态和数量。

此时，当我们重新点击按钮，可以发现状态会立即被乐观更新，用户的体验得到了极大的提升。


## 总结

通过本文的介绍，我们详细了解了 TanStack Query 以及各种用法。那么我们可以进一步提出一个问题：既然有了 TanStack Query，我们是否还需要其它状态管理库呢？

答案自然是：肯定的！我们在前面的章节中介绍了状态可以分为局部状态、全局状态和服务器状态三种，TanStack Query 被用来管理异步数据，如从服务器获取的数据。而我们前面介绍的 Zustand、Jotai、Valtio 包括 MobX、Redux 等都用来管理客户端的数据，虽然也可以用于管理异步请求回来的数据，但无疑这部分交给 TanStack Query 处理更合适。因此，我们也推荐来组合使用，例如在购物场景中，你可以使用 TanStack Query 来获取和管理商品列表、用户评论等数据，同时使用 Zustand 或 Jotai 等来管理购物车、用户界面偏好等客户端状态。

当然 TanStack Query 官网也是这么推荐的：

> In this situation it's important to note that **TanStack Query is not a replacement for local/client state management**. However, you can use TanStack Query alongside most client state managers with zero issues.
> 
> 需要注意的是，**TanStack Query 不能替代本地/客户端状态管理**（比如上面提到的 Zustand、Jotai、Valtio 等）。但是，您可以将 TanStack 查询与大多数客户端状态管理库一起使用，而不会出现任何问题。




本章我们详细地介绍了 TanStack Query。从下一节开始，我们来实现 TanStack Query 源码，实现会分为下面几个部分：



<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ce5432af66b640aa9644d1550f15c4e5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=974&h=708&s=69476&e=png&b=fffefe" alt="image.png" width="60%" /></p>

- 核心逻辑（22 章）：由于 TanStack Query 代码量比较庞大，因此我们将源码实现拆成了两章，在第 22 章中会搭建出 TanStack Query 的框架，并实现基本的异步请求查询逻辑。

- 核心功能（23 章）：我们会进一步进行扩充，演示更复杂的功能在 TanStack Query 内部是如何实现的，即我们在本章会实现`查询过期`、`缓存回收`、`查询取消`、`错误重试`、`预加载` 五大能力。
- 兼容 RSC（24 章）：React 19 正式提出了 RSC（React Server Component）能力，相应的社区库也进行了相应的改造，在本章中我们会介绍什么是 RSC 以及演示 RSC 给社区带来了什么活力，同时继续改造我们的 TanStack Query 让它兼容 RSC。
- DevTools（25 章）：TanStack Query 也提供了 DevTools 方便我们进行调试，在本小册中也会基于我们实现的 TanStack Query 之上进一步去实现 DevTools 能力。
- 单元测试（27 章）：当然我们也会实现 TanStack Query 的单元测试部分，用来演示开源库是如何保障自己核心功能，同时也能够验证我们实现的 TanStack Query 的准确性。在该章中也会连带去实现 Zustand、Jotai、Valtio 的单元测试。
