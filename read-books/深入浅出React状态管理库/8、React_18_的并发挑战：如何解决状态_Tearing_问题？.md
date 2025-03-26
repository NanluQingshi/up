
我们在上一章提到 React18 最主要的特性就属并发更新了，同时由于并发更新的特性也带来了 Tearing 的问题。

本章让我们来深入研究一下什么是 React Tearing，以及 React 给状态管理库生态提供了什么新的 API 来解决这个问题。



## 什么是 React Tearing

普通情况下，当用户触发更新的时候，整个 React 渲染过程是不可被打断的，直到渲染流程结束之后才可以继续执行其他任务。

比如 React 现在正在渲染下面的组件树，其中子组件 Cpn4、Cpn5、Cpn6 依赖了外部的状态。React 会以 DFS （深度优先遍历）的方式去遍历整棵树，也就是说会以 `Cpn1 -> Cpn2 -> Cpn4 -> Cpn5 -> Cpn3 -> Cpn6` 这样的顺序来去遍历：



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/981e7e507f2b47d78a37cd00ea3208bd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1060&h=910&s=57569&e=png&b=ffffff" alt="image.png" width="60%" /></p>




当渲染到 Cpn4 的时候，用户执行一个操作，从而去触发 Store 状态的变化，但是由于渲染并没有结束，所以会继续遍历剩余组件：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dc7d46ddb72c42c89c980655372b91a4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2042&h=912&s=103872&e=png&b=ffffff" alt="image.png" width="100%" /></p>


可以看到，虽然用户执行改变 Store 的状态的操作，但此时需要等待渲染结束后才能真正更新 Store 状态。当整个过程结束，接下来会改变外部 Store 的状态：




<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/962cc660c3844250b7789982adae42e7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=630&h=586&s=31618&e=png&b=ffffff" alt="image.png" width="60%" /></p>



可以看到整个渲染过程不会被打断，因此引用外部 Store 的各个组件获取的状态是一致的。


不过 React18 增加了并发更新机制，`本质上是时间切片，并且高优先级会打断低优先级的任务`。在渲染的过程中，由于整个连续不断的渲染过程拆分成了一个个分片的渲染片段，因此在渲染的间隙时就有机会去响应用户的操作：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bb08952f26d349d1bf49af145beeaa18~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1324&h=1112&s=64798&e=png&b=ffffff" alt="image.png" width="90%" /></p>

我们来看一下上面的过程在 React18 之后是怎么样的：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d42c63f26bec44c4b8eba204a5e67d3f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2392&h=786&s=113353&e=png&b=ffffff" alt="image.png" width="100%" /></p>

  


可以看到当渲染到 Cpn4 时，拿到的是 Store V1 的状态，这时候用户的操作（例如点击事件）改变了外部的状态。在恢复继续渲染时就发生了状态不一致的现象，即 Cpn4 引用的是 Store V1 的状态，而 Cpn5 和 Cpn6 引用的是 Store V2 的状态。这就是 **`React Tearing（撕裂）问题`**，即**各个组件展示的状态不一致**的问题。可以看到，虽然 React18 并发更新带来了诸多优势，但也给状态管理社区带来了新的问题和挑战。


举个实际的 🌰，在 react-redux 7 中，用 `startTransition` 来开启并发更新，并用 `while (performance.now() - start < 20) {}` 延长每个组件 render 的时间，模拟真实的 render 过程：

