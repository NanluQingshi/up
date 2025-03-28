
在上一节中我们搭建了 TanStack Query 框架，在本节中让我们在这个框架之上继续扩展更多能力，进一步揭示一个个非常实用的能力在 TanStack Query 源代码中是如何实现的。

<div align="center">

|  | 上一章 | 本章 |
| --- | --- |--- |
| 框架搭建 | ✅ |  |
| 错误重试 |  | ✅ |
| 查询过期 |  | ✅  |
| 缓存回收  |  | ✅ |
| 查询取消 |  | ✅ |
| 预加载 |  | ✅ |

</div> 
 
> 完整代码实现见仓库：https://github.com/q-u-n/state-management-collection



## 错误重试（retry）

当请求出错时 TanStack Query 会自动帮助我们做请求重试，这个重试次数默认为 3，同时在每次出错后都会等待一定的时间才会进行下一次请求。


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




通过上一章的学习，我们知道 `retryer` 是真正用来执行请求函数的地方，顾名思义请求重试也应该在这里来实现。

首先我们要实现自定义配置能力，即可以在 `useQuery` 中传入 `retry` 和 `retryDelay` 分别来控制`最大重试次数`和`重试间隔`，这两个参数为可选项，如果没有传入则采用 TanStack Query 的默认值。而这两个参数最终会被传入到 `createRetryer` 中进行消费：


```ts
// query.ts
export class Query<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> {
  // ...
 
  fetch(options?: QueryObserverOptions<TData, TQueryKey>) {
    if (options) {
      this.options = options
    }

    // 发起请求函数
    const fetchFn = () => {
      return this.options.queryFn(queryFnContext)
    }
    const context = {
      fetchFn,
      options: this.options,
    }

    // 更新状态，通知组件 re-render，这时候 `status` 为 'pending'，组件可以进一步展示正在加载状态时的 UI
    this.#dispatch({ type: 'fetch' })

    this.#retryer = createRetryer({
      fn: context.fetchFn as () => Promise<TData>,
      onSuccess: (data) => {
        // 请求成功后更新状态
        this.#dispatch({
          data,
          type: 'success',
        })
      },
      onError: (error: TError) => {
        // 请求失败后更新状态
        this.#dispatch({
          type: 'error',
          error: error as TError,
        })
      },
+     // 重试次数
+     retry: context.options.retry,
+     // 重试间隔时间
+     retryDelay: context.options.retryDelay,
    })
    this.#promise = this.#retryer.promise
    return this.#promise
  }
  
  // ...
}
```

然后就可以在 `createRetryer` 中拿到这两个参数：

```ts
// retryer.ts
// 默认的请求重试延迟间隔函数
+ function defaultRetryDelay(failureCount: number) {
+   return Math.min(1000 * 2 ** failureCount, 30000)
+ }

export function createRetryer<TData = unknown, TError = Error>(
  config: RetryerConfig<TData, TError>,
): Retryer<TData> {
+  // 记录请求失败次数
+  let failureCount = 0

  let promiseResolve: (data: TData) => void
  let promiseReject: (error: TError) => void

  const promise = new Promise<TData>((outerResolve, outerReject) => {
    promiseResolve = outerResolve
    promiseReject = outerReject
  })

  const resolve = (value: any) => {
    config.onSuccess?.(value)
    promiseResolve(value)
  }

  const reject = (value: any) => {
    config.onError?.(value)
    promiseReject(value)
  }

  const run = () => {
    let promiseOrValue: any
    try {
      // 执行异步请求
      promiseOrValue = config.fn()
    } catch (error) {
      promiseOrValue = Promise.reject(error)
    }
    Promise.resolve(promiseOrValue)
      .then(resolve)
      .catch((error) => {
+       // 默认重试次数
+       const retry = config.retry ?? 3
+       // 默认在出错后重试间隔
+       const delay = config.retryDelay ?? defaultRetryDelay(failureCount)
+       const shouldRetry = failureCount < retry
+       if (!shouldRetry) {
          reject(error)
          return
+       }

+       // 增加失败次数
+       failureCount++

+       sleep(delay).then(() => {
+         // 等待延迟后重试
+         run()
+       })
      })
  }

  run()

  return {
    promise,
  }
}
```

即当没有在 `useQuery` 中传入 `delay` 时默认会重试 3 次，当没有传入 `retryDelay` 时会调用 `defaultRetryDelay` 来计算每次重试的延迟间隔，重试等待时间间隔会随着重试次数而不断升高，默认不超过 30s，因此可以看到在 TanStack Query 内部其实做了大量且大胆的的默认配置项。

我们可以用一个图来表示这个过程：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ec85842771cd490d94916d66444c1b2e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1232&h=498&s=26446&e=png&b=ffffff" alt="image.png" width="70%" /></p>



