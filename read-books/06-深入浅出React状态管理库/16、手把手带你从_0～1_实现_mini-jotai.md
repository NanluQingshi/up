要想从 0 到 1 实现 mini-jotai，第一步就需要确定 mini-jotai 包含哪些功能，这里可以试想一下我们平时在项目中是如何使用 Jotai 的。

  
举一个例子，首先，我们会创建一个 `atom`，这个 `atom` 包含我们想要的数据：

```js
const firstNameAtom = atom('');
const lastNameAtom = atom('');
```

接下来，我们会用派生原子（derived atom）来将它们进一步组合起来：

```js
const fullNameAtom = atom((get) => {
  return get(firstNameAtom) + " " + get(lastNameAtom);
});
```

最终，`atom` 会在组件中被使用：

```jsx
const Display = () => {
  const fullName = useAtomValue(fullNameAtom);
  return <div>fullName: {fullName}</div>;
};
```

  


也可能会在组件中被更新状态：

```jsx
const Controller = () => {
  const setFirstName = useSetAtom(firstNameAtom);
  const setLastName = useSetAtom(lastNameAtom);
  return (
    <>
      <button
        onClick={() => {
          setFirstName("Michael");
        }}
      >
        set first name
      </button>
      <button
        onClick={() => {
          setLastName("Jordan");
        }}
      >
        set last name
      </button>
    </>
  );
};
```

> 查看完整 Demo：https://codesandbox.io/p/sandbox/use-case-hvqvk4

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f3c4ac51d8f40df869010f12a90b4e3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=408&h=112&s=28886&e=gif&f=24&b=fcfbfe" width="50%" alt=""  /></p>

在一个组件中可以通过 `useAtom`/`useSetAtom`/`useAtomValue` 完成对 atom 的操作：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eb5e408804704cfea8dbe391f3d11495~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1330&h=678&s=80089&e=png&b=ffffff" alt="image.png"  width="70%"/></p>

在上面的例子中，当我们点击按钮的时候会触发两个动作：1. 更新 `atom` 状态；2. 触发组件发生 re-render。




这就是 Jotai 的核心能力，所以我们将会实现：
-   **atom 函数**：能够完成各类型 atom 的创建。
-   **createStore 函数**：创建 Jotai Store，来完成对所有 atom 的管理，即订阅、改变状态、读取状态。
-   **核心 hooks**：`useAtom` / `useSetAtom` / `useAtomValue`。


为了更好的帮助大家理解 Jotai 的源码，我们会做一定的简化。




## 从 0～1 实现 jotai

### atom 实现

`atom()` 函数可以传入两个参数，第一个参数用来定义状态，第二个参数用来更改状态。

 
首先下一个定义：

-   Primitive atom（原始原子）：只传入第一个参数，并且第一个参数不是函数。
-   Read-only atom（只读原子）：只传第一个参数，并且第一个参数是一个函数。
-   Read-Write atom（可读可写原子）：两个参数均传入。


基于这个定义我们可以实现 `atom` 函数：

```js
function atom(read, write) {
  const config = {} // 其实就是一个对象，没有什么黑魔法
  if (typeof read === 'function') {
    config.read = read 
  } else {
    config.init = read
    config.read = (get) => get(config)
    config.write = (get, set, arg) =>
      set(config, typeof arg === 'function' ? arg(get(config)) : arg)
  }
  if (write) {
    config.write = write
  }
  return config
}

```


可以看到，`atom` 返回的其实就是一个对象，并没有什么黑魔法，这个对象将传入的读函数和写函数保存了起来，我们在这个基础上来补充一下类型：

