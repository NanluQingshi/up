> 单纯讨论状态管理库选型时就好比我们争论哪个是最好的编程语言一样没有意义，我们需要结合团队现状、项目特点来进行选择，因此本文尽量从客观的角度进行分析，非常欢迎 👏 大家在评论区下面理性探讨。同时由于作者并没有深度使用全部状态管理库，因此有不对的地方欢迎指正。

本文以常见的 React 状态管理库为例来分析，当然你也可以借助本文的分析框架来套用其他的库，下面表格列举了在本篇中要分析的 React 状态管理库的基本信息，其中 Star 🌟 数量统计时间为 06/22。
 
 <div align="center">

| 库名 |  GitHub地址 | Stars 🌟 数量 | 推出时间 | 
| --- | --- | --- | --- |
| Redux | https://github.com/reduxjs/redux | 60.6k  | 2012 | 
| MobX | https://github.com/mobxjs/mobx | 27.3k  | 2016 | 
| Zustand | https://github.com/pmndrs/zustand | 44.1k  | 2017 | 
| XState | https://github.com/statelyai/xstate | 26.5k  | 2017 | 
| Recoil | https://github.com/facebookexperimental/Recoil | 19.5k  | 2020 | 
| Jotai | https://github.com/pmndrs/jotai | 17.7k  | 2021 | 
| Valtio | https://github.com/pmndrs/valtio | 8.6k  | 2021 | 

</div>

按照状态管理库的理念我们可以对上面的状态管理库进行分类：


**中心化模型：Redux**

中心化模型指整个应用的状态被存储到一个单一的、全局的 Store 中。这种模式下，所有的状态变更都通过这个中心进行管理和分发，确保状态的一致性和可预测性。

优点：

- 可预测性：因为所有状态的操作都通过中心化的 Store 来进行的，所以整个状态的变更会变的更加可预测性。
- 易于调试：中心化的状态使得调试和状态监控变得容易。

缺点：

- 性能问题：由于所有状态都集中到单一的 Store 中，因此任何状态的更新都会导致整个状态树的更新，因此容易触发额外的 re-render，即使不相关的状态发生变化。
- 额外的模板代码：需要编写较多的模板代码，在应用的开发和维护中都带来了额外的成本。
- 较高的学习成本：学习曲线比较陡峭，有大量的概念和中间件需要学习。


**Mutable（可变） 模型：MobX、Valtio**

Mutable 指的是创建对象之后任何状态更新都是基于对原先对象的基础之上进行的，典型的比如 MobX、Valtio 都是属于此类，比如：


```js
// Valtio
<button onClick={() => (state.deep.nested.obj.count += 1)}>+1</button>
```

优点：

- 提升开发效率：Mutable 方案可以使得更新状态更加容易，尤其是在多层嵌套对象的更新上。同时由于基于 Mutable 方案下的状态管理库内部会基于 Proxy 来实现，会监听组件对于状态的使用情况，从而在更新状态时正确触发对应的组件完成 re-render，因此这种方案下我们可以认为性能默认就是最优的，不需要手动来优化。
- 容易理解：相比于 Immutable 方案，更容易学习和理解。

缺点：

- 因为 Mutable 方案内部采用 Proxy，因此过于黑盒，状态的更新没有那么透明，遇到问题可能比较难以排查。


**Immutable（不可变） 模型：Redux、Zustand、XState、Recoil、Jotai**

Immutable 指的是对象一旦创建就不能被修改，需要基于这个对象生成新的对象而保证原始对象不变，比如 Zustand、Jotai、Redux 都属于这一类。比如：
 
 
```js
// Zustand
increment: () =>
  set((state) => ({
    deep: {
      ...state.deep,
      nested: {
        ...state.deep.nested,
        obj: {
          ...state.deep.nested.obj,
          count: state.deep.nested.obj.count + 1,
        },
      },
    },
  })),
```

优点：

- 可预测性：当状态发生变化时，这些变化是可以被追踪以及最终状态的更新结果是明确的。

缺点：

- 理解和开发成本：在更新状态时，尤其是多层嵌套的对象中会比较麻烦。不过我们可以结合 Immer 来解决这个问题。


**原子化模型：Jotai、Recoil**


优点：

- 精细的状态控制：原子化的设计模型维护各个原子状态以及原子之间的依赖交错关系，并通过原子之间的相互依赖关系阻止应用 re-render，提高性能。
- 方便组合和重用：各个原子可以相互组合和重用来共同构建整个应用的状态。

缺点：

