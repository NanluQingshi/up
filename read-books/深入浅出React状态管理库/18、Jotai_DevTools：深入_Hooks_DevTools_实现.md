目前 DevTools 可以大致分为三类，即：

- **Extension DevTools**：例如 [Redux DevTools](https://chromewebstore.google.com/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd?utm_source=ext_app_menu) 等，这类工具作为浏览器扩展而存在，可以在[应用商店](https://chromewebstore.google.com/)里下载和安装。
- **Hooks DevTools**：例如 [Jotai DevTools](https://jotai.org/docs/tools/devtools)、[Recoil DevTools](https://recoiljs.org/docs/guides/dev-tools) 等，这类工具基于 Hooks 实现的，方便在代码中直接进行调试。
- **UI DevTools**：例如 [Jotai DevTools](https://jotai.org/docs/tools/devtools)、[Tanstack Query DevTools](https://tanstack.com/query/latest/docs/framework/react/devtools) 等，这类工具基于组件实现并最终展示在页面中，方便开发者在页面中直接进行调试。

本小册会对以上三种方案全部实现，对于 Jotai 来说既提供了组件形式的调试方案，也提供了 Hooks 方便我们在代码中引入进行调试，在本节中我们重点实现 Hooks 方案，并讲解如何与 React DevTools 联动来使用。




## Jotai DevTools 介绍

[Jotai DevTools](https://github.com/jotaijs/jotai-devtools) 提供了两种方式来帮助开发者更好地进行调试，一种是 UI DevTools，另一种是 Hooks 形式。


### UI DevTools

安装：


```js
npm i jotai-devtools @emotion/react
```

可以看到，除了 jotai-devtools 以外，我们还需要安装 @emotion/react，因为包含了 UI 的部分，而这部分 jotai-devtools 样式是基于 [emotion](https://emotion.sh/docs/@emotion/react) 来实现的。

Jotai DevTools 使用起来非常简单，该库暴露出 `<DevTools />` 组件，只需要将其集成到页面组件中即可，例如：


```jsx
import { DevTools } from 'jotai-devtools'


const App = () => {
  return (
    <>
      <DevTools />
      {/* your app */}
    </>
  )
}
```

我们以官方[例子](https://codesandbox.io/p/sandbox/peaceful-euclid-k5p12d?file=%2Fsrc%2FApp.tsx&from-embed=)为例来看一下 Jotai UI DevTools 都包含了什么功能：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/29720d5eda714e779b118318c71799e5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1190&h=746&s=97133&e=png&b=ffffff" alt="image.png" width="90%" /></p>

首先我们可以在页面左下角看到一个按钮，点击可以展开调试面板。主要包含了两个功能，分别对应两个 Tab 按钮：

1. **Atom Viewer**：可以搜索 atom 并查看它的状态，以及与其他 atom 的依赖关系。
2. **Time travel**：可以进行时间旅行，通过这个功能可以观察状态随时间的变化，并且非常方便地“旅行”到应用程序状态的任何时间点。



<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abdc1f2cb41e482991a26a029ac63cb7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1200&h=1056&s=431571&e=gif&f=206&b=fdfcff" alt="20240317203151_rec_.gif" width="80%" /></p>




### Hooks DevTools

另一种是 Hooks DevTools，类似于 Recoil，Jotai 也暴露出很多 Hooks 用来在 React 应用中进行调试，这里介绍几个常用的。

**`useAtomsDebugValue`**

`useAtomsDebugValue` 可以在 React Devtools 中显示所有 atoms 的状态，避免需要去具体组件中查看，例如：

```jsx
import { useAtomsDebugValue } from 'jotai-devtools';

const textAtom = atom("hello");
textAtom.debugLabel = "textAtom";

const lenAtom = atom((get) => get(textAtom).length);
lenAtom.debugLabel = "lenAtom";

const TextBox = () => {
  const [text, setText] = useAtom(textAtom);
  const [len] = useAtom(lenAtom);
  return (
    <span>
      <input value={text} onChange={(e) => setText(e.target.value)} />({len})
    </span>
  );
};

const DebugAtoms = () => {
  useAtomsDebugValue();
  return null;
};

const App = () => (
  <Provider>
    <DebugAtoms />
    <TextBox />
  </Provider>
);

export default App;
```

之后就可以在 React Devtools 面板中看到所有 atoms 的状态：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1e66352c37374942a443ded4d203f290~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=891&h=471&s=49104&e=png&b=ffffff" alt="" width="100%" /></p>



**`useAtomsSnapshot`**

`useAtomsSnapshot` 用于获取 Jotai 原子的当前快照。这个快照表示在组件渲染时**所有原子**的当前状态，方便查看和监视多个原子随时间的状态变化，例如：

```jsx
import { useAtomsSnapshot } from 'jotai-devtools';

const App = () => {
  const snapshot = useAtomsSnapshot();
  useEffect(() => {
    // 当 useEffect 依赖项发生变化时打印包含 debugLabel 属性的 atom value
    console.log(
      Array.from(snapshot.values).reduce((prev, [{ debugLabel }, atomValue]) => {
        debugLabel && (prev[debugLabel] = atomValue);
        return prev;
      }, {}),
    );
  }, [deps]);
  return <div>jotai</div>
}
```

`useAtomsSnapshot` 返回的类型是：

```ts
type AtomsSnapshot = Readonly<{
  values: AtomsValues;
  dependents: AtomsDependents;
}>;
```

其中 `values` 包含了所有 atoms 及其当前值映射的集合，`dependents` 包含了原子之间的依赖关系的映射。

注意：这里会订阅所有 atom 的状态，只要有状态发生变化都会触发当前调用 `useAtomsSnapshot` 的组件发生 re-render。



**`useGotoAtomsSnapshot`**

`useGotoAtomsSnapshot` 用于实现 Jotai atom 状态的时间旅行能力，通常结合 `useAtomsSnapshot` 一起使用，接收 Jotai 状态快照，并将应用的状态跳转到该快照所对应的状态。

```jsx
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools';

const App = () => {
  const snapshot = useAtomsSnapshot();
  const gotoSnapshot = useGotoAtomsSnapshot();

  const handleRestore = () => {
    gotoSnapshot(snapshot);
  };

  return <button onClick={handleRestore}>Restore State</button>;
}
```



## React Devtools

首先，我们安装一下 React Devtools 工具，Chrome 右上角三个点 -> 扩展程序 -> 访问 Chrome 应用商店，然后搜索 React Developer Tools 即可：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57f2d12e737e45f5b8ce24d48ab9ac5d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2284&h=1222&s=327756&e=png&b=fdfdfd" alt="image.png"  /></p>

然后我们点击“添加至 Chrome”，点击右上角扩展程序就可以看到我们刚才安装的插件了，点击将其固定到页面中。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8cb13ffa164c4affbb9767ec68bf6b20~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=700&h=398&s=72916&e=png&b=fefefe" alt="image.png" width="50%" /></p>

这时候 React Developer Tools 图标就会出现在扩展程序旁边，根据网页不同情况图标展示不同的形态：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4df17ea7cfd8427180440a0c36a9304b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1468&h=340&s=252289&e=png&b=005d60" alt="image.png" width="70%"  /></p>

从左至右图标分别代表着：

- 使用 React 的生产版本（production build）；
- 使用 React 过期版本； 
- 网站中没有使用 React；
- 开发环境（development environment）。

鼠标右键点击检查，可以看到增加了两个 Tab，分别是⚛️ Components和⚛️ Profiler：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/69aae285ed78487a9b0061b5aa181bf4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1490&h=1240&s=336350&e=png&b=fefdfd" alt="image.png"  /></p>


我们分别介绍二者的功能，演示的代码见仓库中 `/examples/zustand/todos`。




### ⚛️ Components


#### 快捷搜索组件

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1a49c75e4ab2420ba53630a3dff743a6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2754&h=1400&s=324243&e=png&b=fcfcfc)

鼠标移到对应的组件树则会高亮页面内容，在右侧可以看到组件的一系列信息，例如 props、hooks、由什么渲染的，以及对应源代码来源。

###### useDebugValue

`useDebugValue` 是 React 提供的一个 hook 用于在 React DevTools 中显示自定义 hooks 的内部状态。

`useDebugValue` 主要用于自定义 hooks。因此，我们在开源库的源码中经常可以看到 `useDebugValue` 的身影，比如在 Jotai `useAtomValue` 的最后调用了 `useDebugValue` 包裹了拿到的状态：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/958f50a4be404b3e80e7bacaf4c7e4ca~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1122&h=906&s=190197&e=png&b=1f1f1f" alt="image.png" width="80%" /></p>


Zustand 的 `useStore` hook 中也调用了 `useDebugValue`：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/716fbc303b624dd9a6b5c1df1d96ece2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1748&h=1214&s=271785&e=png&b=1e1e1e" alt="image.png"  /></p>



我们再来对应看一下 React Devtools：



![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f31b90e9c4d04bceae2f57c1f476763b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1560&h=938&s=198224&e=png&b=fefefe)

可以直接看到该 Store 的全部状态。




#### 修改组件状态


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/82745e6bfd994d00959199b56ace1122~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=599&h=276&s=5635833&e=gif&f=30&b=fbfbfb" alt="QQ20240209-174542-HD.gif"  /></p>

我们也可以直接在 React DevTools 中修改状态，这将自动更新页面视图，方便调试。


#### 调试工具

在右上角有一排工具：


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/520cc687c10f4b8687b9ddd30acffcb4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1488&h=1232&s=249868&e=png&b=fcfcfc)

可以帮助我们更方便地调试，接下来我们依次介绍。





###### 显示 fallback 状态

> 样例在仓库 /examples/zustand/suspense 下。

现在有一个简单的 demo，当数据还未加载完毕会展示一个 loading 的状态：

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1ca8c57c7288497da99ba16cfcc8fa5a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=202&h=78&s=383169&e=gif&f=21&b=fdfdfd" alt="QQ20240210-085452-HD.gif"  width="30%"/></p>

如果我们想停留在 fallback 状态方便调试，可以点击按钮：


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8292da617cd54042b3999b0129d08abc~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1486&h=904&s=125296&e=png&b=ffffff)

这时候就会一直停留在 loading 状态。



###### 跳转到组件对应的 DOM


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/927109d8cf5a4e85a16da0d807cab14c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1476&h=722&s=95010&e=png&b=fefefe)

点击该按钮，即可立即跳转到对应的 DOM 节点：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4bc6d5b2539340baaa8b19e10c89162f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=600&h=283&s=2896761&e=gif&f=15&b=fbfbfb" alt="QQ20240210-090117-HD.gif"  /></p>



###### 控制台打印组件数据


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e7e991477b124843b963fc74d2a983e7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1484&h=1206&s=255591&e=png&b=fdfdfd)



![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/618e135365b94ea0a5734ec4a1e71de4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1472&h=378&s=121918&e=png&b=fefefe)


有些开发者喜欢在kong zhi t下工作，这个功能可以帮助你打印所有的组件信息在控制台。


###### 查看当前元素源代码


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f31a04f31d5d465187eca8c31b505e5c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=600&h=477&s=3576797&e=gif&f=11&b=fcfcfc" alt="QQ20240210-091450-HD.gif"  /></p>

点击可以跳转到当前组件的源代码。


###### 高亮 re-render 组件


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85319b8bf07b441bbbed2a9de07429aa~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1480&h=1172&s=198046&e=png&b=fefefe)


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/663505601406453aa1b5c7fa00bf389d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=599&h=322&s=3722096&e=gif&f=17&b=fcfcfc" alt="QQ20240209-141859-HD.gif"  /></p>

