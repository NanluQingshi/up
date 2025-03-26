由于 React19 发布并没有多久，因此连 Zustand、Jotai、Valtio 共同作者 Daishi 也没完全理解和考虑好未来要做什么，怎么去做，因此本文仅仅是尝试解析 React19 的各种特性以及可能对社区产生的影响。

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9d839f09795a441fb87e869c71b13aea~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1192&h=790&s=651979&e=png&b=f7f7f7" alt="image.png" width="80%" /></p>

本节先让我们一起来探究一下 React Compiler 吧。



## React Compiler

什么是 React Compiler？

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c8f42469e7c47078ab39e2c35b29a1f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1406&h=536&s=182419&e=png&b=1e1f26" alt="image.png" width="70%" /></p>

React Compiler 可以在应用构建时来完成代码的优化，从而提高性能，尤其是在 re-render 方面。因此你可以无需再编写恶心的 `useCallback`、`useMemo`、`memo` 逻辑！

那 React Compiler 在真实场景中的收益如何呢？


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/680e0c72d5e5465fa550226743794ca0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2304&h=1284&s=755344&e=png&b=202329)

在 [React Conf 2024](https://www.youtube.com/watch?v=T8TZQ6k4SLE) 中 [Joe Savona](https://github.com/josephsavona) 提到，React Compiler 从去年年初开始应用在 Meta 产品中。


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4859a7947f744d5780dc15bdc9a61d31~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2302&h=1296&s=800665&e=png&b=202329)

