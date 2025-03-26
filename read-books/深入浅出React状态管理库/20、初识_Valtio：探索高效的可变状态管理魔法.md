

Valtio 和 Zustand、Jotai 一样，作者都是 [Daishi Kato](https://github.com/dai-shi)。截至本章发布，Valtio 的主版本为 v1.13.2，根据 Daishi 的描述这大概率可能是最后一个 v1 版本：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c53517058f8742f48a9f2550ee78c3b6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1184&h=1056&s=259682&e=png&b=ffffff" alt="image.png" width="70%" /></p>

而 v2 会跟随着 React 19 一起发布，因此我们可以直接基于 v2 版本来进行学习。

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3d741e921cf445a7b72eb033cdd18276~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1188&h=512&s=110416&e=png&b=ffffff" alt="image.png" width="70%" /></p>

而 v2 相比于 v1 做了哪些事情呢？可以看这个讨论（https://github.com/pmndrs/valtio/discussions/703 ），总结来说，v2 会有 breaking change（与 v1 不完全兼容），主要几个影响使用的部分：

- 在 v2 中 Valtio 不 resolve promise，因此需要手动使用 `use` 包裹 promise 来获取状态：

> 点击查看 Demo：
> 
> v1：https://codesandbox.io/p/sandbox/difference-zr52tf?file=%2Fsrc%2FApp.js%3A15%2C9
> 
> v2：https://codesandbox.io/p/sandbox/difference-v1-qdhz37?file=%2Fsrc%2FApp.js%3A13%2C8



```js
// v1
import { proxy, useSnapshot } from 'valtio'

const state = proxy({ data: fetch(...).then((res) => res.json()) })

const Component = () => {
  const snap = useSnapshot(state)
  return <>{JSON.stringify(snap.data)}</>
}

// v2
import { use } from 'react'
import { proxy, useSnapshot } from 'valtio'

const state = proxy({ data: fetch(...).then((res) => res.json()) })

const Component = () => {
  const snap = useSnapshot(state)
  return <>{JSON.stringify(use(snap.data))}</>
}
```

- 版本号限制：v2 限制 React 版本在 18 以上，这主要原因是 Valtio v2 把 use-sync-external-store 这个包移除了，因此 `useSyncExternalStore` 就无法兼容 18 以下的版本。
- Valtio 的 proxy 函数会对传入的对象进行代理，从而能够追踪状态的修改并通知组件完成 re-render，在 v1 源码的实现中传入 `new Proxy` 中的是拷贝后的对象，但通常不需要做这一点，因此 v2 默认去掉了这一部分并提供了 `deepClone` 函数来作为替代。


```js
// v2
import { proxy } from 'valtio';
import { deepClone } from 'valtio/utils';

const state = proxy(deepClone({ count: 1, obj: { text: 'hi' } }))
state.obj = deepClone({ text: 'hello' })
```

- v2 从 `dependencies` 移除了 `derive-valtio`，因此需要的话必须手动来进行安装。
- 删除弃用的功能：在 v1 中标记为已弃用的所有功能都将在 v2 中删除。

> 在写文章的时候我会尽可能地把更多上下文，比如 Github issue、discussion、blog 甚至是 twitter 文章发给大家，这样大家慢慢会有更多的感觉，并逐步参与到社区中。

好，接下来让我们正式开始 Valtio 的学习。






## 从一个 Todos 案例开始

正如我们在学习一门语言都会从 “Hello World” 开始，Todos 非常适合作为我们上手某个状态管理库的第一个例子。代码参见[项目](https://github.com/q-u-n/state-management-collection/tree/main/examples/valtio/todos)，最终效果如下：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/366ae38d2af240269c668dbb8db87137~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=599&h=365&s=12650685&e=gif&f=51&b=fcfbfc" alt="QQ20240210-144917-HD.gif" width="90%" /></p>



### 安装 Valtio

在 [NPM](https://www.npmjs.com/package/valtio?activeTab=versions) 中，我们可以看到 Tag 分为了 `latest` 和 `next`。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9e257bf688bc46949aac7f02925be9bd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1652&h=716&s=87574&e=png&b=ffffff" alt="image.png" width="90%" /></p>

其中：

- `latest` 指向库的最新稳定版本，当运行 `npm install <package-name>`（不指定版本号或标签）时，npm 会安装用 `latest` 标签标记的版本。
- `next` 指向即将成为稳定版的下一个版本，可以通过 `npm install <package-name>@next` 来进行安装。

由于我们要使用 Valtio v2 版本，因此我们需要指定 next：



```js
npm i valtio@next
```

为了让页面更好看一些，我们同时也安装一下 `antd` 和 `@react-spring/web`。


### 创建 Store

然后通过 Valtio 的 `proxy` 可以创建一个 Store：


```js
import { proxy, useSnapshot } from 'valtio'

type FilterType = 'all' | 'completed' | 'incompleted'
type Todo = {
  id: number
  title: string
  completed: boolean
}

export const store = proxy<{ filter: FilterType; todos: Todo[] }>({
  filter: 'all',
  todos: [],
})
```

可以看到，我们通过 `proxy` 创建了一个 Store，包含了：

-   `filter` 代表选择项，可以选择 `all` 代表全部工作，`completed` 代表已完成项，`incompleted` 代表待完成项。
-   `todos` 代表待办事项，其中每个 todo item 中包含了：`title` 代表事项名称和 `completed` 代表是否完成。


以及创建出操作 Store 的函数：


```js
const addTodo = (title: string) => {
  store.todos.push({
    id: Date.now(),
    title,
    completed: false,
  })
}

const setTodos = (fn: (todos: Array<Todo>) => Array<Todo>) => {
  store.todos = fn(store.todos)
}

const setFilter = (filter: FilterType) => {
  store.filter = filter
}
```

可以看到，我们可以像修改一个对象一样直接修改 Store，例如我们想要切换 `filter` 可以直接 `store.filter = filter`，这就是 Mutable 的优势，即以一种非常自然、符合直觉的方式来更新状态。

如下，可以看到整个页面大致分为三块，下面我们分别来对每一部分进行实现。

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abfc17ae09ab4a2db3d452dec1c69acd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1556&h=990&s=64059&e=png&b=fdfdfd" alt="image.png" width="90%" /></p>


### App 组件


```js
const App = () => {
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const title = e.currentTarget.inputTitle.value
    e.currentTarget.inputTitle.value = ''
    addTodo(title)
  }

  return (
    <form onSubmit={add}>
      <Filter />
      <input name="inputTitle" placeholder="Type ..." />
      <Filtered />
    </form>
  )
}
```

在 `<App />` 组件中返回内容被 `<form></form>` 包裹，并提供一个 `add` 函数，当用户在表单内的一个 `input` 字段中按下回车键时会执行 `onSubmit` 回调函数。

当执行 `add` 时，将 `<input />` 内容插入到 Store 里，并清空内容。


### Filter 组件


```js
const Filter = () => {
  const { filter } = useSnapshot(store)

  return (
    <Radio.Group onChange={(e) => setFilter(e.target.value)} value={filter}>
      <Radio value="all">All</Radio>
      <Radio value="completed">Completed</Radio>
      <Radio value="incompleted">Incompleted</Radio>
    </Radio.Group>
  )
}
```

这里提供了三个 `radio`，点击每个按钮时更新 `filter` 字段。


### Filtered 组件


```js
const Filtered = () => {
  const { todos, filter } = useSnapshot(store)
  const filterTodo = todos.filter((todo) => {
    if (filter === 'all') return true
    if (filter === 'completed') return todo.completed
    return !todo.completed
  })
  const transitions = useTransition(filterTodo, {
    keys: (todo) => todo.id,
    from: { opacity: 0, height: 0 },
    enter: { opacity: 1, height: 40 },
    leave: { opacity: 0, height: 0 },
  })

  return transitions((style, item) => (
    <a.div className="item" style={style}>
      <TodoItem item={item} />
    </a.div>
  ))
}
```

`<Filtered />` 组件包含了全部的 Todo 列表，我们可以把每个 Todo 项单独拆成一个组件 `<TodoItem />`，让代码更干净一些。

在 `<Filtered />` 组件里读取 Store 的 `todos` 和 `filter` 字段，并根据 `filter` 字段筛选 `todos` 。


### TodoItem 组件


```js
import { CloseOutlined } from '@ant-design/icons'

const TodoItem = ({ item }: { item: Todo }) => {
  const { title, completed, id } = item

  const toggleCompleted = () =>
    setTodos((prevTodos) =>
      prevTodos.map((prevItem) =>
        prevItem.id === id ? { ...prevItem, completed: !completed } : prevItem,
      ),
    )

  const remove = () => {
    setTodos((prevTodos) => prevTodos.filter((prevItem) => prevItem.id !== id))
  }

  return (
    <>
      <input type="checkbox" checked={completed} onChange={toggleCompleted} />
      <span style={{ textDecoration: completed ? 'line-through' : '' }}>
        {title}
      </span>
      <CloseOutlined onClick={remove} />
    </>
  )
}
```

对于每个 Todo 项，我们可以决定是否完成，以及是否取消，分别对应 `toggleCompleted` 函数以及 `remove` 函数。

至此，整个 Todo List 项目就完成了。




## Valtio 与状态更新

Valtio 可以让我们以自然符合直觉的方式来轻松更新状态，背后采用 Mutable 思想。

在讨论状态管理库时，我们可以从多个角度对其进行分类。其中的一种分类方法就是根据状态的可变性分为 `Mutable（可变）`与`Immutable（不可变）`。



<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ce58d3706a4e4e00ad7ffaaa93892dd6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1350&h=518&s=48872&e=png&b=ffffff" alt="image.png" width="70%" /></p>


- **Mutable（可变）**：指的是创建对象之后，任何状态更新都是基于对原先对象的基础之上进行的，典型的比如 MobX、Valtio 都是属于此类。例如：


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


当然，上面演示的例子中数据结构非常简单，我们可以举一个更加复杂的、多层嵌套的对象：


```js
const state = {
  deep: {
    nested: {
      obj: {
        count: 1,
      },
    },
  },
}
```

那对于这样的数据结构来说，以 Mutable 和 Immutable 方式分别应该如何来更新状态？

Mutable：


```jsx
// Valtio
<button onClick={() => (state.deep.nested.obj.count += 1)}>+1</button>
```

Immutable：


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

可以看到，对于复杂的多层嵌套的数据结构来说，Immutable 方式处理起来非常麻烦，并且容易出错，而 Mutable 方式则更加的自然、清晰和符合直觉。




## Valtio 与性能优化

使用 Valtio 我们无需刻意关心性能优化，因为 Valtio 会帮助我们追踪组件依赖的状态，从而自动完成性能优化，避免无关状态的变更导致额外的 re-render。

相比之下，Zustand 需要借助 selector 来从状态中进行选取，从而保证性能。而 Jotai 则是借助原子化的特性，通过原子之间相互依赖关系来完成性能优化，因此原子的合理拆分就显得极为重要。

> 点击查看 Demo：https://codesandbox.io/p/sandbox/simple-exp-9f556t?file=%2Fsrc%2FApp.js%3A11%2C36

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c3ad300aff649ba83c7e918c2fbb571~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1160&h=948&s=90611&e=png&b=ffffff" alt="image.png" width="70%" /></p>

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



在这个例子中，点击按钮执行 `obj.count += 1` 更新 `count` 状态，而由于 `Display` 没有用到 `count` 值，因此不会 re-render。可以看到这就是使用 Valtio 的好处之一，即我们不需要手动优化性能，背后 Valtio 会自动帮助我们进行追踪，从而默认就是性能最优的。




## 如何组织 actions

Valtio 非常灵活，可以以多种方式来组织 actions。

### 分离写法

> 点击查看 Demo：https://codesandbox.io/p/sandbox/separate-zwstqy?file=%2Fsrc%2FApp.js%3A1%2C1-28%2C1

这种是 Valtio 推荐的写法，因为更适合代码拆分。

```js
const state = proxy({
  count: 0,
  name: 'foo',
})

const inc = () => {
  ++state.count
}

const setName = (name) => {
  state.name = name
}
```

### 集中写法

> 点击查看 Demo：https://codesandbox.io/p/sandbox/concentrate-qc4lcz?file=%2Fsrc%2FApp.js%3A1%2C1-29%2C1

```js
const state = proxy({
  count: 0,
  name: 'foo',
})

const actions = {
  inc: () => {
    ++state.count
  },
  setName: (name) => {
    state.name = name
  },
}
```

### 将 actions 放到 proxy 中

> 点击查看 Demo：https://codesandbox.io/p/sandbox/actions-proxy-jz2m44?file=%2Fsrc%2FApp.js%3A8%2C5

```js
const state = proxy({
  count: 0,
  name: 'foo',
  inc: () => {
    ++state.count
  },
  setName: (name) => {
    state.name = name
  },
})
```

### this 写法

> 点击查看 Demo：https://codesandbox.io/p/sandbox/actions-this-yjppj3?file=%2Fsrc%2FApp.js%3A5%2C15

```js
const state = proxy({
  count: 0,
  name: 'foo',
  inc() {
    ++this.count
  },
  setName(name) {
    this.name = name
  },
})
```

### 类写法

> 点击查看 Demo：https://codesandbox.io/p/sandbox/actions-class-d38ch9?file=%2Fsrc%2FApp.js%3A5%2C15

```
class State {
  count = 0
  name = 'foo'
  inc() {
    ++this.count
  }
  setName(name) {
    this.name = name
  }
}

const state = proxy(new State())
```


## 处理异步操作

可以有两种方式来编写异步逻辑，一种是当数据请求回来后更新状态：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/simple-exp-8jrkmm?file=%2Fsrc%2FApp.js%3A12%2C26


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1c6841dad1a2421d80533b1f21e77afd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=648&h=648&s=122231&e=gif&f=105&b=fdfcff" alt="20240407112734_rec_.gif" width="45%" /></p>

```js
const state = proxy({
  todos: null,
  error: null,
})

const fetchData = async () => {
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos?_delay=2000')
    const todos = await response.json()
    state.todos = todos
  } catch (error) {
    state.error = error;
  }
}

export default function App() {
  const { todos, error } = useSnapshot(state)

  useEffect(() => {
    fetchData();
  }, []);

  if (!todos) return <div>Loading...</div>;

  if (error) return <div>{error.message}</div>;

  return (
    <div>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

另一种是结合 `use` hook + React `Suspense` 来做：

> 点击查看 Demo：https://codesandbox.io/p/sandbox/difference-v2-zr52tf?file=%2Fsrc%2FApp.js%3A23%2C15

```js
import { use, Suspense } from 'react'
import { proxy, useSnapshot } from 'valtio'

const state = proxy({
  todos: fetch('https://jsonplaceholder.typicode.com/todos?_delay=2000')
    .then((res) => res.json())
})

function Display() {
  const { todos } = useSnapshot(state)
  return (
    <ul>
      {use(todos).map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <Display />
    </Suspense>
  )
}
```


## DevTools

当然，对于一个好的状态管理库来说，有一个 DevTools 工具支持是必不可少的，Valtio 需要结合 [Redux DevTools](https://chromewebstore.google.com/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd?utm_source=ext_app_menu) 一起来使用。然后只需要简单地引入 devtools 即可：


```js
import { devtools } from 'valtio/utils'

const state = proxy({
  count: 0,
  name: "foo",
});
const unsub = devtools(state, { name: "state name", enabled: true });
```


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1b3c95a43c5f477d921a11a39bb5ad0c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1548&h=828&s=109572&e=png&b=f7f6f6" alt="image.png" width="80%" /></p>





## 总结

至此，我们已经完成了 Zustand、Jotai、Valtio 三个库的介绍。这三个状态管理库都非常具有代表性，理念并不相同。**Zustand 是 Immutable 的代表，Jotai 是原子化的代表，Valtio 则是 Mutable 的代表。**

而巧合的是这三个库都是由一个人发明的 —— [Daishi Kato](https://github.com/dai-shi)。那在项目中如何来进行选择呢？让我们来看看作者怎么说：

> 链接：https://twitter.com/dai_shi/status/1343694177884721152

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/01fb6250326746e0a27ac40113e32e1a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1190&h=770&s=160035&e=png&b=ffffff" alt="image.png" width="70%" /></p>

> 链接：https://twitter.com/dai_shi/status/1759803449418629232

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d077bacb7efd42988f7c8b620e641281~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1186&h=672&s=145288&e=png&b=ffffff" alt="image.png" width="70%" /></p>



对状态管理库做技术选型是一个很难的事情，很轻松就可以找到一些理由来支持我们选择某种方案。但从作者的角度我们可以获得一些`启发`：

- Zustand 是可预测的，因为它是基于 Immutable 模型，因此在大型的复杂的项目中更加适合。
- Valtio 基于 Mutable 模型，因此它在更新状态时是简单和符合直觉的，但因为是 Mutable 模型，所以不建议在大型复杂的项目中进行使用。
- 而 Jotai 基于原子化模型，非常有趣，各个原子之间交错组合来完成状态的更新。

另外，Valtio 内部采用 Proxy 来实现，因此会有一定的兼容性问题（例如不兼容 IE11）:


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9bc3f0bce97a45428555eb8b550ceee2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1844&h=720&s=130145&e=png&b=ffffff" alt="image.png" width="90%" /></p>

所以，如果你的项目需要兼容老版本的浏览器，则不能使用 Valtio。  