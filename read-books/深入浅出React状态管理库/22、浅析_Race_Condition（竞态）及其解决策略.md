本章会来介绍一下什么是 Race Condition（竞态）以及 Race Condition 的解决策略，并通过一个渐进式的例子带你逐步在组件中完成一个异步请求代码的编写。

为什么要写这章？因为笔者发现很多项目只是简单做了些请求的封装，并没有考虑 Race Condition 的问题以及其它因素，学习本章会帮助你认识到在封装请求时我们需要考虑哪些因素，进而帮助你进一步理解 TanStack Query 的价值。 



为了模拟真实的 API 请求场景，本节和后续 TanStack Query 的案例会借助 `jsonplaceholder`（一个免费的在线 REST API 服务）来做，官网：[jsonplaceholder.typicode.com/](https://link.juejin.cn/?target=https%3A%2F%2Fjsonplaceholder.typicode.com%2F "https://jsonplaceholder.typicode.com/")。

我们先来看一下文中会涉及到的一些 JSONPlaceholder 的用法：

- `/todos`：获取所有 todos。
- `/todos/1`：代表获取特定的 todos，这里是获取第一个。
- `_delay`：用于模拟网络延迟的情况，我们可以借助这个参数模拟竞态条件。
- `_limit`：限制返回结果数量。
- `_page`：用于指定返回结果的页码，用于实现分页功能。


好，接下来让我们正式开始学习。


## 什么是 React Race Condition（竞态）

React Race Condition 是指组件的状态在更新过程中，因为异步操作的结果顺序不确定性，导致最终的组件状态不符合预期的问题。

我们来看一个例子：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/race-condition1-qsxnfj?file=%2Fsrc%2FApp.js%3A33%2C2



<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f49088f0ec74072af2f5beef59dad38~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=388&h=164&s=71847&e=gif&f=76&b=fcfbfe" alt="20240420184612_rec_.gif" width="30%" /></p>

```js
import { useEffect, useState } from "react";

function Display({ id }) {
  const [title, setData] = useState("");
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        `https://jsonplaceholder.typicode.com/todos/${id}?_delay=${5000 / id}`
      );
      const { title } = await res.json();
      setData(`${id}-${title}`);
    };
    fetchData();
  }, [id]);
  return <div>{title || "loading"}</div>;
}

export default function App() {
  const [id, setId] = useState(1);
  return (
    <>
      <button
        onClick={() => {
          setId((id) => id + 1);
        }}
      >
        +1
      </button>
      <Display id={id} />
    </>
  );
}
```


在这个例子中，我们通过 `_delay` 模拟了竞态条件，即当请求序号增加时对应减少网络请求时延。

可以看到，当我们连续点击两次按钮时预期应该展示 `id` 为 3 所对应的 todo，而由于 2 对应的请求滞后返回了，因此最终展示了 `id` 为 2 所对应的 todo。这就是 React Race Condition，为了帮助大家更好地理解，我们用一个图来表示：



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/06bd6e7ef53845a09d78b34380fbae0b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=640&h=842&s=58195&e=png&b=ffffff" alt="image.png" width="50%" /></p>


解决这个问题有很多方式，例如：

1. 利用闭包来解决。
2. 利用 Suspense 来解决。
3. 利用 AbortController 来解决。
4. 利用社区一些开源库，例如 ahooks 中的 `useRequest`、 TanStack Query、SWR 等等库来解决。

我们分别来看下每种方案应该如何实现。


### 闭包

> 点击查看 Demo：https://codesandbox.io/p/sandbox/closure-pqmf3y?file=%2Fsrc%2FApp.js%3A39%2C2


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0941bcbc14594b0fb0d0a59ec6273145~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=412&h=200&s=44303&e=gif&f=45&b=fcfbfe" alt="20240420232244_rec_.gif" width="30%" /></p>

我们可以增加一个 `flag` 变量用来控制，当组件被卸载后，我们将 `flag` 置为 `false`，这样即使数据请求回来，也不会改写状态。

```js
function Display({ id }) {
  const [title, setData] = useState("");
  useEffect(() => {
    let flag = true;

    const fetchData = async () => {
      const res = await fetch(
        `https://jsonplaceholder.typicode.com/todos/${id}?_delay=${3000 / id}`
      );
      const { title } = await res.json();
      if (flag) {
        setData(`${id}-${title}`);
      }
    };
    fetchData();

    return () => {
      flag = false;
    };
  }, [id]);
  return <div>{title || "loading"}</div>;
}
```


### Suspense

> 点击查看 Demo：https://codesandbox.io/p/sandbox/suspense-2w967z?file=%2Fsrc%2FApp.js%3A38%2C2

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d7f7df4d662d446ebe4819e938ac2f8c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=344&h=156&s=113788&e=gif&f=105&b=fcfbfe" alt="20240107222042_rec_.gif" width="30%" /></p>


```js
const cachePool = {};