## 查询过期（staleTime）

通常当我们完成一个查询，该查询立刻会变成 `stale（过期）`状态，这样即使已经有了缓存仍然需要重新请求数据，我们可以增加 `staleTime` 参数来修改它的过期时间：


```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
+ staleTime: 10000,
});
```


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80efc5da0d82469ebd9524e2fde9da81~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1236&h=724&s=402874&e=gif&f=141&b=fdfcff" alt="20240504194231_rec_.gif" width="70%" /></p>

可以看到，此时返回上一页就没有额外的请求了，这里的是否过期是站在使用者的角度上来看待的，比如有多个 `useQuery`，传入了不同的 `staleTime` 参数，那么传入较小的 `staleTime` 就可能需要额外的重新请求数据，而较长的 `staleTime` 则不需要。


接下来让我们来实现一下这个能力，不难想到其实就是在请求前增加一个条件来判断数据是否过期：


```ts
// queryObserver.ts
+ // 判断是否应该发起请求
+ function shouldFetchOptionally(
+ query: Query<any, any, any>,
+ prevQuery: Query<any, any, any>,
+ options: QueryObserverOptions<any, any>,
+): boolean {
+  return prevQuery !== query && query.isStaleByTime(options.staleTime)
+}

export class QueryObserver<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> extends Subscribable {
  // ...

  setOptions(options?: QueryObserverOptions<TData, TQueryKey>) {
    this.options = options ?? this.options
    const prevQuery = this.#currentQuery
    // 构造 `query`
    this.#updateQuery()
-   if (prevQuery !== this.#currentQuery) {
+   if (shouldFetchOptionally(this.#currentQuery, prevQuery, this.options)) {
      // 发起请求
      this.#executeFetch()
    }
  }

  // ...
}
```

在这里将原先 `#executeFetch` 执行条件抽成了 `shouldFetchOptionally` 函数，并增加了对 `staleTime` 的判断，我们再在 `Query` 中实现一下 `isStaleByTime` 方法：

```ts
// query.ts
export class Query<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> extends Removable {
  // ...

+ // 判断数据是否 `stale` (过期)
+ isStaleByTime(staleTime = 0): boolean {
+   return (
+     this.state.data === undefined ||
+     this.state.dataUpdatedAt + staleTime < Date.now()
+   )
+ }

  #dispatch(action: Action<TData, TError>): void {
    const reducer = (
      state: QueryState<TData, TError>,
    ): QueryState<TData, TError> => {
      switch (action.type) {
        case 'success': {
          return {
            ...state,
            data: action.data,
            status: 'success', // 代表数据请求成功
 +          dataUpdatedAt: Date.now(), // 记录下更新状态的时间，用来对比数据是否 `stale`
          }
        }
        case 'fetch': {
          return {
            ...state,
            status: 'pending', // 正在请求数据中
          }
        }
        case 'error': {
          const error = action.error
          return {
            ...state,
            error: error,
            status: 'error', // 发生错误
          }
        }
      }
    }
    // 更新状态
    this.state = reducer(this.state)
    // 触发组件 re-render
    this.#observers.forEach((observer) => {
      observer.updateResult()
    })
  }
  
  // ...
}

function getDefaultState<TData, TError>(): QueryState<TData, TError> {
  return {
+   dataUpdatedAt: Date.now(),
    data: undefined as TData,
    status: 'pending',
    error: null,
  }
}
```

即数据没有过期（`isStaleByTime` 为 `false`），也就是 `this.state.dataUpdatedAt + staleTime < Date.now()` 则不会发起额外的请求，而 `dataUpdatedAt` 会在请求成功后被更新为当前的时间。

举一个形象的例子来演示这个过程：



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c566311e1b054beaa84c5f6bb4e74b08~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1106&h=524&s=56913&e=png&b=ffffff" alt="image.png" width="70%" /></p>

对于每一个请求 `QueryObserver` 需要知道数据是否不新鲜（过期），但是 `QueryObserver` 并不知道，因为这些数据比如 `dataUpdatedAt`（数据更新的时间）存储在 `Query` 实例之上。因此，`QueryObserver` 就需要去问 `Query` 这个数据是否过期，我是否还需要再去请求数据（调用 `isStaleByTime` 函数）。如果过期，即函数返回为 `true`，则再去请求。


## 缓存回收（gcTime）

我们知道，当创建 `Query` 之后会缓存到 `QueryCache` 的 `#queries` 上，也就是一个 Map。但是这个 Map 不可能一直增加，这会导致内存泄漏，我们需要一个机制来进行垃圾回收，也就是从 Map 去 `delete` 不重要的 `Query`。与 `staleTime` 类似，这个可以在 `useQuery` 中传入 `gcTime` 来定制化，如果不传则默认 5 分钟。举一个例子，当设置 `gcTime` 为 0 后，意味着 `Query` 会被立即从缓存中移除，这样即使返回上一页也需要重新展示 Loading...：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/527e71aa140f4a2b9aa8756fd5bd4d0d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1008&h=384&s=254380&e=gif&f=99&b=fdfcff" alt="20240504190714_rec_.gif" width="70%" /></p>

