本章让我们来深入聊一下 React 保持高性能的终极秘籍 —— bailout 策略。

为什么要加上这一章呢？我们在[迎接变革：React 19 的新特性与对状态管理生态的影响解析（上）](https://juejin.cn/book/7311970169411567626/section/7339581765017108495)一章中聊了 React Compiler 的作用，它可以优化 re-render 从此之后我们就不再需要使用 `useMemo`、`useCallback`、`memo`。因此增加了这一章，希望通过本章可以帮助大家彻底理解为什么我们之前需要这些，以及组件产生不必要 re-render 的核心原因。


当我们更新组件状态时，React 并不是只 re-render 当前组件，而是会自顶向下去遍历整颗 Fiber 树。而 React 的一个核心概念是`幂等性`，这意味着在 React Component 中，相同的输入（`props`、`state`、`context`）总会得到相同的输出：



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b8db4aea98db4045b273df214e3c8228~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2308&h=1062&s=160358&e=png&b=ffffff" alt="image.png" width="70%" /></p>
 
因此我们有理由相信只要这些没有变化，就不需要 re-render 而复用上一次的渲染结果。 
这就是 bailout 策略，即 React 在渲染过程中的一种优化手段，从而避免不必要的渲染以提升性能。



# 从 3 个案例开始

当你写代码的时候你是否会有这个组件为什么没有 render/为什么这个组件 render 多次的疑惑，接下来让我们通过 3 个案例来演示这个问题。

## 案例1 —— 小试牛刀

> 点击查看 Demo：https://codesandbox.io/p/sandbox/bailout1-tfl3v9?file=%2Fsrc%2FApp.js


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9399634d6161426f8a86010976161b14~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=256&h=552&s=39488&e=gif&f=34&b=fcfbfe" alt="20240609213808_rec_.gif" width="20%" /></p>


```js
const Cpn = () => {
  console.log("Cpn render");
  return <div>Cpn</div>;
};

const App = () => {
  const [state, updateState] = useState(1);

  console.log("App render");

  return (
    <div className="App">
      <button onClick={() => updateState(() => state)}>+1</button>
      <div>{state}</div>
      <Cpn />
    </div>
  );
};
```

在这个例子中 `state` 的初始状态为 1，当点击按钮时更新状态为相同的值，此时可以看到没有任何的输出，也就 `App` 组件和 `Cpn` 组件都没有 re-render。


## 案例2 —— 渐入佳境

我们再来看下面这个例子：


> 点击查看 Demo：https://codesandbox.io/p/sandbox/bailout2-8ll8qk?file=%2Fsrc%2FApp.js%3A1%2C1-28%2C1


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d81adbb951c64c82b2a10660a144be1d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=320&h=852&s=50475&e=gif&f=29&b=fbfafe" alt="20240609223044_rec_.gif" width="20%" /></p>

```js
const Cpn2 = () => {
  console.log("Cpn2 render");
  return <div>Cpn2</div>;
};

const Cpn = () => {
  console.log("Cpn render");
  return <Cpn2 />;
};

const App = () => {
  const [state, updateState] = useState(1);

  console.log("App render");

  return (
    <div className="App">
      <button onClick={() => updateState(state + 1)}>+1</button>
      <div>{state}</div>
      <Cpn />
    </div>
  );
};
```

在这个例子中每当我们点击按钮时都会赋予一个新的值，当点击按钮的时候我们可以看到，`App`、`Cpn`、`Cpn2` 组件都被 re-render 了。

那如果我们给 `Cpn` 组件包一层 `memo` 呢，比如：


```js
const Cpn = memo(() => {
  console.log("Cpn render");
  return <Cpn2 />;
});
```

请回答，现在点击按钮时哪些组件 re-render？

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/864a99860995429d84e5df5d1b670c6b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=264&h=864&s=50060&e=gif&f=35&b=fbfafe" alt="20240609223444_rec_.gif" width="20%" /></p>

答案是只有 `App` 组件 re-render 了。

## 案例3 —— 高手过招

事情开始变得有趣起来了。。。

在下面这个例子中我们创建了一个 React Context，并在 `Count1` 组件中消费和更新状态：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/bailout3-vmlyhk?file=%2Fsrc%2Findex.js


```js
const initialState = {
  count1: 0,
  count2: 0,
};

const context = createContext(initialState);

const Count1 = () => {
  const [state, dispatch] = useContext(context);
  console.log("Count1 render");

  return (
    <div
      onClick={() =>
        dispatch((state) => ({ ...state, count1: state.count1 + 1 }))
      }
    >
      <span>{state.count1}</span>
      <div>Count1</div>
    </div>
  );
};

const Count2 = () => {
  console.log("Count2 render");
  return <div>Count2</div>;
};

const App = () => {
  return (
    <context.Provider value={useState(initialState)}>
      <Count1 />
      <Count2 />
    </context.Provider>
  );
};
```

请回答：当点击按钮时 `Count2` 组件是否会 re-render？

答案是：会的。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14dc03857ec64feb88c94e55c8764617~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=292&h=880&s=51103&e=gif&f=35&b=fcfbff" alt="20240609225337_rec_.gif" width="20%" /></p>

这似乎有些反直觉，但是如果我们将 `Provider` 抽离成单独的组件后就不会再 re-render 了：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60e5830af83a4579ab8b7c6b668a690e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=260&h=832&s=50534&e=gif&f=36&b=fdfcff" alt="20240609225801_rec_.gif" width="20%" /></p>


```js
const Wrapper = ({ children }) => {
  return (
    <context.Provider value={useState(initialState)}>
      {children}
    </context.Provider>
  );
};

const App = () => {
  return (
    <Wrapper>
      <Count1 />
      <Count2 />
    </Wrapper>
  );
};
```

通常我们可以看到开源的库对于 `Provider` 也都是这么封装的，接下来让我们一起来看一下 React 内部到底用了什么“黑魔法”。


# 剖析 React 内部机制

## eagerState

在上面第 1 个案例中我们调用了 `updateState` 将状态更新为相同的值。试想一下，如果我们更新后的状态和当前状态一致，那么 React 是不是就不需要再去 re-render 了？

这就是 eagerState 策略，也就是说在 re-render 之前 React 会去计算一下更新后的状态，如果对比之后发现一致，则不会再 re-render 了。

在 React 源码内部实现是这样的：


```js
function dispatchSetState<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
): void {
  // ...
  const currentState: S = (queue.lastRenderedState: any); // 获取上一次的计算结果
  const eagerState = lastRenderedReducer(currentState, action); // 计算最新的状态
  if (Object.is(eagerState, currentState)) {
    return; // 先后状态一致，不 re-render
  }
  // ...
  scheduleUpdateOnFiber(root, fiber, lane, eventTime); // 先后状态不一致则 re-render
  // ...
}
```

在这里 `dispatchSetState` 就是更新状态时 React 内部会调用的函数，而 `scheduleUpdateOnFiber` 是 React 开启渲染的入口函数。

React 会计算最新的状态，对应案例1 中会调用 `() => state`。当 React 发现前后状态一致了就会直接 `return` 不会继续后面的步骤，从而避免了无用的 re-render。


## bailout

我们上面说，当 `props`、`state`、`context` 不变时 React 就可以无需重新渲染组件并复用上一次的渲染结果。我们分别来看一下 React 内部是如何判断的：

- `props`


```js
const oldProps = current.memoizedProps; 
const newProps = workInProgress.pendingProps; 

if (oldProps !== newProps) {
  // props 不同，需要 re-render
}
```

可以看到 React 是直接判断新旧的 `props` 引用是否直接相等。

- `state` / `context`


```js
// 判断是否包含 `state` 或 `context` 变化
const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
  current,
  renderLanes,
);

// `checkScheduledUpdateOrContext` 实现
function checkScheduledUpdateOrContext(
  current: Fiber,
  renderLanes: Lanes,
): boolean {
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) { // 判断 `state` 变化
    return true;
  }
  if (enableLazyContextPropagation) {
    const dependencies = current.dependencies;
    if (dependencies !== null && checkIfContextChanged(dependencies)) { // 判断 context 变化
      return true;
    }
  }
  return false;
}
```

当我们在组件中更新状态时，React 就会往当前的 Fiber Node 上记录也就是这里的 `lanes` 来标记渲染的优先级，因此 React 就可以直接通过这个字段来判断是否需要 re-render。


## memo

当父组件 render 时一定会生成新向子组件传递的 `props`，例如对于这样一个简单的组件：


```js
function App() {
  return <Cpn count={1} />
}
```

我们可以在 [babel 平台](https://babeljs.io/repl)上看这段代码被编译后的结果：



![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/08b7c3830a5b410baf11daaca5b2c056~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2358&h=260&s=62372&e=png&b=fefefe)

而每次当渲染 `App`（其实也就是调用 `App` 函数）的时候，背后会调用 React 提供的 `jsx` 函数，最后会得到类似这样的对象（当然实际上会更复杂），也就是我们常说的 Virtual DOM 或者叫 React Elements：


```js
{
  type: Cpn, // 也就是子组件这个函数
  props: { // 向子组件传递的参数
    count: 1
  },
}
```

然后当渲染 `Cpn` 组件时，假设这个对象名字叫 `wip`，最后相当于执行 `wip.Cpn(wip.props)`，可以看到 React 原理并不复杂，复杂的是对于无数细节的处理，但是对于我们来说理解到大致的运行过程就足够了。

所以当父组件渲染时，子组件拿到的 `props` 一定是全新的对象，因此一定不满足我们前面提到 `oldProps` 和 `newProps` 相等的原则，但是内部的属性可能没有变化。在案例2 中我们可以看到当更新 `App` 组件时 `Cpn` 和 `Cpn2` 也连带的被 re-render 了，即使父组件没有传入任何的状态。


因此 React 提供了 `memo` 来解决这个问题，也就是对前后 `props` 进行浅层比较（`shallowEqual`）。

整个过程大概是这样的：


```js
const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
  current,
  renderLanes,
);

if (!hasScheduledUpdateOrContext) { // 如果发现 `state` 和 `context` 都没有变化，再进一步浅层比较 props
  const prevProps = currentChild.memoizedProps;
  if (shallowEqual(prevProps, nextProps)) { // 对前后 props 进行浅层比较
    // 复用上一次的渲染结果
  }
  // ...
}
```

可以看到对于正常的流程来说只要父组件 re-render 一定会导致 `props` 发生变化，从而去 re-render 子组件，而 `memo` 帮助我们解决了这个问题。

## useMemo 与 useCallback

我们前面说 `memo` 会浅层比较 `props`，但是我们通常需要配合 `useMemo` 和 `useCallback` 一起来使用，来看下面这个例子：


```js
function App() {
  const obj = []
  const fn = () => {
    // ...
  }
  return <Cpn obj={obj} fn={fn} />
}
```
在这个例子中我们在 `App` 组件内部创建了 `obj` 对象，以及 `fn` 函数，并将其传递给了子组件 `Cpn` 进行消费。试想一下这个过程中会有什么问题？

每当 `App` 组件 re-render 时都会创建新的 `obj` 和 `fn` 的引用，那么即使我们对 `Cpn` 组件使用了 `memo`，在浅层比较的过程中也会无法通过校验，因此 React 提供了 `useMemo` 和 `useCallback` 来解决这个问题。

我们也可以看一下 `useMemo` 和 `useCallback` 的源码，它们也同样非常简单。在 React 中分为 mount 和 update 阶段，分别对应了不同的实现。

`useMemo`（`mountMemo` 与 `updateMemo`）:


```js
// mount 阶段只需要简单的保存一下即可
function mountMemo<T>(
  nextCreate: () => T,
  deps: Array<mixed> | void | null,
): T {
  // ...
  const nextDeps = deps === undefined ? null : deps; 
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps]; // 缓存状态以及依赖
  return nextValue;
}

function updateMemo<T>(
  nextCreate: () => T,
  deps: Array<mixed> | void | null,
): T {
  // ...
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps: Array<mixed> | null = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) { // 循环对比依赖是否发生变化
        return prevState[0]; // 通过校验只需要简单返回上一次的缓存结果
      }
    }
  }
  const nextValue = nextCreate(); // 如果未通过校验就需要重新调用一遍并更新缓存
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
```

可以看到对于 `useMemo` 来说，mount 阶段只需要调用一下传入的函数，并保存结果以及依赖信息即可。对于 update 阶段则会取出上一次保存的 `deps` 结果，并与本次进行比较，如果通过校验则直接返回即可。

`useCallback`（`mountCallback` 与 `updateCallback`）:

```js
// mount 阶段只需要简单的保存一下即可
function mountCallback<T>(callback: T, deps: Array<mixed> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps]; // useCallback 不需要调用，直接保存
  return callback;
}

function updateCallback<T>(callback: T, deps: Array<mixed> | void | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps: Array<mixed> | null = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }
  hook.memoizedState = [callback, nextDeps]; // 未通过校验需要更新缓存
  return callback;
}
```

可以看到 `useMemo` 与 `useCallback` 实现几乎一致。所以 `useMemo` 和 `useCallback` 内部并不是没有消耗，它需要对比 `deps` 依赖以及存储相关信息。


# 总结

现在让我们再来看上面的最后一个案例，当 `Count1` 组件更新状态时会导致 `App` 组件 re-render，那么在 `Count2` 没有包裹 `memo` 的前提下，`props` 是一定会变化的，因此 `Count2` 组件也被 re-render 了。

那为什么将 `Provider` 抽离成单独的组件后 `Count2` 组件就不会再 re-render 了呢？

我们可以看下 babel 编译后的代码：


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/db75bf3d76db4bd5b0b610cdf5dbe5d2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2828&h=648&s=215534&e=png&b=fefefe)

可以看到此时 `Count2` 组件的 `props` 并非由 `Wrapper` 产生，那么当 `Wrapper` re-render 时也就不会产生新的 `props`，那么此时就满足了 bailout 策略的全部要求了。

在本章我们从 3 个案例开始深入的探究了 bailout 策略以及 React 内部 `memo`、`useMemo`、`useCallback` 的实现机制。