- 额外的原子管理成本：由于状态被分散成了一个个切片的原子，因此如何拆分和维护较多的原子带来了额外的成本。

**状态机模型：XState**


优点：

- 清晰的状态逻辑：状态机提供了一种数学化的方法来描述状态和转换，使得复杂逻辑变得清晰。
- 可视化：状态机的状态和转换可以被可视化，有助于理解。

缺点：

- 较高的学习成本：状态机模型和其它状态管理库理念有比较大的差别，对于新接触的同学来说，理解需要一定的成本。
- 引入额外的设计复杂度：将应用的功能的状态逻辑适配到状态机模型中可能带来额外的设计复杂度，在应用逻辑的发展变化后对状态机的维护和更新也会带来一定的成本。


# 状态管理库的选择因素

2024 年了，我们在选择一个状态管理库时应该关注哪些因素？




<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/44dd0d916920462c8e9b455d392c5926~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1052&h=1372&s=143248&e=png&b=fafafa" alt="image.png" width="70%" /></p>


-   **受欢迎/流行程度**：一个更流行的库意味着它经过更多项目的验证，因此更为可靠。
-   **活跃程度**：一个活跃的库表示它正在持续更新和维护，能够及时修复 bug 并及时支持 React 新特性，迎合 React 发展。
-   **完善的使用文档**：一个清晰完善的文档非常重要，一个好的文档无论新手还是具有经验的开发者都能从中找到日常开发中所需的信息和解决方案。
-   **上手难度**：一个容易上手的状态管理库可以减少开发者学习成本，新同学加入后也能够快速上手进行开发，从而加速项目开发流程。
-   **是否支持 Class Components**：如果你在使用 Class Components 的话这意味着面向 Function Components 设计的状态管理库则无法使用。
-   **包体积**：如果一个库的体积较大，则会对应用的性能造成影响，增加应用的加载时间，同时也会增大带宽成本。
-   **中心化/去中心化状态管理**：随着 React 的发展，状态管理库的心智模型也随之演变，从中心化 Store 到去中心化方案。
-   即考虑你的应用是否需要一个大的中央存储（大Store）或是更倾向于分散和模块化的存储（分片Store）。
-   **Mutable/Immutable**：Mutable 和 Immutable 各有优劣。Immutable 可以让我们的函数在多次执行时，保持可预测性。Mutable 可以帮助我们更轻松的完成自动优化。
-   **优化方式**：根据优化方式可以大致分为自动优化和手动优化，手动优化意味着需要更高的开发者素质。
-   **DevTools支持**：一个好的 DevTools 支持非常重要，良好的 DevTools 支持可以显著提高开发效率。
-   **React新特性的支持程度**：随着React不断更新和引入新特性，需要确保状态管理库与这些新特性是否兼容。
-   **兼容性**：需要确保库与你的技术栈的兼容性，包括React版本、Proxy 浏览器兼容版本、SSR 兼容性等。
-   **SSR/RSC支持**：如果在项目中正在使用 SSR/RSC，则需要确保状态管理库是否很好的支持。
-   **解决 Tearing 问题/支持并发更新**：这两个本质上是一种 trade-off，如果你希望在应用中不出现 Tearing 问题，则选择 `useSyncExternalStore` 方案的状态管理库，比如 Zustand、React Redux，如果你想要并发更新，则可以考虑选择 Jotai。

接下来，让我们来根据这些因素逐个分析这些状态管理方案。






## 受欢迎/流行程度

可以从 npm 下载次数、stars 上升数量来评价状态管理库的受欢迎程度。

### npm下载次数

当我们在项目中运行 `npm install` 时会从 npm registry 下载对应的库，因此可以通过npm下载次数大概来衡量有多少项目使用了该库。

> 链接：https://npm-compare.com/react-redux,zustand,xstate,mobx,jotai,recoil,valtio



![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/225b47c492164877b2ac2848a5ceec2c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2436&h=1176&s=230434&e=png&b=fefefe)

可以看到 react-redux 仍是遥遥领先，其次就是 Zustand。

### Stars 上升数量

固然 npm 下载次数可以衡量项目的使用数量，但因为 react-redux 早早就推出了，因此存在大量的老项目仍然在使用 react-redux，因此用它来衡量项目的受欢迎程度并不太合适。

