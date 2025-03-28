在上一节中我们介绍了 Valtio。

Valtio 是一个非常有意思的库，基于 Mutable 思想，可以让我们以一种非常轻松和符合直觉的方式编写代码来更新状态，并且 Valtio 内部基于 Proxy 来实现，会帮助我们跟踪哪些属性在组件中被访问，从而自动完成优化，避免手动写出类似 Zustand、React Redux 中 selector 的代码，性能默认就是最优的。

本节让我们一起来实现一个 Valtio 状态管理库，为了方便大家理解，代码实现部分会做一定的简化。
> 本节实现部分见 GitHub 仓库：https://github.com/q-u-n/state-management-collection/tree/main/packages/valtio




## mini-valtio 实现 

在实现之前，需要先确定一下我们的 mini-valtio 包含哪些功能。让我们先来回顾一下上一节举的一个例子：


```js
import { proxy, useSnapshot } from 'valtio'

const obj = proxy({
  count: 0,
  text: 'mumu',
})

const Display = () => {
  const { text } = useSnapshot(obj)
  console.log('Display re-render');
  return (
    <div>text: {text}</div>
  )
}

const Control = () => {
  const { count } = useSnapshot(obj)
  console.log('Control re-render');
  return (
    <>
      <button onClick={() => (obj.count += 1)}>button</button>
      <div>count: {count}</div>
    </>
  )
}
```

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/06fbde8607e947aca8e775cd0960a16d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=672&h=608&s=62365&e=gif&f=40&b=fcfbfe" alt="20240406195946_rec_.gif" width="40%" /></p>

即我们需要实现 `proxy` 和 `useSnapshot` 两个 API。


