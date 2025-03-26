本节开始我们将来实现 TanStack Query，首先我们需要确定在我们的代码中需要实现哪些内容。


TanStack Query 代码量会比较大，因此将实现划分为了两个部分，在本节中会实现 TanStack Query 的框架部分，在下一节我们将会继续扩展，来实现更多能力。

> 为了方便大家理解在源码实现中会做一些简化，本章实现见代码仓库：https://github.com/q-u-n/state-management-collection/tree/tanstack-query%401.0.0 。

<div align="center">

|  | 本章 | 下一章 |
| --- | --- |--- |
| 框架搭建 | ✅ |  |
| 查询过期 |  | ✅  |
| 缓存回收  |  | ✅ |
| 请求去重  |  | ✅ |
| 查询取消 |  | ✅ |
| 错误重试 |  | ✅ |

</div>



## 架构分析

在[源码仓库](https://github.com/tanstack/query)可以看到 TanStack Query 以 Monorepo 的形式来组织代码：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/96a92b21212549bbbd977689d4a3fb2c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=744&h=1608&s=159800&e=png&b=ffffff" alt="image.png" width="40%" /></p>

当然我们也是这么做的，这也通常是社区对于复杂项目的解决方案，即当这个库变得更加庞大和复杂时会采用 Monorepo 来进行组织和管理。但我们前面介绍的 Jotai、Zustand 则不是这样的，它们也同样拥有庞大的生态。原因其实是 TanStack Query 主要由作者 [Tanner](https://github.com/tannerlinsley) 和他的核心团队进行贡献和维护，而 Daishi 则需要管理更多库，因此 Jotai、Zustand、Valtio 则更依赖于社区的贡献，因此它们采用了 Muti-Repo（多仓）形式。

> 来源：https://twitter.com/dai_shi/status/1766287081641558435


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a3ddb98c0b8148c2ab5a02a87bad8c87~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1066&h=1462&s=706526&e=png&b=f2f8fd" alt="image.png" width="50%" /></p>

TanStack Query 的源码量比较大，但是各个模块之间职责非常清晰，在正式开始代码实现之前让我们通过一张图来演示这些模块的职责以及它们之间是如何协作的。


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3393db6ca59340d192bf5a7061a3a5aa~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1600&h=1272&s=198138&e=png&b=ffffff)



在这个图中包含了 TanStack Query 源码中几个重要的核心概念，让我们先来介绍一下它们，方便在接下来的源码学习中更好地理解。

- `QueryObserver`：用来监听 `Query` 的状态变化，协调 `Query` 与组件，例如根据 `Query` 生成查询结果，当 `Query` 状态发生变化时触发组件 re-render 等等。当在组件中使用 `useQuery` 时，实际上内部创建了 `QueryObserver` 的实例。

- `Query`：代表了一个具体的数据获取任务，它封装了数据加载的逻辑和当前的数据状态。每个 `Query` 对象都与一个唯一的 `queryKey` 相关联。
- `QueryCache`：一个全局缓存对象，用于存储所有的 `Query` 对象。在 `QueryCache` 中通过查询键可以快速访问到对应的 `Query`。
- `QueryClient`：相当于 TanStack Query 的中心控制器，通过 `QueryCache` 来管理查询，并为应用提供管理查询的接口，比如预请求数据、让缓存失效等等。

这张图为我们提供了一个高层次的视角，对于理解后续的源码实现至关重要。在深入研究代码的过程中，我们可能会遇到一些难以把握的部分，因此可以时常回顾这张图以帮助保持正确的方向。

现在，让我们开始正式实现一个 TanStack Query 吧。


## 源码实现

### QueryClientProvider 与 useQueryClient

通过上一章节的学习，我们了解到使用 TanStack Query 的起点，也就是第一步是我们必须要通过 `QueryClient` 创建一个实例并传入到 `QueryClientProvider` 中，在组件中可以通过 `useQueryClient` 来获取该实例，而这部分是基于 React Context 实现的。让我们先来实现这部分：

```ts
// QueryClientProvider.tsx
import { createContext, ReactNode, useContext } from 'react'

import type { QueryClient } from './queryClient'

export const QueryClientContext = createContext<QueryClient | undefined>(
  undefined,
)

export const useQueryClient = () => {
  const client = useContext(QueryClientContext)
  if (!client) {
    // 这里需要做一个判断，如果拿到的 `client` 为 undefined 就代表没被 `QueryClientProvider` 包裹，需要报错
    throw new Error('未设置 QueryClient，请使用 QueryClientProvider 设置一个')
  }
  return client
}

export type QueryClientProviderProps = {
  client: QueryClient
  children?: ReactNode
}

export const QueryClientProvider = ({
  client,
  children,
}: QueryClientProviderProps) => {
  return (
    <QueryClientContext.Provider value={client}>
      {children}
    </QueryClientContext.Provider>
  )
}
```

可以看到，我们通过 React Context 创建了一个 `QueryClientContext`，并将 `client` 传入到 `Provider` 中，这样可以方便地在组件树中传递和获取 `QueryClient` 实例。


### QueryClient

`QueryClient` 相当于 TanStack Query 的中心控制器，通过 `QueryCache` 来管理查询，并为应用提供管理查询的接口，比如预请求数据，让缓存失效等等。

因为目前没有包含更复杂的功能，因此我们现在只需要在 `QueryClient` 构造函数中实例化并保存 `QueryCache` 以及提供 `getQueryCache` 用来获取 `QueryCache` 实例即可：

```ts
// queryClient.ts
import { QueryCache } from './queryCache'

export class QueryClient {
  #queryCache: QueryCache

  constructor() {
    this.#queryCache = new QueryCache()
  }

  getQueryCache(): QueryCache {
    return this.#queryCache
  }
}
```

> 在下一节中，我们会继续丰富 `QueryClient` 的代码以实现更多能力。


### QueryCache


#### hashKey 实现

在 TanStack Query 缓存中是通过 `queryKey` 来映射对应的 `query` 的，但是我们知道 `queryKey` 这个数组中即使每个元素都相同，数组也不相同，比如：


```js
const arr1 = ['str1', 'str2', {key: 'val'}]
const arr2 = ['str1', 'str2', {key: 'val'}]
arr1 === arr2 // false
```

因此，我们必须需要一种方法可以完整地对比两个数组是否完全相等，很容易想到的一种方式就是通过 `JSON.stringify` 来将数据映射成字符串或者说叫序列化，然后再根据字符串来进行对比不就好了吗？比如：

```js
const arr1 = ['str1', 'str2', {key: 'val'}]
const arr2 = ['str1', 'str2', {key: 'val'}]
JSON.stringify(arr1) === JSON.stringify(arr2) // true
```

但是这样有一个问题，就是在 JavaScript 对象中键是有顺序的，并不是按照插入顺序来的，因此即使两个对象内容相同，`JSON.stringify` 也会产生不同的结果：


```js
const obj1 = { key1: 'val1', key2: 'val2' }
const obj2 = { key2: 'val2', key1: 'val1' }
JSON.stringify(obj1) // '{"key1":"val1","key2":"val2"}'
JSON.stringify(obj2) // '{"key2":"val2","key1":"val1"}'
JSON.stringify(obj1) === JSON.stringify(obj2) // false
```

在这个例子中，我们创建了内容完全相同的两个对象，但是可以观察到 `JSON.stringify` 的结果并不相同。这是由于这些键值对在对象中的顺序不同导致的，在 JavaScript 中对象的键排序会有三种情况：

- **整数索引键**：整数索引键按照数值顺序排序。
- **字符串键**：所有非整数索引的字符串键按照它们被添加到对象的顺序排列。
- **Symbol 键**：所有使用 `Symbol` 类型的键按照它们被添加到对象的顺序排列，且这些键总是排在整数索引键和字符串键之后。


```js
let obj = {
  '100': 'value100', // 整数键
  '1': 'value1', // 整数键
  b: 'valueB', // 字符串键
  a: 'valueA', // 字符串键
  [Symbol('id')]: 1, // Symbol键
  '10': 'value10', // 整数键
}

obj['2'] = 'value2' // 新增一个整数键
obj['y'] = 'valueY' // 新增一个字符串键
obj[Symbol('name')] = 'Name' // 新增一个Symbol键

console.log(Object.getOwnPropertyNames(obj)) // ['1', '2', '10', '100', 'b', 'a', 'y']
console.log(Object.getOwnPropertySymbols(obj)) // [Symbol(id), Symbol(name)]
```

其中 `Object.getOwnPropertyNames` 用来获取对象自身属性名，返回一个数组。`Object.getOwnPropertySymbols` 用来获取对象的符号属性名。

因此，我们需要一种方式来对对象属性顺序进行调整，从而生成稳定的字符串结果。`JSON.stringify` 为我们提供了第二个参数 [replacer](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#replacer_%E5%8F%82%E6%95%B0)，可以传入一个函数，在序列化过程中，被序列化的值的每个属性都会经过该函数进行转换和处理。然后借助 `sort` 方法来对对象键进行排序即可：



```ts
// 判断是否是对象且不为 `null`
function isObject(val: unknown): boolean {
  return typeof val === 'object' && val !== null
}

export function hashKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_, val) =>
    isObject(val)
      ? Object.keys(val) // 如果是对象的话就进行排序，得到稳定的一致的字符串结果
          .sort()
          .reduce((result, key) => {
            result[key] = val[key]
            return result
          }, {} as any)
      : val,
  )
}
```

在代码仓库中，增加了[单元测试](https://github.com/q-u-n/state-management-collection/blob/main/packages/react-query/__tests__/hashKey.test.tsx)部分来对实现的 hashKey 进行校验。





#### QueryCache 实现


`QueryCache` 是一个全局缓存对象，用于存储所有的 `Query` 对象：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f2a42aabb644cd7aa5a6ccd72ebd5bc~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1868&h=656&s=77366&e=png&b=ffffff" alt="image.png" width="80%" /></p>

因此，不难想到我们需要在 `QueryCache` 类中提供以下能力：

- 一个 `Map` 对象用来存储 `Query`，通过 `queryKey` 序列化后的字符串进行映射。
- 给定字符串获取对应 `Query` 的 `get` 方法。
- 将 `Query` 添加到缓存的 `add` 方法。
- 构建 `Query` 实例的 `build` 方法，该方法需要判断 `queryKey` 对应的 `Query` 是否被包含在缓存中，如果不包含才需要构造 `Query` 实例，同时需要把它加入到缓存中。

由此，我们可以将 `QueryCache` 实现出来：


```ts
// queryCache.ts
export class QueryCache {
  #queries: Map<string, Query>

  constructor() {
    // 缓存，`queryKey` -> `query` 的映射
    this.#queries = new Map<string, Query>()
  }

  // `queryHash` —> `query`
  get(queryHash: string) {
    return this.#queries.get(queryHash)
  }

  // 如果当前没有缓存就将该 `query` 加入到缓存中
  add(query: Query): void {
    if (!this.#queries.has(query.queryHash)) {
      this.#queries.set(query.queryHash, query)
    }
  }

  // 构建 `Query` 实例
  build(options: any) {
    const queryKey = options.queryKey
    const queryHash = hashKey(queryKey)
    let query = this.get(queryHash)
    // 保障了在相同 `queryKey` 下对应同一个 `query`
    if (!query) {
      query = new Query({
        queryKey,
        queryHash,
        options,
        cache: this,
      })
      this.add(query)
    }
    return query
  }
}
```

可以看到，在 `QueryCache` 中是通过 `queryHash` 来关联 `query` 的，而 `queryHash` 是通过 `hashKey` 来根据传入到 `queryKey` 计算出来的。




### useQuery

`useQuery ` 是一个用于数据获取和缓存管理的 Hook，它使得异步数据的加载、缓存、更新和同步变得简单且高效。

让我们来实现一下这个 Hook：


```ts
// useQuery.ts
import { QueryKey, UseQueryOptions, UseQueryResult } from './types'
import { useBaseQuery } from './useBaseQuery'

export function useQuery<
  TError = Error, // `useQuery` 返回的 `error` 的类型
  TData = unknown, // `useQuery` 返回的 `data` 的类型
  TQueryKey extends QueryKey = QueryKey, // `queryKey` 的类型
>(options: UseQueryOptions<TData, TQueryKey>): UseQueryResult<TData, TError> {
  return useBaseQuery(options)
}
```

可以看到实际上在 `useQuery` 的内部代码逻辑比较简单，核心就是调用 `useBaseQuery`。其中：

- `TError` 代表 `useQuery` 返回的 `error` 的类型。
- `TData` 代表 `useQuery` 返回的 `data` 的类型。
- `TQueryKey` 代表 `queryKey` 的类型。


然后我们来实现一下 `useBaseQuery`：


```ts
// useBaseQuery.ts
import { useState, useEffect, useSyncExternalStore, useCallback } from 'react'
import { useQueryClient } from './QueryClientProvider'
import { QueryObserver } from './queryObserver'
import { UseBaseQueryResult, UseBaseQueryOptions } from './types'

export type QueryKey = ReadonlyArray<unknown>

export function useBaseQuery<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseBaseQueryOptions<TData, TQueryKey>,
): UseBaseQueryResult<TData, TError> {
  // 通过 hook 拿到 `QueryClient` 实例
  const client = useQueryClient()
  // 在整个组件生命周期中保持 `QueryObserver` 唯一
  const [observer] = useState(
    () => new QueryObserver<TError, TData, TQueryKey>(client, options),
  )

  // 获取查询结果
  const result = observer.getOptimisticResult(options)

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        // 订阅，为了当状态更新时通知组件重新渲染
        const unsubscribe = observer.subscribe(onStoreChange)
        return unsubscribe
      },
      [observer],
    ),
    // 可以看到useSyncExternalStore没有用到返回值，所以其实这里就是为了满足类型要求
    () => observer.getCurrentResult(),
    () => observer.getCurrentResult(),
  )

  useEffect(() => {
    // 发起请求
    observer.setOptions(options)
  }, [options, observer])

  return result
}
```

`useBaseQuery` 中整个代码逻辑可以大致分为四个部分：

- 实例化 `QueryObserver`：可以看到我们用 `useState` 包裹了一下，这样做的目的是确保 `QueryObserver` 在组件的整个生命周期中保持不变。
- 调用 `getOptimisticResult` 获取查询结果。
- 订阅：在《[React 18 的并发挑战：如何解决状态 Tearing 问题](https://juejin.cn/book/7311970169411567626/section/7312839604753661978)》一节中我们深入学习了 `useSyncExternalStore` 的作用以及原理，`useSyncExternalStore` 会调用传入的函数并向其传入 `onStoreChange` 用来触发组件重新渲染，在这里利用 `observer.subscribe` 来保存 `onStoreChange`，以便在 `Query` 状态更新时可以调用来重新渲染对应调用了 `useQuery` 的组件。



### QueryObserver

`QueryObserver` 用来监听 `Query` 的状态变化，协调 `Query` 与组件，例如根据 `Query` 生成查询结果，当 `Query` 状态发生变化时触发组件 re-render 等等。在前面 `useBaseQuery` 的实现中我们可以看到，当在组件中使用 `useQuery` 时，实际上内部创建了 `QueryObserver` 的实例。

接下来让我们来实现一下 `QueryObserver` 部分。

#### Subscribable

我们可以将订阅相关的逻辑独立出来放到 `Subscribable`，然后 `QueryObserver` 去继承该类，这样可以更加清晰：


```ts
// subscribable.ts
type Listener = () => void

export class Subscribable<TListener extends Function = Listener> {
  protected listeners: Set<TListener>

  constructor() {
    this.listeners = new Set()
  }

  // 进行订阅，这里传入的`listener`就是触发组件重新re-render的函数
  subscribe(listener: TListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
```

这里我们创建了一个 `listeners` 用来保存 re-render 组件的函数，也就是上面 `useSyncExternalStore` 传进来的 `onStoreChange`。


#### QueryObserver 实现

在 `QueryObserver` 实现中核心包含了三个部分，即我们在 `useBaseQuery` 调用的 `subscribe` 用来保存 `useSyncExternalStore` 传进来的回调函数方便在某个时机来调用从而触发组件 re-render，这个在上面的 `Subscribable` 已经实现了；以及 `getOptimisticResult` 用来获取查询结果、`setOptions` 用来发起查询：


```ts
// queryObserver.ts
import { Query } from './query'
import { QueryClient } from './queryClient'
import { Subscribable } from './subscribable'
import { QueryKey, QueryObserverOptions, QueryObserverResult } from './types'
import { shallowEqualObjects } from './utils'

export class QueryObserver<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> extends Subscribable {
  #client: QueryClient
  #currentResult: QueryObserverResult<TData, TError> = undefined!
  #currentQuery: Query = undefined!

  constructor(
    client: QueryClient,
    public options: QueryObserverOptions,
  ) {
    super()
    //  保存 `Query` 实例
    this.#client = client
  }

  setOptions(options?: QueryObserverOptions<TData, TQueryKey>) {
    this.options = options ?? this.options
    const prevQuery = this.#currentQuery
    // 构造 `query`
    this.#updateQuery()
    if (prevQuery !== this.#currentQuery) {
      // 发起请求
      this.#executeFetch()
    }
  }

  // 判断状态是否变化，如果有变化则通知组件 re-renders
  updateResult() {
    const prevResult = this.#currentResult
    const nextResult = this.createResult(this.#currentQuery)
    // 浅层比较
    if (shallowEqualObjects(nextResult, prevResult)) {
      return
    }
    this.#currentResult = nextResult
    // 通知组件re-render
    this.#notify()
  }

  // 执行异步请求逻辑
  #executeFetch() {
    const promise = this.#currentQuery.fetch()
    return promise
  }

  // 获取查询结果
  getOptimisticResult(
    options: QueryObserverOptions<TData, TQueryKey>,
  ): QueryObserverResult<TData, TError> {
    // `build` 实现中会判断 `queryKey` 对应是否有 `query`，有的话会直接拿缓存，不会重复构建
    const query = this.#client.getQueryCache().build(options)
    // 构造返回结果
    const result = this.createResult(query)
    return result
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.#currentResult
  }

  createResult(query: Query): QueryObserverResult<TData, TError> {
    // 从 `Query` 实例中获取状态
    const { state } = query
    const { data, status } = state

    // 根据 `status` 生成 `isPending`、`isError`、`isSuccess`
    const isPending = status === 'pending'
    const isError = status === 'error'
    const isSuccess = status === 'success'

    const result = {
      data,
      status,
      isPending,
      isError,
      isSuccess,
    }

    return result as QueryObserverResult<TData, TError>
  }

  #notify() {
    this.listeners.forEach((listener) => {
      // re-render 组件
      listener()
    })
  }

  #updateQuery(): void {
    const query = this.#client.getQueryCache().build(this.options)
    if (query === this.#currentQuery) {
      return
    }
    this.#currentQuery = query
    // 一个 `query` 可能会对应多个 `QueryObserver` 实例，因此需要保存到 `query` 上
    // 方便当状态更新时可以借助 `QueryObserver` 通知组件 re-render
    query.addObserver(this)
  }
}
```

在 `getOptimisticResult` 中，通过我们在前面 `QueryCache` 里实现的 `build` 方法获得 `Query` 实例，这个过程如果已经构建过则会直接返回而不会重新实例化 `Query` 对象。接下来调用 `createResult` 来根据 `Query` 实例获取查询结果。

在 `setOptions` 中调用 `#updateQuery` 用来构造并建立 `Query` 与 `QueryObserver` 的联系，通过 `#executeFetch` 调用 `Query` 实例上的 `fetch` 发起异步请求。

同时我们也提供了 `updateResult` 函数，方便在 `Query` 状态更新时触发以重新渲染组件。


### Query

`Query` 代表了一个具体的数据获取任务。它封装了数据加载的逻辑和当前的数据状态。每个 `Query` 对象都与一个唯一的 `queryKey` 相关联：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/340e8f86dda2471d9df86e93a5bfa93e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2546&h=1226&s=356550&e=png&b=ffffff)

即在拥有相同 `queryKey` 的情况下，`QueryObserver` 持有了相同的 `Query` 实例。

接下来让我们来实现一下 `Query` 部分。


#### Query 实现


```ts
// query.ts
import { QueryCache } from './queryCache'
import { QueryObserver } from './queryObserver'
import { createRetryer, Retryer } from './retryer'
import { QueryKey, QueryObserverOptions, QueryStatus } from './types'

interface QueryConfig<TQueryKey extends QueryKey = QueryKey> {
  cache: QueryCache
  queryHash: string
  queryKey: TQueryKey
  options: QueryObserverOptions
}

interface SuccessAction<TData> {
  data: TData | undefined
  type: 'success'
}

interface fetchAction {
  type: 'fetch'
}

interface ErrorAction<TError> {
  type: 'error'
  error: TError
}

export type Action<TData, TError> =
  | SuccessAction<TData>
  | ErrorAction<TError>
  | fetchAction

export interface QueryState<TData = unknown, TError = Error> {
  data: TData | undefined
  status: QueryStatus
  error: TError | null
}

export class Query<
  TError = Error,
  TData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> {
  queryKey: TQueryKey
  queryHash: string
  options: QueryObserverOptions
  #promise?: Promise<TData>
  #cache: QueryCache
  state: QueryState<TData, TError>
  #retryer?: Retryer<TData>
  #initialState: QueryState<TData, TError>
  #observers: Array<QueryObserver>

  constructor(config: QueryConfig<TQueryKey>) {
    this.queryHash = config.queryHash
    this.queryKey = config.queryKey
    this.options = config.options
    this.#cache = config.cache
    // 初始化状态
    this.#initialState = getDefaultState()
    // 实际存放状态的地方
    this.state = this.#initialState
    // 保存 `QueryObserver` 实例，一个 `Query` 可能对应多个 `QueryObserver`，通过数组将他们关联起来
    this.#observers = []
  }

  // 关联 `Query` 与 `QueryObserver`
  addObserver(observer: QueryObserver<any, any, any>) {
    if (!this.#observers.includes(observer)) {
      this.#observers.push(observer)
    }
  }

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

  fetch() {
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
      },
      onError: (error: TError) => {
        // 请求失败后更新状态
        this.#dispatch({
          type: 'error',
          error: error as TError,
        })
      },
    })
    this.#promise = this.#retryer.promise
    return this.#promise
  }
}

function getDefaultState<TData, TError>(): QueryState<TData, TError> {
  return {
    data: undefined as TData,
    status: 'pending',
    error: null,
  }
}
```

也就是说，当调用 `fetch` 时的整个流程：



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/81dae763ec674c16a17c989c4916e0a7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1010&h=1040&s=118569&e=png&b=ffffff" alt="image.png" width="70%" /></p>

也就是说首先会 `dispatch({ type: 'fetch' })`，此时会更新 `Query` 的状态，同时 re-render 组件，这时候组件就可以根据 `status` 展示数据加载中对应的 UI，然后根据请求成功/失败来对应 `dispatch` 不同的 `type`，这个过程也同样会更新状态以及触发组件 re-render。

结合这张图再看上面的代码应该会清晰许多。


#### retryer 实现

在上面 `Query` 的实现中我们可以看到，在每个 `Query` 中都会调用一个 `createRetryer` ：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bcc256f2693540089120912f4d3c3539~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=818&h=756&s=162171&e=png&b=ffffff" alt="image.png" width="55%" /></p>

即每个 `Query` 都会对应一个 `createRetryer` 来完成异步请求及重试。


```ts
// retryer.ts
interface RetryerConfig<TData = unknown, TError = Error> {
  fn: () => TData | Promise<TData> // 请求函数
  onError?: (error: TError) => void // 请求失败后的回调
  onSuccess?: (data: TData) => void // 请求成功后的回调
}

export interface Retryer<TData = unknown> {
  promise: Promise<TData>
}

export function createRetryer<TData = unknown, TError = Error>(
  config: RetryerConfig<TData, TError>,
): Retryer<TData> {
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
        reject(error)
        return
      })
  }

  run()

  return {
    promise,
  }
}
```

虽然叫 `createRetryer`，但是在这里还没有实现重试机制，在下一节中我们会在这个基础之上完成请求出错重试能力。


## 总结

最后，我们用一张图来总结一下 `useQuery` 的大致流程，帮助大家更好地理解源码：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8cf8acc3118a4e5d9ed143bb7886839c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2022&h=826&s=145481&e=png&b=ffffff)

1. 首先当 React 组件挂载（mount）之后会调用 `useQuery`，在 `useQuery` 内部会创建 `QueryObserver` 实例。
2. 接下来 `QueryObserver` 会创建 `Query` 实例，`Query` 内部会借助 `retryer` 进行查询，同时通知 `QueryObserver`，代表 `Query` 正在进行异步请求。`QueryObserver` 进一步通知组件完成 re-render，此时 `status` 状态为 `pending`，`isPending` 为 `true`，组件可以根据该状态进一步展示正在加载状态时的 UI。
3. 当请求结束后会根据最新数据更新 `Query` 缓存，同时继续通知 `QueryObserver`，以及通知组件完成 re-render。

本节我们搭建了 TanStack Query 的框架部分，至此我们的 TanStack Query 已经能够管理异步请求并在多个 `useQuery` 中共享缓存状态了。

我们可以发现，虽然 TanStack Query 源码量很大，但是并不复杂，各个模块之间职责清晰。在下一节中我们会继续实现我们的 TanStack Query，增加更多更复杂的功能。
