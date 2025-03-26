## 什么是 strict 模式

说到 `strict` 模式，估计有不少同学，特别是刚刚接触前端的同学会比较陌生，但应该都见过很多 .js 文件前面的 `"use strict";` 字样。

JavaScript 是一门宽松的语言，它允许开发者在编写代码时存在一些不规范的行为。然而，这种宽松性也可能导致一些潜在的问题。为了解决这些问题，`ES5` 引入了 strict 模式。

它是一种执行模式，通过限制某些不规范的行为来提供更严格的错误检查。在该模式下，一些不规范的语法和行为将直接抛出异常，从而迫使代码更加规范和可靠。

strict 模式可以应用在整个脚本文件中，也可以仅应用于特定的函数。要在整个脚本文件中启用 strict 模式，可以在文件的开头添加如下语句：

```js
"use strict";
```

要在特定的函数中启用 strict 模式，可以在函数体的开头添加相同的语句。

有时候，strict 会继承，因此，不包含此语句的函数，同样可能由于引入关系的不同，既可能运行在 strict 模式下也可能运行在非 strict 模式下，称之为 `non-strict`。

接下来，我带大家简单感受一下 strict 模式对我们日常开发都有哪些影响。strict 报错异常的地方，一般来说也是我们应该优化或改进代码的地方。




## strict 模式带来哪些影响

非常多，依照 ECMAScript 举几个典型的案例。


### 禁止对未声明的变量赋值

在 strict 模式下，所有的变量都必须先声明后使用。如果使用未声明的变量，将会抛出一个 `ReferenceError`。这有助于避免因为拼写错误或者意外的全局变量污染而导致的错误。

```js
nonDeclaredVar = 1;
```

以上代码，无论在函数内外，如果是 non-strict 模式，那么就会在全局对象上（下文会讲到）定义一个变量，即：

```js
globalThis.nonDeclaredVar === 1 // true
```

这显然是不希望的一种副作用，万一重名，你一个不小心忘记用 var、let、const 声明本地变量了，那就会覆盖全局的那一个。

在 strict 模式下，这样的代码会抛出 `ReferenceError`。当然，如今的工具链也能够轻而易举地在代码的静态分析阶段就发现问题，比如 TypeScript 的 **TS2304** 错误。

### 禁止对不可写属性赋值

关联我们之前学习过的属性结构的知识，这里的不可写属性是指属性描述符为数据类型，其中 `writable=false`，或者为存取器类型，其中 `set=undefined`。

按理说对这种属性赋值是不被允许的，不过在 non-strict 模式下是静默失败的，你可以是试试运行下列代码：

```js
const p = Object.create(null, {
    name: {
        writable: false,
    },
    age: {
        get() {},
    },
});

p.name = 'Jake';
p.age = 16;
```

接下来，在最前面添加一行 `"use strict";`，就会抛出 `TypeError` 错误：

```
❌ TypeError: Cannot assign to read only property 'name' of object '[object Object]'
```

与之类似的还有一条：**禁止对不可扩展、密封或冻结对象新增属性**。在 non-strict 模式下也是静默失败的：

```js
const p = Object.preventExtensions({});
// const p = Object.seal({});
// const p = Object.freeze({});

p.name = 'Jake';
```

### 禁止删除变量、函数和函数参数 

在 strict 模式下，使用 delete 操作符删除变量、函数和函数参数将会抛出一个 `SyntaxError`。这样可以避免意外删除重要的代码片段。

```js
var foo;

function bar() {}

function baz() {
    delete arguments;
}

delete foo;
delete bar;
baz();
```

相信正常情况下没有人会真的需要上面的这种效果，strict 模式的功能是防止误操作。当然，即便在 non-strict 模式下，这些变量也是无法真正被删除的。

与之相近的还有**删除不可配置的属性**：

```js
const p = Object.create(null, {
    name: {
        configurable: false,
    }
});

delete p.name;
```

以及尝试**删除密封对象或冻结对象中的属性**：

```js

const p = Object.seal({ name: 'jake' });
// const p = Object.freeze({ name: 'jake' });

delete p.name;
```


