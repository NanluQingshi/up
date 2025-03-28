我们继续上一节的内容。这里我就假设各位已经将 Proxy 的剩余 handler 都实现了，如果有问题可以给我留言。

盘点一下我们完成了下列的哪些需求点：


 - <input type=checkbox checked> 至少能读取到 window 的真实属性值，在它们上定义操作属性不会影响到真实 window
 - <input type=checkbox checked> 支持指定属性的“逃逸”，即读写都会作用在真实 window 上
 - <input type=checkbox checked> 支持预设虚拟数据
 - <input type=checkbox> 支持区域化事件
 - <input type=checkbox> 支持事件、fetch、setTimeout 的自动清除
 - <input type=checkbox> 支持 localStorage 的自动空间

大概还有一半的需求没有实现。当然，不要忘了最后我们还要组装成能运行代码的 API。



## 区域化事件

由于 window 继承了 `EventTarget`，因此事件相关的 API 都在原型上。按照前一篇的 `get` 实现，从 window 上获取的 `addEventListener`、`removeEventListener`、`dispatchEvent` 都会被包装一层，以确保执行时的上下文仍然是 window。

因此，在沙箱中派发事件，沙箱外依然是可以监听到的，那么如何阻断事件向外传播呢？

一种方案是，可以创建一个独立的 EventTarget 实例来代替 window，这就需要覆盖 window 的上述三个函数了。我们可以用**预设虚拟数据**的方式来定义：

```js
presetVariables = {
    addEventListener,
    removeEventListener,
    dispatchEvent,
};
```

具体来说，创建一个 EventTarget 对象：

```js
const evt = new EventTarget();

function addEventListener(...args) {
    return evt.addEventListener(...args);
}

function removeEventListener(...args) {
    return evt.removeEventListener(...args);
}

function dispatchEvent(...args) {
    return evt.dispatchEvent(...args);
}

presetVariables = {
    addEventListener,
    removeEventListener,
    dispatchEvent,
};
```

这种实现有几种问题，需要解释给大家：

1. `addEventListener`、`removeEventListener`、`dispatchEvent` 相当于位于 winProxy 本身而不是其原型上了，虽然不影响正常使用，但是要注意可枚举性，它们不应被遍历出来。因此 `presetVariables` 不能是简单的 *key-value*，而是 *key-descriptor*，即包含属性描述符信息；当然也可以在 winProxy 之上增加一层原型来存储它们；
2. 无法实现冒泡，当然如果只是 window 的话，也就不存在冒泡了，但是如果你考虑 document 以及 DOM 节点上的事件的话，上面这个方案并不能正常工作；
3. `preventDefault` 不能工作，不过我们主动派发的自定义事件也不会有什么默认行为；
4. 事件对象（Event）上有几个属性和方法：`currentTarget`、`target/srcElement`、`composedPath()` 是和派发环境有关的，上面这个方案会返回错误的值，我们可以尝试修正一下：

```js
function addEventListener(eventName, listener, options) {
    return evt.addEventListener(eventName, (evt) => {
        if (evt instanceof Event) {
            Object.defineProperties(evt, {
                composedPath: {
                    get: () => [window],
                    configurable: true,
                },
                currentTarget: {
                    get: () => window,
                    configurable: true,
                },
                target: {
                    get: () => window,
                    configurable: true,
                },
                /** deprecated */
                srcElement: {
                    get: () => window,
                    configurable: true,
                },
            });
        }
        return listener.call(this, evt);
    }, options);
}
```

> 💡 注意 `defineProperties` 只在 Object 上有，Reflect 上没有。`instanceof` 只简单用来判断类型。

看来如果关注细节的话，那么上面这个方案的问题还是挺多的，但如果仅考虑自定义事件的话，就还能忍受。它的最致命问题是无法实现冒泡。如果你想在 `document` 上也实现区域化事件的话，就可能需要考虑冒泡，这就是另一个故事了，你可能得完整实现一套自定义的 `EventTarget`。