接下来 [Mofei Zhang](https://github.com/mofeiZ) 对 React Compiler 在 Meta 内部的收益进行了介绍，点击和滚动速度提升 2.5 倍、初始加载速度和跨页面导航时间优化 12%、对内存的使用和应用崩溃没有影响。在跨路由导航速度 Quest 提升了至少 4%，而 Instagram 平均提升了 3%。

当然，性能是一方面，另一方面是对于我们日常开发体验上的巨大提升。


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ccd6bb93103e4ea183e5ef99261e1429~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1394&h=742&s=164005&e=png&b=1e1f26" alt="image.png" width="70%" /></p>

在原先 React 应用中我们很难同时保持代码的易读性和应用的性能，当我们想要提升应用的性能时，我们需要引入 `useMemo`、`useCallback`、`memo` 来优化我们的代码，这无疑使我们的代码变得更难以理解。而 React Compiler 可以解决这个问题：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4eebaf47f3c40338327e3fa814f6256~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1350&h=710&s=184117&e=png&b=1e1f26" alt="image.png" width="70%" /></p>

使我们的代码同时获得很好的可读性和保证性能，甚至提高了应用性能的上限，借助 React Compiler 可以做比开发者更深度的优化！现在开发者可以移除大约 17% 的代码量！




### React Compiler 解决了什么问题？

其实严格意义上来说 React Compiler 并不属于 React19 的特性。因为 React Compiler 并不强制 React 版本，但 React 官方推荐升级到 19 版本，否则你需要做[额外的事情](https://github.com/reactwg/react-compiler/discussions/6)来进行兼容。React Compiler 目前已开源在 https://github.com/facebook/react/tree/main/compiler 。


当然 React Compiler 取得的收益取决于我们本身代码的质量以及优化程度。




我们日常在开发 React 的时候会使用到 `useCallback`、`useMemo`、`memo` 来优化应用的性能，但是我们真的需要这些吗？

无疑这些 Api 的学习和使用给我们带来了额外的心智负担，我们也经常可以看到不正确的使用场景，以 `useMemo` 为例，`useMemo` 可以帮助我们缓存昂贵的计算结果，我们经常可以在代码中看到胡乱使用 `useMemo` 的例子，比如：


```js
const c = useMemo(() => {
  return a + b
}, [a, b])
```

在这个例子中我们缓存了 `a + b` 的计算结果，只有当 `a` 和 `b` 的值实际发生变化时才会重新计算，但很显然在这种场景下我们是不需要包裹 `useMemo` 的，因为 `useMemo` 并非没有消耗，React 会依次对比 `deps`，也就是这里传入的 `[a, b]` 是否有变化，如果没有变化的话会复用上次的计算结果，同时 React 也需要把这些信息保存到 Fiber Node 上。

React 推荐 `useMemo` 的使用姿势是如果你不知道是否应该包裹 `useMemo`，你可以添加 `console` 去测量代码的执行时间，例如：


```js
console.time('filter array'); 
const visibleTodos = filterTodos(todos, tab); 
console.timeEnd('filter array');
```

如果时间大于等于 1ms 则代表添加 `useMemo` 来缓存计算结果是有意义的。


同时即使你已经非常小心了，也难免在应该包裹它们的地方遗漏。

React Compiler 会自动帮助我们做下面两件事情：

- 优化 re-render：React 会根据 `props`、`state`、`context` 是否变化来决定是否 re-render 当前组件，因此当父组件 re-render 时，如果子组件没有使用 `memo`、`useCallback`、`useMemo` 时，子组件一定会 re-render，因此合理的使用这些 Api 就显得极为重要。React Compiler 会解决这个问题，就像你使用这些 Api 一样，从而避免额外的 re-render。

- 缓存昂贵的计算结果：类似于原先对于昂贵的计算我们会使用 `useMemo` 进行包裹，Compiler 也会判断哪些函数是昂贵的，从而进行缓存，当然前提是该函数是在组件或者 hook 中被调用。




接下来让我们通过一个小的例子来演示 React Compiler 在这两个场景下的效果，案例代码见仓库：https://github.com/L-Qun/state-management-collection/tree/main/examples/react19/compiler

在不久前 5月23日 NextJS 发布了 15RC 版本，在 15 版本中支持了 React Compiler 能力，因此我们可以直接基于该版本进行体验，[当然你使用其它库也是可以的](https://react.dev/learn/react-compiler#installation)。首先我们需要安装 15RC 版本，我们可以借助 Next CLI 进行安装：


```js
npx create-next-app@rc
```

这样 Next 和 React 的版本都是最新版的了：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5dce57b19bc84520a9e48c2f0ed3400f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1104&h=1056&s=181072&e=png&b=ffffff" alt="image.png" width="50%" /></p>




```ts
"use client"

import { useState } from "react"

const Component = () => {
  console.log('re-render')
  return <div>Component</div>
}

export default function Home() {
  const [count, setCount] = useState(0)

  return (
    <>
      <span>count: {count} </span>
      <button onClick={() => setCount(count => count + 1)}>+1</button>
      <Component />
    </>
  )
}
```

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39a5847c0b6a475eb2edbe96299876ad~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=852&h=956&s=101753&e=gif&f=46&b=fdfcff" alt="20240601164025_rec_.gif" width="50%" /></p>

也就是说我们现在有一个父组件 `Home` 包含了一个子组件 `Component`，当我们点击按钮是更新 `count` 值，当我们没有给 `Component` 组件包 `memo` 时每当父组件 re-render 必然造成子组件 re-render。



然后我们看一下在开启 Compiler 后的变化，首先我们需要做一些其它工作：

- 安装 `babel-plugin-react-compiler`：


```js
npm install babel-plugin-react-compiler
```

- 在 next.config.js 配置文件中新增 `experimental.reactCompiler` 配置：


```js
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
};
 
module.exports = nextConfig;
```


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bd1bddf36004411e8e76292d1e1168fb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=820&h=740&s=77200&e=gif&f=42&b=fdfcff" alt="20240601164554_rec_.gif" width="50%" /></p>

此时再点击按钮可以发现子组件已经不会再 re-render 了！

然后我们来看一下 Compiler 的第二个能力，缓存昂贵的计算，首先我们需要构建一个函数来模拟繁重的 JS 逻辑：


```js
// 模拟繁重的 JS 逻辑
function simulateHeavyComputation() {
  console.log('simulateHeavyComputation')
  const start = performance.now();
  while (performance.now() - start < 2) {}
  return 'mock res'
}
```

在这里我们通过 `while (performance.now() - start < 2) {}` 在这里阻塞延迟了 2ms，同时我们需要在组件中调用这个函数，来分别看下开启配置前后的效果：

开启 `reactCompiler: true` 前：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/46e6b68cacb545408c465159745c6892~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=984&h=1028&s=112748&e=gif&f=39&b=f8fbee" alt="20240602005546_rec_.gif" width="50%" /></p>

开启 `reactCompiler: true` 后：

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c8fd881926041eb82bf3d3d1fe1c7d5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=916&h=872&s=82760&e=gif&f=40&b=f8fbed" alt="20240602005344_rec_.gif" width="50%" /></p>



同时如果我们打开 React DevTools(v5.0+)，我们可以看到包含了 “Memo ✨” 标识的组件代表它已经被 Compiler 优化过了：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/764b2bb6a04842e1ba05bc8eeb858f4d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=396&h=128&s=16596&e=png&b=ffffff" alt="image.png" width="40%" /></p>







## React Compiler 会对社区产生哪些影响



使用 React Compiler 要求你应用需要遵循 React 规则，这样 React Compiler 才能够正确的理解和编译你的代码，因此社区的库需要遵守 React 规则。例如 Daishi 在之前修复了 Valtio 的一个[问题](https://github.com/pmndrs/valtio/pull/810#issuecomment-2150626089)，从而让 Valtio 更好的支持 React Compiler：


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/49e46bf7f95f44df8d0e4357254a8097~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1884&h=1342&s=316913&e=png&b=ffffff)

我们在[手把手带你从 0～1 实现 mini-valtio](https://juejin.cn/book/7311970169411567626/section/7326398444003590182)一节中深入的讲解了 Valtio 的内部原理，当我们使用 `useSnapshot` 的时候会返回一个代理对象，从而监听在组件中使用了哪些状态，避免无关状态的变更导致组件 re-render，从而完成自动优化。这背后会将属性的使用情况保存到一个 `WeakMap` 中，这样就知道哪些属性被使用到了。


而在之前 Valtio 的实现中是这样的：


```js
export function useSnapshot(proxyObject) {
  // ...
  const currAffected = new WeakMap() // 每次 re-render 的时候都会创建一个新的 WeakMap
  // ...
}
```

因此就导致了这样一个问题：

如果你使用了 `useMemo(() => snap.a, [snap])`，当第一次 render 时，`useMemo` 传入的参数被执行了从而导致 `.a` 被追踪了，但是当第二次 render 时，由于缓存 `useMemo` 内部的函数没有被调用，从而没有被追踪，当状态发生变化时没有办法正确通知到组件完成 re-render。

这破坏了 React 什么规则呢？

我们可以看 Daishi Kato 和 Joe Savona（就是我们前面提到的 React Compiler 的作者之一） 的这段对话： 

> 来源：https://twitter.com/en_JS/status/1763634863507493214


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9b60b4df4d1d409483781c9d04a0bedd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1198&h=352&s=96140&e=png&b=ffffff" alt="image.png" width="70%" /></p>


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/481eec4814f14b4d8cbf19459a10c5e9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1184&h=158&s=51458&e=png&b=ffffff" alt="image.png" width="70%" /></p>

我粗浅的理解是 React Component 和 Hook 必须遵循幂等性原则，相同的输入（props、state、context 和 Hook 输入的参数）必须对应相同的输出，React Hook 返回的结果需要可以被用在 `useMemo`、`useCallback` 依赖项里面，而原先的 Valtio 违反了这个规则。


试想一下如果没有 React Compiler 我们可以刻意去避免编写类似的代码从而规避这类问题，那如果有了 React Compiler 同时帮助我们自动去 memorize，那是不是就产生了问题了！

因此在 React Compiler 的到来需要我们更加遵守 React Rules，对于开源库而言更应如此。


## 总结

本节我们深入研究了 React Compiler，并尝试解析了它的产生可能对社区产生什么样的影响，我相信此时此刻你们与我一样兴奋，期待它对 React 应用即将带来的巨大影响！

下一节让我们来继续分析 React19 的其它特性。