### 禁止重复的函数参数名

在 strict 模式下，函数的参数名必须是唯一的。如果出现重复的参数名，将会抛出一个 `SyntaxError`。这有助于避免因为参数名重复而导致的混淆和错误。

```js
function Person(name, name, age) {}
```

在 non-strict 下，上面的代码完全是可以运行的，只不过第二个 *name* 会覆盖第一个。无论如何，这是不合理的，因此在 strict 模式下，上面代码会抛出错误，而且是一个**早期错误**，即不需要等到运行此函数。

由此我们也可以试一试利用 `Function` 动态创建函数：


```js
const fn = Function("name, name", "return name");
fn("Mike", "Jake"); // "Jake"
```

其效果也完全符合直接声明函数。


### 禁止使用八进制字面量

在 strict 模式下，八进制字面量将会抛出一个 `SyntaxError`。这是因为八进制字面量在 JavaScript 中容易引起混淆，不利于代码的可读性和维护性。

八进制有两种表示方法，旧的方式就是前面加一个 0。但前面有 0 不一定就是八进制，也可以是十进制：

```js
console.log(071, 078); // 57 78
```

这显然会让你非常困惑，所以新的八进制表示就是以 `0o` 为前缀，与二进制的 `0b` 和十六进制的 `0x` 形式上统一。

```js
console.log(0o71);
```

于是旧版的八进制就被 strict 模式所禁止。


### 禁止使用 this 关键字指向全局对象

如果在函数内部使用 this 关键字，且没有通过对象或者构造函数调用该函数，this 会指向全局对象，即 `globalThis`，在浏览器下是 window，在 Node.js 下是 global：

```js
function foo() {
    console.log(`this in foo`, this); // window
}

function bar() {
    console.log(`this in bar`, this); // window
    foo();
}

function baz() {
    console.log(`this in baz`, this); // window
    bar();
}

baz();
```

在 strict 模式下，函数内部的 this 关键字将会是 undefined。这有助于避免在函数内部意外地访问和修改全局对象。

### 禁止在当前上下文创建新变量

在 non-strict 模式下，你可以通过 `eval("var newVariable")` 的方式在当前上下文创建新变量，并且可以被后续代码使用：

```js
eval(`var foo = 1`);
console.log(foo); // 1
```

这显然非常危险，因此 strict 模式对此加以禁止，它会创建一个新的变量环境。可以联想我们之前讲到过的环境记录。


### 禁止使用 with 语句

之前我们在涉及 with 语句的时候，基本都直接略过，没有详细探讨，就是因为它作为被 strict 明令禁止的写法，我们日常很难真正用得上。

之所以禁用它，关键考虑因素并非性能损失，而是它带来的难以预测的变量访问。如果 with 的参数对象发生属性变化，那么其内部的代码在两次访问同一变量名时，很可能访问的不是一个。

```js
const name = 'Mike';

const origin = {};

with (origin) {
    console.log(name); // "Mike"
    origin.name = 'Jake';
    console.log(name); // "Jake"
}
```

> 💡 从这里可以联想到，专为 with 而设计的 `Symbol.unscopables` 用武之地也不大。


### 一些变量名受到限制

在 non-strict 模式下，implements、interface、let、package、private、protected、public、static、yield 都可以当作变量名，是不是很意外？特别是 let、static、yield 明显是在用的关键字，怎么会被用作变量名？

类似的还有 eval、arguments。在 strict 模式下，这些名字通通不可以当作变量名。当然，除非不小心，一般谁也不至于词穷到非要用它们作变量名。



还有一些其他的 strict 案例，不过平时极难遇到，我就不讲了。总体来说，strict 模式在尽量帮助我们规避掉可能引起歧义的写法，降低程序复杂度。因此，**除非特殊情况，我们应始终开启 strict 模式**。

事实上，在很多场景下，strict 是自动开启的。




## 不同场合下的 strict 状态

不是一定需要声明 `"use strict";` 才能开启 strict 模式。我们来看以下这些情况。

### ESM 下一定是 strict 模式