我们有一个更好的指标，即 Stars 上升数量。我们可以看 2023 年过去一年状态管理库 stars 的上升数量：[risingstars.js.org/2023/en#sec…](https://link.juejin.cn/?target=https%3A%2F%2Frisingstars.js.org%2F2023%2Fen%23section-statemanagement "https://risingstars.js.org/2023/en#section-statemanagement")

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/927d862241914d209561de9c553970ea~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1498\&h=1572\&s=93572\&e=webp\&b=f1f1ee" width="70%" alt="image.png"  /></p>



因此可以看到，虽然 redux 作为老牌的状态管理库仍被用在大量项目中，但他的 Stars 上升排名仅仅只能排到第十位，而且其由于较高的上手难度以及较为繁琐的配置和模板代码，被很多人所诟病。

## 更新的频繁程度

想象一下这种场景：你正在使用某个库开发功能，忽然碰到了一个棘手的 bug。急切间，你跑到 GitHub，发起了一个 issue，心怀希望地等待解答。日复一日，页面上的回复栏却依旧空荡荡，没有一个回音。

因此不难理解，一个频繁迭代的库意味着频繁的功能迭代，社区更加活跃，开发者不断的更新新的功能和改进现有的功能。以及社区在积极的响应各种 issue，及时修复漏洞和缺陷。

我们以这个维度来看一下上面几个库的迭代频繁程度：







| 库                                                                                                                                                                                              | 贡献量                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [react-redux](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Freduxjs%2Freact-redux%2Fgraphs%2Fcontributors "https://github.com/reduxjs/react-redux/graphs/contributors")            | ![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c299f99eba7b498f8f8f1defae7b05ac~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1814&h=482&s=62919&e=png&b=f5f7f9) |
| [Zustand](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fpmndrs%2Fzustand%2Fgraphs%2Fcontributors "https://github.com/pmndrs/zustand/graphs/contributors")                          | ![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/76f27a9880b4408e8fca7f70b2b5a151~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1818&h=492&s=59567&e=png&b=f6f8fa) |
| [Jotai](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fpmndrs%2Fjotai%2Fgraphs%2Fcontributors "https://github.com/pmndrs/jotai/graphs/contributors")                                | ![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4767e617dd79460f88e8cff26784a522~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1800&h=482&s=73161&e=png&b=f5f7f9) |
| [recoil](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Ffacebookexperimental%2FRecoil%2Fgraphs%2Fcontributors "https://github.com/facebookexperimental/Recoil/graphs/contributors") | ![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8e23c690d711495b93d7ffb3fbdcc3f6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1804&h=486&s=66496&e=png&b=f5f7f9) |
| [Valtio](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fpmndrs%2Fvaltio%2Fgraphs%2Fcontributors "https://github.com/pmndrs/valtio/graphs/contributors")                             | ![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b4e5ccb0a74c44acbae6bd4fe236f222~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1806&h=488&s=57781&e=png&b=f6f8fa) |
| [Mobx](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fmobxjs%2Fmobx%2Fgraphs%2Fcontributors "https://github.com/mobxjs/mobx/graphs/contributors")                                   | ![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1763f27db04545afa9117f77e327ff99~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1808&h=490&s=63008&e=png&b=f6f8fa) |
| [XState](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fstatelyai%2Fxstate%2Fgraphs%2Fcontributors "https://github.com/statelyai/xstate/graphs/contributors")                       | ![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0be637f387c54a27a44dae4918b9fda8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1802&h=492&s=82921&e=png&b=f5f7f9) |







可以看到上面中除了 Recoil，都在稳定的迭代着。因为 Recoil 的成员都被 Facebook 裁了。。。


## 完善的使用文档

一个清晰完善的文档非常重要，因为它不仅可以帮助开发者快速上手和理解库的核心概念、API 使用方法和最佳实践，还可以有效减少在集成和应用开发过程中遇到的问题。优秀的文档应包含丰富的示例代码、场景说明、常见问题解答和性能优化建议，使得无论是新手还是有经验的开发者都能够在不同阶段的项目开发中找到所需的信息和解决方案，从而提高开发效率和质量。


## 上手难度

上手难度是一个难以量化的指标，对于每个人来说可能都不相同。但是我们可以确定的是，整个状态管理库发展的趋势是朝着更容易上手、更加简单、心智负担更小、更符合直觉的方向去发展的。一个更容易上手的方案也意味着新人上手项目的成本更低，跨团队协作更加容易。

## 是否支持 Class Components

虽然 Class Components 已经过时了，但仍然有大量的项目在使用这种模式进行开发，所以当你的项目使用 Class Components 时是否状态管理库原生支持十分重要。为什么说原生支持呢？

因为大部分状态管理库都包含了 vanilla（纯 JavaScript 实现，不包含任何框架比如 React Vue 等），所以理论上其实所有状态管理库都可以结合 Class Components 进行开发，但是需要手动使用 vanilla + Class Components `setState` 进行使用，或者在 Class Components 外层包裹 Function Component，这无疑非常影响开发体验。

原生支持 Class Components 的状态管理库包含：Redux、Mobx。


## 包体积

最终库被打包进应用的大小会直接影响应用的性能，更大的包体积意味着更久的下载时间尤其是在网络较差的环境下、更久的浏览器解析和执行时间。从而带来更久的首屏时间和更久的交互时延。同时也意味着带来更高的带宽成本。


## 单一/多个/原子化状态管理

大Store是指在整个应用中只维护一个全局的状态对象。模块化Store是指将应用的状态分割成多个小块或模块，每个模块管理自己的状态。

在 react-redux 中采用的方案就是大 Store，整个应用的状态被存储在一个单一的、大型的对象中。虽然所有状态都存储在一个地方，可以更容易追踪状态的变化和维护状态的一致性，但这种方案有着诸多问题，例如：

*   **性能问题**：随着应用规模的增长，整个应用的状态都保存在一个大的对象中，可能导致性能问题。每当状态更新时，即使是小的更改，也可能导致整个应用或大部分应用重新渲染。
*   **学习曲线**：对于新手开发者来说，理解和管理一个庞大的状态树可能相对困难，增加了学习曲线。
*   **过度的模板代码**：管理大Store可能需要编写大量的样板代码，如actions、reducers等。
*   **难以迁移和重构**：随着项目的发展，对大Store的结构进行迁移或重构可能非常困难和耗时。

而现在，整个社区从大 Store 全局统一状态朝着模块化、分片化 Store 在发展。

## Mutable / Immutable

- **Mutable（可变）**：指的是创建对象之后任何状态更新都是基于对原先对象的基础之上进行的，典型的比如 MobX、Valtio 都是属于此类，例如：


```js
// Valtio
import { proxy, useSnapshot } from 'valtio';

const state = proxy({
  count: 0,
});

export default function App() {
  const snapshot = useSnapshot(state);

  return (
    <div>
      <div>{snapshot.count}</div>
      <button onClick={() => (state.count += 1)}>+1</button>
    </div>
  );
}
```

在这个例子中我们可以看到，在点击按钮后会直接在原始状态上进行修改来完成状态的更新，即 `state.count += 1`。


- **Immutable（不可变）**：指的是对象一旦创建就不能被修改，需要基于这个对象生成新的对象而保证原始对象不变。



```js
// Zustand
import { create } from "zustand";

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

export default function App() {
  const { count, increment } = useStore();

  return (
    <div>
      <div>{count}</div>
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

在这个例子中我们可以看到，对于 Immutable 模型的状态管理库而言，不能直接在原先的对象上修改，而是需要生成一个新的对象，包含了修改后的 `count` 值。



对上述九个状态管理库分类如下：

<div align="center">

| 状态管理库          | Mutable | Immutable |
| -------------- | ------- | --------- |
| react-redux    |         | ✅         |
| Zustand        |         | ✅         |
| Jotai          |         | ✅         |
| recoil         |         | ✅         |
| Valtio         | ✅       |           |
| Mobx           | ✅       |           |
| XState         |         | ✅         |
| Tanstack Query |         | ✅         |
| SWR            |         | ✅         |
    
</div>

我们对 Mutable 和 Immutable 做一个总结：

对于复杂的多层嵌套的数据结构来说，Immutable 方式处理起来非常麻烦，并且容易出错，而 Mutable 方式则更加的自然、清晰和符合直觉。除此之外，基于 Mutable 方案下的状态管理库内部基于 Proxy 来实现，会监听组件对于状态的使用情况，从而在更新状态时正确触发对应的组件完成 re-render，因此这种方案下我们可以认为性能默认就是最优的，不需要手动来优化。

但是 Immutable 可以保证可预测性，而 Mutable 则难以保证这一点。可预测性指的是当状态发生变化时，这些变化是可以被追踪以及最终状态的更新结果是明确的。而 Mutable 方式则会直接修改原始的数组，当应用中不同的地方以不可预期的方式修改了这个状态，尤其是在复杂的应用中，最终这个状态可能会难以追踪，在遇到 Bug 时也难以排查。

## 优化方式

根据优化方式可以分为三类：基于 selector、基于原子化模型、基于 Proxy 的自动优化。我们不能说那种方案是更好的，而是需要根据不同团队情况、产品情况来正确选择合适的方案，接下来我们分别介绍一下：

### 基于 selector（React Redux、Zustand、XState）

在组件使用状态时需要开发者手动进行性能优化，举个例子：

```jsx
const usePersonStore = create((set) => ({
  firstName: '',
  lastName: '',
  updateFirstName: (firstName) => set(() => ({ firstName: firstName })),
  updateLastName: (lastName) => set(() => ({ lastName: lastName })),
}))

function App() {
  const { firstName } = usePersonStore()
  return <div>firstName: {firstName}</div>
}
```

在上面的例子中我们首先创建了一个 `usePersonStore`，包含了 `firstName`、`lastName` 与操作他们的方法。然后在 `App` 组件中我们使用到了`firstName`。

这种写法会有什么问题吗？

答案是肯定的，这里我们通过解构的方式拿到了 `firstName` 的值，Zustand 是不知道组件真正用到了什么状态的，所以当 `lastName` 也会导致 `App` 重新渲染。那最佳实践应该是：

```jsx
function App() {
  const firstName = usePersonStore(state => state.firstName)
  return <div>firstName: {firstName}</div>
}
```

可以看到稍不留意可能就会带来性能的问题（虽说这种问题可能可以忽略不计），当然凡事也有双面性，手动优化的方案可以做极其细致的优化配置，而显然也会对开发者的素质有着更高的要求。

### 基于原子之间交错组合（Jotai）



基于原子化模型的状态管理库中每个原子维护自己的小的状态片段，并通过原子之间的相互依赖关系阻止应用 re-render，提高性能。这类状态管理库不需要我们传入 selector。


```js
const firstNameAtom = atom('')

const lastNameAtom = atom('')

const fullNameAtom = atom(get => {
  const firstName = get(firstNameAtom)
  const lastName = get(lastNameAtom)
  return firstName + lastName
})

function App() {
  const firstName = useAtomValue(firstNameAtom)
  return <div>firstName: {firstName}</div>
}
```

这里我们创建了 `firstNameAtom`、`lastNameAtom`，并创建了 `fullNameAtom` 用来组合 `firstNameAtom` 与 `lastNameAtom`。

在 `App` 组件中我们只使用到了 `firstNameAtom`，那么由于我们并没有用到 `lastNameAtom` 状态，也没有用到 `fullNameAtom` ，当 `lastNameAtom` 状态发生变化是不会导致 `App` 组件重新渲染的。那么我们稍微改一下 `App` 组件：


```jsx
function App() {
  const fullName = useAtomValue(fullNameAtom)
  return <div>fullName: {fullName}</div>
}
```

这时候如果 `lastNameAtom` 状态发生变化则会导致 `App` 组件重新渲染。

### 基于 Proxy 自动优化（Mobx、Valtio）

以 Valtio、Mobx 为首的基于 Mutable 的状态管理库：这类状态管理库内部采用 Proxy 来实现，会自动监听组件使用了哪些状态，只有这些状态变化才会触发组件 re-render。





## DevTools支持

一个设计良好的 DevTools 可以更好的提高开发者的效率，一个好的 Devtools 工具需要包含状态监视、状态时间旅行（Time Travel）。状态时间旅行指开发者可以在应用的不同状态之间来回“旅行”，即回溯和重新应用之前的状态。这个功能主要在开发过程中用于调试和理解应用状态的变化。

DevTools 按照实现可以分为三类：

- **Extension DevTools**：例如 [Redux DevTools](https://chromewebstore.google.com/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd?utm_source=ext_app_menu) 等，这类工具作为浏览器扩展而存在，需要在开发 DevTools 功能之外额外开发浏览器扩展插件。
- **Hooks DevTools**：例如 [Jotai DevTools](https://jotai.org/docs/tools/devtools)、[Recoil DevTools](https://recoiljs.org/docs/guides/dev-tools) 等，这类工具基于 Hooks 实现的，用来获取快照、进行时间旅行、将状态集成到 React DevTools 等功能，方便在代码中直接进行调试。
- **UI DevTools**：例如 [Jotai DevTools](https://jotai.org/docs/tools/devtools)等，这类工具基于组件实现并最终展示在页面中，这种通常会置于页面底端占用一定的空间，点击可以展开，需要实现一个较为美观的组件界面，以及区分开发环境和生产环境，在生产环境需要确保被 Tree Shaking，避免将 DevTool 带入线上。


不同状态管理库按照 DevTools 实现方式分类如下：


<div align="center">


|                                                                                                                                                                                                                                                                     | 基于 Chorme Extension | 在页面中展示 | 基于 hooks |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----- | -------- |
| [react-redux](https://link.juejin.cn/?target=https%3A%2F%2Fchromewebstore.google.com%2Fdetail%2Fredux-devtools%2Flmhkpmbekcpmknklioeibfkpmmfibljd%3Fhl%3Dzh-CN "https://chromewebstore.google.com/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd?hl=zh-CN") | ✅                |       |          |
| [Zustand](https://link.juejin.cn/?target=https%3A%2F%2Fdocs.pmnd.rs%2Fzustand%2Fmigrations%2Fmigrating-to-v4%23combine%2C-devtools%2C-subscribewithselector "https://docs.pmnd.rs/zustand/migrations/migrating-to-v4#combine,-devtools,-subscribewithselector")     | ✅                |       |          |
| [Jotai](https://link.juejin.cn/?target=https%3A%2F%2Fjotai.org%2Fdocs%2Ftools%2Fdevtools "https://jotai.org/docs/tools/devtools")                                                                                                                                   |                  | ✅     | ✅        |
| [recoil](https://link.juejin.cn/?target=https%3A%2F%2Frecoiljs.org%2Fdocs%2Fguides%2Fdev-tools "https://recoiljs.org/docs/guides/dev-tools")                                                                                                                        |                  |       | ✅        |
| [Valtio](https://link.juejin.cn/?target=https%3A%2F%2Fvaltio.pmnd.rs%2Fdocs%2Fapi%2Futils%2Fdevtools "https://valtio.pmnd.rs/docs/api/utils/devtools")                                                                                                              | ✅                |       |          |
| [Mobx](https://link.juejin.cn/?target=https%3A%2F%2Fchromewebstore.google.com%2Fdetail%2Fmobx-developer-tools%2Fpfgnfdagidkfgccljigdamigbcnndkod "https://chromewebstore.google.com/detail/mobx-developer-tools/pfgnfdagidkfgccljigdamigbcnndkod")                  | ✅                |       |          |
| [XState](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Famitnovick%2Fxstate-devtools%3Ftab%3Dreadme-ov-file "https://github.com/amitnovick/xstate-devtools?tab=readme-ov-file")                                                                          |                  | ✅     |          

</div>
    
    当然这里仅统计了官方的实现方案，当然也有很多社区的实现版本。评判 Chorme 插件的好用程度可以通过评分和安装量来衡量。

## React新特性的支持程度

例如 React 在升级 18 之后引入了并发更新机制，同时也给状态管理库带来了 Tearing 的问题，因此像 React Redux 在 8 版本引入了 useSyncExternalStore 来解决这个问题。

再举个例子，React `use` hooks 是 React官方提出的新的 hooks，可以方便的配合 Suspense 来进行使用，很多状态管理库都已经内置了 `use`，从而能够更轻松的管理异步的状态。

随着 React19 的到来，给整个社区生态带来了巨大的挑战以及机遇，虽然目前状态管理库是兼容 19 版本的，但是状态管理库生态其实还没有结合任何 19 新的能力。事实上连 Daishi Kato 也没完全理解和考虑好未来要做什么，怎么去做。


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c32b1a66d73942809a9913a79fde0a2c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1164&h=790&s=650051&e=png&b=080808" alt="image.png" width="70%" /></p>

不过可以确信的是 React19 的到来给我们带来了更多的机遇，我们可以有更多机会参与到社区的开源贡献中去，一起为 React 生态添砖加瓦！


## 兼容性

需要确保库与你的技术栈的兼容性，例如使用 Mobx、Valtio 等基于 Proxy 实现的状态管理库，则需要考虑 Proxy 的兼容性，Proxy 在 Chrome 49 版本以下、Edge12 以下、Firefox18 以下不支持。如果你的应用需要支持这些浏览器，则无法使用这些库。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a4f7db527a014f459a1d1c7a9e1b8452~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1564\&h=842\&s=43268\&e=webp\&b=fdfdfd)

除此之外你也需要考虑与 React 版本之间的兼容性，通常你可以看状态管理库 package.json 中的 `peerDependencies` 字段，其给出了需要满足的宿主环境，例如：

```json
"peerDependencies": {
  "react": ">=17.0.0"
}
```

表示当前包需要 React 库作为其宿主环境，并且兼容的 React 版本应该是 17.0.0 或更高，如果你的项目使用的是16版本则不能使用。

SSR 兼容性：同样的，我们也需要关注该库是否支持 SSR，即是否提供了一种方式来在 Hydration 阶段填充数据。


## SSR/RSC 支持

当状态管理库结合 SSR/RSC 时面临的最主要的两个问题是：

- 每个请求都需要对应一个 Store
- 状态需要传递给前端，并在前端填入到 Store 中

而其中我们说 Zustand/Valtio 是 React “外部” 状态管理库，也就是说这些状态不基于 React Context 来分发 Store。所以当你的项目使用 SSR/RSC，可能需要谨慎考虑使用 Zustand/Valtio。


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4a2670c63e1a402a9bb88863451335e4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1840&h=630&s=173828&e=png&b=ffffff)

这一点 Dai Shi 也意识到了，所以他发明了 Jotai。


# 总结

## 所以说状态管理库的未来应该是什么样的？

*   非单一的状态存储模型：可以看到随着社区的发展，已经从传统的单一状态存储库（如 Redux）演变为了非单一状态存储库（如 Zustand、Jotai）。单一状态存储模型不仅很容易造成性能问题，减少灵活性，也会带来额外的学习曲线、开发的复杂度、以及非常多的模板代码。
*   心智简单：更易用，更容易上手，简洁直观的 Api，意味着没有那么多的概念，同时更符合直觉。
*   丰富的生态：即强大的社区支持和生态系统，这包括在开发工具如 DevTools 中集成更多功能，提供丰富的辅助工具和插件，以及完善的文档和教程，这样无论在日常开发中遇到任何需求都能够有对应的解决方案和工具支持，帮助开发者更高效地处理日常开发工作。
*   对 React 支持更好：对 React 的最新特性，如并发模式、`Suspense`、`use` 等提供原生支持，使得开发者能够更轻松的使用 React 新特性来应对日常开发工作。
*   更自动化的性能优化策略：从 React 的发展来看其实我们就可以发现性能优化应该由框架来解决而不是开发者，在我们日常开发中需要手动使用诸如 `memo`、`useCallback`、`useMemo` 等等 Api 来手动进行性能优化，而这些 Api 其实很大程度上带来了开发者的心智负担，降低了开发效率。而在 React 官网 [Compiler](https://react.dev/blog/2024/02/15/react-labs-what-we-have-been-working-on-february-2024) 一节我们知道 React 一直在致力于解决这个问题。当然对于状态管理库的发展也是一样，朝着更自动化的方向发展，以 Jotai 为例采用了原子化模型，优化通过原子之间的依赖自动完成了优化。Zustand 也是如此，在原先你需要手动传入 selector 来从 Store 中选取你关心的状态，并且传入 `shallow` 来优化性能，这样有一个问题其实很多开发者容易遗漏传入 selector，以及不知道何时传入 `shallow`。而现在[官网](https://docs.pmnd.rs/zustand/guides/auto-generating-selectors)则建议更符合直觉的方式，即 `createSelectors` 与 `useShallow`。因此我们可以看到整个社区的发展是朝着更自动化性能优化策略来发展的，将复杂的、繁琐的优化由底层框架来完成。


## 在我们实际开发中应该如何进行技术选型？

其实笔者发现很多团队在技术选型的时候往往会出现两种情况：

1. 主导技术选型的同学没有经过充分的调研而直接选择自己熟悉的技术方案。所以我们会发现，即使 Redux 如此难用不符合未来，无数人吐槽的情况仍然有源源不断的新项目采用。不同的项目情况、团队情况应该有不同的选择，而不是拍脑袋直接选择一个自己熟悉的。
2. 喜欢选择一些小众的库，甚至是自创一个。其实这样非常不好，选择小众的库代表这个技术方案没有充分经过大量的项目验证，以及缺少社区的关注与支持。遇到问题也难以在 issue 中找到答案。而自创则更不推荐，首先自创需要花费大量的精力，并且在项目的运行过程中一定会遇到很多问题甚至带来损失，某一天这位同学从公司离开了可能意味着这个自创方案不再有人维护，可能又需要花费精力去重新进行架构设计。

根据前面的分析，其实我们首先可以很容易的排除一些方案，即：


*   上手难度大，概念多，难以使用
*   没有文档或者文档内容较少，缺少丰富的事例代码
*   缺乏 DevTools 的支持
*   更新频次低，几乎不维护
*   对 React 新特性的支持较差

因此我们可以根据这个规则来对上述我们分析的库去做排除法，这里可以排除掉 Recoil。

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e9d7ffb192d94f0b8f80dbc9809ed58d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1542&h=1472&s=148154&e=png&b=ffffff" alt="image.png" width="70%" /></p>


原因：

- 项目长时间不维护了，截止至 6 月份该库已经 9 个月没有贡献记录：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c5d385ee88634d2ba8cd316f3946fe5b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1830&h=698&s=105617&e=png&b=f5f7f9)

- 性能问题：参考该 Issue：https://github.com/pmndrs/jotai/discussions/1484 。在这个 Issue 中 Daishi 演示了了一个简单的 Benchmark，对比了 React Context、Recoil、Jotai 读取状态的性能，结果如下：


```js
recoil: 92.89111328125 ms
context: 0.89990234375 ms
jotai: 12.327880859375 ms
jotai: 10.9609375 ms
```

在该 Benchmark 中可以看到 Jotai 拥有比 Recoil 更好的性能。这个项目是由 Facebook 发明的，但是维护 Recoil 的成员**都被解雇（lay off）了**。。



![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/656a69192b0f42e4981ea0f98b9c724a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1796&h=258&s=66797&e=png&b=f5f7f9)

这也意味着这个项目彻底流产了。所以毫无疑问的是当我们选择状态管理库时不应该再考虑 Recoil 了。其它方案则各有优劣，其实无论 Mutable 还是 Immutable，亦或者大 store、原子化状态管理在笔者看来都没有对错，这取决于大家的团队情况、项目情况。


接下来让我们对每个因素逐个进行分析：


- 项目中是否使用 Class Components，如果你的项目正在使用 Class Components 写法，这意味着拥有对 Class Components 原生支持的状态管理库可以带来更好的开发体验。

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/30e86a2b733a4e2493cf52f5e61b3e43~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1310&h=1232&s=84139&e=png&b=ffffff" alt="image.png" width="50%" /></p>


*   兼容性：是否需要兼容低版本浏览器，如果需要则不能使用 Proxy 方案的状态管理库例如 Valtio。团队使用的 React 版本是否兼容该状态管理库。团队是否使用 SSR 方案以及对应状态管理库是否支持 SSR 等。



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b6eddc8e2aa14550820c92bdb2e46aa7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1414&h=1184&s=85885&e=png&b=ffffff" alt="image.png" width="55%" /></p>


*   团队大小：
    *   对于大团队，需要一个统一的规范，来保证大家遵循相同的原则编写代码。因此不建议用原子化的库，因为原子化过于灵活，最终会导致写出无数 atom，且不利于维护。
    *   而对于小团队或者个人项目，则更注重灵活性和更快的开发速度，因此对于小团队来说需要选择更为灵活、学习曲线低上手更快的库。因此会比较推荐原子化的库，因为可以非常灵活高效的编写代码，同时避免需要写很多模板代码降低团队的效率。当然像 Zustand、Vatio 这种非常灵活和简洁的状态管理库也非常适合小团队。
*   项目大小：对于大项目来说，其实和上面类似，不建议使用原子化的库。同时也不建议使用基于Proxy/Mutable 的状态管理方案，如 Valtio。虽然这种方案以更直观和灵活的方式来更新应用状态，降低学习成本和提高开发效率的同时保证了应用的性能，但这种方案过于黑盒，有时可能不容易跟踪特定变更的来源。这可能会使得调试变得更加困难，尤其是对于大型的项目来说。



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e3acaca054a44fafafe0eee39dbaf70f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1346&h=1188&s=95440&e=png&b=ffffff" alt="image.png" width="50%" /></p>


*   开发人员素质：如果团队整体素质普通，那则更加推荐 Zustand、Valtio、Jotai 这类更简洁符合直觉的状态管理库，上手成本低，像 Valtio、Jotai 这种自动化的优化方案以及在 Zustand 中借助 `createSelectors` 与 `useShallow` 可以轻松的保证应用性能。



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5795ec2f8d224e1c8958531008fd5102~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1350&h=1200&s=89642&e=png&b=ffffff" alt="image.png" width="50%" /></p>

*   是否项目需要处理复杂的状态逻辑和状态转化：如果有，则比较推荐XState，因为 XState 通过状态机的概念高度结构化和可预测的方式来管理状态，极大地增强了代码的可读性和可维护性，XState 的可视化工具可以帮助团队更好地理解和沟通整个应用的状态逻辑



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1446d49fe4e340e791ed8dac3280a0bf~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1356&h=1200&s=95297&e=png&b=ffffff" alt="image.png" width="55%" /></p>

*   最后才是根据团队现状，比如内部同学的偏好、更熟悉的方案来进行选择。