更具体来说在这个例子我们可以看到，在 `Display` 组件读取状态时只使用到了 `text` 值，当更新 `count` 值时没有触发 `Display` 组件重新渲染，背后 Valtio 在 `useSnapshot` 中借助 [proxy-compare](https://github.com/dai-shi/proxy-compare) 库导出的 `createProxy` 及 `isChanged` 来实现了这一点。

- `createProxy`：用来生成代理对象，对状态的使用情况进行追踪，比如上面的例子中 `createProxy` 会记录下 `Display` 使用了 `text` 值。
- `isChanged`：返回一个 `boolean` 值代表状态是否有变更，比如上面的例子中在发生点击事件时更新了 `count` 状态，而 `isChanged` 发现  `Display` 组件在 `text` 属性上没有发生变化，因此就不会重新渲染。


除此之外，`useSnapshot` 也需要完成对 Store 的订阅，这样当状态更新时才知道要触发哪些组件来 re-render，对应 `subscribe` 函数，以及拿到当前状态的 `snapshot` 函数。


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f246f109dc6d4838a2a57cb6da256ae4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2238&h=956&s=184227&e=png&b=ffffff" alt="image.png"  /></p>

因此，上图就是我们需要实现的全部内容。在我们的 mini-valtio 中，会单独生成一个文件 proxy-compare.ts 来实现 proxy-compare 库的核心逻辑。


首先我们来实现 proxy-compare。



### proxy-compare 实现

> proxy-compare 实现代码见仓库：https://github.com/q-u-n/state-management-collection/blob/main/packages/valtio/src/proxy-compare.ts

在 Valtio 源代码中将 Proxy 对比逻辑提取到了 [proxy-compare](https://github.com/dai-shi/proxy-compare) 库来实现，这个包中用来在 [Valtio](https://github.com/pmndrs/valtio) 和 [React Tracked](https://github.com/dai-shi/react-tracked) 进行复用。

在实现之前，让我们先来看下用法：


```js
const state = { a: 1, b: 2 }
const affected = new WeakMap() // 创建一个WeakMap用来追踪哪些属性被访问了
const proxy = createProxy(state, affected) // 创建代理对象

// 读取某个属性
console.log(proxy.a) // 1

// 对比使用的属性是否发生改变
console.log(isChanged(state, { a: 1, b: 22 }, affected)) // false
console.log(isChanged(state, { a: 11, b: 2 }, affected)) // true
```

即我们需要实现两个 API。

- `createProxy`：创建一个代理对象，用来追踪哪些属性被访问了。
- `isChanged`：对比被追踪的属性是否发生变化，返回 `boolean`。




#### createProxy 实现

通过上面的例子我们得知需要追踪使用到的属性，因此不难理解我们需要使用 Proxy 来做到这一点，并且对于返回的对象我们也需要进行代理。

举个例子来帮助大家理解这个过程：


```js
const handler = {
  get(target, prop) {
    console.log("get", target, prop);
    const value = target[prop];
    if (typeof value === "object" && value !== null) {
      return new Proxy(value, handler);
    }
    return value;
  },
};

const state = {
  deep: {
    nested: {
      obj: {
        count: 1,
      },
    },
  },
};

const proxy = new Proxy(state, handler);

proxy.deep.nested.obj.count;
```


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ca6e27029b7c47c8a769ef306f69feeb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=678&h=116&s=32276&e=png&b=323232" alt="image.png" width="60%" /></p>


在这个例子中，我们创建了一个 `handler` 对象，定义了对代理对象进行操作时如何拦截的 `get` 方法。通过 `get` 我们可以拦截读取对象属性的操作，为了确保连续属性访问（例如深层对象属性的读取）时也能够进行追踪，因此对于返回的子对象也需要进行代理。

我们继续对 `createProxy` 进行实现。

`createProxy` 创建一个代理对象，用来追踪哪些属性被访问了，这些属性才是组件真正关心的内容，在触发组件重新渲染时只需要根据这些属性是否变化来决定是否 re-render 即可。当然不仅仅只有 get 来拦截对属性的访问：


- `get`：拦截读取对象属性的操作。
- `has`：拦截 `in` 操作，例如：`'prop' in proxy`。
- `ownKeys`：拦截获取对象全部属性操作，例如：`Object.keys(target)` 等。

因此，我们可以把 `handler` 以及关联部分的逻辑先实现出来：


```ts
const AFFECTED_PROPERTY = 'a'
const KEYS_PROPERTY = 'k'
const HAS_KEY_PROPERTY = 'h'
const ALL_OWN_KEYS_PROPERTY = 'w'

type Used = {
  [HAS_KEY_PROPERTY]?: Set<string | symbol>
  [ALL_OWN_KEYS_PROPERTY]?: true
  [KEYS_PROPERTY]?: Set<string | symbol>
}
type Affected = WeakMap<object, Used>
type ProxyHandlerState<T extends object> = {
  [PROXY_PROPERTY]?: T
  [AFFECTED_PROPERTY]?: Affected
}

const createProxyHandler = <T extends object>(origObj: T) => {
  const state: ProxyHandlerState<T> = {}

  // 记录属性访问情况
  const recordUsage = (
    type:
      | typeof HAS_KEY_PROPERTY
      | typeof ALL_OWN_KEYS_PROPERTY
      | typeof KEYS_PROPERTY,
    key?: string | symbol,
  ) => {
    let used = (state[AFFECTED_PROPERTY] as Affected).get(origObj)
    if (!used) {
      used = {}
      ;(state[AFFECTED_PROPERTY] as Affected).set(origObj, used)
      // 当 `type` 为 `ALL_OWN_KEYS_PROPERTY` 时，代表后面在对比变化时需要对比全部属性
      if (type === ALL_OWN_KEYS_PROPERTY) {
        used[ALL_OWN_KEYS_PROPERTY] = true
      } else {
        let set = used[type]
        if (!set) {
          set = new Set()
          used[type] = set
        }
        set.add(key as string | symbol) // 记录访问了哪些属性
      }
    }
  }

  const handler: ProxyHandler<T> = {
    // 拦截读取对象属性的操作
    get(target, key) {
      recordUsage(KEYS_PROPERTY, key)
      // 需要对返回的对象继续代理
      return createProxy(
        Reflect.get(target, key),
        state[AFFECTED_PROPERTY] as Affected,
      )
    },
    // 拦截 `in` 操作
    has(target, key) {
      recordUsage(HAS_KEY_PROPERTY, key)
      return Reflect.has(target, key)
    },
    // 拦截获取对象全部属性操作，如：`Object.keys(target)`、`Reflect.ownKeys(target)`、`Object.getOwnPropertyNames(target)`、`Object.getOwnPropertySymbols(target)`
    ownKeys(target) {
      recordUsage(ALL_OWN_KEYS_PROPERTY)
      return Reflect.ownKeys(target)
    },
  }

  return [handler, state] as const
}
```

可以看到，当拦截到对象属性访问操作时会调用 `recordUsage` 记录这次使用的情况。`state[AFFECTED_PROPERTY]` 就是上面例子中传入的 `affected`。比较特殊的是 `ownKeys` 的拦截，因为诸如调用 `Object.keys()` 会拿到全部属性，因此这里直接标记为 `true` 代表后续 `isChanged` 对比时要对比全部的 `key`，而其它则是将使用过的 `key` 加入到 `Set` 中用于后续对比。

我们继续完成 `createProxy` 剩余部分的实现：

```ts
const PROXY_PROPERTY = 'p'

// 创建一个 Proxy 对象，用来追踪哪些属性被访问了，这些属性才是组件真正关心的内容，在触发组件重新渲染时只需要对比这些属性即可
export const createProxy = <T>(
  obj: T,
  affected: WeakMap<object, unknown>,
): T => {
  if (typeof obj === 'object' && obj !== null) {
    const handlerAndState = createProxyHandler(obj)
    handlerAndState[1][PROXY_PROPERTY] = new Proxy(obj, handlerAndState[0])
    handlerAndState[1][AFFECTED_PROPERTY] = affected as Affected
    return handlerAndState[1][PROXY_PROPERTY]
  }
  return obj
}
```

`createProxy` 内部调用了 `createProxyHandler` 用来生成代理对象并返回，并把这个代理对象和 `affected` 保存到 `handlerAndState` 第一个属性上，也就是 `createProxyHandler` 中的 `state`，方便在 `recordUsage` 中进行记录。


#### isChanged 实现

`isChanged` 用来根据 `affected` 的使用记录来对比传入的两个对象中用到的属性上是否发生变化，返回 `boolean` 值。

```ts
const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

// 用来根据 `affected` 的使用记录来对比传入的两个对象中用到的属性上是否发生变化
export const isChanged = (
  prevObj: unknown,
  nextObj: unknown,
  affected: WeakMap<object, unknown>,
): boolean => {
  // 判断对比双方是否完全相同
  if (Object.is(prevObj, nextObj)) return false
  // 判断是否不是对象
  if (!isObject(prevObj) || !isObject(nextObj)) return true
  const used = (affected as Affected).get(prevObj)
  if (!used) return true
  let changed: boolean = false
  // 这里依次对比 `KEYS_PROPERTY`、`HAS_KEY_PROPERTY`、`ALL_OWN_KEYS_PROPERTY`
  for (const key of used[HAS_KEY_PROPERTY] || []) {
    changed = Reflect.has(prevObj, key) !== Reflect.has(nextObj, key) // 这里因为拦截的是 `has` 操作，所以判断的是前后有没有这个属性
    if (changed) return changed
  }
  if (used[ALL_OWN_KEYS_PROPERTY] === true) {
    // 对比全部属性
    const prevKeys = Reflect.ownKeys(prevObj)
    const nextKeys = Reflect.ownKeys(nextObj)
    return (
      prevKeys.length !== nextKeys.length ||
      prevKeys.some((k, i) => k !== nextKeys[i]) // 这里对比的是key
    )
  }
  for (const key of used[KEYS_PROPERTY] || []) {
    // 递归对比状态是否改变
    changed = isChanged((prevObj as any)[key], (nextObj as any)[key], affected)
    // 如果发现改变了就直接返回true
    if (changed) return changed
  }
  return changed
}
```

前面 `handler` 实现中会在使用属性时根据使用情况在 `affected` 中进行记录，在 `isChanged` 中则需要依次对这些属性进行验证。




### useSnapshot 实现

`useSnapshot` 是一个 React Hook，用来返回状态，并对通过 `proxy` 创建的 Store 进行订阅，在这个过程中，`useSnapshot` 会自动追踪属性的使用情况，对于不关心的属性发生变化不会造成组件 re-render。

为了方便理解 `useSnapshot` 的实现，我们先来回顾一下上一节举的例子：

```ts
const obj = proxy({
  count: 0,
  text: 'mumu',
})

const Display = () => {
  const { text } = useSnapshot(obj)
  console.log('Display re-render');
  return (
    <div>text: {text}</div>
  )
}

const Control = () => {
  const { count } = useSnapshot(obj)
  console.log('Control re-render');
  return (
    <>
      <button onClick={() => (obj.count += 1)}>button</button>
      <div>count: {count}</div>
    </>
  )
}
```




<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/06fbde8607e947aca8e775cd0960a16d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=672&h=608&s=62365&e=gif&f=40&b=fcfbfe" alt="20240406195946_rec_.gif" width="40%" /></p>
 


在这个例子中点击按钮执行 `obj.count += 1` 更新 `count` 状态，而由于 `Display` 没有用到 `count` 值，因此不会 re-render。Valtio 在背后借助 proxy-compare 的 `createProxy` 帮助我们追踪状态在组件中的使用情况，从而优化性能。可以看到，这就是使用 Proxy 的好处之一，即我们不需要手动优化性能，背后 Valtio 会自动帮助我们进行追踪，从而默认就是性能最优的。

好！借助这个思想，我们可以完成 `useSnapshot` 实现：


```ts
import { useRef, useEffect, useMemo, useSyncExternalStore } from 'react'

import { snapshot, subscribe } from './vanilla'
import { createProxy, isChanged } from './proxy-compare'

export function useSnapshot<T extends object>(proxyObject: T): T {
  const lastSnapshot = useRef<T>()
  const affected = useMemo(() => new WeakMap<object, unknown>(), [proxyObject])
  const currSnapshot = useSyncExternalStore(
    (callback) => {
      // 进行订阅
      const unsub = subscribe(proxyObject, callback)
      return unsub
    },
    () => {
      // client，当状态变化时会调用这个函数，拿到新的状态，对比新旧状态是否一致来决定是否re-render
      const nextSnapshot = snapshot(proxyObject) // 生成新的状态
      if (
        lastSnapshot.current &&
        !isChanged(lastSnapshot.current, nextSnapshot, affected) // 对比前后状态在使用的属性上是否变化
      ) {
        return lastSnapshot.current // 如果关心的状态没有变化，则返回上次的状态，不会触发re-render
      }
      return nextSnapshot
    },
    // server
    () => snapshot(proxyObject),
  )

  useEffect(() => {
    lastSnapshot.current = currSnapshot
  })

  // 借助 `createProxy` 生成一个 proxy，追踪属性使用情况，避免组件没用到的状态变化造成组件re-render
  return createProxy(currSnapshot, affected)
}
```

这里重点是理解 `useSyncExternalStore`，如果不熟悉的同学可以翻阅 [  
《React 18 的并发挑战：如何解决状态 Tearing 问题？》](https://juejin.cn/book/7311970169411567626/section/7312839604753661978) 一章，这章详细讲解了 `useSyncExternalStore` 的使用以及源码。

当状态发生变化时，需要触发组件重新渲染，通过调用传入的函数计算最新的状态，也就是传入 `useSyncExternalStore` 中的第二个参数。当调用 `isChanged` 发现没有变化时则返回上一次的状态，`useSyncExternalStore` 会根据当次计算的状态和上一次进行对比，没有变化则不触发 re-render，从而完成 Valtio 的状态追踪和性能优化。

为了帮助大家更好地理解这个过程，画了一张图：



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/01f352a908d04478b8558e6301098043~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=988&h=924&s=93323&e=png&b=ffffff" alt="image.png" width="70%" /></p>



### proxy 实现

Valtio 实现了 `proxy` 函数，用来追踪对状态的更新以及通知组件完成重新渲染。

Valtio 对这部分的实现比较有趣：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/debaf0ab9e8a418db5b9f8f66dd4d1dd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1038&h=1526&s=269304&e=png&b=1e1e1e" alt="image.png" width="70%" /></p>

即实现了一个 `buildProxyFunction`，将需要用到的函数作为可选参数，并给予了一个默认的实现，这样做可以提供更高的灵活性：可以在[源码](https://github.com/pmndrs/valtio/blob/dcf48e4bf923ae918efb03ed959171c71ec0e7d4/src/vanilla.ts#L410)中看到 Valtio 将 `buildProxyFunction` 作为 `unstable_buildProxyFunction` 导出，这意味着作为开发者可以更定制化地去使用 Valtio 提供的能力。



<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f7c8ac81403542809c81b99736d386d5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1776&h=484&s=116259&e=png&b=f4f6f8" alt="image.png" width="100%" /></p>

好！我们继续来实现 `proxy`，首先来搭建整个架子：


```ts
const buildProxyFunction = (
  // 追踪状态更新、触发组件重新渲染
  proxyFunction = () => {
    // 需要传入一个对象
    if (!isObject(baseObject)) {
      throw new Error('object required')
    }
    // 剩余 proxyFunction 逻辑实现
  }
) =>
  [
    proxyFunction,
  ] as const
  
const [defaultProxyFunction] = buildProxyFunction()

export function proxy<T extends object>(baseObject: T): T {
  return defaultProxyFunction(baseObject)
}
```

即调用 `buildProxyFunction` 返回 `proxyFunction` 也就是 `defaultProxyFunction`，最终在 `proxy` 函数中使用 `defaultProxyFunction`。接下来让我们继续完善 `proxyFunction`。


#### proxyFunction 实现

接下来我们需要实现 `proxyFunction` 剩余逻辑，`proxyFunction` 用来追踪状态更新、触发组件重新渲染，具体来说需要包含这几部分：

- 需要返回一个代理对象来捕获状态更新操作。
- 增加一个 `addListener` 函数用来保存重新渲染组件的函数。
- 同时需要增加一个 `notifyUpdate` 用来在状态发生变化时通知组件重新渲染。

因此，`proxyFunction` 实现如下：

```ts
const proxyStateMap = new WeakMap<object, any>() // 缓存，方便获取代理对象对应的状态

// 追踪状态更新、触发组件重新渲染
proxyFunction = <T extends object>(baseObject: T): T => {
  // 需要传入一个对象
  if (!isObject(baseObject)) {
    throw new Error('object required')
  }
  const listeners = new Set<Listener>()
  // 通知组件 re-render
  const notifyUpdate = () => {
    listeners.forEach((listener) => listener())
  }
  const addListener = (listener: Listener) => {
    listeners.add(listener)
    const removeListener = () => {
      listeners.delete(listener)
    }
    // 需要返回一个函数，组件卸载时调用，移除监听器
    return removeListener
  }
  const handler = {
    set(target: T, prop: string | symbol, value: any, receiver: object) {
      // 更新状态
      Reflect.set(target, prop, value, receiver)
      // 通知组件重新渲染
      notifyUpdate()
      return true
    },
  }
  const proxyObject = new Proxy(baseObject, handler)
  const proxyState: ProxyState = [baseObject, createSnapshot, addListener]
  proxyStateMap.set(proxyObject, proxyState)
  return proxyObject
},
```



#### snapshot 实现

上面 `useSnapshot` 实现中用到了 `snapshot`，`snapshot` 的作用是生成当前状态对应的快照，快照指的是当前状态的一个完整备份，这样即使后续对象的状态发生变化，快照中保存的状态仍然保持不变。

为了避免每次组件 render 时都会调用 `createSnapshot` 生成新的对象，Valtio 会使用 `version` 来作为状态是否变化的标记。因此，我们需要在上面实现的 `proxyFunction` 基础上增加一个版本号标记 `version` 以及获取该版本号的函数 `ensureVersion`，当状态更新时我们需要增加版本号。

```ts
// 追踪状态更新、触发组件重新渲染
proxyFunction = <T extends object>(baseObject: T): T => {
  // 需要传入一个对象
  if (!isObject(baseObject)) {
    throw new Error('object required')
  }
  const listeners = new Set<Listener>()
+ let version: number = 1
  // 通知组件 re-render
  const notifyUpdate = () => {
+   version++ // 抬升版本号
    listeners.forEach((listener) => listener())
  }
+ const ensureVersion = () => {
+   // 获取当前版本号
+   return version
+ }
  const addListener = (listener: Listener) => {
    listeners.add(listener)
    const removeListener = () => {
      listeners.delete(listener)
    }
    // 需要返回一个函数，组件卸载时调用，移除监听器
    return removeListener
  }
  const handler = {
    set(target: T, prop: string | symbol, value: any, receiver: object) {
      // 更新状态
      Reflect.set(target, prop, value, receiver)
      // 通知组件重新渲染
      notifyUpdate()
      return true
    },
  }
  const proxyObject = new Proxy(baseObject, handler)
- const proxyState: ProxyState = [baseObject, createSnapshot, addListener]
+ const proxyState: ProxyState = [
+   baseObject,
+   ensureVersion,
+   createSnapshot,
+   addListener,
+ ]
  proxyStateMap.set(proxyObject, proxyState)
  return proxyObject
},
```

这样在 `snapshot` 实现中，就可以通过 `ensureVersion` 获取状态对应的版本号。

我们继续来实现 `snapshot`：

```ts
export function snapshot<T extends object>(proxyObject: T): T {
  // 从缓存中获取代理对象对应的状态
  const proxyState = proxyStateMap.get(proxyObject)
  const [target, ensureVersion, createSnapshot] = proxyState
  // 获取最新状态
  return createSnapshot(target, ensureVersion())
}
```

然后我们来实现 `createSnapshot`，`snapshot` 会调用  `createSnapshot` 生成当前对象的拷贝，并加入到缓存中：


```ts
// 快照缓存
snapCache = new WeakMap<object, [version: number, snap: unknown]>(),

// 获取最新状态
createSnapshot = <T extends object>(target: T, version: number): T => {
  const cache = snapCache.get(target)
  // 判断当前状态版本是否在缓存中
  if (cache?.[0] === version) {
    return cache[1] as T
  }
  const snap: any = Array.isArray(target) ? [...target] : { ...target }
  // 缓存新快照
  snapCache.set(target, [version, snap])
  return snap
},
```

可以看到，在生成新的快照之前会判断当前版本是否在缓存中，这样避免了每次组件 render 都生成一个新的快照。


#### subscribe 实现

`subscribe` 的作用是保存 `useSyncExternalStore` 传进来的 `callback`，这样当发现状态变化时调用这个  `callback` 来 re-render 组件。

```ts
export function subscribe<T extends object>(
  proxyObject: T,
  // `useSyncExternalStore` 传入的 `callback` 调用完成组件的重新渲染
  callback: Listener,
) {
  const proxyState = proxyStateMap.get(proxyObject)
  const addListener = proxyState[3]
  const removeListener = addListener(callback)
  return removeListener
}
```

最终返回一个 `removeListener` 函数在组件卸载时从 `listeners` 中移除 `callback`。



### 验证


至此我们已经实现了全部 Valtio 的核心逻辑，为了证明上面我们实现 Valtio 代码以及 proxy-compare 的准确性，编写单元测试代码进行验证。

> 单测代码见： https://github.com/q-u-n/state-management-collection/tree/main/packages/valtio/__tests__

在后续有专门的单元测试章节带领大家实现单元测试部分，运行单元测试 `pnpm run test`：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6baa4bdb308f4042bc485cc45f9c0ca5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=710&h=240&s=40344&e=png&b=1f1f1f" alt="image.png" width="60%" /></p>

可以看到通过了单元测试校验。


## 总结

我们用一张图来串联整个流程：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a47c9d9b3af544128bd5e3027534d293~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=470&h=898&s=42944&e=png&b=ffffff" alt="image.png" width="30%" /></p>

-  生成 Store：这个过程我们会借助 Valtio 提供的 API `proxy` 来生成 Store，本质上是一个代理对象，会捕获 `set` 操作。
- 组件订阅 Store：这个过程我们会在组件中借助 `useSnapshot`，在获取状态的同时也完成了对 Store 的订阅，目的是当 Store 状态更新时可以通知到组件完成 re-render。背后 `subscribe` 函数会将 `useSyncExternalStore` 传进来的 `callback` 保存到 `listeners` 中，等待被调用。
- 更新状态，这个过程我们可以直接操作第一步通过 `proxy` 生成的代理对象，在更新状态的同时依次触发组件重新渲染。
- 是否用到的状态发生了变更，这个过程属于优化步骤，借助 `isChanged` 函数来判断，如果使用到的属性上发生了变化，则触发 re-render。

 
在本章中我们实现了 Valtio 以及 proxy-compare 库的核心部分。Valtio 内部借助 Proxy 追踪在组件中使用到的属性，并在状态更新时自动判断组件用到（关心）的属性上是否变化，这就是 Valtio 可以以一种自然符合直觉的方式更新状态并且能保持高性能的秘诀。

至此，我们已经完成了 Zustand、Jotai、Valtio 三个状态管理库的实现。


 