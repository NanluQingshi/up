## Proxy 概念

这里的 Proxy 和前端经常接触的 HTTP Proxy 并非同一事物，但仍然没偏离代理的本意。

JavaScript 中的 Proxy 是 ES6 新增的功能。它用来拦截并定义对象的各种操作，比如属性读取、赋值、枚举、删除，甚至函数调用。

Proxy 提供了一种非常强大和灵活的方式来操作和控制对象的行为。它的基本语法如下：

```js
let proxy = new Proxy(target, handler);
```

其中，target 是要代理的目标对象，handler 是一个包含了一组捕获器（也称为 `trap`）的对象。捕获器是一个包含了一些预定义方法的对象，这些方法可以拦截并修改对象的操作。

> 💡 如果 target 和 handler 任一不是对象，上面的代码则抛出 TypeError，因此不要尝试把数字、字符串、布尔等这类 Primitive 变量当作被代理的对象。

想必大家都能猜到，handler 是 Proxy 的核心所在。它提供的能力几乎涵盖了你能想到的所有对象操作途径，比如有人想删除一个对象的某个属性，你可以监听到这种企图，并且拒绝它。

<p align="center"><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/24dbd7c4d8c84f3e983ee9b0c3149c62~tplv-k3u1fbpfcp-watermark.image" width="60%"></p>

从这一点上来说，我们似乎具备了“为所欲为”的能力，真的是这样吗？我们不妨围绕着 handler 的结构来详细讨论 Proxy 的功能。




## handler 分解

handler 就是一个普通对象，它的以下函数属性是会被使用的：
1. defineProperty
2. deleteProperty
3. get
4. set
5. getOwnPropertyDescriptor
6. getPrototypeOf
7. setPrototypeOf
8. has
9. ownKeys
10. apply
11. construct
12. isExtensible
13. preventExtensions

一共 13 个函数，代表了对一个对象的 13 种操作。事实上，任意对象操作都可以分解成这 13 种元操作的组合。大家想一想，`Object.freeze` 应该是由上面哪几种操作组成的？

接下来我就以最简单的 `set` 来为没有使用过 Proxy 的同学展示一下它的能力：

```js
const origin = {
    name: 'Mike',
};

const proxy = new Proxy(origin, {
    set(target, p, value) {
       if ('name' === p) return false;

       return Reflect.set(target, p, value);
    }
});

proxy.name = 'Jim'; // failed

console.log(proxy.name); // "Mike"

proxy.age = 16; // success

console.log(proxy.age); // 16
```

这段简短的 Proxy 实现了对 name 属性的赋值锁定功能，但却不妨碍对其他属性的赋值。这样的 Proxy 会有非常大的想象空间，一定有很多同学开始有各种奇思妙想的想法。

上面的代码还有一处亮点，我用 `Reflect` 来执行对 target 的操作。当然，你也可以用中括号语法赋值，但是要注意捕获错误，因为 handler 中包括 set 在内的好多函数都需要返回布尔值，反馈操作成功与否。讲到这里，我们应该可以恍然大悟了——原来 Reflect API 返回布尔值的设计，是为了在 Proxy 中使用啊～

是的，Reflect 的最大用武之地就是 Proxy，这个我们在前一篇中提到过。事实上在 ECMAScript 规范中，Reflect 和 Proxy 一起都属于 Reflection 的概念范畴。

接下来，我要用本节的大部分篇幅来解释上面 13 个函数的使用方法和注意事项。大家注意，等到本节结束之前，我们要回答一个问题：**Proxy 能不能让对目标对象的操作为所欲为？**


### getPrototypeOf

显然，当我们用 `Object.getPrototypeOf` 或者 `Reflect.getPrototypeOf` 获取一个对象的原型时，就会调用此方法。

我们可以利用它来改写 `instanceof` 的行为：

```js
const proxy = new Proxy(origin, {
    getPrototypeOf() {
       return Number.prototype;
    }
});

console.log(proxy instanceof Number); // true
```

是不是很震惊呢？当然，返回 null 也是允许的。但是不允许返回除了对象和 null 之外的其他类型。除此之外，`getPrototypeOf` 还有一条法则：**`如果目标对象不可扩展（non-extensible），那么 getPrototypeOf 必须返回目标对象的原型`**。