这样可以快捷地查看用户触发操作时哪些组件发生了 re-render，从而方便优化。




### ⚛️ Profiler

Profiler Tab 帮助我们测试组件的性能，并且提示需要重点优化的组件。


![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/caa9617ad52549879359109b5842ec44~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1480&h=644&s=147528&e=png&b=fdfdfd)


让我们一个个 Tab 分别来看：

- A：profilling button，点击按钮开始记录。
- B：reload button，点击刷新页面并开始记录。
- C：clear button，清空记录的数据。
- D：火焰图，点击切换为火焰图。
- E：排名图，点击切换为排名的方式显示组件列表。
- F：commit 列表，显示在整个记录时期 commit 的情况。

"commit" 是指 React 应用了一组变更到 DOM 的时间点。这通常发生在所有组件的渲染函数执行后，React 确定了需要在 DOM 上做哪些变更并应用这些变更。上图中"commit at 3.3s"代表这个 commit 发生在记录开始后 3.3 秒处。



### 如何利用 React Devtools 优化应用性能

接下来我们讨论如何利用 React Devtools 优化应用性能。

首先，我们打开 render 时高亮按钮：


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/41186ee4c9c741e8af8bcd817d27ac09~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1482&h=550&s=140438&e=png&b=fefefe)


然后，点击 checkbox：

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/663505601406453aa1b5c7fa00bf389d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=599&h=322&s=3722096&e=gif&f=17&b=fcfcfc" alt="QQ20240209-141859-HD.gif"  width="90%"/></p>