```ts
export type Getter = <Value>(atom: ReadableAtom<Value>) => Value
export type Setter = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
) => Result

type Read<Value> = (get: Getter) => Value
type Write<Args extends unknown[], Result> = (
  get: Getter,
  set: Setter,
  ...args: Args
) => Result

// Read-only atom（只读原子）
export type ReadableAtom<Value> = {
  debugLabel: string
  read: Read<Value>
}

// Read-Write atom（可读可写原子）
export type WritableAtom<Value, Args extends unknown[], Result> = {
  write: Write<Args, Result>
} & ReadableAtom<Value>

type SetStateAction<Value> = Value | ((prev: Value) => Value)
// Primitive atom（原始原子）
export type PrimitiveAtom<Value> = WritableAtom<
  Value,
  [SetStateAction<Value>],
  void
>
```

完成类型定义后，我们来补充一下 `atom` 函数的类型：

```ts
export function atom<Value, Args extends unknown[], Result>(
  read: Value | Read<Value>,
  write?: Write<Args, Result>
) {
  const config = {} as WritableAtom<Value, Args, Result> & { init?: Value };
  if (typeof read === "function") {
    config.read = read as Read<Value>;
  } else {
    config.init = read;
    config.read = (get) => get(config);
    config.write = ((get: Getter, set: Setter, arg: SetStateAction<Value>) =>
      set(
        config as unknown as PrimitiveAtom<Value>,
        typeof arg === "function"
          ? (arg as (prev: Value) => Value)(get(config))
          : arg
      )) as unknown as Write<Args, Result>;
  }
  if (write) {
    config.write = write;
  }
  return config;
}
```

为什么我们这里没有额外定义 Write-only atom（只写原子）呢？因为对于 Write-only atom 来说，虽然叫“只写”原子，但其实无论如何都要传入第一个参数，只不过我们通常会用 `null` 占位，所以获取的状态也是这里的 `null`，也就是说严格意义上并不存在 Write-only atom 的概念，因此我们这里对概念做了一些简化。



### Hooks 实现

我们对于一个 atom 会有三种操作：1. 读（`get`）；2. 写（`set`）；3. 订阅（`sub`）。

  

前两个很好理解，那什么是订阅呢？订阅的目的是希望当 `atom` 状态发生变化时，可以通知当前组件来发生 re-render，从而基于最新的状态更新 UI。这个订阅操作是内置在 `useAtomValue` 中的，也就是说当组件调用 `useAtomValue` 来获取 `atom` 状态时，同时也会订阅这个 `atom` 以便当状态变化时可以重新渲染，展示正确的 UI。我们用一个图来表示这个过程：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/284718bbf97242db9ec3f2b163814df1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1010&h=838&s=114525&e=png&b=ffffff" alt="image.png" width="70%" /></p>

在上面图中只有 ComponentA 和 ComponentC 调用了 `useAtomValue` hook 对 atom 订阅，当 atom 状态变化时也只会触发 ComponentA 和 ComponentC 重新渲染。当然通过上节课的学习我们了解了 `useAtom` 内部会调用 `useAtomValue`, 因此在组件中使用  `useAtom` 也会达到相同的订阅效果。


`get`、`set`、`sub` 三个 Api 在 Jotai 中是通过 `createStore` 函数暴露出来的，也就是：


```ts
const createStore = () => {
  const readAtom = () => {}
  const writeAtom = () => {}
  const subscribeAtom = () => {}

  return {
    get: readAtom,
    set: writeAtom,
    sub: subscribeAtom,
  }
}

export type Store = ReturnType<typeof createStore>

let defaultStore: Store | null = null
export const useStore = () => {
  if (!defaultStore) {
    defaultStore = createStore()
  }
  return defaultStore
}
```

也就是说会有这么一个 `createStore` 函数用来创建 Store，这个 Store 会暴露出 `get`、`set`、`sub` 三个核心的 Api。同时我们创建了 `useStore` hook 可以创建并缓存 Store。

  


好！我们现在已经可以基于以上概念来实现 hooks 了，首先我们来实现`useAtom`：