```js
export default function Counter() {
  const value = useSelector((state) => state);
  const start = performance.now();
  while (performance.now() - start < 20) {}
  return <div>{value}</div>;
}
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/73b855a6657c4cea968033b7278d85ea~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1376&h=816&s=130493&e=gif&f=97&b=fdfcff)



可以看到，当连续点击按钮的时候状态发生了不一致的情况，那最终为什么状态一致了呢？这是因为 Tearing 的问题是发生在点击的过程中的。在用户的操作改变外部 Store 的状态后会触发 re-render（重新渲染），最后一次的 re-render 每个组件所引用 store 状态都是最新的状态，所以最终还是会趋于一致。


react-redux 8 引入了 `useSyncExternalStore` 来解决这个问题，我们将 react-redux 版本升级到 8，再来看下效果：

> 可以戳这里，直接在线查看 Demo, 可以手动切换 react-redux 版本查看效果：https://codesandbox.io/s/react-tearing-9mn3dv

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/54d85299a6ad4bbaac0a08877ffa0514~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1356&h=820&s=66681&e=gif&f=57&b=fdfcff)

可以看到不会有之前的问题了，各个组件的状态保持了一致，但是渲染变得卡顿了，打开 performance 面板，整个过程如下：



原先：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bbd3330f0ad343209244c773e2b29e70~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1810&h=738&s=34191&e=png&b=f7f9ff)



现在：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/793d31c1643e4b8c913ed0a45edd54f0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1736&h=688&s=93830&e=png&b=f7f9ff)

React 提供了 `useSyncExternalStore` 来解决这个问题，核心原理就是**将这次的并发更新变为同步更新（也就是不可中断）** 。整个并发更新过程变回同步不可被中断了，自然也就不会有这个问题了。


  


## useSyncExternalStore 与 use-sync-external-store

### useSyncExternalStore

React18 提供了一个新的 API `useSyncExternalStore`，在我们日常开发中不会用到，但对于状态管理库来说则非常重要。`useSyncExternalStore` 提供了一种标准化的方式来共享外部状态，并保证组件与这些外部状态源的同步，简化了跨组件状态共享的复杂度，也解决了我们在上文提到的 React Tearing 的问题。

`useSyncExternalStore` 的基本用法如下：

```js
const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)
```


-   `subscribe`：一个函数，接受一个监听器（listener）回调。当外部数据源更新时，这个监听器应该被调用，以通知 React 组件需要重新渲染。这个函数应该返回一个取消订阅的函数。
-   `getSnapshot`：一个函数，返回当前的外部状态快照。React 会在订阅外部数据源时调用它来获取最初的状态，之后每当外部数据源通知 React 更新时，也会调用它来获取最新状态。
-   `getServerSnapshot`（可选）：在服务端渲染（SSR）中使用，返回当前外部状态的快照，类似于 `getSnapshot`，但专门用于 SSR 使用。


我们来实现一个例子帮助大家更深入理解这个 Api，理解这个例子非常重要，我们在接下来的章节学习 Zustand 源码时你会发现和这个 Demo 非常相似。

> 点击查看完整 Demo：https://codesandbox.io/p/sandbox/usesyncexternalstore-l8ltf8?file=%2Fsrc%2FApp.js%3A28%2C16


```js
import { useSyncExternalStore } from "react";

// 外部状态管理器
const store = {
  state: { count: 0 },
  listeners: new Set(),
  setState(newState) {
    this.state = newState;
    // 触发订阅该store的组件re-render
    this.listeners.forEach((listener) => listener());
  },
  subscribe(listener) {
    this.listeners.add(listener);
    // 取消订阅
    return () => this.listeners.delete(listener);
  },
  getState() {
    return this.state;
  },
};

function useStore() {
  const state = useSyncExternalStore(
    // 订阅函数
    (listener) => store.subscribe(listener),
    // 获取当前快照
    () => store.getState()
  );

  return state;
}