可以看到，当点击时整个页面都发生了 re-render，很显然这是有性能问题的，打开 profiler：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0b269d293af48c3af60346abbaf33b3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1482&h=686&s=132031&e=png&b=fbf9f9" alt="image.png" width="100%" /></p>


整个 render 花费了 2.1ms，预期应该是只有`TodoItem`本身重新渲染。我们可以来优化一下。

首先通过前面的学习我们知道，当使用 `useStore` 时最好向其中加入 selector 以及 shallow 参数，避免组件不依赖的状态的更新导致了组件发生 re-render。例如：


```js
const { filter, setFilter } = useStore();
```

对其修改为：

```js
const { filter, setFilter } = useStore(
  (state) => ({
    filter: state.filter,
    setFilter: state.setFilter,
  }),
  shallow,
);
```

完成全部`useStore`的改动后，我们来看下效果：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fac30b575c7748f28f996de980121282~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=599&h=314&s=2135389&e=gif&f=10&b=fcfbfc" alt="QQ20240209-145539-HD.gif"  width="90%"/></p>


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4fec6c0af1c41a4b85a4a3519aedb6e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1420&h=368&s=88216&e=png&b=fcfcfc" alt="image.png" width="100%" /></p>

可以看到，整个渲染时间以及优化到了 1.2ms，其中阴影部分代表了这些组件没有重新渲染。

