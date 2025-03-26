## 什么是反射

反射是一种在运行时检查、访问和修改类、属性、方法和接口的能力，有点类似于从“上帝视角”来操控万物。过去在静态语言如 Java、C# 中会有独特的作用。

ECMAScript 从 ES5 开始引入属性描述符后，事实上已经带有一些体现反射能力的 API 了，比如 `Object.getPrototypeOf/getOwnPropertyDescriptor/getOwnPropertyNames/defineProperty`等等。但是还不够体系化，功能也还不足。

因此 ES6 引入了对标其它语言的独立反射模块，称之为 `Reflect API`。事实上我们能够发现，Reflect 的好多方法都在 Object 上有同名的实现，功能基本相同，但是在结果上有细微差别。

本章，我们就来熟悉 Reflect 的关键能力，拓展操作对象的高级方法。

## Reflect 的功能

Refect 类似于 Math 和 JSON，是全局上下文中的一个对象。它的 `[Symbol.toStringTag]` 是 “Relfect”，即：

```js
`${Reflect}` === "[object Reflect]"
```

它囊括了一系列的对象访问方法，虽然之前有替代写法，但是 Reflect 让这些操作都聚合在一个命名空间之下。

我将 Reflect 的功能简单划分成几类。

### 函数调用

`Reflect.apply` 方法用于主动调用一个函数，事实上它和 `Function.prototype.apply` 没有什么不同：

 以下两行代码是等价的：
```js
Reflect.apply(fnObj, context, args)
fnObj.apply(context, args)
```

如果非要较真儿的话，那么后者也可能是个自定义对象在调用自定义的 apply 函数。比如：

```js
var fakeFn = {
    call() {},
    apply() {},
};

fakefn.apply(...)
```

从这一点上来说，Reflect.apply 似乎更保险一些。

### 对象创建

`Reflect.construct` 方法可以使用一个构造函数来创建对象，它的非范型版本的 TypeScript 定义是：

```ts
function construct(target: Function, argumentsList: ArrayLike<any>, newTarget?: Function): any;
```

当我们写 **Reflect.construct(Foo, [1, 2, 3])** 的时候，就相当于在写 **new Foo(1, 2, 3)**。但是，第三个参数 `newTarget` 是做什么的呢？

要解释这个参数，我们需要先回到关键字 `super` 上。在前面的基础篇中，我们讲到过 class 继承，但是没有详细探讨 super 的原理。

在构造函数中，它指向基类的构造函数，是必需的一个执行环节。那么它到底做了什么呢？

以下面这个简单的类继承为例：

```js
class Bar {
    constructor(name) {
        this.name = name;
    }
}

class Foo extends Bar {
    constructor(name, age) {
        super(name);
        this.age = age;
    }
}
```

依照我们之前学习到的 `class`、`new` 相关知识，上面代码的执行原理大致是这样的：

> 💡 看不懂的同学可以复习基础篇的相关内容。

```js
// Foo extends Bar
Foo.prototype = Object.create(Bar.prototype, {
    constructor: {
        value: Foo,
        // ...
    },
    // ...
});

// new Foo()
function newFoo(name, age) {
    const foo = Object.create(Foo.prototype);
    Bar.apply(foo, [name]);

    foo.age = age;

    reutrn foo;
}
```

注意看 *newFoo* 的前两行代码：

```js
const foo = Object.create(Foo.prototype);
Bar.apply(foo, [name]);
```

功能是以 Foo 为原型创建对象，并以此为上下文执行 Bar。我们抽象成一个函数：

```js
function Construct(F, args, newTarget) {
    const obj = Object.create(newTarget.prototype);
    F.apply(obj, [name]);
    return obj;
}
```

这就关键字 `super` 在构造函数中的逻辑，同时也是 ECMAScript 内部函数 `Construct` 的功能，如果你还记得我们在函数那一章的讨论，应该知道构造函数本身有一个 `[[Contruct]]` 属性，它的默认实现就是上面的代码。严格来说应该是 `Construct` 调用了 `[[Construct]]`。