## 支持事件、fetch、setTimeout 的自动清除

事件、fetch、XMLHttpRequest、MutationObserver、setTimeout、setInternal、requestAnimationFrame 甚至 MessageChannel、WebSocket 等等有生命周期属性的“任务”，在沙箱销毁时都应该终断和清理。

我们以事件、fetch 和 setTimeout 作为典型案例。


### 事件

要清理掉已经注册的事件监听器，那么就需要知道都有哪些已经注册了的监听器。不妨用 Map 和 Set 结构做一下记录，然后再封装 addEventListener 和 removeEventListener：


```js
// {
//     event1: Set([fn1, fn2...]),
//     event2: Set([fn1, fn2...])
// }
const listenerMap = new Map();

function addEventListener(eventName, listener, options) {
    if (listenerMap.has(eventName)) {
        const listenerFnSet = listenerMap.get(eventName);
        
        listenerFnSet.add(listener);
    } else {
        const listenerFnSet = new Set();
        listenerMap.set(eventName, listenerFnSet);
        
        listenerFnSet.add(listener);
    }
    return evt.addEventListener(eventName, listener, options);
}

function removeEventListener(eventName, listener, options) {
    if (listenerMap.has(eventName)) {
        const listenerFnSet = listenerMap.get(eventName);
        
        listenerFnSet.remove(listener);
        
        if (!listenerFnSet.size) listenerMap.delete(eventName);
    }
    
    return evt.removeEventListener(eventName, listener, options);
}
```

顶层数据结构为 `Map`，key 是事件名，value 是一个 `Set` 结构，存储的是映射这个事件名的所有函数监听器。

在注册新事件监听器时，就往这个 Set 中添加函数，在移除事件监听器时，就从 Set 中移除函数。当沙箱销毁时，**应该遍历所有的 Set，将函数从真正的 EventTarget 上移除**，大概是这个样子：

```js
// dispose
for (const [eventName, eventSet] of listenerMap) {
    for (const lis of eventSet) {
        evt/*如果不需要区域化事件，这里就是 window*/.removeEventListener(eventName, lis);
    }
}
```

> 💡 上面涉及 Map、Set 的迭代器特性。

但是这样是有问题的，之前没有特别讲过，因为它本不属于本小册的范围，这个知识点就是：**移除事件监听函数除了要看事件名之外，还要看 `useCapture` 参数**。

`useCapture` 代表的就是事件监听函数应该在**捕获**阶段还是**冒泡**阶段被调用。如果你定义了一个捕获阶段的监听器，那么移除时也必须指定 useCapture。

`useCapture` 有两种指定方式：

```js
evt.addEventListener(eventName, listener, true);
evt.addEventListener(eventName, listener, {
    capture: true,
});
```

即第三个参数可以是布尔型或者含有 `capture` 参数的对象。我们需要从这个参数中计算出 useCapture 到底是 true 还是 false，然后附属给 Set 中的每个函数。在最终统一移除的时候要使用到它，如果前后对应不上，是不能成功从 EventTarget 上移除监听器的。

先实现一个识别 `useCapture` 的逻辑：

```js
function addEventListener(eventName, listener, options) {
    let useCapture;
    if ('object' === typeof options) useCapture = Boolean(options?.capture);
    else useCapture = Boolean(options);
    return evt.addEventListener(eventName, listener, options);
}
```

> 💡 除了对象类型之外，options 都会被隐式转换为布尔型。

剩余过程我就不在这里实现了，大家可以自己试试看。


### fetch

清理 `XMLHttpRequest` 更简单，因为它的实例有 `abort` 方法。`fetch` 的终断需要传入的一个 `signal` 参数，所以我们得封装一下 `fetch`：