什么意思？看下面的案例：

```js
const origin = {
    name: 'Mike'
};

Object.preventExtensions(origin)

const proxy = new Proxy(origin, {
    getPrototypeOf() {
        return Number.prototype;
    }
});

proxy instanceof Number // ❌ TypeError: 'getPrototypeOf' on proxy: proxy target is non-extensible but the trap did not return its actual prototype
```

为什么有这样的规则？不可扩展的对象就是不能修改原型，这个我们前面学习过。那和 Proxy 有什么关系？

ECMAScript 规范定义了一种叫做不变量（**`Invariants`**）的概念。不变量是一种特殊的规则或属性，无论发生什么事情，它们都不会改变，即便是 Proxy 也要遵守。

ECMAScript 的不变量都集中和对象有关，比如对于 getPrototypeOf 就有这么一条不变量的表述：**如果对象是不可扩展的，用 getPrototypeOf 返回了 V 值，那么以后的调用都始终返回 V**。这句话事实上规定了不可扩展的一条语义就是它的原型不可改变。

像这样的不变量还有很多，我们继续分解 handler。


### setPrototypeOf

`setPrototypeOf` 自然作用于 `Object.setPrototypeOf` 和 `Reflect.setPrototypeOf`。它的布尔返回值反映了操作的结果，因此返回值必须是布尔值就是第一条不变量。

另一条不变量是和 `getPrototypeOf` 呼应的，即**如果目标对象不可扩展，除非参数等于目标对象的原型，否则 setPrototypeOf 必须返回 false**。

举一个反例：

```js
const origin = {
    name: 'Mike'
};

Object.preventExtensions(origin)

const proxy = new Proxy(origin, {
    setPrototypeOf(V) {
        return true;
    }
});

Reflect.setPrototypeOf(proxy, Reflect.getPrototypeOf(origin)); // true

Reflect.setPrototypeOf(proxy, null); // ❌ TypeError: 'setPrototypeOf' on proxy: trap returned truish for setting a new prototype on the non-extensible proxy target
```

### isExtensible

`isExtensible` 作用于 `Object.isExtensible` 和 `Reflect.isExtensible`，返回对象是否可扩展。

这个值必须和目标对象的一样，否则就会抛出错误：

```js
const origin = {
    name: 'Mike'
};

const proxy = new Proxy(origin, {
    isExtensible() {
        return false;
    }
});

Reflect.isExtensible(proxy); // ❌ TypeError: 'isExtensible' on proxy: trap result does not reflect extensibility of proxy target (which is 'true')
```

不过也仅限如此，除了 `Object.isExtensible` 和 `Reflect.isExtensible` 之外，根本没有其他行为会检查这个方法的返回值，因此你依旧可以拓展对象：

```js
proxy.age = 16; // success
```

不过，上面新增的 age 既不能遍历出来也不能用 hasOwnProperty、Object.hasOwn 判断出来。


### preventExtensions

`preventExtensions` 作用于 `Object.preventExtensions` 和 `Reflect.preventExtensions`，返回阻止可扩展是否成功。

第一条不变量也是它必须返回布尔值。第二条不变量是**只有在 isExtensible 返回 false 的时候，preventExtensions 才能返回 true**。

```js
const proxy = new Proxy(origin, {
    isExtensible() {
        return true;
    },
    preventExtensions() {
        return true;
    }
});

Reflect.preventExtensions(proxy); // ❌ TypeError: 'preventExtensions' on proxy: trap returned truish but the proxy target is extensible
```

至于如果 `preventExtensions` 想返回 false，那么这个时候对 `isExtensible` 却没有要求，true 和 false 都可以。

这种似乎不完备的现象我们可以这样理解，`preventExtensions` 是动作，而 `isExtensible` 是状态，动作成功了，状态必然需要改变；而动作失败，则不代表在修改状态方面失败了，也可能是动作的其他方面失败了。


### get

获取对象的某个属性值可以用中括号，也可以用 `Reflect.get`：

```js
foo[property]
Reflect.get(foo, property)
```