export default function App() {
  const { count } = useStore();

  return (
    <div>
      Count: {count}
      <button onClick={() => store.setState({ count: count + 1 })}>
        Increment
      </button>
    </div>
  );
}
```

在这个例子中我们封装了一个自定义 Hook —— `useStore`，通过 `useSyncExternalStore` 订阅了外部的 `store` 状态源。当 `store` 的状态改变时（`setState`），会遍历 `listeners` 中的全部 `listener` 来 re-render 订阅该 `store` 的全部组件，也就是说导致使用了 `useStore` 的组件重新渲染。



### use-sync-external-store 库



社区的各个状态管理库并没有直接使用 `useSyncExternalStore` API，而是使用 use-sync-external-store 这个库。因为 `useSyncExternalStore` 是 React18 提供的一个 API，如果项目是 React17 会拿不到这个 API。而 **use-sync-external-store 会根据 React 是否暴露这个 API，如果暴露了，就直接使用，否则会使用该库自己实现的一套**。也就是说 `useSyncExternalStore` 分为两个版本，一个是 React18 内置的，一个是自己实现的一套。

> use-sync-external-store 库是在 React 仓库中实现的，并独立发布于 npm 上。
> 
> npm 地址：https://www.npmjs.com/package/use-sync-external-store
> 
> 仓库地址：https://github.com/facebook/react/tree/main/packages/use-sync-external-store

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/91a28549989f476584bbb09d1174acea~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=628&h=704&s=44364&e=png&b=fefefe" alt="image.png" width="50%" /></p>

这里的 “垫片（shim）” 的意思是 use-sync-external-store 关于 `useSyncExternalStore` 的内置实现，用于兼容 React18 以下的版本。

而社区的各个状态管理库也并没有直接用 `useSyncExternalStore`，而是会使用 `useSyncExternalStoreWithSelector`。`useSyncExternalStoreWithSelector` 相较于`useSyncExternalStore` 会增加两个额外的参数传入：


```js
export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection;
```

-   `selector`：用于从整个状态中选择一个子集。
-   `isEqual`：（可选）：一个函数，用于比较前后两次选择的状态是否相等，如果相等则说明这次状态没有发生变化，组件不需要 re-render，从而避免不必要的重渲染。




也就是说，`useSyncExternalStoreWithSelector` 是带 `selector`（选择器）版本的 `useSyncExternalStore`，各个状态管理库可以基于这个 API 更轻松地实现状态的订阅。各个组件只关心选取出来的状态（或者说只关心组件自己关心的状态），其他的状态发生变化不会导致组件发生 re-render，从而进一步优化性能和开发体验。




### use-sync-external-store 源码解读


接下来我们就讲解下 `use-sync-external-store` 库的原理，首先是 `useSyncExternalStore` Api 的实现：

#### useSyncExternalStore

我们在前面提到 `useSyncExternalStore` 会区分 React 是否支持（即 React 是否导出了这个 Api）来选择使用 React 原生实现还是 use-sync-external-store 的实现版本：


```ts
// 原生实现
import {useSyncExternalStore as builtInAPI} from 'react';