```ts
// 记录所有的 AbortController
const abortControllers: AbortController[] = [];

// 存储 AbortController
const pushAbortController = (ac: AbortController): void => {
    abortControllers.push(ac);
};

// 移除 AbortController
const removeAbortController = (ac: AbortController): void => {
    const idx = abortControllers.findIndex(nid => nid === ac);
    if (idx >= 0) {
        abortControllers.splice(idx, 1);
    }
};

// 此函数注入到 presetVariables 中
function fetchProxy(input: RequestInfo | URL, init?: RequestInit): ReturnType<typeof fetch> {
    if (!init?.signal) {
        const ac = new AbortController();
        let ret: ReturnType<typeof fetch>;

        if (init) {
            init.signal = ac.signal;
            ret = fetch(input, init);
        } else {
            ret = fetch(input, {
                signal: ac.signal,
            });
        }

        pushAbortController(ac);

        return ret.finally(() => removeAbortController(ac)});
    }

    return fetch(input, init);
}
```

封装 `fetch` 的目的是希望能创建自己的 `AbortController`，将其 `signal` 传入真正的 `fetch` 中。只要我们记录了所有的 `AbortController`，就能统一调用它们的 `abort` 方法，从而终断所有在途的网络请求：

```js
abortControllers.forEach(ac => ac.abort());
```

我上面的代码忽略了本来就带有 signal 参数的的 fetch 调用。这种情况下也有办法，虽然我们拿不到 `AbortController` 对象，但是可以在 `signal` 上派发 `abort` 事件——是的，`signal` 的类型叫做 `AbortSignal`，也派生自 `EventTarget`。

从这一点上来说，似乎我们只需要存储 `signal` 就行了，这一部分就由各位来完成吧。




### setTimeout

*setTimeout*、*setInterval*、*requestAnimationFrame*、*requestIdleCallback* 都属于一类，记录它们的返回值，即可用对应的清理 API（*clearTimeout*、*clearInterval*、*cancelAnimationFrame*、cancelIdleCallback）实现清除。

我们不妨写一个通用的包装函数：


```js
function fnProxy(createfn, rets) {
    return function(...args) {
        const ret = createFn(...args);
        rets.push(ret);
        return ret;
    }
}

const timeouts = [];
const setTimeoutProxy = fnproxy(setTimeout, timeouts);

const intervals = [];
const setIntervalProxy = fnproxy(setInterval, intervals);

const rafs = [];
const requestAnimationFrameProxy = fnproxy(requestAnimationFrame, rafs);

const rics = [];
const requestIdleCallbackProxy = fnproxy(requestIdleCallback, rics);
```


总之，无论是事件还是 fetch、setTimeout，宗旨都是想办法记录能清理任务的句柄。但有些沙箱行为并非创建新的资源，而是访问浏览器共享资源，比如 `localStorage`。





## 支持 localStorage 的自动空间

`localStorage` 是持久化数据，不需要在沙箱销毁时清理，但不同沙箱实例读写时希望可以相互隔离。我们很快能想到利用 key 字符串的特定格式来实现，比如为每个实例设定一个唯一的**前缀**：

```js
const localStorageProxy = {
    getItem(key) {
        return localStorage.getItem(KEY_PREFIX + key);
    },
    setItem(key, val) {
        return localStorage.setItem(KEY_PREFIX + key, val);
    },
    removeItem(key) {
        return localStorage.removeItem(KEY_PREFIX + key);
    },
};
```

不过 localStorage 除了上面三个方法外，还有 key、 clear、length 三个方法和属性，它们就留给大家去实现了。

和 localStorage 相似的还有 `sessionStorage`，也可以按照上面的方法处理，不过根据需求，你可以实现成沙箱销毁后自动清理 `sessionStorage`。


涉及沙箱的功能需求我们就讲到这，剩下的事情无非就是扩展支持更多 API 的封装处理，方法基本如出一辙。现在我们假设已经拿到一个完整的 `winProxy` 对象，甚至用同样方法创建了一个 `docProxy`，接下来我们来实现让 JavaScript 代码在其下运行的能力。