讲到这就豁然开朗了，`Reflect.construct` 几乎就等价于 `Construct`。在没有第三个参数 `newTarget` 的情况下，就和 `new` 操作符的功能就完全一致。我们日常使用最多的还是只有前两个参数的情况。

### 属性读写

属性的读写分为**描述符的读写**和**值的读写**，也包括**删除属性**。

`Reflect.defineProperty` 和 `Object.defineProperty` 的签名完全一致，功能也相同，都是调用对象内部的 `[[DefineOwnProperty]]` 方法，只不过在异常情况的反馈上有所差异。前者返回执行的布尔结果，如果失败则返回 false，而后者会抛出异常。

我们可以这样认为：

```js
Object.defineProperty = function(...args) {
    if (!Reflect.defineProperty(...args)) {
        throw TypeError();
    }

    return args[0]
}
```

注意，`Reflect 没有提供 defineProperties 方法`，因为一个布尔值无法反应所有属性的操作结果，很有可能有的属性操作成功，有的则失败。

`Reflect.getOwnPropertyDescriptor` 和 `Object.getOwnPropertyDescriptor` 也是近似的。区别在于如果第一个参数不是对象的情况下，前者会抛出 TypeError，而后者会将其转换为对象：

```js
Object.getOwnPropertyDescriptor('abc', 'length'); // ✅ { value: 3, writable: false, enumerable: false, configurable: false }
Reflect.getOwnPropertyDescriptor('abc', 'length'); // ❌ TypeError
```

因此 `Object.getOwnPropertyDescriptor` 只有遇到 null 和 undefined 时才会报错。

`Reflect 也没有提供 getOwnPropertyDescriptors 方法`。

我们认为原型也是广义上的属性。Reflect 也提供了 `getPrototypeOf` 和 `setPrototypeOf` 方法。

`Reflect.getPrototypeOf` 和 `Object.getPrototypeOf` 的区别，与 getOwnPropertyDescriptor 是一致的，也是遇到非对象时，前者报错，后者用 `ToObject` 主动转换为对象。

`Reflect.setPrototypeOf` 和 `Object.setPrototypeOf` 的区别除了上面这种之外，还有就是前者返回布尔值，而后者返回第一个参数本身，在失败的时候，也会抛出 TypeError。

总结一下上面这几个和 Object 有同名函数的实现，它们的特点是`用返回布尔值来代替抛出异常，但是在对象类型上的判断更严格`。

接下来看两个独特的方法，`Reflect.get` 和 `Reflect.set`。

*Reflect.get(O, p)* 等价于 *O\[p]*，也会顺着原型链进行属性查找。但是 `Reflect.get` 还支持第三个参数，它的 TypeScript 签名是这样的：

```ts
function get<T extends object, P extends PropertyKey>(
    target: T,
    propertyKey: P,
    receiver?: unknown,
): P extends keyof T ? T[P] : any;
```

那么这个可选的 **receiver** 是什么呢？用以下代码就能解释清楚：

```js
const O = Object.create(null, {
    name: {
        get: function() {
            return this.name; // this 即 receiver，默认为 O
        }
    }
});

Reflect.get(O, 'name', { name: 'Mike' }); // "Mike"
```

当要获取的属性是一个存取器属性时，不管是在对象本身还是在原型链上，`描述符中的 get 函数上下文就指向 receiver`。默认地，该函数上下文指向对象本身，即 O。

同样地，`Reflect.set(target, propertyKey, V [, receiver])` 最后一个参数也是如此之用。

> 💡 再强调一遍之前讲过的一个知识点，set 操作只要当遇到存取器时，才会影响到原型链上，否则会在对象上创建新的数据属性。


对于删除属性的诉求，之前用 `delete` 操作符，现在我们有一个更安全的版本——`Reflect.deleteProperty`。为什么说它安全，因为和上面一样，它也不会报错，只会返回一个操作结果的布尔值：