但还是不符合预期，因为点击仍然会造成所有`TodoItem`都发生 re-render，而我们的预期是只有被点击的重新渲染，因此我们可以用 React `memo`来包裹一层：


```js
const TodoItem = memo(({ item }: { item: Todo }) => {
  const setTodos = useStore((state) => state.setTodos);
  const { title, completed, id } = item;

  const toggleCompleted = () =>
    setTodos((prevTodos) =>
      prevTodos.map((prevItem) =>
        prevItem.id === id ? { ...prevItem, completed: !completed } : prevItem,
      ),
    );

  const remove = () => {
    setTodos((prevTodos) => prevTodos.filter((prevItem) => prevItem.id !== id));
  };

  return (
    <>
      <input type="checkbox" checked={completed} onChange={toggleCompleted} />
      <span style={{ textDecoration: completed ? "line-through" : "" }}>
        {title}
      </span>
      <CloseOutlined onClick={remove} />
    </>
  );
});
```

我们再来看下效果：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/47a4e90322814b658937ee01a1c3a8c3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=599&h=314&s=3843405&e=gif&f=18&b=fcfcfc" alt="QQ20240209-152001-HD.gif"  width="90%"/></p>


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85da2df7bff64a5695e45a6e89be9811~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1468&h=468&s=89785&e=png&b=fcfcfc" alt="image.png" width="100%" /></p>

整个渲染时间已经缩减到了 0.7ms。




## Hooks DevTools 实现

我们这里要达到的一个目标是暴露一个 hook —— `useAtomsDebugValue`，当组件使用时可以在 React DevTools 中看到 Jotai Store 中所有 atoms 的状态：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ca391704e4a14a54bccec35cbb2bb6e1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=891&h=471&s=49104&e=png&b=ffffff" alt="" width="90%" /></p>

更细化一点，我们只需要知道已经挂载的 atoms 的状态即可。为了能够在 hook 中拿到 Store 中全部挂载好的 atom 的状态，我们需要修改一下之前实现的 `createStore` 函数。首先我们增加一个 `mountedAtoms`，当 atom 挂载时我们将它加入 `mountedAtoms` 中，以及一个方法 `get_mounted_atoms` 返回 `mountedAtoms` 的值：


```ts
type MountedAtoms = Set<AnyReadableAtom>

export const createStore = () => {
 // 先前的逻辑
 let mountedAtoms: MountedAtoms
 
 const mountAtom = <Value>(
   atom: ReadableAtom<Value>,
   initialDependent?: AnyReadableAtom,
 ): Mounted => {
   // 其它逻辑
   mountedAtoms.add(atom) // atom 挂载之后加入到 mountedAtoms 中
   return mounted
 }
 
 return {
   get_mounted_atoms: () => mountedAtoms.values(),  // 用于给 Jotai DevTools 使用
 }
}
```

然后，我们来实现一下 `useAtomsDebugValue` hook：


```ts
import { useDebugValue, useEffect, useState } from 'react'

import { ReadableAtom } from './atom'
import { Store, useStore } from './store'

const stateToPrintable = ([store, atoms]: [Store, ReadableAtom<unknown>[]]) => 
  atoms.reduce(
    (res, atom) => {
      const atomState = store.get(atom)
      res[atom.debugLabel] = { value: atomState }
      return res
    },
    {} as Record<string, unknown>,
  )


export function useAtomsDebugValue() {
  const store = useStore()

  const [atoms, setAtoms] = useState<ReadableAtom<unknown>[]>([])

  useEffect(() => {
    setAtoms(Array.from(store.get_mounted_atoms()))
  }, [store])

  useDebugValue([store, atoms], stateToPrintable)
}
```

这里我们向 `useDebugValue` 传入了两个参数，第二个参数为函数类型的可选项，React 会把第一个参数的值作为第二个函数的参数传入，最终将结果展示在 React DevTools 中。

你可能会想为什么不直接在 hook 中完成计算例如 `stateToPrintable([store, atoms])` 再把结果传入到  `useDebugValue` 中。这样做的好处是你可以把展示数值相关的繁重计算放到一个函数并作为第二个参数，这样只有当你在 React DevTools 中查看对应的组件时才会去计算它，从而提升性能。


## 总结

通过本章节你可以学习到：

- 如何使用 Jotai DevTools 来调试应用状态；
- React DevTools 介绍；
- 实现 Jotai DevTools Hooks。

至此，我们已经通过两个状态管理库学习完了两种 DevTools 类别的实现方案，在后续 Tanstack Query DevTools 部分我们将讲解第三种。