```ts
export const useSetAtom = () => {}

export const useAtomValue = () => {}

export const useAtom = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
) => {
  return [useAtomValue(atom), useSetAtom(atom)]
}
```

可以看到对于 `useAtom` 来说实现非常简单，只是通过 `useAtomValue` 读取数据，以及通过 `useSetAtom` 拿到修改 atom 状态的方法，并将结果作为一个二元组 `[useAtomValue(atom), useSetAtom(atom)]` 返回出来。接下来我们来实现 `useSetAtom`：

```ts
export const useSetAtom = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
) => {
  // 获取store
  const store = useStore()
  // 用useCallback包裹一层的目的是保持返回的setAtom引用不变
  const setAtom = useCallback(
    (...args: Args) => {
      return store.set(atom, ...args)
    },
    [store, atom],
  )
  return setAtom
}

export const useAtomValue = () => {}

export const useAtom = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
) => {
  // useAtom仅仅是调用useAtomValue获取状态，useSetAtom获取更新atom的函数。并返回一个二元组而已。
  return [useAtomValue(atom), useSetAtom(atom)]
}
```

  


还记得前面我们说的吗，通过 `useStore` 可以拿到 Jotai Store，并且通过 Store 上的 `set` 函数可以更新 `atom` 的状态。因此可以看到，其实`useSetAtom` 只是将 `set` 包了一层而已，同时用 `useCallback` 来保证函数的引用不变。

  


最后我们来实现 `useAtomValue`：

```ts
export const useAtomValue = <Value>(atom: ReadableAtom<Value>) => {
  // 获取store
  const store = useStore()

  const [value, rerender] = useReducer((prev) => {
    const nextValue = store.get(atom)
    if (Object.is(prev, nextValue)) {
      // 状态不变则不触发re-render
      return prev
    }
    return nextValue
  }, store.get(atom))

  useEffect(() => {
    // 订阅组件
    const unsub = store.sub(atom, rerender)
    // 取消订阅
    return unsub
  }, [store, atom])

  return value
}
```

这里借助了 `useReducer` 来实现状态的更新以及性能的优化。


多提一嘴，当 `useReducer` 接收的函数返回结果不变时，React 不会 re-render，这里使用了 `store.get(atom)` 作为初始状态，也就是传入到 `useReducer` 的第二个参数。同时在 `useEffect` 中，我们对当前 `atom` 进行订阅（`sub`），当 `atom` 状态发生更新时，会调用上面 `useReducer` 返回的 `rerender` 函数来实现重新渲染。

当组件卸载时会进行 `unsub`，即取消订阅。

  


### Store 实现

整个 Jotai 最难的部分也就是 Store 的设计和实现，在这里我们不考虑边界的场景，来实现一个 mini-jotai Store。



前面我们实现了一个简单的 `createStore` 函数，包含了 `readAtom`（`get`）、`writeAtom`（`set`）、`subscribeAtom`（`sub`），下面我们先来丰富一下类型系统：

```ts
type AnyReadableAtom = ReadableAtom<unknown>
type AnyWritableAtom = WritableAtom<unknown, unknown[], unknown>

type Dependencies = Map<AnyReadableAtom, AtomState>
type AtomState<Value = unknown> = {
  d: Dependencies
  v: Value
}

type Listeners = Set<() => void>
type Dependents = Set<AnyReadableAtom>
type Mounted = {
  l: Listeners
  t: Dependents
}
```

类型定义完成后，我们继续来看 `createStore` 函数：

```ts
const createStore = () => {
  const atomStateMap = new WeakMap<AnyReadableAtom, AtomState>()
  const mountedMap = new WeakMap<AnyReadableAtom, Mounted>()
  const pendingMap = new Map<AnyReadableAtom, AtomState | undefined>()

  const readAtom = () => {}
  const writeAtom = () => {}
  const subscribeAtom = () => {}

  return {
    get: readAtom,
    set: writeAtom,
    sub: subscribeAtom,
  }
}
```