```js
"use strict";
var a = 1;

delete a // ❌ SyntaxError

Reflect.deleteProperty(globalThis, 'a'); // false
```

### 对象访问

判断一个属性有没有存在于一个对象上，有一个条件是**要不要考虑原型链**。

如果不考虑，那么应该使用 `Object.prototype.hasOwnProperty` 或者 `Object.hasOwn`。注意，如果这两种方法的主角不是对象，那么会用 `ToObject` 转换为对象。

如果考虑原型链，那么应该使用 `in` 操作符。现在我们有了一个新选择——`Reflect.has`：

```js
Reflect.has(obj, 'name')
```

这两种方法是完全一致的。`Reflect.has` 以语义更明确的方式实现了此功能。

如果要遍历对象的 key，我们在之前的章节中提到过使用 `Object.getOwnPropertyNames/getOwnPropertySymbols/getOwnPropertyDescriptors`，不过都有这样或者那样的限制，最能反应内部 `[[OwnPropertyKeys]]` 数据的，只能是 `Reflect.ownKeys`。

`Reflect.ownKeys` 不像 Object 的那些方法会自动转换参数为对象类型，它会抛出 TypeError：

```js
Reflect.ownKeys("abc") // ❌ TypeError: Reflect.ownKeys called on non-object
```

最后就是 `Reflect.preventExtensions` 与 `Reflect.isExtensible` 了，它们与 Object 上的同名方法之间的差异依旧是对待非对象类型上面，Reflect 会更严格。

我们看到，Reflect 没有提供 seal/isSealed 和 freeze/isFrozen 方法。它们更偏向于对属性的操作，只存在于 Object 对象上。



## Reflect 与元编程

元编程（*Meta Programming*），指的是在运行时操作和分析代码自身的行为。反射是元编程的关键组成部分，但不是全部。广义上来说，typeof、instanceof、Object.keys、Object.getOwnPropertyNames，以及我们即将要学习的 Proxy 等等这些操作都是元编程概念的一部分。

元编程并非像有的同学认为的那样，只有底层框架才会涉及到，而是在业务的方方面面都发挥着重要作用，我下面就列举 1 个我们常见的场景——对象克隆（复制）。

### 对象复制

严格来说，任意对象的完全深度复制是不可能实现的。这不仅仅是技术问题，更是哲学问题，比如一个对象持有了 window 的句柄，你说我们复制它还是不复制。话题放小一点，用一个 DOM 节点替代 window，如果你真的复制了它，但能复制它的上下文环境吗？

先不管这种哲学问题，在实际的开发活动中，总有一些降级场景需要用到克隆，甚至深度克隆。我们之前在 JSON 那一章讲到过有人用先序列化再解析的方式深克隆一个对象：

```js
var cloned = JSON.parse(JSON.stringify(origin));
```

显然这样不但受到 JSON 支持格式的限制，也会明显丢失掉对象以及其属性的特征，比如对象是否可扩展、属性是数据类型还是存取器类型，还有不可枚举属性、原型链属性的丢失。

因此，克隆不是不能实现，只是需要舍弃掉相当的信息量，也就是需要明确定义克隆的具体规则。

我们先把变量定义出来：
1. **cloneNonEnum**：是否克隆不可枚举的属性；
2. **cloneSymbol**：是否克隆 Symbol 属性；
3. **keepPropDesc**：是否保留属性描述符类型；
4. **keepPrototype**：是否保留原型链；
5. **keepExtensible**：是否保留可扩展信息。

单单是这几个条件的排列组合就能得到几十种不同的克隆方案，用哪个取决于你的需求，我们这里主要来看元编程是如何发挥功用的。

声明一个“万能”克隆函数：

```js
function clone(origin, options = {}) {}
```

假设入参就是一个对象（非 Primitive），那么第一件事就是遍历其属性，根据选项来选择遍历方法：

