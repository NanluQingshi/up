在 [初识 Jotai：一个高性能原子化状态管理库](https://juejin.cn/book/7311970169411567626/section/7312837845533032485)一节中，我们讲解了如何使用 Jotai 来更优雅地处理异步行为。以 async read [为例](https://codesandbox.io/p/sandbox/jotai-use-vs48q8)再来复习一遍：


```jsx
import { Suspense } from "react";
import { atom, useAtomValue } from "jotai";

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


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e739b2959469406ebb58e8cb36d28ea4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=228&h=116&s=19338&e=gif&f=21&b=fdfcff" alt="" width="30%" /></p>

在这个例子中，我们向 `atom` 函数传入了一个异步函数，接下来用 `useAtomValue` 来读取这个原子，最终在最外层包裹了一个 `fallback` 为 loading 的 `Suspense`。可以看到，首先展示 loading，2 秒后拿到状态展示内容。

这是因为在 jotai `useAtomValue` hooks 中内置了 use hooks，从而使得可以轻松和 React Suspense 联动，但是我们目前实现的 mini-jotai 还不支持这种用法。在本章中会介绍 React Suspense 与 React use，并在 mini-jotai 的 `useAtomValue` hook 实现中加入这个能力。






## React Suspense

使用 React Suspense 好处非常多，例如：

-   **更优雅的写法**。使用 Suspense 可以避免写出下面这种代码：

```tsx
function App() {
  // 其它逻辑

  if (loading) {
    return <Loading />
  }
  return xxx;
}
```

-   **解决 Race Condition 问题**。React Suspense 天然可以解决 Race Condition，这来源于两部分原因：1. 当异步请求发生时 UI 会立即渲染 fallback 状态；2. 数据请求与组件渲染逻辑分离。

-   **更好的性能**。通常我们会将异步请求写在 `useEffect` 中，这需要等待渲染结束后才会发出请求，而使用 Suspense 可以把这部分前置到渲染时。
-   **更好的用户体验**。借助 `useTransition` 和 `Suspense` 可以降低此次的更新优先级以及延迟渲染，这样可以避免卡顿以及带来更好的用户体验。
-   **流式渲染**。`Suspense` 允许推迟某些内容的渲染，直到数据加载完毕。这样使得页面加载更快，无需等到数据准备好即可开始渲染和 hydration，降低 TTFB、FCP、TTI 等性能指标，从而用户可以更早地看到内容和进行交互。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1f7c9e02fda243b9b21733901bffc86e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1310&h=666&s=277179&e=png&b=f9f9f9" alt="" width="70%" /></p>

我们以一个[例子](https://codesandbox.io/p/sandbox/suspense-58d7r7)来说明 `Suspense` 的优势，首先创建一个 promise 读取器：


```ts
const use = (promise) => {
  if (promise.status === "pending") {
    throw promise;
  } else if (promise.status === "fulfilled") {
    return promise.value;
  } else if (promise.status === "rejected") {
    throw promise.reason;
  } else {
    promise.status = "pending";
    promise.then(
      (v) => {
        promise.status = "fulfilled";
        promise.value = v;
      },
      (e) => {
        promise.status = "rejected";
        promise.reason = e;
      }
    );
    throw promise;
  }
};
```

这里的 `use` 函数会对接收到的 `promise status` 属性进行改写，并根据 `status` 的状态来处理，如果 `status` 是 `pending` 会将其抛出。接下来 React 会捕获到 throw 出来的 `promise` 进而渲染 `Suspense` 的 `fallback`。


然后，我们来创建一个模拟请求的函数：

```ts
const delay = (t) =>
  new Promise((r) => {
    setTimeout(r, t);
  });

const cachePool = {};

function fetchData(id) {
  const cache = cachePool[id];
  if (cache) {
    return cache;
  }
  return (cachePool[id] = delay(2000).then(() => {
    return { data: Math.random().toFixed(2) * 100 };
  }));
}
```


可以看到，我们在这里加了缓存机制，即每次调用 `fetchData` 时首先会从 `cachePool` 中看缓存中是否包含，如果包含的话直接返回结果，缓存机制避免了无限次请求数据。

最后，我们创建 `Display` 和 `App` 组件：

```tsx
import { Suspense } from "react";

const Display = () => {
  const { data } = use(fetchData(0));
  return <div>value: {data}</div>;
};

export default function App() {
  return (
    <Suspense fallback={<div>loading</div>}>
      <Display />
    </Suspense>
  );
}
```

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02013c48b51f49da8e5bd3a1f7dec340~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=236&h=92&s=23183&e=gif&f=26&b=fdfcff" alt="" width="30%" /></p>


本例模拟了一个请求数据的过程，2 秒钟后返回一个随机数，在请求的过程中会展示 `Suspense` 的 `fallback`，在这里是 loading 状态，当返回数据后将其展示。

传统上我们使用 `useEffect` 来处理请求逻辑，因此整个过程必须要等到渲染完之后进行。在本例中可以发现，整个过程更为前置，在渲染的过程中完成数据请求的过程，因此用户体验更好。同时我们不需要写 `if (loading) return xxxx` 这样的代码，而是通过传入 `Suspense` 的 `fallback`，代码更为优雅。





## React use

在上面的例子中我们创建了一个 `use` hook，原理与 React `use` hook 类似。

React `use` hook 是 React 官方提出的新的 hook，可以方便地配合 `Suspense` 来进行使用，`use` 接收 promise 或 context 并获取它们的状态，和其他 hooks 不同的是，`use` 可以放在条件语句、块、循环中，该 API 目前仍处于实验性质。

来看一下 React `use` 源码：

```ts
let thenableIndexCounter: number = 0;
let thenableState: ThenableState | null = null;

export function createThenableState(): ThenableState {
  return [];
}

function use<T>(usable: Usable<T>): T {
  if (usable !== null && typeof usable === 'object') {
    if (typeof usable.then === 'function') {
      // promise
      const thenable: Thenable<T> = (usable: any);

      const index = thenableIndexCounter;
      thenableIndexCounter += 1;

      if (thenableState === null) {
        thenableState = createThenableState();
      }
      return trackUsedThenable(thenableState, thenable, index);
    } else if (
      usable.$$typeof === REACT_CONTEXT_TYPE ||
      usable.$$typeof === REACT_SERVER_CONTEXT_TYPE
    ) {
      // context
      const context: ReactContext<T> = (usable: any);
      return readContext(context);
    }
  }

  throw new Error('An unsupported type was passed to use(): ' + String(usable));
}
```

可以看到 `use` 可以接收 promise 或者 context，如果是 context 的话直接返回 context 的值，反之调用 `trackUsedThenable` 函数。我们再来看一下 `trackUsedThenable` 实现：

```ts
let suspendedThenable: Thenable<any> | null = null;

export function trackUsedThenable<T>(
  thenableState: ThenableState,
  thenable: Thenable<T>,
  index: number,
): T {
  switch (thenable.status) {
    case 'fulfilled': {
      const fulfilledValue: T = thenable.value;
      return fulfilledValue;
    }
    case 'rejected': {
      const rejectedError = thenable.reason;
      throw rejectedError;
    }
    default: {
      if (thenable.status === undefined) {
        const pendingThenable: PendingThenable<T> = (thenable: any);
        pendingThenable.status = 'pending';
        pendingThenable.then(
          fulfilledValue => {
            if (thenable.status === 'pending') {
              const fulfilledThenable: FulfilledThenable<T> = (thenable: any);
              fulfilledThenable.status = 'fulfilled';
              fulfilledThenable.value = fulfilledValue;
            }
          },
          (error: mixed) => {
            if (thenable.status === 'pending') {
              const rejectedThenable: RejectedThenable<T> = (thenable: any);
              rejectedThenable.status = 'rejected';
              rejectedThenable.reason = error;
            }
          },
        );

        switch (thenable.status) {
          case 'fulfilled': {
            const fulfilledThenable: FulfilledThenable<T> = (thenable: any);
            return fulfilledThenable.value;
          }
          case 'rejected': {
            const rejectedThenable: RejectedThenable<T> = (thenable: any);
            throw rejectedThenable.reason;
          }
        }
      }
      suspendedThenable = thenable;
      throw SuspenseException;
    }
  }
}
```

可以看到，`trackUsedThenable` 的实现与我们上面的 `use` 函数封装极为相似，`trackUsedThenable` 方法也会对用户传入给 `use` hook 中的 promise 进行处理并根据状态标记 `status` 值。当 `use` 第一次处理传入的 promise 时，上面不包含 `status` 属性，因此会走到 `default` 逻辑，并默认给 `status` 赋值为 `pending`，最终抛出（throw）一个 `SuspenseException`，React 会捕获这个“错误”，并中断继续渲染其子孙组件，改为渲染传入到 Suspense `fallback` 中的内容。




## 在 Jotai 中使用 use 特性

前面提到由于在 Jotai `useAtomValue` 中内置了 `use` 的实现，因此我们不需要直接使用 `use` 就可以轻松地读取异步的数据，只需要保证传入的是异步的函数即可。React 18 原生实验性质的实现了 `use` hooks，但 React 17 及以下是用不了的，但是我们的状态管理库肯定是通用的库，因此我们需要区分使用者的版本从而选择采用 React 原生的 `use` 还是我们自己实现的 `use`。

用一个图来表示这个过程：



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bec2545d2e8e49ceafe652acc9bde62f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1634&h=530&s=49792&e=png&b=ffffff" alt="image.png" width="100%" /></p>


然后我们来实现一下 `use` hook：


```ts
import ReactExports from 'react';

const use =
  // 判断react是否包含了use hooks，如果没有的话采用自己实现的方案。
  ReactExports.use ||
  (<T>(
    promise: PromiseLike<T> & {
      status?: "pending" | "fulfilled" | "rejected";
      value?: T;
      reason?: unknown;
    }
  ): T => {
    if (promise.status === "pending") {
      throw promise;
    } else if (promise.status === "fulfilled") {
      return promise.value as T;
    } else if (promise.status === "rejected") {
      throw promise.reason;
    } else {
      promise.status = "pending";
      promise.then(
        (v) => {
          promise.status = "fulfilled";
          promise.value = v;
        },
        (e) => {
          promise.status = "rejected";
          promise.reason = e;
        }
      );
      throw promise;
    }
  });
```

然后我们需要实现一个函数用来判断读取到的值是否是一个 promise：

```js
const isPromiseLike = (x: any) => typeof x.then === "function";
```

如果是一个 promise 就需要用 `use` 来包裹一下，反之则直接返回即可，最后我们来改一下`useAtomValue`实现：

```js
export const useAtomValue = <Value>(atom: ReadableAtom<Value>) => {
  // 获取store
  const store = useStore();

  const [value, rerender] = useReducer((prev) => {
    const nextValue = store.get(atom);
    if (Object.is(prev, nextValue)) {
      // 状态不变则不触发re-render
      return prev;
    }
    return nextValue;
  }, store.get(atom));

  useEffect(() => {
    // 订阅组件
    const unsub = store.sub(atom, rerender);
    // 取消订阅
    return unsub;
  }, [store, atom]);

  return isPromiseLike(value) ? use(value) : value;
};
```



## 总结

通过本章你可以学习到：


- React `use` 与 `Suspense`。
- 如何实现自定义 `use` hook。
- 在 `useAtomValue` hook 中集成 `use`。

在下一节中，我们将讲解 Jotai DevTools 与 React DevTools，并对其中一个 Hook 进行实现。