可以看到 `createStore` 会包含三个 Map。

-   `atomStateMap`：记录了 `AnyReadableAtom`（就是 atom 函数创建的原子） 到 `AtomState` 的映射，从类型签名上看，`AtomState` 包含 `v`（当前 atom 对应的状态），`d`（这个原子会依赖哪些原子）。
> 通过分析 AtomState 和 Dependencies 两个类型签名看，可以发现这里其实构建了 atom 的依赖树。
-   `mountedMap`：记录了 `AnyReadableAtom` 到 `Mounted` 的映射，从类型签名上看，`Mounted` 包含 `l` 和 `t`：
    -   `l`: 订阅函数的集合 (`Set`)，当原子状态改变时会依次调用 `Set` 内包含的函数，也就是上面我们实现 `useAtomValue` 中 `useReducer` 返回的 `rerender` 函数，触发组件重新渲染，因此 `l` 是实现 re-render 的关键
    -   `t`: 包含了哪些派生原子，也就是说哪些原子会依赖当前原子。
> 请注意 d: Dependents 和 t: Dependencies 二者的区别。这里为啥需要定义 t，其实很好理解，如果该原子更新了，依赖该原子的派生原子也必须同步计算更新，相当于连锁反应。


-   `pendingMap`：记录了需要被更新的 `atom` 的集合，当 `atom` 状态发生改变时会加入到 `pendingMap` 中。

那为什么 `atomStateMap` 和 `mountedMap` 用 WeakMap 来实现呢？因为 WeakMap 中键是弱引用。如果没有其他引用指向键对象，这个对象可以被垃圾回收，可以帮助避免内存泄漏。

但是为什么 `pendingMap` 没有采用 WeakMap 而是采用了 Map 呢？因为对于 `atomStateMap`/`mountedMap` 来说只需要调用 `get`/`set`/`has` 就足够了，但是对于 `pendingMap` 来说需要去遍历这个 map，而 WeakMap 是不可以遍历的。

这里其实就开始复杂起来了，为了帮助大家理解这里画了一张图：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/42c2995443884226abfe75c6825c024e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1304&h=966&s=112171&e=png&b=fefefe" alt="image.png" width="80%" /></p>

`createStore` 函数用来创建 Store，在 Store 中可以分为两部分：

- State：维持状态，核心是 `atomStateMap`、`mountedMap`、`pendingMap`。
- Api：暴露给上层 Api 例如我们上面实现的几个 Hooks，或者直接使用，核心是 `get`、`set`、`sub`。

而在 State 中，不好理解的是 `atomStateMap` 与 `mountedMap` 的关系，举个实际的例子：


```js
const countAtom = atom(1);

const derivedAtom = atom((get) => get(countAtom) * 2);

const derivedAtom2 = atom((get) => get(derivedAtom) * 3);

function Display() {
  const count = useAtomValue(derivedAtom2);
  return <div>{count}</div>;
}
```

在这个例子中我们创建了 `countAtom`，以及 `derivedAtom` 派生原子依赖了 `countAtom`，以及一个 `derivedAtom2` 依赖了  `derivedAtom` 。那么它们之间的关系如下：


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9cd03acfe166456dabba463359b85dc2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=402&h=1006&s=40621&e=png&b=ffffff" alt="image.png" width="25%" /></p>



接下来我们分别对 `readAtom`、`writeAtom` 以及 `subscribeAtom` 进行实现。

#### readAtom 实现


首先我们来实现一些工具函数：