export const useSyncExternalStore: <T>(
  subscribe: (() => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
) => T = builtInAPI !== undefined ? builtInAPI : shim;
```


我们在这里重点讲解 use-sync-external-store 关于 `useSyncExternalStore` 的实现版本，理解 `useSyncExternalStore` 的内部逻辑对于日后开发属于我们自己的状态管理库非常重要。`useSyncExternalStore`分为 client 端和 server 端两个实现，React 会根据 `canUseDOM` 来区分不同环境：


```ts
import {useSyncExternalStore as client} from './useSyncExternalStoreShimClient';
import {useSyncExternalStore as server} from './useSyncExternalStoreShimServer';

const canUseDOM: boolean = !!(
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'
);

const shim = canUseDOM ? client : server;
```

server 端（给 SSR 用的）的实现如下：

```ts
export function useSyncExternalStore<T>(
  subscribe: (() => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return getSnapshot();
}
```

可以看到，server 端只是简单调用了一下传入的 `getSnapshot` 并返回取得的状态。



client 端实现如下：

```ts
export function useSyncExternalStore<T>(
  subscribe: (() => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  const value = getSnapshot();
  
  // forceUpdate用来触发组件re-render
  const [{inst}, forceUpdate] = useState({inst: {value, getSnapshot}});

  useLayoutEffect(() => {
    inst.value = value;
    inst.getSnapshot = getSnapshot;

    if (checkIfSnapshotChanged(inst)) {
      forceUpdate({inst});
    }
  }, [subscribe, value, getSnapshot]);

  useEffect(() => {
    if (checkIfSnapshotChanged(inst)) {
      forceUpdate({inst});
    }
    const handleStoreChange = () => {
      // 这里做了性能优化，会判断前后状态是否变化，如果没有变化则不会re-render
      if (checkIfSnapshotChanged(inst)) {
        forceUpdate({inst});
      }
    };
    // 订阅，把handleStoreChange传入到订阅函数subscribe中，最终在状态管理库中会调用handleStoreChange来触发re-render
    return subscribe(handleStoreChange);
  }, [subscribe]);

  return value;
}

// 工具函数，判断状态是否变化
function checkIfSnapshotChanged<T>(inst: {
  value: T,
  getSnapshot: () => T,
}): boolean {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !Object.is(prevValue, nextValue);
  } catch (error) {
    return true;
  }
}
```

我们来回顾一下前面在学习 `useSyncExternalStore` 时举的例子，结合这个例子帮助我们更好的理解 React 源码：


```js
// 外部状态管理器
const store = {
  state: { count: 0 },
  listeners: new Set(),
  setState(newState) {
    this.state = newState;
    // 触发订阅该store的组件re-render
    this.listeners.forEach((listener) => listener());
  },
  subscribe(listener) {
    this.listeners.add(listener);
    // 取消订阅
    return () => this.listeners.delete(listener);
  },
  getState() {
    return this.state;
  },
};

function useStore() {
  const state = useSyncExternalStore(
    // 订阅函数
    (listener) => store.subscribe(listener),
    // 获取当前快照
    () => store.getState()
  );

  return state;
}

export default function App() {
  const { count } = useStore();

  return (
    <div>
      Count: {count}
      <button onClick={() => store.setState({ count: count + 1 })}>
        Increment
      </button>
    </div>
  );
}
```

这里可以分为两块来看：

- 订阅 Store：即这里向 `useSyncExternalStore` 传入的订阅函数 `(listener) => store.subscribe(listener)`，结合源码来看我们可以知道，这里传入的 `listener` 其实就对应源码里的 `handleStoreChange`，如果状态变化，`handleStoreChange` 就会调用 `forceUpdate` 来完成组件的重新渲染。同时我们把 `listener` 保存到了 `store` 里的 `listeners` 中。
- 更新状态：即调用 `store.setState`，`store.setState` 会依次调用 `listeners` 中的全部 `listener`，来完成组件的重新渲染。

#### useSyncExternalStoreWithSelector

然后是 `useSyncExternalStoreWithSelector` 的源码，`useSyncExternalStoreWithSelector` 内部会调用 `useSyncExternalStore`，相比于 `useSyncExternalStore` 增加了两个额外的参数 `selector` 与 `isEqual`：

```ts
import * as React from 'react';
import is from 'shared/objectIs';
import {useSyncExternalStore} from 'use-sync-external-store/src/useSyncExternalStore';

const {useRef, useEffect, useMemo, useDebugValue} = React;

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (() => void) => () => void,
  getSnapshot: () => Snapshot, 
  getServerSnapshot: void | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  // 初始化变量
  const instRef = useRef(null);
  let inst;
  if (instRef.current === null) {
    inst = {
      hasValue: false,
      value: (null: Selection | null),
    };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  // 实现selector版的getSelection、getServerSelection
  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot;
    let memoizedSelection: Selection;
    const memoizedSelector = (nextSnapshot: Snapshot) => {
       // ...
    };
    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      maybeGetServerSnapshot === null
        ? undefined
        : () => memoizedSelector(maybeGetServerSnapshot());
    return [getSnapshotWithSelector, getServerSnapshotWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  // 通过useSyncExternalStore计算状态
  const value = useSyncExternalStore(
    subscribe,
    getSelection,
    getServerSelection,
  );

  // 返回状态
  return value;
}
```

可以看到，`useSyncExternalStoreWithSelector` 实现包含了三个部分：

-   实现 selector 版的 `getSelection`、`getServerSelection`；
-   通过 `useSyncExternalStore` 计算状态；
-   最终返回状态；



通过 `useMemo` 返回的 `getSelection` 和 `getServerSelection` 分别对应 `getSnapshotWithSelector`、`getServerSnapshotWithSelector`。核心在于 `memoizedSelector` 的实现，`getSnapshotWithSelector` 和 `getServerSnapshotWithSelector` 仅仅是用 `memoizedSelector` 包了一下 `getSnapshot` 和 `getServerSnapshot` 而已。



我们来看 `memoizedSelector` 的实现：

```ts
const memoizedSelector = (nextSnapshot: Snapshot) => {
  if (!hasMemo) {
    hasMemo = true;
    memoizedSnapshot = nextSnapshot;
    const nextSelection = selector(nextSnapshot);
    memoizedSelection = nextSelection;
    return nextSelection;
  }

  const prevSnapshot: Snapshot = (memoizedSnapshot: any);
  const prevSelection: Selection = (memoizedSelection: any);

  if (Objectis(prevSnapshot, nextSnapshot)) {
    return prevSelection;
  }

  const nextSelection = selector(nextSnapshot);

  if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
    return prevSelection;
  }

  memoizedSnapshot = nextSnapshot;
  memoizedSelection = nextSelection;
  return nextSelection;
};
```


还记得 `selector` 的作用是什么嘛？`selector` 会从当前 `store` 的状态选取你需要的状态。比如，现在 store 的状态是 `{ count1: 10, count2: 100, count3: 1000 }`，如果你只关心 `count1` 和 `count2` 的值，`selector` 就可以写为：

```ts
const snapshot = (state) => ({
  count1: state.count1,
  count2: state.count2
})
```

最终 `{ count1: 10, count2: 100 }`这个对象会作为 `useSyncExternalStoreWithSelector` 的返回结果。


回到 `memoizedSelector` 源码，首先当第一次调用这个 Hook 时，即 `hasMemo` 为 false，此时没有上一次的保存的状态，这时候只需要计算一下最新的状态并更新 `memoizedSelection` 即可。


`nextSnapshot` 就是通过传入的 `getSnapshot` 计算得到，也就是当前 store 的状态。接下来调用 `selector(nextSnapshot)` 得到选取的状态，然后和上一次选取的状态进行比较：`isEqual(prevSelection, nextSelection)`，如果一致则直接返回 `prevSelection`，从而来保证引用的一致。可以看到这里是通过你传入的 `isEqual` 调用的，因为每次都会重新调用 `selector`，以上面返回 `{ count1: 10, count2: 100 }` 这个为例，每次调用都会返回一个新的对象，即使 `count1` 和 `count2` 都没有变。因此，`isEqual` 一般都会传入一个 `shallowEqual` 函数，即浅层比较，会对对象的第一层属性进行比较，如果没有变则会返回 `true`，否则返回 `false`。
  


  


## 总结

本文我们一起剖析了在 React18 下状态管理库的 Tearing 问题，以及 React 的 `useSyncExternalStore` 是如何解决这种问题的。之后深入讲解了 `use-sync-external-store` 库的实现原理。


通过本章节，你可以学习到：

-   什么是 React Tearing。
-   `useSyncExternal` Api。
-   `use-sync-external-store` 库的实现原理。


理解这一章对于理解状态管理库的实现至关重要，因为 React18 开始就进入了并发更新时代，同时带来了 React Tearing 的问题，React 通过 `useSyncExternalStore` 来帮助社区状态管理库解决这个问题，同时简化了实现的流程，因此整个社区状态管理库几乎已经转向了使用这个 Api 来实现。在下一章节我们将正式开始 Zustand 的学习。