## 执行 JavaScript

回到 Sandbox 的 API 定义，我们只关心 **runScript**：

```js
class Sandbox {
    runScript(code) {
        const opts = this.#options;
    }
}
```

动态运行代码有两种方式：`Function` 和 `eval`，后者默认具备访问当前上下文的能力，但这是我们要避免的，因此两者可以说旗鼓相当，就用 `eval` 吧。

为了避免用 var、function 声明的变量污染全局，我们还是得创建一个函数环境：

```js
(0, eval)(`(function() {${code}})()`);
```

动态代码会直接访问哪些变量，决定了这个函数的参数和上下文。至少有 this、globalThis、window、self、document、localStorage、setTimeout 等等。

对于 this 来说，我们知道在 `non-strict` 模式下，this 会指向 globalThis（即 window），否则就是 undefined。我们不妨为 Sandbox 新增一个 *strict* options，然后指定上述函数的上下文：


```js
class Sandbox {
    runScript(code) {
        const { strict } = this.#options;
        return (0, eval)(`(function() {
            ${strict ? '"use strict";' : ''}
            ${code}
        }).call(${strict ? 'undefined' : 'window'})`);
    }
}
```

不过上下文不能是真实的 window，而是我们前面创建的 winProxy 对象。这个对象并不能在 eval 参数中访问得到。

我们换一个思路，仅仅用 eval 创建一个函数实例，然后就可以直接调用传参：

```js
const fn = (0, eval)(`(function() {
    ${strict ? '"use strict";' : ''}
    ${code}
}`);

fn.apply(strict ? undefined : winProxy);
```

其他的变量名我们都需要声明到函数参数里：

```js
const fn = (0, eval)(`(function(window, globalThis, self, document, localStorage, setTimeout) {
    ${strict ? '"use strict";' : ''}
    ${code}
}`);

fn.apply(
    strict ? undefined : winProxy,
    [
        winProxy, /* window */
        winProxy, /* globalThis */
        winProxy, /* self */
        docProxy, /* document */
        localStorageProxy, /* localStorage */
        setTimeoutProxy /* setTimeout */
    ]
);
```

虽然 window 上的所有属性都可以直接访问到，但如果都声明在函数参数中的话，未免太多了，够用就好。按理说这里是 `with` 语句的最佳实践，无奈它的副作用更大，已经不被允许。

事实上，即便不声明到这个函数参数中，直接使用变量（比如 navigator、history）也不会是 undefined，因为毕竟沙箱还是跑在全局环境中的。我们要声明的，只是那些被封装、代理过的属性。

以上实现事实上有很多限制，大家需要清楚：
1. 不支持 ESM 代码，只能利用 `dynamic import` 导入远程地址；
2. var、function 的声明无法与 winProxy 相互同步，毕竟代码并非在真实 global 环境下执行；
3. 前面声明的变量，后面无法访问到，因为前后两次代码执行分属不同的函数上下文中。

无论如何，上面的代码已经将 Sandbox API 和 Proxy 联系了起来，总结一下本文涉及的知识点：

1. Object.defineProperties；
2. instanceof；
3. Map 与 Set；
4. 迭代器；
5. 类型判定与转换；
6. Promise；
7. eval；
8. strict 模式；

等等，受限于篇幅，完整的代码我就不贴出来了，仍然作为作业留给各位。





## 小结

一个相当原始的 Sandbox 我们就实现到这了，选择这个主题就是因为它包含了比较丰富的 JavaScript 特性，虽然不是全部，但也囊括了日常业务开发所需知识的大半，足以支撑各位在这门语言编程能力上的进步。

在此过程中，我也没有亲力亲为所有细节，力求在篇幅受控的同时，也给大家充足的自我自考空间，补足缺失的代码部分，从而学以致用。

到此为止，本小册主要内容全部结束，但我还是有一些期望，同时在编写过程中也得到了很多感悟，这些内容我们留给下一篇，也是最后一篇。