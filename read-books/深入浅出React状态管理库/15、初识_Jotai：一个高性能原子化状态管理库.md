

在 “[React Context 性能挑战及其优化之道](https://juejin.cn/book/7311970169411567626/section/7313462656471334949)” 一节中我们介绍了 React Context 会带来额外 re-render 的问题，Jotai 就是用来解决额外的 re-render 问题而发明出来的。

Jotai 核心理念是**原子（atom）**，灵感来自 Recoil，那怎么理解 “原子” 的概念呢？




<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c6dba3e85b2b4fe4940a10e62113755a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2052&h=1022&s=166523&e=png&b=ffffff" alt="image.png" width="100%" /></p>

一个前端应用通常由多个组件组合而成，而组件之间自然就有了共享状态的需求，状态管理库就应运而生了，而这时候就诞生了两个派别 —— 以 Redux 为首的单一状态树与 Jotai 为首的原子化状态管理派别。`原子化`就是指整个应用的外部状态被拆分为了一个个分片的状态片段，每个状态片段保存在各自的 atom 中，各自的 atom 组合交错共同组成了整个应用的状态。

而 Jotai 帮助我们维护各个原子状态以及原子之间的依赖交错关系，并通过原子之间的相互依赖关系阻止应用 re-render，提高性能。

时至今日，Jotai 及它的[社区](https://github.com/orgs/jotaijs/repositories)仍在不断快速地发展和迭代着。目前已经被非常多的公司应用在生产环境中：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a9d69776e38b4a65808a583d05d2d696~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1824&h=174&s=22848&e=png&b=f7f7f7" alt="image.png"  width="100%"/></p>




本节让我们来一起快速入门 Jotai。


## Store

Jotai Store 用来存储 atom 的状态，通过 `createStore` 可以创建一个 Jotai Store：


```js
import { createStore } from 'jotai'

const myStore = createStore()
```

创建的 Store 可以传入 `Provider` 中：


```jsx
import { Provider } from 'jotai'

const Root = () => (
  <Provider store={myStore}>
    <App />
  </Provider>
)
```

这样被  `Provider` 包裹的子孙组件就可以通过 `useStore` hook 来拿这个 `myStore`，Jotai 内部会创建一个默认的 Store，不传 `store` 参数时默认会使用 Jotai 内部默认的 Store。

Jotai Store 会包含 3 个属性：

- `get`：用来获取 atom 的状态，例如 `myStore.get(countAtom)`。
- `set`：用来修改 atom 的状态，例如 `myStore.set(countAtom, 10)`。
- `sub`：用来订阅 atom，例如：


```jsx
const unsub = myStore.sub(countAtom, () => {
  console.log('countAtom value is changed to', myStore.get(countAtom))
})
```

在这个例子中订阅了 `countAtom`，当它的状态发生变化时会执行后面的回调函数，`sub` 会返回一个函数用来取消订阅。





## atom

通过 atom 函数你可以创建一个原子：


```js
import { atom } from 'jotai'

const priceAtom = atom(10)
const messageAtom = atom('hello')
const productAtom = atom({ id: 12, name: 'good stuff' })
```

原子本身不持有状态，它的状态会被保存在 Jotai Store 中。atom 接收两个参数：

- `read`：用来定义该 atom 的状态，可以接收一个值，或者一个函数。当传入一个函数时我们称它为派生原子，派生原子会基于其他原子之上来定义状态。


```js
import { atom } from 'jotai'

const priceAtom = atom(10)
const derivedAtom = atom((get) => get(priceAtom) * 2) // 派生原子
```

- `write`：传入一个函数，定义了如何修改 atom 的状态。


```js
const writeAtom = atom(null, (get, set, update) => {
  const price = get(priceAtom)
  set(priceAtom, price + update)
})
```

根据不同的情况可以将原子划分为三类：

- **只读原子（Read-only atom）**：只传入了 `read`，并且其是一个函数，例如：


```js
const readOnlyAtom = atom((get) => get(priceAtom) * 2)
```

这时候派生原子 `readOnlyAtom` 是不能被修改的，如果我们 `set(readOnlyAtom, newState)` 会报错。

- **只写原子（Write-only atom）**：只传入了 `write` 函数，例如：


```js
const writeOnlyAtom = atom(null, (get, set, update) => {
  const price = get(priceAtom)
  set(priceAtom, price + update)
})
```

这时候尝试去读取 `writeAtom` 拿到的是 `null`。


- **读写原子（Read-Write atom）**：


```js
const readWriteAtom = atom(
  (get) => get(priceAtom) * 2,
  (get, set, update) => {
    set(priceAtom, price + update)
  },
)
```




## hooks

Jotai 的核心 hooks 包含 3 个。

### useAtomValue

通过 `useAtomValue` 可以在 React 组件中拿到 atom 的状态：


```js
import { atom, useAtomValue } from 'jotai'

const priceAtom = atom(10)

function App() {
  const price = useAtomValue(priceAtom)
}
```

在这个例子中我们通过 `useAtomValue` 函数获取 `priceAtom` 的状态。这时候你可能会问，即然 Jotai Store 上的 get 函数也可以获取到 atom 的状态，那我们能否这么写呢？


```js
function App() {
  const store = useStore()
  const price = store.get(priceAtom)
}
```

其实 `useAtomValue` 有另外一个作用就是 “订阅”，当使用 `useAtomValue` 时除了拿到 atom 状态以外会完成对它的订阅，当 atom 状态发生变化时会通知该组件重新渲染。

因此，通过 `store.get` 的方式虽然可以正确拿到 price 的值，却不会完成订阅的过程。

可以参考 [Demo](https://codesandbox.io/p/sandbox/naughty-jepsen-ms73xk) 来帮助理解：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14d5851384b0421099b8f67356d3d49f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=216&h=178&s=264045&e=gif&f=6&b=f9f9f9" alt="QQ20240219-153600-HD.gif" width="20%" /></p>



```jsx
const priceAtom = atom(0)

function Display() {
  const price = useAtomValue(priceAtom)
  return <div>Display: {price}</div>
}

function Control() {
  const store = useStore()
  const price = store.get(priceAtom)

  return (
    <div>
      <div>Control: {price}</div>
      <button onClick={() => store.set(priceAtom, 1)}>set price</button>
    </div>
  )
}

export default function App() {
  return (
    <Provider>
      <Display />
      <Control />
    </Provider>
  )
}
```

在这个例子中有两个组件 `<Display />` 和 `<Control />`，其中  `<Display />` 组件使用 `useAtomValue` 来读取状态， `<Control />` 组件使用 `store.get` 读取状态，点击按钮更新 `priceAtom` 的状态。

可以看到，当点击时  `<Control />` 组件的状态并没有发生变化，也就是并没有重新渲染。



### useSetAtom

在 React 组件中调用 `useSetAtom` 会返回一个修改 atom 状态的函数：


```jsx
import { atom, useSetAtom } from 'jotai'

const priceAtom = atom(10)

function App() {
  const setPrice = useSetAtom(priceAtom)
  return <button onClick={() => setPrice(10)}>dispatch</button>
}
```



### useAtom

`useAtom` hook 你可以看作是 `useAtomValue` 和 `useSetAtom` 的集合，调用 `useAtom` 会返回 `[状态, 修改状态函数]` 的二元组，类似 `useState`：


```js
import { useAtom } from 'jotai'

function App() {
  const [price, setPrice] = useAtom(priceAtom)
}
```

当然调用 `useAtom` 也是会完成订阅的。它的实现也非常简单，我们现在就可以把它写出来！



```js
function useAtom(atom) {
  const value = useAtomValue(atom)
  const setAtom = useSetAtom(atom)
  return [value, setAtom]
}
```




借助 `useAtomValue` 和 `useAtom` 可以在组件中获取状态以及完成订阅，当组件卸载时会自动取消订阅。借助 `useSetAtom` 和  `useAtom` 可以在组件中拿到修改 atom 状态的方法。







## 原子化与 re-render

我们前面说 Jotai 的理念是原子化，各个分片的原子组成了整个应用系统的状态，那么对于派生原子来说，我们来看一个[例子](https://codesandbox.io/p/sandbox/derived-re-render-yp6vtq)：





<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/efd4467da7f347e6b9ebfbb6a892251d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1578&h=1010&s=94084&e=png&b=ffffff" alt="image.png" width="90%" /></p>


现在有三个 atom —— `derivedAtom2` 依赖 `derivedAtom`，`derivedAtom` 依赖 `countAtom`；有两个组件 —— `<Control />` 依赖 `countAtom`，`<Display />` 依赖 `derivedAtom2`。

```jsx
import { atom, useAtomValue, useSetAtom } from "jotai";

const countAtom = atom(1);

const derivedAtom = atom((get) => get(countAtom) * 2);

const derivedAtom2 = atom((get) => get(derivedAtom) * 3);

function Display() {
  const count = useAtomValue(derivedAtom2);
  return <div>{count}</div>;
}

function Control() {
  const setCount = useSetAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>Increment</button>;
}

export default function App() {
  return (
    <>
      <Display />
      <Control />
    </>
  );
}
```

一开始的时候展示的状态为 6，如果我们点击按钮会发生什么？直觉告诉我们每次当点击按钮的时候 `countAtom` 会自增 1，展示的 `derivedAtom2` 会自增 6。


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c5fb582ebf454506bafa10898d7a7894~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=206&h=146&s=517476&e=gif&f=15&b=f9f9f9" alt="QQ20240316-184152-HD.gif" width="20%" /></p>

结果也确实是如此，Jotai 帮助我们管理原子之间的依赖关系，并根据依赖关系正确触发组件重新渲染。
也正是这种特性能够避免不必要的 re-render。

但是也正是 Jotai 原子化的特性，我们也需要关心如何合理地拆分原子，否则就会带来额外的 re-render 的问题，[例如](https://codesandbox.io/p/sandbox/jotai-re-render-q8nld3)：


```jsx
const anAtom = atom({
  count: 10,
  text: "jotai",
});

function Display() {
  const { text } = useAtomValue(anAtom);
  console.log("re-render");
  return <div>text: {text}</div>;
}

function Increment() {
  const setCount = useSetAtom(anAtom);
  return <button onClick={() => setCount((c) => c + 1)}>increment</button>;
}

export default function App() {
  return (
    <>
      <Display />
      <Increment />
    </>
  );
}
```

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1027ee703f0b4315b483a3f26c9ae8cc~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=225&h=599&s=1689699&e=gif&f=11&b=fcfcfc" alt="QQ20240219-174834-HD.gif" width="30%" /></p>


可以看到，在 `<Display />` 组件中使用了 `anAtom` 中的 `text` 字段，但是当我们修改 `count` 值会发现，即使 `<Display />` 组件中没有用到但随着 `count` 值的变化也会触发 re-render。

那解决办法是什么呢？我们可以将 `anAtom` 状态拆分成两部分：


```jsx
const countAtom = atom(10);
const textAtom = atom('jotai');

function Display() {
  const text = useAtomValue(textAtom);
  console.log("re-render");
  return <div>text: {text}</div>;
}

function Increment() {
  const setCount = useSetAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>increment</button>;
}

export default function App() {
  return (
    <>
      <Display />
      <Increment />
    </>
  );
}
```

这样 count 值的变化就不会触发额外的 re-render，通过这个例子展示了合理拆分原子的重要性，而不是把整个一坨大的状态塞到一个 atom 中维护。


### atom 中的 atoms

接下来我们介绍一种非常有意思的实践 —— atoms in atom，顾名思义就是将一些 atom 放到一个 atom 中来管理和维护，来看下面这个[例子](https://codesandbox.io/p/sandbox/atoms-in-atom-h9k2y7)。

首先，创建 atoms in atom：

```js
const countsAtom = atom([atom(1), atom(2), atom(3)])
```

接下来在组件中使用：


```jsx
const Counter = ({ countAtom }) => {
  const [count, setCount] = useAtom(countAtom);
  return (
    <div>
      {count} <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
};

const Parent = () => {
  const [counts, setCounts] = useAtom(countsAtom);
  const addNewCount = () => {
    const newAtom = atom(0);
    setCounts((prev) => [...prev, newAtom]);
  };
  return (
    <div>
      {counts.map((countAtom) => (
        <Counter countAtom={countAtom} key={countAtom} />
      ))}
      <button onClick={addNewCount}>Add</button>
    </div>
  );
};
```

在这个例子中，父组件 `Parent` 读取了 `countsAtom` 的状态，并将一个个子 atom 传入 `Counter` 组件中，例如在应用启动时，`countsAtom` 包含了 3 个 atom，对应创建了 3 个 `Counter` 组件。这样做的好处是当增加 count 时只有对应的 `Counter` 组件 re-render 而不会影响到其余的 `Counter` 组件。



### focusAtom

借助 `focusAtom` 可以选择一部分数据创建新的 atom，来看下面这个[例子](https://codesandbox.io/p/sandbox/focus-atom-zkn6yn)：


```jsx
const textAtom = focusAtom(anAtom, (optic) => optic.prop("text"));

function Display() {
  const text = useAtomValue(textAtom);
  console.log("re-render");
  return <div>text: {text}</div>;
}
```

在这个例子中，我们将 `text` 状态单独抽离成了一个新的 atom，并将 `<Display />` 组件改为直接从 `textAtom` 获取状态，这样当 `count` 值再发生变化时不会导致 `<Display />` 组件 re-render。





## async

借助 async atom 和 Suspense，可以更加轻松地处理异步逻辑，这里分为 async read atom 和 async write atom。


### async read atom


我们需要向 atom 中传入 async function，例如我们模拟一个异步逻辑，2s 后返回 10，来看下面这个[例子](https://codesandbox.io/p/sandbox/jotai-use-vs48q8)：


```js
const anAtom = atom(async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(10);
    }, 2000);
  });
});
```

然后当加载异步逻辑时我们希望展示 loading：


```jsx
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


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/aa2983bec24d41b883c31dae3a722e35~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=220&h=174&s=1090483&e=gif&f=25&b=fefefe" alt="QQ20240219-184857-HD.gif" width="20%" /></p>


当 `useAtomValue` 读取状态时 Jotai 会 “挂起” 应用，展示 `Suspense` 的 fallback。


### async write atom


我们来看一个[例子](https://codesandbox.io/p/sandbox/jotai-async-set-tvmgcf)：

```jsx
const countAtom = atom(1);

const request = async () => new Promise((r) => setTimeout(r, 2000, 10));

const Display = () => {
  const [value, increment] = useAtom(countAtom);
  return <div onClick={() => increment(request)}>value: {value}</div>;
};

export default function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <Display />
    </Suspense>
  );
}
```

当然我们也可以在更新状态时通过传入 promise 来触发挂起，Jotai 会等待 promise 被 resolve，并用值更新 atom 的状态。


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8df2c37df81f40b09ef777681c93029a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=184&h=128&s=379587&e=gif&f=14&b=fdfdfd" alt="QQ20240219-185745-HD.gif" width="20%" /></p>






## 总结

在本章节中，我们介绍了 Jotai 的概念和基本用法，并配有大量的可以直接调试的 Demo，以方便大家学习和练习。在下一节中我们就来上手实践，从 0 到 1 来实现一个 mini-jotai。