```js
const { isPending, error, data } = useQuery({
  queryKey: ["projects", page],
  queryFn: () => fetchData(page),
+ gcTime: 0,
});
```

可以看到，此时即使返回上一页也需要重新拉取数据，因为缓存立即失效了。

不难想到缓存移除其实是移除对应的 `Query`，因此在 `QueryCache` 中首先要提供一个方法来从 Map 中移除 `Query` 实例，对应 `remove` 方法：


```ts
export class QueryCache {
  // ...
  
  // 移除缓存
  remove(query: Query<any, any, any>): void {
    const queryInMap = this.#queries.get(query.queryHash)

    if (queryInMap) {
      // 防御性编程，理论上相同的 `queryHash` 应该对应同一个 `query`
      if (queryInMap === query) {
        this.#queries.delete(query.queryHash)
      }
    }
  }
  
  // ...
}
```

同时在 `Query` 中我们需要实现这几个事情：

- 保存用户传入的 `gcTime`，用来控制多久回收 `Query`。
- 垃圾回收，在 `gcTime` 间隔后调用 `QueryCache` 上的 `remove` 方法。

我们可以将这部分能力独立出去成一个类（`Removable`），并让 `Query` 继承它，类似于 `QueryObserver` 与 `Subscribable` 的关系：


```ts
// removable.ts
export abstract class Removable {
  gcTime!: number

  protected scheduleGc(): void {
    setTimeout(() => {
      this.optionalRemove()
    }, this.gcTime)
  }

  protected updateGcTime(newGcTime: number | undefined): void {
    // 默认query回收时间为5分钟
    this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? 5 * 60 * 1000)
  }

  protected abstract optionalRemove(): void
}
```

然后再改一下 `Query`，让它能在合适的时候触发垃圾回收机制和更新 `gcTime` 值：


```ts
export class Query<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> extends Removable {
  // ...

  fetch(options?: QueryObserverOptions<TData, TQueryKey>) {
    if (options) {
      this.options = options
    }

+   // 更新 `query` 回收时间
+   this.updateGcTime(this.options.gcTime)

    // 发起请求函数
    const fetchFn = () => {
      return this.options.queryFn()
    }
    const context = {
      fetchFn,
      options: this.options,
    }

    // 更新状态，通知组件 re-render，这时候 `status` 为 'pending'，组件可以进一步展示正在加载状态时的 UI
    this.#dispatch({ type: 'fetch' })

    this.#retryer = createRetryer({
      fn: context.fetchFn as () => Promise<TData>,
      onSuccess: (data) => {
        // 请求成功后更新状态
        this.#dispatch({
          data,
          type: 'success',
        })
 +      // 请求成功后调度 `scheduleGc` 来垃圾回收
 +      this.scheduleGc()
      },
      onError: (error: TError) => {
        // 请求失败后更新状态
        this.#dispatch({
          type: 'error',
          error: error as TError,
        })
      },
      // 重试次数
      retry: context.options.retry,
      // 重试间隔时间
      retryDelay: context.options.retryDelay,
    })
    this.#promise = this.#retryer.promise
    return this.#promise
  }

+ protected optionalRemove() {
+   this.#cache.remove(this)
+ }
}
```


## 查询取消（Query Cancellation）

对于一个请求，如果不需要关心它的结果，我们就可以取消这次请求，这样有助于减少服务端资源消耗、节省带宽以及提高性能。通常我们不需要主动关心请求的取消，TanStack 会在 `queryFn` 执行的时候传入 `signal`，我们需要做的只是将 `signal` 作为请求的参数传入即可。

我们来看一个例子：



> 点击查看 Demo：https://codesandbox.io/p/sandbox/query-cancellation-r4rf34?file=%2Fsrc%2FApp.js%3A9%2C2


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8840423b8cfb476eb2635dcde1f0cb53~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1096&h=640&s=141317&e=gif&f=61&b=fdfcff" alt="20240501185711_rec_.gif" width="50%" /></p>

```js
const fetchData = async () => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos?_delay=3000&_limit=5`,
    { signal }
  );
  const data = await res.json()
  return data;
}