```ts
const isEqualAtomValue = <Value>(a: AtomState<Value>, b: AtomState<Value>) =>
  'v' in a && 'v' in b && Object.is(a.v, b.v)
  
const returnAtomValue = <Value>(atomState: AtomState<Value>): Value => {
  return atomState.v
}

const createStore = () => {
  const atomStateMap = new WeakMap<AnyReadableAtom, AtomState>()
  const mountedMap = new WeakMap<AnyReadableAtom, Mounted>()
  const pendingMap = new Map<AnyReadableAtom, AtomState | undefined>()

  const getAtomState = <Value>(atom: ReadableAtom<Value>) =>
    atomStateMap.get(atom) as AtomState<Value> | undefined

  const setAtomState = <Value>(
    atom: ReadableAtom<Value>,
    atomState: AtomState<Value>,
  ): void => {
    const prevAtomState = atomStateMap.get(atom)
    atomStateMap.set(atom, atomState)
    if (!pendingMap.has(atom)) {
      pendingMap.set(atom, prevAtomState)
    }
  }

  const readAtomState = () => {}

  const readAtom = <Value>(atom: ReadableAtom<Value>): Value =>
    returnAtomValue(readAtomState(atom))
  const writeAtom = () => {}
  const subscribeAtom = () => {}

  return {
    get: readAtom,
    set: writeAtom,
    sub: subscribeAtom,
  }
}
```

这一部分中，我们增加了：

-   从 WeakMap 中读取 `atom` 状态的`getAtomState`。
-   写状态的`setAtomState`，写入状态的同时需要把当前的 `atom` 加入到 `pendingMap` 中。
-   从 `atomState` 中拿到具体值的 `returnAtomValue`。
-   判断两个 `atom` 状态是否一致的 `isEqualAtomValue`。

  


接下来我们来实现读状态也就是`readAtomState`函数：

```ts
const setAtomValue = <Value>(
  atom: ReadableAtom<Value>,
  value: Value,
  nextDependencies?: NextDependencies,
): AtomState<Value> => {
  const prevAtomState = getAtomState(atom)
  const nextAtomState: AtomState<Value> = {
    d: nextDependencies || new Map(),
    v: value,
  }
  if (prevAtomState && isEqualAtomValue(prevAtomState, nextAtomState)) {
    // 这里会判断最新的状态和先前的状态是否一致，也就是判断v是否一致，不一致才需要更新状态
    return prevAtomState
  }
  setAtomState(atom, nextAtomState)
  return nextAtomState
}

const readAtomState = <Value>(
  atom: ReadableAtom<Value>,
  force?: boolean,
): AtomState<Value> => {
  const atomState = getAtomState(atom)
  // 这里会判断缓存，如果不是强制重新读状态(force = true)，否则直接返回缓存的状态
  if (!force && atomState) {
    return atomState
  }
  const nextDependencies: NextDependencies = new Map()
  const getter: Getter = <V>(a: ReadableAtom<V>) => {
    // 这里需要判断是读当前的atom还是读的其他atom
    if ((a as AnyReadableAtom) === atom) {
      const aState = getAtomState(a)
      if (aState) {
        // 记录atom依赖了哪些其他atom，也就是说get了哪个就将哪个atom加入到nextDependencies
        nextDependencies.set(a, aState)
        return returnAtomValue(aState)
      }
      if (hasInitialValue(a)) {
        nextDependencies.set(a, undefined)
        return a.init
      }
      throw new Error('no atom init')
    }
    // 如果不是读的自己，则递归调用readAtomState去读，并加入到依赖项nextDependencies中
    const aState = readAtomState(a)
    nextDependencies.set(a, aState)
    return returnAtomValue(aState)
  }
  // 这里其实就是构造了一个getter函数，并传入到read函数中来得到value
  const value = atom.read(getter)
  // 然后将最新的值更新到atomStateMap中
  return setAtomValue(atom, value, nextDependencies)
}
```

我们前面说 Jotai 内部会维护三个 Map，其中 `atomStateMap` 维护了 `atom` 到状态的映射，因此可以从该 Map 中获取 `atom` 对应的最新状态，因此在读取状态时，如果当前 `atom` 不在 `atomStateMap` 时，代表之前没有读取过该 `atom` 的状态，需要将其加入进 `atomStateMap`。同时实现了 `getter` 函数，也就是我们代码中`atom((get) => get(anAtom));` 里的 `get`。