function fetchData(id) {
  const cache = cachePool[id];
  if (cache) {
    return cache;
  }
  cachePool[id] = (async () => {
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/todos/${id}?_delay=${3000 / id}`
    );
    const { title } = await res.json();
    return `${id}-${title}`;
  })();
  return cachePool[id];
}

function Display({ id }) {
  const title = use(fetchData(id));
  return <div>{title || "loading"}</div>;
}

export default function App() {
  const [id, setId] = useState(1);
  return (
    <Suspense fallback={<div>loading...</div>}>
      <button
        onClick={() => {
          setId((id) => id + 1);
        }}
      >
        +1
      </button>
      <Display id={id} />
    </Suspense>
  );
}
```

可以看到，当发生异步请求的时候会立即渲染 `fallback` 状态，直到等待异步数据返回后才会继续渲染内容，因此就不会存在 Race Condition 的问题。



### AbortController

`AbortController` 允许你主动取消正在进行中的异步操作，如 `fetch` 请求，可以用来避免不必要的资源消耗以及解决 Race Condition 问题。

> 点击查看 Demo：https://codesandbox.io/p/sandbox/abortcontroller-ky7ghj?file=%2Fsrc%2FApp.js%3A42%2C2

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b8b462cfb2eb483395227d9f530d6175~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1464&h=680&s=156168&e=gif&f=39&b=fdfcff" alt="20240107161026_rec_.gif" width="90%" /></p>


```js
function Display({ id }) {
  const [title, setData] = useState("");
  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      const res = await fetch(
        `https://jsonplaceholder.typicode.com/todos/${id}?_delay=${3000 / id}`,
        {
          signal: abortController.signal,
        }
      );
      const { title } = await res.json();
      setData(`${id}-${title}`);
    };
    fetchData();

    return () => {
      abortController.abort();
    };
  }, [id]);
  return <div>{title || "loading"}</div>;
}
```

在这个例子中，我们通过 `AbortController` 创建了一个实例，并将 `signal` 作为 `fetch` 的参数传入，最后当组件卸载时我们调用 `abortController.abort()` 来取消这次请求，即每次新的请求之前会 cancel 掉上一次的请求。


### 社区

我们以 TanStack Query 为例来看一下如何解决这个问题：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/tanstack-query-yrw8pm?file=%2Fsrc%2FApp.js%3A12%2C31



```js
const fetchData = async (id) => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos/${id}?_delay=${5000 / id}`
  );
  const { title } = await res.json()
  return `${id}-${title}`;
}

function Display({ id }) {
  const { data: title, isLoading } = useQuery({
    queryKey: ['todo', id],
    queryFn: fetchData
  })
  return <div>{isLoading ? "loading" : title}</div>;
}
```







## 封装请求逻辑

至此，我们已经全面地介绍了如何在 React 中解决 Race Condition 问题。在这个过程中，我们展示了基本的异步请求处理逻辑。然而，在日常开发中，我们往往会遇到更加多样化和复杂的场景。接下来，我们将通过一个渐进式的例子来探讨在真实环境中需要考虑的各种因素。

> 完整版本查看 Demo：https://codesandbox.io/p/sandbox/race-condition2-lprpmt?file=%2Fsrc%2FApp.js%3A3%2C1-32%2C3




### 初始版本

假如现在你接到了一个需求，需要获取用户的工作事项（todos）并展示到页面上，于是你不假思索写了一个 `<TodoList />` 组件：



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/097104f3a622431fafef170578c9f843~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=852&h=320&s=42224&e=gif&f=34&b=fdfcff" alt="20240421081310_rec_.gif" width="50%" /></p>


```js
import { useState, useEffect } from "react";

export default function TodoList() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
      });
  }, []);

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

即在 `useEffect` 中发起了异步请求，拿到数据以后更新状态。


### 状态控制

这时候你会发现好像还差点什么，好像缺少了当加载数据的时候如何展示以及当发生错误时如何展示时的逻辑，好吧，让我们把它加上：



<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e3c283653c1b47f1aceeb69fba696649~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=812&h=316&s=69170&e=gif&f=47&b=fdfcff" alt="20240421081458_rec_.gif" width="50%" /></p>

```js
import { useState, useEffect } from "react";