function TodoList() {
  const { isPending, error, data } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetchData()
    queryFn: ({ signal }) => fetchData(signal)
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

可以看到，我们只需要将 TanStack Query 提供给我们的 `signal` 作为 `fetch` 的参数传入，这样当组件卸载的时候就会自动取消不需要的请求。

因此，我们需要做两个事情：

- 调用 `AbortController`，并将 `signal` 传入到 `queryFn` 中。
- 在合适的地方调用 `abortController.abort()` 来取消请求。

让我们来实现一下：


```ts
// Query.ts
export class Query<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> extends Removable {
  // ...
  
+ // 取消请求
+ cancel() {
+   this.#retryer?.cancel()
+ }
  
  fetch(options?: QueryObserverOptions<TData, TQueryKey>) {
    if (options) {
      this.options = options
    }

    // 更新 `query` 回收时间
    this.updateGcTime(this.options.gcTime)

+   // 用于取消请求
+   const abortController = new AbortController()

+   const queryFnContext: QueryFunctionContext = {
+     signal: abortController.signal,
+   }

    // 发起请求函数
    const fetchFn = () => {
-     return this.options.queryFn()
+     return this.options.queryFn(queryFnContext)
    }
    const context = {
      fetchFn,
      options: this.options,
    }

    // 更新状态，通知组件 re-render，这时候 `status` 为 'pending'，组件可以进一步展示正在加载状态时的 UI
    this.#dispatch({ type: 'fetch' })

    this.#retryer = createRetryer({
      fn: context.fetchFn as () => Promise<TData>,
+     abort: abortController.abort.bind(abortController),
      onSuccess: (data) => {
        // 请求成功后更新状态
        this.#dispatch({
          data,
          type: 'success',
        })
        // 请求成功后调度 `scheduleGc` 来垃圾回收
        this.scheduleGc()
      },
      onError: (error: TError) => {
        // 请求失败后更新状态
        this.#dispatch({
          type: 'error',
          error: error as TError,
        })
      },
      // 重试次数
      retry: context.options.retry,
      // 重试间隔时间
      retryDelay: context.options.retryDelay,
    })
    this.#promise = this.#retryer.promise
    return this.#promise
  }
  
  // ...
}
```

然后在 `createRetryer` 中暴露出 `cancel` 函数：


```ts
export function createRetryer<TData = unknown, TError = Error>(
  config: RetryerConfig<TData, TError>,
): Retryer<TData> {
  // ...

+ const cancel = () => {
+   config.abort()
+ }

  // ...

  return {
    promise,
+   cancel,
  }
}
```

最后在 `QueryObserver` 中增加 `onUnsubscribe`，在组件卸载后调用，来取消请求：


```ts
export class QueryObserver<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> extends Subscribable {
  // ...
  
+ protected onUnsubscribe(): void {
+   if (!this.hasListeners()) {
+     // 取消监听
+     this.#currentQuery.cancel()
+   }
+ }
  
  // ...
}
```


 
 
## 预加载（prefetching）


TanStack Query 提供了一个非常有用的功能称为预加载（prefetching），这允许开发者在数据使用之前就提前加载它。这种方式可以显著提高用户体验，因为它减少了用户等待数据加载的时间。在用户与应用互动时，数据可以即时显示，因为它已经被加载并缓存在后台。

例如：

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

可以观察到，当我们将鼠标移动到按钮处时就已经发出了网络请求，因此此时当用户点击按钮之后会更早地看到内容。让我们在 `QueryClient` 中来实现预加载能力：




```ts
// queryClient.ts
export class QueryClient {
  // ...

  fetchQuery<TData = unknown, TQueryKey extends QueryKey = QueryKey>(
    options: QueryObserverOptions<TData, TQueryKey>,
  ) {
    const defaultedOptions = this.defaultQueryOptions(options)
    const query = this.#queryCache.build(defaultedOptions)
    return query.isStaleByTime(defaultedOptions.staleTime)
      ? query.fetch(options)
      : Promise.resolve(query.state.data)
  }

  // 预加载
  prefetchQuery<TData = unknown, TQueryKey extends QueryKey = QueryKey>(
    options: QueryObserverOptions<TData, TQueryKey>,
  ): Promise<void> {
    return this.fetchQuery(options).then(noop).catch(noop)
  }

  // ...
}
```

可以看到在 `prefetchQuery` 实现中只是简单地判断了 `staleTime`，如果数据没有失效就调用 `fetch` 完成数据请求。


## 总结

为了证明我们实现 TanStack Query 的准确性，增加单元测试作为验证：

> 单测代码见： https://github.com/q-u-n/state-management-collection/tree/main/packages/react-query/__tests__

在后续有专门的单元测试章节带领大家实现单元测试部分，运行单元测试 `pnpm run test`：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8cc3ddf48d6040c5adebf762f19436fe~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=846&h=350&s=72426&e=png&b=202020" alt="image.png" width="60%" /></p>

可以看到通过了单元测试校验。

在本节中，我们演示了 TanStack Query 一些很实用的能力在源码中是如何实现的。在下一节中我们会讲解什么是 RSC（React Server Component）并在源码中兼容 RSC。