#### writeAtom 实现

然后我们来实现一下 `writeAtom`：


```ts
const writeAtom = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
): Result => {
  // 更新atom状态
  const result = writeAtomState(atom, ...args)
  // 触发重新渲染
  flushPending()
  return result
}
```

可以看到 `writeAtom` 分为两个部分：

-   `writeAtomState`：用来更新 `atom` 上状态，这个过程会把状态发生变化的 `atom` 和依赖这个 `atom` 的 `atom`，也就是对应的派生原子加入到 `pendingMap` 中。
-  `flushPending`：用来触发 re-render 的函数。在调用 `writeAtomState` 之后， `pendingMap` 其实就包含了状态变化的 `atom` 以及这些 `atom` 对应的派生原子，以及派生原子对应的派生原子......那么我们就能遍历并调用这些 `atom` 对应的 `l` 来触发 re-render。


`writeAtomState` 实现：

```ts
const recomputeDependents = (atom: AnyReadableAtom): void => {
  // t上记录了哪些其他atom依赖了这个atom
  const dependents = new Set(mountedMap.get(atom)?.t)
  dependents.forEach((dependent) => {
    if (dependent !== atom) {
      // 因为要重新计算状态，所以这里第二个参数force = true，并且这个过程会将变化的atom加入到pendingMap中
      readAtomState(dependent, true)
    }
    recomputeDependents(dependent)
  })
}

const writeAtomState = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
): Result => {
  const getter: Getter = <V>(a: ReadableAtom<V>) =>
    returnAtomValue(readAtomState(a))
  const setter: Setter = <V, As extends unknown[], R>(
    a: WritableAtom<V, As, R>,
    ...args: As
  ) => {
    let r: R | undefined
    if ((a as AnyWritableAtom) === atom) {
      const prevAtomState = getAtomState(a)
      const nextAtomState = setAtomValue(a, args[0] as V)
      if (!prevAtomState || !isEqualAtomValue(prevAtomState, nextAtomState)) {
        // 这里判断状态是否真的发生了变化，如果改变则需要重新去计算依赖的atom的状态
        recomputeDependents(a)
      }
    } else {
      // 如果不是set当前的atom，则需要递归来完成状态更新
      r = writeAtomState(a as AnyWritableAtom, ...args) as R
    }
    return r as R
  }
  // 这里其实就是创建了getter和setter函数，并传入到atom.write而已
  const result = atom.write(getter, setter, ...args)
  return result
}
```

类似于 `readAtomState` 的实现中其实就是调用 `atom.read`，`writeAtomState` 会调用 `atom.write`，并传入 `getter` 和 `setter`。并根据依赖关系，依次触发（`recomputeDependents`）派生原子更新状态以及加入到 `pendingMap` 中。


然后我们实现 `flushPending` 用来触发组件重新渲染，目的是将最新的状态更新到 UI 上：

```ts
const flushPending = (): void | Set<AnyReadableAtom> => {
  while (pendingMap.size) {
    const pending = Array.from(pendingMap)
    pendingMap.clear()
    pending.forEach(([atom, prevAtomState]) => {
      const atomState = getAtomState(atom)
      const mounted = mountedMap.get(atom)
      if (
        mounted &&
        atomState &&
        !(prevAtomState && isEqualAtomValue(prevAtomState, atomState))
      ) {
        mounted.l.forEach((listener) => listener())
      }
    })
  }
}
```

可以看到，`flushPending`会判断`pendingMap`中是否包含记录，如果有的话则首先会清空 Map，然后根据之前的状态（`prevAtomState`）和现在的状态（`atomState`）相比是否一致（`isEqualAtomValue`），如果不一致则会触发组件重新渲染。