包括内链和外链，只要是 Module 环境，就强制开启 strict 模式。在这种文件中写出上诉违反 strict 的代码是不可能的。


### class 代码一定是 strict 模式

class 是特殊的函数，显然它还相当于在函数体内强制声明了 `"use strict";` 语句。观察下面的代码，不同位置，对声明特殊变量 *eval* 的态度是不同的：

```js
const eval = 1; // ✅

class Foo {
    constructor() {
        var eval = 2; // ❌ SyntaxError: Unexpected eval or arguments in strict mode
    }
}
```

### eval 取决于参数和方式

如果 eval 的参数代码开始于 `"use strict";` 语句，那么自然就开启了 strict 模式。否则的话，取决于环境和调用方式。

一般情况下，eval 的代码会继承 eval 所在的环境，即如果 eval 在 non-strict 模式下调用，那么其代码也运行在 non-strict 模式下；如果 eval 在 strict 模式下调用，那么其代码默认也运行在 strict 模式下。

有个例外，**如果在 eval 以非直接方式调用，那么即便其处于 strict 环境下，代码也会以 non-strict 模式运行**。

什么叫做非直接方式调用？这其实对于 eval 来说并不陌生，事实上它还有另一个重要的特性，即**非直接调用总会在全局环境下运行**。这对于很多场景来说非常重要，因为这样会排除了运行环境的变量上下文对于代码执行结果的干扰和影响。

言归正传，将 eval 转换为间接的表达式计算结果的方式，即非直接调用，最经典的莫过于：

```js
(0, eval)(code);
```

其实，下面这些方式都可以当作是非直接调用，效果相同：

```js
[0,eval][1](code);

let myEval = eval; myEval("var eval=1");

(() => eval)()(code);
```

理论上来说，非直接调用有无数种写法，只不过尤以 `(0, eval)` 方式最简单，因此应用最广泛。

于是，为保证代码能够运行在 strict 模式下，eval 的非直接调用下最好还是加上 `"use strict";` 语句。


注意，用 `Function` 动态创建函数则非常纯粹，没有直接间接之分，也不管当前环境，只要函数体没有以 `"use strict";` 语句开头的，则都属于 non-strict 模式。

### 函数取决于环境和自身代码

如果函数没有声明 `"use strict";` 语句，那么它会继承所处的环境的 strict 状态。在特殊的情况下，代码本身可能并不知道它运行时是 strict 还是 non-strict，比如下面的代码：

```js
var eval = 1;
```

如果在 HTML 中以普通 &lt;script&gt; 的方式引入，它就是 non-strict 的：

```js
<script src="./foo.js"></script>
```

而如果以 ESM 的方式引入，它就是 strict 的：

```js
<script type="module" src="./foo.js"></script>
```

注意，这种未知性并不是意味着一个函数，由于被调用栈的不同，可能运行在两种模式下。一段代码是 strict 还是 non-strict，在代码解释阶段已经确定好了，不可能再行更改。你可以认为这是静态分析得到的。

> 💡 有同学可能会想到这样一个极端的例子，假如真的有如下代码：
> 
> ```js
> <script src="./foo.js"></script>
> <script type="module" src="./foo.js"></script>
> ```
> 那事实上这个 *foo.js* 会被当作两个文件分别独立加载和解释。

当然，上面提到的“**代码本身可能并不知道它运行时是 strict 还是 non-strict**”这句话仅存在于理论之中，在实际的生产环境中，基本都会强制声明 `"use strict";` 语句，或者压根就是 ESM。




## 小结

本文带大家简要了解了 strict 模式，它禁止了哪些写法，在什么情况下会被开启等等。应该说 strict 是规范和引擎层面提供的最底层的**编码最佳实践**，我们平时用的 eslint、prettier 等社区工具都要更严格，但它们也只能作用于静态分析阶段，而 strict 能够在运行时做出检查。

为了代码的健壮性和可维护性，我们应始终开启 strict 模式，相信大家如果使用的是社区的打包工具，最终产物一定都是 strict 模式的，不妨看看文件的开始。