```js
function clone(origin, options = {}) {
    const { cloneNonEnum, cloneSymbol } = options;
    let keys;
    if (cloneNonEnum && cloneSymbol) {
        keys = Reflect.ownKeys(origin);
    } else if (cloneNonEnum && !cloneSymbol) {
        keys = Object.getOwnPropertyNames(origin);
    } else if (!cloneNonEnum && !cloneSymbol) {
        keys = Object.keys(origin);
    } else /* !cloneNonEnum && cloneSymbol */ {
        keys = Reflect.ownKeys(origin).filter(key => Object.propertyIsEnumerable(origin, key));
    }
}
```

根据是否可枚举，以及是否需要 Symbol 属性，我们可以枚举出 4 种采集属性 key 的方法，只有最后一种没有现成的方法，我们稍微变通了一下，用到了 `Object.propertyIsEnumerable`。这个方法我们之前没有提到，它也算做是元编程中的一种简化手段，相当于 **Reflect.getOwnPropertyDescriptor(obj, key)?.enumerable ?? false**。

其实，严格来说，我们可以把 Object.getOwnPropertyNames 和 Object.keys 都当作 `Reflect.ownKeys` 的子集，那么上面的代码就变成了：

```js
function clone(origin, options = {}) {
    const { cloneNonEnum, cloneSymbol } = options;
    let keys;
    if (cloneNonEnum && cloneSymbol) {
        keys = Reflect.ownKeys(origin);
    } else if (cloneNonEnum && !cloneSymbol) {
        keys = Reflect.ownKeys(origin).filter(key => 'string' === typeof key);
    } else if (!cloneNonEnum && !cloneSymbol) {
        keys = Reflect.ownKeys(origin).filter(key => 'string' === typeof key && Object.propertyIsEnumerable(origin, key));
    } else /* !cloneNonEnum && cloneSymbol */ {
        keys = Reflect.ownKeys(origin).filter(key => Object.propertyIsEnumerable(origin, key));
    }
}
```

接下来，我们来拷贝属性，根据是否保留属性描述符，我们有两种操作：

```js
const cloned = {};

if (options.keepPropDesc) {
    for (const key of keys) {
        const desc = Reflect.getOwnPropertyDescriptor(origin, key);
        Reflect.defineProperty(cloned, key, desc);
    }
} else {
    for (const key of keys) {
        Reflect.set(cloned, key, Reflect.get(origin, key));
    }
}
```

然后看原型链和可扩展性：

```js
if (options.keepPrototype) {
    Reflect.setPrototypeOf(cloned, Reflect.getPrototypeOf(origin));
}

if (options.keepExtensible && !Reflect.isExtensible(origin)) {
    Reflect.preventExtensions(cloned);
}
```

到此为止，我们完全用 Reflect 就实现了一个比较完备的、功能可调的克隆函数。但是它还只能实现浅克隆，给大家留一个练习题吧，把这个函数改写成深克隆，看看还需要哪些知识。

> 💡 注意不同类型数据的判断。

对象的克隆在很多场景中有重要应用，比如作为状态来驱动 DOM 视图时，很多人用过的 *immutable.js* 的核心原则就是数据变更会触发数据复制出新的副本。


## 小结

总体来说，Reflect API 做出了两方面的贡献，一是将一些对象的“元编程”操作归拢到了同一个命名空间之下，方便使用；二是提供了之前不具备或者不方便使用的能力，比如 `Reflect.ownKeys`。

Reflect 和 Object 有很多静态方法是同名的，差别也只体现在两方面：
1. 对传入非对象的处理态度不同；
2. 返回值（报错方式） 不同。

Reflect 总返回布尔值的这种特性，并非头脑一热的设计，它的最大用武之地，其实是 `Proxy`。没有 Reflect， Proxy 的实现会非常繁琐，我们下一章就来聊聊 Proxy，这一实现数据可观测性的最大功臣。