我们以一个问题来帮助大家更好的理解这个过程，假设我们更新了箭头 `atom` 的状态，则哪些组件最后会 re-render 呢？


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e032947f9ae740e980b888494c83cd85~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1308&h=1088&s=115355&e=png&b=ffffff" alt="image.png" width="80%" /></p>

答案是：



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6db15f44dce945ac9d17a130e5092592~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1308&h=1118&s=121290&e=png&b=ffffff" alt="image.png" width="80%" /></p>

更新箭头指向 atom 状态之后，也就是说会调用我们上面实现的 `writeAtom` 函数，之后  `writeAtom` 函数内部分别调用 `writeAtomState` 以及 `flushPending`。

 `writeAtomState` 中会调用 `recomputeDependents` 依次触发依赖 atom、依赖 atom 的依赖..... 重新计算状态，也就是蓝色的所有 `atom`，最后通过  `flushPending` 来更新所有组件重新渲染。



#### subscribeAtom（sub） 实现

最后我们来实现一下 `subscribeAtom`（`sub`）。


通过前面的描述我们知道，当在读取 `atom` 状态时（`useAtom`/`useAtomValue`）组件会对 `atom` 进行订阅 `store.sub(atom, rerender)`，以便当 `atom` 状态发生变化时可以通知组件完成重新渲染，并且当组件卸载时可以取消订阅。


由此可以知道，`subscribeAtom` 要做两件事情：

-   当调用时需要对该 `atom` 进行订阅，即将当前 `atom` 加入到 `mountedMap` 中，并借助 `atomStateMap` 分析被哪些 `atom` 所依赖（这样当这个 `atom` 状态发生变化时可以知道要去重新计算哪些其他的 `atom` 新的状态），并加入到 `t` 上。将回调函数（`sub` 的第二个参数，也就是我们在实现 `useAtomValue` 中 `useReducer` 返回的 `rerender` 函数）加入到 `l` 中。
-   返回一个取消订阅的函数，需要做的事情就是将当前 `atom` 从 `mountedMap` 中删除，并且要把这个 `atom` 从其他 `mountedMap` 中 `atom` 的 `t` 上给剔除掉。

  

具体实现如下：

```ts
const mountAtom = <Value>(
  atom: ReadableAtom<Value>,
  initialDependent?: AnyReadableAtom,
): Mounted => {
  // 分析atom依赖了哪些其他atom，然后逐个加入到mountedMap中
  getAtomState(atom)?.d.forEach((_, a) => {
    // 寻找依赖的方式是通过getAtomState(atom)，上面的d参数就是atom依赖的其他atom。这个过程是记录atom的依赖项，这样当状态变化时就知道要去重新计算哪些atom的状态。
    const aMounted = mountedMap.get(a)
    if (aMounted) {
      aMounted.t.add(atom)
    } else {
      if (a !== atom) {
        // 递归，确保直接或间接依赖都加入到mountedMap中
        mountAtom(a, atom)
      }
    }
  })
  const mounted: Mounted = {
    t: new Set(initialDependent && [initialDependent]),
    l: new Set(),
  }
  // 将atom加入到mountedMap中
  mountedMap.set(atom, mounted)
  return mounted
}

const addAtom = (atom: AnyReadableAtom): Mounted => {
  let mounted = mountedMap.get(atom)
  if (!mounted) {
    mounted = mountAtom(atom)
  }
  return mounted
}

const unmountAtom = <Value>(atom: ReadableAtom<Value>): void => {
  // 卸载atom
  mountedMap.delete(atom)
  // 将atom从mountedMap中剔除
  const atomState = getAtomState(atom)
  if (atomState) {
    // 这里的作用是分析mountedMap中的所有atom中有哪些依赖了atom，也就是说把atom从t上删除
    atomState.d.forEach((_, a) => {
      if (a !== atom) {
        const mounted = mountedMap.get(a)
        if (mounted?.t.has(atom)) {
          mounted.t.delete(atom)
        }
      }
    })
  }
}

// 完成对atom的订阅，listener的作用是当atom状态发生变化时调用listener来完成组件的重新渲染
const subscribeAtom = (atom: AnyReadableAtom, listener: () => void) => {
  // 将当前atom加入到mountedMap中
  const mounted = addAtom(atom)
  // 注册订阅者
  const listeners = mounted.l
  listeners.add(listener)

  // 返回unsub函数，当组件卸载时调用
  return () => {
    unmountAtom(atom)
  }
}
```