这种操作可能会顺着原型链向上查找，也可能遇到存取器属性抛出错误。

get 的签名是这样的：

```js
const proxy = new Proxy(origin, {
    get(target, p, receiver) {
        return Reflect.get(target, p, receiver);
    },
});
```

p 是字符串或者 Symbol 类型，而 receiver 参数映射的是 Reflect.get 中的第 3 个参数，这个我们在上一章已经讲过了。

通过 get，我们可以任意篡改对象的属性值，甚至伪造出不存在的属性。比如为了防止调用到不存在的函数导致报错，我们可以这样：

```js
const proxy = new Proxy(origin, {
    get(target, p, receiver) {
        if ('string' === typeof p && p.startsWith('on')) {
            if (/...not exist/) {
                return function() {
                    console.warn(`${p} does not exist.`)
                };
            }
        }
        return Reflect.get(target, p, receiver);
    },
});
```

get 有两条不变量：

1. **如果目标对象有不可配置且不可写的属性 a，那么代理对象在用 get 取值 a 时必须返回和目标对象相同值**；
2. **如果目标对象的属性 a 是不可配置的，且是缺少 get 的存取类型，那么代理在用 get 取值 a 时必须返回 undefined**。

我们写两个违反不变量的案例：

```js
const origin = Object.create(Object.prototype, {
    name: {
        value: 'Mike',
        configurable: false,
        writable: false,
    }
});

const proxy = new Proxy(origin, {
    get(target, p, receiver) {
        if ('name' === p) {
            return 'Kate';
        }
        return Reflect.get(target, p, receiver);
    }
});

proxy.name; // ❌ TypeError: 'get' on proxy: property 'name' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected 'Mike' but got 'Kate')
```

上面案例的初衷是保证对象获取这种特殊属性的幂等性，即获取 N 次，都应该取得相同的值。


```js
const origin = Object.create(Object.prototype, {
    name: {
        set() {},
        configurable: false,
        writable: false,
    }
});

const proxy = new Proxy(origin, {
    get(target, p, receiver) {
        if ('name' === p) {
            return 'Kate';
        }
        return Reflect.get(target, p, receiver);
    }
});

proxy.name; // ❌ TypeError: Invalid property descriptor. Cannot both specify accessors and a value or writable attribute, #<Object>
```

其实和上面的案例是意义相似的。


### set

set 和 get 是一对，它作用于中括号和 `Reflect.set`。我们也能大致推测出类似的不变量：

1. **如果目标对象有不可配置且不可写的属性 a，那么代理对象就不能用 set 给 a 设置不同的值**；
2. **如果目标对象的属性 a 是不可配置的，且是缺少 set 的存取类型，那么代理在用 set 设值 a 时必须返回 false**。

注意第一条不变量，**不可以设置不同的值，不是不可以赋值**，因此下面这样的代码是可以正常工作的：

```js
const origin = Object.create(Object.prototype, {
    name: {
        value: 'Mike',
        configurable: false,
        writable: false,
    }
});

const proxy = new Proxy(origin, {
    set(target, p, receiver) {
        if ('name' === p) {
            return true;
        }
        return Reflect.set(target, p, receiver);
    }
});

proxy.name = 'Mike'; // ✅ 
```

但这样却不可以：

```js
proxy.name = 'Kate'; // ❌ TypeError: 'set' on proxy: trap returned truish for property 'name' which exists in the proxy target as a non-configurable and non-writable data property with a different value
```

### deleteProperty

当使用 `delete` 操作符或者 `Reflect.deleteProperty` 时，会调用此函数，得到是否成功删除的布尔值。

它的不变量是：

1. **如果目标对象上的属性 a 是不可配置的，那么不可以返回 true**；
2. **如果目标对象是不可扩展的且存在属性 a，那么不可以返回 true**。