export default function TodoList() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState([])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetch('https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5')
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setIsLoading(false)
      })
      .catch((e) => {
        setError(e)
      })
  }, [])

  if (isLoading) return <div>Loading...</div>

  if (error) return <div>发生了错误</div>

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
``` 

在上面的例子中：

- `isLoading` 来代表是否正在加载网络数据。
- `error` 来记录错误。
- `data` 来记录请求回来的 `todos` 数据。

当不同的情况，如加载数据中/发生错误/数据请求回来，分别展示不同的 UI。


### 抽取 Hook

现在已经开始有点繁琐了，能不能让这个 `<TodoList />`：看起来更干净一些！


我们可以把请求相关的逻辑提取出来，封装为一个 `useQuery` hook：


```js
export default function TodoList() {
  const { isLoading, error, data } = useQuery();

  if (isLoading) return <div>Loading...</div>;

  if (error) return <div>发生了错误</div>;

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```
 
 `useQuery`：
 
 
```js
const useQuery = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetch('https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5')
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setIsLoading(false)
      })
      .catch((e) => {
        setError(e)
      })
  }, [])

  return { isLoading, error, data };
};
```



### 分页

当然，你不可能一次把全部的 `Todos` 数据请求下来，通常会做分页加载或者懒加载。即不会一次拿到所有数据，而是在进入不同的页码时才请求对应的数据。

因此，我们需要在请求中加一些参数来控制，同时在 `<TodoList />` 中增加一个按钮来控制页数：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f79dbeb899cd4e0086d4a9c735077d9a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=840&h=364&s=268821&e=gif&f=126&b=fdfcff" alt="20240420114748_rec_.gif" width="50%" /></p>



```js
export default function TodoList() {
  const [page, setPage] = useState(1);

  const { isLoading, error, data } = useQuery(page);

  if (isLoading) return <div>Loading...</div>;

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


 `useQuery`：
 
 
```js
const useQuery = (page) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState([])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetch('https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5&_page=${page}')
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setIsLoading(false)
      })
      .catch((e) => {
        setError(e)
      })
  }, [page])
  
  return { isLoading, error, data }
}
```




### Race Condition


这时候你突然想起来前面所学的内容，如果当多次请求时可能会导致 Race Condition 的问题！让我们借助 `AbortController` 来解决这个问题：
 
```js
const useQuery = (page) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const abortController = new AbortController()

    fetch(`https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5&_page=${page}`, { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setIsLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e);
        }
      });

    return () => {
      abortController.abort()
    }
  }, [page]);

  return { isLoading, error, data };
};
```





### 缓存数据


现在每次点击 `+` 会请求下一页的数据，如果点击 `-` 会切换到上一页，同样的也会请求上一页的数据。不难想到我们需要增加一个缓存机制来保存相同 page 下的数据，从而来优化用户体验以及减少带宽的消耗：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/26923d4006024be69efa3877bef06161~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1032&h=352&s=241277&e=gif&f=98&b=fdfcff" alt="20240420200206_rec_.gif" width="50%" /></p>




```js
const useQuery = (page) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const mapRef = useRef(new Map())

  useEffect(() => {
    if (mapRef.current.has(page)) {
      setData(mapRef.current.get(page))
      return;
    }
    setIsLoading(true);
    setError(null);

    const abortController = new AbortController()

    fetch(`https://jsonplaceholder.typicode.com/todos?_delay=1000&_limit=5&_page=${page}`, { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setIsLoading(false);
        mapRef.current.set(page, data)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e);
        }
      });

    return () => {
      abortController.abort()
    }
  }, [page]);

  return { isLoading, error, data };
};
```

可以看到，在增加了缓存逻辑之后再返回上一页时可以直接拿到状态从而避免了额外的网络请求。


## 总结

**更多，我还要更多！！！**

到此，我们已经解决了：

- 根据是否正在加载中以及是否发生错误时向用户展示不同的内容。
- 封装请求 Hook，让组件更加清晰以及方便重用。
- 增加了分页加载机制，即不会一次性拉取全部数据而是按需加载用户需要的数据。
- 利用 `AbortController` 解决了 Race Condition 的问题。
- 增加缓存机制，提高了用户体验，减少网络带宽的消耗。

好像现在已经很完美了，不，还远远不够！我们还需要：

- 缓存失效：既然有了缓存机制那一定需要缓存失效机制，不然显示到页面的数据就可能过时，因此我们需要增加缓存失效机制，比如当网络断开重新连接时让缓存失效。
- 错误重试机制：如果网络请求出错了，封装的 Hook 应该能帮助我们进行自动重试。
- 数据预取：例如我们可以预测用户的行为，并提前加载这部分的数据。比如用户经常查看的页面我们可以提前去加载它，从而提高用户体验。
- 状态共享：当同样的请求发生在多个组件中，我们希望能够共享状态，而不是反复地拉取数据。
- 请求去重：对于同一个 `useQuery` 我们会有缓存机制，但是如果同时在不同的组件中调用 `useQuery` Hook 时，仍然会向同一个 `URL` 发送多次请求，因此你需要实现一个机制来对相同的请求进行去重。
- React 新特性支持：在上面的例子中当发生了异步逻辑时，会更新 `isLoading` 为 `true`，即在组件中判断 `if (isLoading) return xxx`，而更好的写法是结合 Suspense 来解决异步问题。
- Hydration：如果在 SSR 已经拿好数据，如何在 Hydration 时填充数据。
- ……



而这些都可以借助 TanStack Query 来解决，下一章我们将全方位来介绍 TanStack Query。