上面四个函数的作用分别是：

-   `subscribeAtom`：入口函数，完成对 `atom` 的订阅和取消订阅操作。
-   `addAtom`：判断 `atom` 是否已经被订阅过了，也就是说判断 `mountedMap` 上是否包含了 `atom`，如果没被订阅则调用 `mountAtom` 完成对 `atom` 的订阅。
-   `mountAtom`：完成对 `atom` 以及 `atom` 依赖的其他 `atom` 的订阅，这个过程是通过递归完成的。
-   `unmountAtom`：取消订阅，也就是说把 `atom` 从 `mountAtom` 以及其他 `atom` 的 `t` 上移除掉。



注意：`AtomState` 类型中的 `d` 和 `Mounted` 类型的 `t` 并不是一个概念。
- `d` 代表了这个 `atom` 依赖了哪些其他 `atom`，也就是需要 `get` 哪些 `atom` 来完成状态的计算；
- `t` 代表哪些其他 `atom` 依赖了这个 `atom`，当这里的 `atom` 状态发生变化时，需要根据 `t` 参数找到所有依赖，完成状态的重新计算和组件的重新渲染。

为了证明上面 mini-jotai 的准确性，我们以本节最开始的例子作为单元测试的一个 case。

> 单测代码见： https://github.com/q-u-n/state-management-collection/blob/main/packages/jotai/__tests__/basic.test.tsx

在后续有专门的单元测试章节带领大家实现单元测试部分，运行单元测试 `pnpm run test`：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f232b036dc1446e87e81ab13345ee13~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=622&h=234&s=34219&e=png&b=1f1f1f" alt="image.png" width="50%" /></p>

可以看到通过了单元测试校验。




## 总结

整个流程可以梳理和汇总为如下示意图：




<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9140b56a00134fe5b667addaae66bcd3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1118&h=1302&s=100003&e=png&b=ffffff" alt="image.png" width="70%" /></p>

借着上面的示意图，我们来回顾一遍 mini-jotai 的整个流程：

-   首先 `useStore` 借助 `createStore` 来创建一个 Store。
-   Store 内部会维护三个 Api —— `get`、`sub`、`set`，以及三个 Map\WeakMap 来管理 `atom` 的状态和依赖关系，分别为 `atomStateMap`、`mountedMap`、`pendingMap`。
-   最终再借助 `useAtomValue`、`useAtom`、`useSetAtom` Api 完成在组件中消费（读/写）。其中，`useAtom` 内部会调用 `useAtomValue`、`useSetAtom`；`useAtomValue` 借助 Store 上的 `get`、`sub` 完成状态的读取和对 `atom` 的订阅；`useSetAtom` 借助 Store 上的 `set` 完成对 `atom` 状态的更新。






  

本章节带领大家从 0～1 实现了 mini-jotai 的核心部分，通过本章节你可以学到：

-   `atom` 函数的实现原理。
-   核心 hooks（`useAtom` / `useAtomValue` / `useSetAtom`）实现原理。
-   Store 的实现原理。

可以看到相比于 Zustand，Jotai 的实现尤其是 Store 部分，要复杂很多。为了尽可能的让大家理解，画了比较多的图和代码注释。

在下一章节，我们将介绍 React 最新 hooks —— `use`，并利用该 hooks 来继续完善我们的 mini-jotai。