第一条的合理性是显然的，不可配置自然就不能删除。第二条不变量是从 ES2020 开始加上去的，感兴趣的同学可以去看 [tc39/ecma262#262](https://github.com/tc39/ecma262/pull/666) 这个 PR，以及 [esdiscuss](https://esdiscuss.org/topic/object-freezing-proxies-should-freeze-or-throw#content-12) 上的讨论。我简单解释一下：

```js
const origin = Object.create(Object.prototype, {
    name: {
        value: 'Mike',
        configurable: true,
        writable: false,
        enumerable: true
    }
});

Reflect.preventExtensions(origin);

const proxy = new Proxy(origin, {
    deleteProperty(target, p, receiver) {
        if ('name' === p) {
            return true;
        }
        return Reflect.set(target, p, receiver);
    }
});

delete proxy.name;

console.log(proxy.hasOwnProperty('name')); // true
```

如果 proxy 上的 name 被“成功删除”，但是 proxy 又是不可扩展的，检查发现 name 仍然在，那么就可以假设 name 又被增加上来了，显然违反不可扩展的特性。


### ownKeys

之前我们提到过对象会有一个内部的 `[[OwnPropertyKeys]]` 属性，记录了其全部 key，而且只有 `Reflect.ownKeys` 会获取到它的完整值。handler 中的 ownKeys 就发挥了 `[[OwnPropertyKeys]]` 的作用。

它的不变量要求会比较复杂：

1. **必须是一个列表，可以是数组或类数组（比如 Arguments）**；
2. **不能含有重复的值**；
3. **成员必须是字符串或 Symbol**；
4. **必须包含目标对象的全部不可配置属性**；
5. **如果目标对象不可扩展，那么必须`且只能`包括目标对象的全部属性**。

> 💡 可见并没有对顺序做出要求。

这几条不变量都比较容易理解，我重点解释一下后两条。

第 4 条，不可配置的属性意味着不可删除（缺失）：

```js
const origin = Object.create(Object.prototype, {
    name: {
        value: 'Mike',
        configurable: false,
        writable: false,
        enumerable: true
    },
    age: {
        value: 16,
        configurable: true,
        writable: false,
        enumerable: true
    }
});

const proxy = new Proxy(origin, {
    ownKeys() {
        return ['age'];
    }
});

Object.keys(proxy); // ❌ TypeError: 'ownKeys' on proxy: trap result did not include 'name'
```

第 5 条，不可扩展的对象，既不能多出属性（违背不可扩展的特性），也不能少出属性（前面解释过，相当于反向增加属性）：

```js
const origin = Object.create(Object.prototype, {
    name: {
        value: 'Mike',
        configurable: true,
        writable: false,
        enumerable: true
    },
});

Reflect.preventExtensions(origin);

const proxy = new Proxy(origin, {
    ownKeys() {
        return ['age'];
    }
});

Object.keys(proxy); // ❌ TypeError: 'ownKeys' on proxy: trap result did not include 'name'
```


### getOwnPropertyDescriptor

`getOwnPropertyDescriptor` 作用于 `Object.getOwnPropertyDescriptor` 和 `Reflect.getOwnPropertyDescriptor`，返回指定的属性描述符。

Proxy 对象返回的属性描述符，会受到目标对象的很大影响，我们来看 `getOwnPropertyDescriptor` 的不变量：

1. **必须返回对象或 undefined，后者意味着属性不存在**；
2. **目标对象中的不可配置属性不可以报告为不存在**，很容易理解，不可配置自然不可删除；
3. **对于不可扩展的目标对象中的属性，不可以报告为不存在**，前面也讲过，不可扩展对象的属性也不可丢失；
4. **如果目标对象是不可扩展的，那么其不存在的属性也不能报告为存在**，自然，不能有新增属性；
5. **目标对象中的不可配置属性，不能报告为可配置的**，否则会引起是否可删除方面的冲突；
6. **如果一个属性想报告为不可配置且不可写的，那么在目标对象中也必须如此**。

解释一下第 6 条，我们看一个反例：

```js
const origin = Object.create(Object.prototype, {
    name: {
        value: 'Mike',
        configurable: false,
        writable: true,
        enumerable: true
    },
});

Reflect.preventExtensions(origin);

const proxy = new Proxy(origin, {
    getOwnPropertyDescriptor(target, p) {
        if ('name' === p) {
            return {
                value: 'Mike',
                configurable: false,
                writable: false,
                enumerable: true
            };
        }
        return Reflect.getOwnPropertyDescriptor(target, p);
    }
});

Object.getOwnPropertyDescriptor(proxy, 'name'); // ❌ TypeError: 'getOwnPropertyDescriptor' on proxy: trap reported non-configurable and writable for property 'name' which is non-configurable, non-writable in the proxy target
```

目标对象的 name 是可写的，我们在 Proxy 报告为不可写的，会有什么后果？

就是 *proxy.name* 不是幂等的，多次获取其值可能会不相同，违背其不可配置、不可写的特性。

### has

`has` 映射的是对象内部中的 `[[HasProperty]]` 属性，在包括 `Reflect.has`、`in` 等很多场景中都有被调用。注意它并不要求属性是对象自身的。

它的不变量是：
1. **对于目标对象中的不可配置属性，不可以报告为不存在**；
2. **如果目标对象不可扩展，对于其属性不可报告为不存在**。

其实它们属于 `getOwnPropertyDescriptor` 不变量的子集，本来 `getOwnPropertyDescriptor` 也属于 `in/Reflect.has` 的子集，所以是可以理解的。


### apply 与 construct

`apply` 和 `construct` 仅对于目标对象是函数的情况有效，否则会抛出错误。平时比较少能接触到，受限于篇幅，我这里就不详细展开了，感兴趣的同学可以进一步了解。





## Proxy 的用武之地

在和我们日常工作最相关的场景中，Proxy 更多应用于数据的可响应性（`reactive`）改造。众所周知，Vue2 是基于 defineProperty 的，它的弊端是无法捕获新增加的属性，你必须主动调用 *$set* 通知 Vue。而且 Vue2 也无法响应数组的下标操作。

有了 Proxy 加持后的 Vue3 就不一样了，你可以仅仅通过赋值语法，任意为对象增加新属性。我用这一段内容来做个模拟。

声明一个 Vue 类，它有一个 data 参数：

```js
class Vue {
    constructor(options) {
        this.options = Object.assign({
            data: {},
        }, options);
    }
    
    updateDOM() {}
}
```

在类实例的上下文中，声明一个可供业务操作的 data，它必然是一个 Proxy 对象：

```js
class Vue {
    get data() {
        if (this.#data) return this.#data;
        
        this.#data = new Proxy(this.options.data, {
            defineProperty: (target, p, desc) => {
                const ret = Reflect.defineProperty(target, p, desc);
                this.updateDOM();
                return ret;
            },
            set: (target, p, v) => {
                const ret = Reflect.set(target, p, v);
                this.updateDOM();
                return ret;
            },
            deleteProperty: (target, p) => {
                const ret = Reflect.deleteProperty(target, p);
                this.updateDOM();
                return ret;
            },
        });
        
        return this.#data;
    }
}
```

对数据的修改无非就上面 3 种，我们用 Proxy 都能捕获得到，去触发视图更新即可。在视图中，可以依然使用 *options.data* 做渲染。

当然这只支持最顶层属性变动，如果你想实现像 *store.person.name =* 的这种多级结构，也得需要把数据每一层都转换为 Proxy 对象才行。



## 小结

本章我们简要过了一遍 Proxy 的 API，其中的内容还是不容易理解的。大家可以看到，正确运用 Proxy 就要遵循如此之多的`不变量`法则。这些不变量该如何记忆呢？

死记硬背是不可能了，太多了，而且我要强调的是，即便是 ECMAScript 规范也不一定能保证这些不变量的健壮性，未来不排除继续增加新条目的可能性。

我总结的一条经验是：**handler 中没有声明的函数（即 trap），都意味着操作会同步到目标对象上。你定义 handler 的原则，是要保证目标对象和 Proxy 对象独立操作后，它们各自的特性不违反基本的对象法则，如可扩展性、可写性、可配置性**。从这个角度来理解和消化不变量，应该会对你有所帮助。

不变量的存在从另一个角度决定了`我们并不能为所欲为地控制 Proxy 的行为`，还是要遵循基本的客观规律，但这不影响 Proxy 非常强大的这一事实，我们提到了用其实现数据的可响应性，在包括 Vue 在内的很多视图框架中有关键性应用。但不仅限于此，在后面的应用篇中，我还会重新启用 Proxy，来实现一个更复杂的功能。
