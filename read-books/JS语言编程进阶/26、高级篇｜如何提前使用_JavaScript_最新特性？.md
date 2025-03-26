我们在高级篇中先后了解了 JavaScript 中的模块化、事件循环、strict 模式以及全局对象这些语言和环境特征，但讲得再多，可能也赶不上 ECMAScript 规范新增特性（*features*）的速度。

现在我就用高级篇的最后一文，和大家聊聊最近 ECMAScript 的新特性，以及如何提前享受它们带来的便利。


## ECMAScript 新特性的引入方式

和很多其他语言一样，现代的 JavaScript 语言的发展很大程度上是受到社区的推动，最终由 `TC39` 委员会负责提案的一步步评审和投票。TC39 委员会是 `ECMA` 下辖的一个组织。虽然可能大家对 ECMA 的认识都是从 ECMAScript 开始的，但是 ECMA 并非只有 ECMAScript。不同项目的组织也不同，除了 TC39 以外还有 TC45、TC52 等等，只不过 TC39 负责的 ECMAScript（即 `ECMA262`） 最为重量级。

任何人都可以为 ECMAScript 建议新的特性，TC39 接纳新特性的过程分为五个阶段：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0bcd6683ea0d42059cb3a77d868d48fb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=3684&h=1364&e=png&b=f6f5f5" alt="image.png"  /></p>

从时间上来看，TC39 的工作又可能分成 5 个阶段，每年：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/33945130c78b435ea4638b87a721a083~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=3116&h=1084&e=png&b=fcf8f8" alt="image.png"  /></p>

所以很明显，每年的 7 月份我们就能拿到最新版本的 ECMAScript 规范。

当然，以上流程是 ES2016（即 ES7） 开始的，毕竟前一个版本 ES2015 用了 6 （从 ES2009）年才发布，明显太慢。

我写这篇文章的时候，是 2023 年 8 月份，也就是说就在刚刚上个月发布了 ES2023，引入了几个不痛不痒的新特性，比如之前提到过的数组的 *toSorted*、*toSpliced* 等方法，以及 *WeakSet* 支持 Symbol 为 key。

进入 Stage 4 后，基本可以认定就是下一个版本的新特性，甚至在 ECMAScript 发布之前，各家浏览器可能就开始实现了。Stage 3 的特性如果进度快的话，也是很有希望的。那我们不妨看一看明年都会有什么新特性。在借助工具的支持下，甚至现在就可以使用了。



## 值得期待的新特性

各个阶段的提案都可以在 TC39 的 [GitHub](https://github.com/tc39/proposals) 上找到。到目前为止，我看到有 3 个提案进入到 Stage 4，并且计划在 ES2024 发布，分别是：

1. [Well-Formed Unicode Strings](https://github.com/tc39/proposal-is-usv-string)
2. [Atomics.waitAsync](https://github.com/tc39/proposal-atomics-wait-async)
3. [RegExp v flag with set notation + properties of strings](https://github.com/tc39/proposal-regexp-v-flag)


我要特别解释一下第一个提案，它和我们日常使用字符串还是有比较多的关系的，而且也能呼应我在前面讲到的字符串知识。

### Well-Formed Unicode Strings

回忆一下[第 18 讲《错误处理：保持健壮性的护城河》](https://juejin.cn/book/7226969813581889575/section/7231515402608574496)中的内容，由于十六位的码元最多只能表示 0xFFFF 个字符，远远小于 Unicode 的 0～0x10FFFF 范围，因此绝大部分字符在 JavaScript 中都需要两个码元来表示，在 UTF-16 中需要一定的规则，即 `leading surrogate`（范围 *0xD800～0xDBFF*）和 `trailing surrogate`（范围 *0xDC00～0xDFFF*）。这两种字符必须**成对**出现，通过以下公式转换为 Unicode 点位：

```js
const U = (C1 - 0xD800) × 0x400 + (C2 - 0xDC00) + 0x10000;
```

如果它们没有成对出现，这种字符串是无法被解析的，在显示上肯定会出问题，甚至可能引起更严重的错误，称这种字符串是 **`ill-formed`**，反之则是 **`well-formed`**。

上面的提案为字符串带来了两个新方法：`isWellFormed` 和 `toWellFormed`，前者用来做判断，而后者会将字符串中的不成对的 `leading surrogate` 或者 `trailing surrogate` 替换成 *`0xFFFD`*。

**0xFFFD** 是什么？我想大家或多或少都在会某些场合下遇到软件不能正确显示字符的情景，会看到“�”的出现，这就是 0xFFFD，在 Unicode 中叫做 `REPLACEMENT CHARACTER`。

构造一个 *ill-formed* 的字符串试一试：

```js
var str = String.fromCharCode(0x67, 0xd800, 0x1c02) // 'g\uD800ᰂ'

str.isWellFormed() // false

var wf = str.toWellFormed() // 'g�ᰂ'

wf.codePointAt(1) // 0xFFFD
```
如果你的字符串想展示出来，并且不能确保合法性，那么就可以考虑用 `toWellFormed` 转换一下。

这两个方法虽然还没有正式进入 ECMAScript 规范，但是已经被 Chrome（>=111）、Safari（>=16.4）、Firefox（>=118） 所支持了。退一步讲， *core-js*、*es-shims* 等 polyfill 也已准备好。

这是 Stage 4 的，我们再看 Stage 3 的代表，这也是很有希望在最近一两年进入正式标准的重磅特性。



### Decorators

`Decorators` 装饰器语法在有的语言（比如 Java）中叫做 *Annotation（注解）*。虽然它到现在都还没有进入正式标准，但是在生产环境中的使用却已经有了 10 年左右的时间了，这是怎么回事呢？

其实早在 2014、2015 年左右便开有了第一份 Decorators 提案，当时 *babel* 就已经实现了，我还记得当年我使用 [mobx](http://npm.im/mobx) 配合 React 便大量应用了 Decorators 语法。

但是由于各种复杂的原因（主要还是细节太多，各方争议比较大），Decorators 在 2018 年才进入 Stage 2，在 2022 年才进入 Stage 3，后面够经过了数轮修改，才是今天相对比较稳定的状态。这个时候相比于第一版已经有了很大的变化，大家有兴趣可以参考 [babel-plugin-proposal-decorators](https://babeljs.io/docs/babel-plugin-proposal-decorators) 的相关参数，可以感受到这种纠结。


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/76fbf393fe7f4c46929949d06f491318~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=968&h=469&e=png&b=ffffff)

不过使用最新的版本就能应用到最新的规范了。TypeScript 也一样，从版本 5.0 开始支持最新的规范。

虽然不能完全排除将来 Decorators 提案继续发生不兼容变更的可能性，但以现在这个时间点来说，可以认为它比较稳定了，可以在生产环境中使用，只需要关注它后面的更新即可。

那现在我们就花一点时间一窥 Decorators 的魅力，毕竟它也是广大开发者多年来的诉求。

Decorator 本质上是一种修饰函数，修饰对象可以是类的各种成员，包括属性、函数、getter/setter、静态成员，甚至是类本身。Decorator 有能力“篡改”修饰对象的值，达到一种包装的目的，基本语法可以是：

```js
@listener
class Controller {
    @debounce open() {}
}
```

先来看 *debounce* 怎么实现。最新的规范基本统一了各种修饰对象下的 Decorator 函数，它长这样：

```ts
type Decorator = (value: Input, context: {
  kind: string;
  name: string | symbol;
  access: {
    get?(): unknown;
    set?(value: unknown): void;
  };
  private?: boolean;
  static?: boolean;
  addInitializer?(initializer: () => void): void;
}) => Output | void;
```

*value* 是被修饰对象的当前值，*context* 是包含了被修饰对象各种元信息的参数，比如 *kind* 代表被修饰对象的类型，可能的取值有：

-   "class"
-   "method"
-   "getter"
-   "setter"
-   "field"
-   "accessor"

*access* 可以在任意时刻获取或修改被修饰对象的最新值；当修饰私有成员时，*private* 为 true；当修饰静态成员时，*static* 为 true，等等。

最终 Decorator 要返回一个函数，所以 Decorator 本身是一个二阶函数。


```js
import { debounce } from 'lodash';

function debounceDecorator(value, { kind }) {
    if ('method' === kind) {
        return debounce(function (...args) {
            return Reflect.apply(value, this, args);
        });
    }
    // 忽略其他类型
}
```

注意，正常来讲 Decorator 是没有参数的，如果你想达到 *@debounce(500) open() {}* 的效果，那么应当把上面的函数再包装一层，变成三阶。


再来看修饰类本身的 Decorator：

```js
function listener(value, { kind }) {
    if ("class" === kind) {
        return class extends value {
            on(event, fn) {}
            off(event, fn) {}
        };
    }
}
```

无论哪种 Decorator，如果不 return 任何值，那么相当于没有起作用，如果 return 的不是函数，运行时就会抛出异常。

以上只是举了两个简单的例子，Decorators 提案还提供了一个新的访问控制符号：`accessor`，实现对私有属性的自动化 getter/setter 封装，下面两种写法是等价的：

```js
class Animal {
    accessor name;
}

class Animal {
   #name;
  
   get name() {
     return this.#name;
   }

   set name(val) {
     this.#name = val;
   }
}
```

和 Decorators 提案同在 Stage 3 的还有对它的扩展提案，叫做 [Decorator Metadata](https://github.com/tc39/proposal-decorator-metadata)，只是在第二个参数 *context* 增加了一个 `metadata` 自定义对象。



毫无疑问 Decorators 是 Stage 3 中最令人期待的特性，一旦进入 Stage 4，相信 v8 很快就会实现，虽然在浏览器上原生使用还需时日，但可以立即在最新的 Node.js 上使用了。

同在 Stage 3 的还有下述特性，都是我们在前面的课程中有所涉及的。

### Import Attributes 与 JSON Modules

在前面[第 22 节 ESM 一文](https://juejin.cn/book/7226969813581889575/section/7231515561920823299)中我们提到过 *import assertions proposal*，现在改名叫做 [Import Attributes](https://github.com/tc39/proposal-import-attributes)，但旧版本其实已经被实验性实现了。

[JSON Modules](https://github.com/tc39/proposal-json-modules) 是该提案的一部分，未来它的语法应该是这样的：

```js
import json from "./foo.json" with { type: "json" };
import("foo.json", { with: { type: "json" } });
```

可以断定它们会共同进入到下一个阶段。



### Temporal

[Temporal](https://github.com/tc39/proposal-temporal) 是增强的日期 API，相比于 Date 提供了更加丰富的时区、夏令时、非公历、精确解析等能力。

贴几个 Temporal API 的例子，当然，它们还没有被实现：

```js
Temporal.Now.instant()
Temporal.Now.zonedDateTimeISO()
Temporal.TimeZone.from('Africa/Cairo')
Temporal.Calendar.from('iso8601')
```

### Promise.withResolvers

[Promise.withResolvers](https://github.com/tc39/proposal-promise-with-resolvers) 是一个很实用的提案，解决的是 Promise 的 resolve、reject 函数不外露的问题。

比如你有一个异步任务的集合，在某些时刻需要调用其中某个元素的回调。如果用 Promise 描述的话，一般我们会存储 Promise 的 resolve 和 reject 函数，但是这俩函数是 Promise 构造参数的参数，不外露，我们就得写出这样的“丑陋”代码：

```js
let resolve, reject;

new Promise((res, rej) => {
    resolve = res;
    reject = rej;
});
// executor 函数在构造 Promise 时是同步执行的，因此这里立即就能引用到 resolve 和 reject
```

虽然说不是不能用，但毕竟麻烦，ECMAScript 引入的很多特性都是为了更方便地达到需求目的而设计的。`Promise.withResolvers` 就是这样一个：

```js
const { promise, resolve, reject } = Promise.withResolvers();
````

给大家留一个小作业：**自己实现一个 Promise.withResolvers 的 polyfill。**



讲了这么多，大家有没有发现，ECMAScript 的新特性无非可以分成两类：
 - `新的语法`，比如 *Decorstors*、*Import Attributes* 等；
 - `新的 API`，比如 *Temporal*、*Promise.withResolvers* 等。

那通常我们该如何提前享受到这些新特性呢？




## 尝鲜新特性

相当数量的新 API 都是可以利用现有条件来实现的，比如上面提到的 *Temporal*、*Promise.withResolvers*，还有今年刚刚为数组引入的一系列方法（*toSorted*、*toSpliced* 等）。那么这些特性就可以利用 polyfill 来实现，比如著名的 `core-js`、`es-shims`。

> 💡 polyfill 一般针对于新 API，因为语法需要工具直接转译。

polyfill 有不同的使用方法，简单举几个例子。如果用 core-js 的话，那么你可以手动引入它，这种办法会比较麻烦，你得时刻关注你需要哪些 polyfill。

```js
import 'core-js/modules/esnext.array.to-sorted.js';

[].toSorted() // ok
```

因此，我们还是用 babel 吧，它和 core-js 配合得非常好。创建一个源文件：

```js
// src/index.js
class Animal {
    @log
    say() {}
    eat() {
        Promise.any();
    }
}
```

我们使用了 Decorators 语法和 Promise.any。再创建一个 *babel.config.js* 文件：

```js
module.exports = {
    presets: [["@babel/preset-env", {
        useBuiltIns: 'entry',
        corejs: '3',
        modules: false,
        targets: 'Chrome 84'
    }]],
    plugins: [
        ["@babel/plugin-proposal-decorators", { "version": "2023-05" }]
    ]
}
```

安装 babel 相关依赖：

```sh
npm i @babel/cli @babel/core @babel/preset-env @babel/plugin-proposal-decorators core-js@3 -D
```

先来试一试一种粗暴的做法，即为 *Chrome 84* 补充所有可能的 polyfill，需要在 *src/index.js* 前面加上一句 `import "core-js";`，然后执行：

```sh
npx babel src/index.js --out-file dist/out.js
```

看 *dist/out.js* 的内容：

```js
var _dec, _initProto;
function createAddInitializerMethod(e, t) { return function (r) { assertNotFinished(t, "addInitializer"), assertCallable(r, "An initializer"), e.push(r); }; }
function assertInstanceIfPrivate(e, t) { if (!e(t)) throw new TypeError("Attempted to access private element on non-instance"); }
function memberDec(e, t, r, n, a, i, s, o, c, l) { var u; switch (i) { case 1: u = "accessor"; break; case 2: u = "method"; break; case 3: u = "getter"; break; case 4: u = "setter"; break; default: u = "field"; } var f, d, p = { kind: u, name: o ? "#" + r : r, static: s, private: o }, h = { v: !1 }; if (0 !== i && (p.addInitializer = createAddInitializerMethod(a, h)), o || 0 !== i && 2 !== i) { if (2 === i) f = function (e) { return assertInstanceIfPrivate(l, e), n.value; };else { var v = 0 === i || 1 === i; (v || 3 === i) && (f = o ? function (e) { return assertInstanceIfPrivate(l, e), n.get.call(e); } : function (e) { return n.get.call(e); }), (v || 4 === i) && (d = o ? function (e, t) { assertInstanceIfPrivate(l, e), n.set.call(e, t); } : function (e, t) { n.set.call(e, t); }); } } else f = function (e) { return e[r]; }, 0 === i && (d = function (e, t) { e[r] = t; }); var y = o ? l.bind() : function (e) { return r in e; }; p.access = f && d ? { get: f, set: d, has: y } : f ? { get: f, has: y } : { set: d, has: y }; try { return e.call(t, c, p); } finally { h.v = !0; } }
function assertNotFinished(e, t) { if (e.v) throw new Error("attempted to call " + t + " after decoration was finished"); }
function assertCallable(e, t) { if ("function" != typeof e) throw new TypeError(t + " must be a function"); }
function assertValidReturnValue(e, t) { var r = typeof t; if (1 === e) { if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0"); void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init"); } else if ("function" !== r) { var n; throw n = 0 === e ? "field" : 5 === e ? "class" : "method", new TypeError(n + " decorators must return a function or void 0"); } }
function curryThis1(e) { return function () { return e(this); }; }
function curryThis2(e) { return function (t) { e(this, t); }; }
function applyMemberDec(e, t, r, n, a, i, s, o, c, l) { var u, f, d, p, h, v, y = r[0]; n || Array.isArray(y) || (y = [y]), o ? u = 0 === i || 1 === i ? { get: curryThis1(r[3]), set: curryThis2(r[4]) } : 3 === i ? { get: r[3] } : 4 === i ? { set: r[3] } : { value: r[3] } : 0 !== i && (u = Object.getOwnPropertyDescriptor(t, a)), 1 === i ? d = { get: u.get, set: u.set } : 2 === i ? d = u.value : 3 === i ? d = u.get : 4 === i && (d = u.set); for (var g = n ? 2 : 1, m = y.length - 1; m >= 0; m -= g) { var b; if (void 0 !== (p = memberDec(y[m], n ? y[m - 1] : void 0, a, u, c, i, s, o, d, l))) assertValidReturnValue(i, p), 0 === i ? b = p : 1 === i ? (b = p.init, h = p.get || d.get, v = p.set || d.set, d = { get: h, set: v }) : d = p, void 0 !== b && (void 0 === f ? f = b : "function" == typeof f ? f = [f, b] : f.push(b)); } if (0 === i || 1 === i) { if (void 0 === f) f = function (e, t) { return t; };else if ("function" != typeof f) { var I = f; f = function (e, t) { for (var r = t, n = I.length - 1; n >= 0; n--) r = I[n].call(e, r); return r; }; } else { var w = f; f = function (e, t) { return w.call(e, t); }; } e.push(f); } 0 !== i && (1 === i ? (u.get = d.get, u.set = d.set) : 2 === i ? u.value = d : 3 === i ? u.get = d : 4 === i && (u.set = d), o ? 1 === i ? (e.push(function (e, t) { return d.get.call(e, t); }), e.push(function (e, t) { return d.set.call(e, t); })) : 2 === i ? e.push(d) : e.push(function (e, t) { return d.call(e, t); }) : Object.defineProperty(t, a, u)); }
function applyMemberDecs(e, t, r) { for (var n, a, i, s = [], o = new Map(), c = new Map(), l = 0; l < t.length; l++) { var u = t[l]; if (Array.isArray(u)) { var f, d, p = u[1], h = u[2], v = u.length > 3, y = 16 & p, g = !!(8 & p), m = r; if (p &= 7, g ? (f = e, 0 !== p && (d = a = a || []), v && !i && (i = function (t) { return _checkInRHS(t) === e; }), m = i) : (f = e.prototype, 0 !== p && (d = n = n || [])), 0 !== p && !v) { var b = g ? c : o, I = b.get(h) || 0; if (!0 === I || 3 === I && 4 !== p || 4 === I && 3 !== p) throw new Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h); b.set(h, !(!I && p > 2) || p); } applyMemberDec(s, f, u, y, h, p, g, v, d, m); } } return pushInitializers(s, n), pushInitializers(s, a), s; }
function pushInitializers(e, t) { t && e.push(function (e) { for (var r = 0; r < t.length; r++) t[r].call(e); return e; }); }
function applyClassDecs(e, t, r) { if (t.length) { for (var n = [], a = e, i = e.name, s = r ? 2 : 1, o = t.length - 1; o >= 0; o -= s) { var c = { v: !1 }; try { var l = t[o].call(r ? t[o - 1] : void 0, a, { kind: "class", name: i, addInitializer: createAddInitializerMethod(n, c) }); } finally { c.v = !0; } void 0 !== l && (assertValidReturnValue(5, l), a = l); } return [a, function () { for (var e = 0; e < n.length; e++) n[e].call(a); }]; } }
function _applyDecs(e, t, r, n, a) { return { e: applyMemberDecs(e, t, a), get c() { return applyClassDecs(e, r, n); } }; }
function _checkInRHS(e) { if (Object(e) !== e) throw TypeError("right-hand side of 'in' should be an object, got " + (null !== e ? typeof e : "null")); return e; }
import "core-js/modules/es.regexp.flags.js";
import "core-js/modules/es.typed-array.set.js";
import "core-js/modules/esnext.aggregate-error.js";
import "core-js/modules/esnext.array.last-index.js";
import "core-js/modules/esnext.array.last-item.js";
import "core-js/modules/esnext.composite-key.js";
import "core-js/modules/esnext.composite-symbol.js";
import "core-js/modules/esnext.map.delete-all.js";
import "core-js/modules/esnext.map.every.js";
import "core-js/modules/esnext.map.filter.js";
// 此处省略
import "core-js/modules/esnext.string.code-points.js";
import "core-js/modules/esnext.string.replace-all.js";
import "core-js/modules/esnext.symbol.dispose.js";
import "core-js/modules/esnext.symbol.observable.js";
import "core-js/modules/esnext.symbol.pattern-match.js";
import "core-js/modules/esnext.weak-map.delete-all.js";
import "core-js/modules/esnext.weak-map.from.js";
import "core-js/modules/esnext.weak-map.of.js";
import "core-js/modules/esnext.weak-set.add-all.js";
import "core-js/modules/esnext.weak-set.delete-all.js";
import "core-js/modules/esnext.weak-set.from.js";
import "core-js/modules/esnext.weak-set.of.js";
import "core-js/modules/web.immediate.js";
_dec = log;
class Animal {
  static #_ = [_initProto] = _applyDecs(this, [[_dec, 2, "say"]], []).e;
  constructor(...args) {
    _initProto(this);
  }
  say() {}
  eat() {
    Promise.any();
  }
}
```

除了对 Decorators 语法进行了转译之外，babel 还尝试注入了所有可能用到的 polyfill。如果你不能预测到后续要执行的代码，这种做法就是合理的。

现在换一种办法，我们只注入确实要用到的 polyfill。先把 *src/index.js* 的 `import "core-js";` 删除掉，然后修改 *babel.config.js* 中 `useBuiltIns` 为 **usage**，重新执行命令。

现在我们得到：

```js
var _dec, _initProto;
import "core-js/modules/esnext.aggregate-error.js";
import "core-js/modules/esnext.promise.any.js";
function createAddInitializerMethod(e, t) { return function (r) { assertNotFinished(t, "addInitializer"), assertCallable(r, "An initializer"), e.push(r); }; }
function assertInstanceIfPrivate(e, t) { if (!e(t)) throw new TypeError("Attempted to access private element on non-instance"); }
function memberDec(e, t, r, n, a, i, s, o, c, l) { var u; switch (i) { case 1: u = "accessor"; break; case 2: u = "method"; break; case 3: u = "getter"; break; case 4: u = "setter"; break; default: u = "field"; } var f, d, p = { kind: u, name: o ? "#" + r : r, static: s, private: o }, h = { v: !1 }; if (0 !== i && (p.addInitializer = createAddInitializerMethod(a, h)), o || 0 !== i && 2 !== i) { if (2 === i) f = function (e) { return assertInstanceIfPrivate(l, e), n.value; };else { var v = 0 === i || 1 === i; (v || 3 === i) && (f = o ? function (e) { return assertInstanceIfPrivate(l, e), n.get.call(e); } : function (e) { return n.get.call(e); }), (v || 4 === i) && (d = o ? function (e, t) { assertInstanceIfPrivate(l, e), n.set.call(e, t); } : function (e, t) { n.set.call(e, t); }); } } else f = function (e) { return e[r]; }, 0 === i && (d = function (e, t) { e[r] = t; }); var y = o ? l.bind() : function (e) { return r in e; }; p.access = f && d ? { get: f, set: d, has: y } : f ? { get: f, has: y } : { set: d, has: y }; try { return e.call(t, c, p); } finally { h.v = !0; } }
function assertNotFinished(e, t) { if (e.v) throw new Error("attempted to call " + t + " after decoration was finished"); }
function assertCallable(e, t) { if ("function" != typeof e) throw new TypeError(t + " must be a function"); }
function assertValidReturnValue(e, t) { var r = typeof t; if (1 === e) { if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0"); void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init"); } else if ("function" !== r) { var n; throw n = 0 === e ? "field" : 5 === e ? "class" : "method", new TypeError(n + " decorators must return a function or void 0"); } }
function curryThis1(e) { return function () { return e(this); }; }
function curryThis2(e) { return function (t) { e(this, t); }; }
function applyMemberDec(e, t, r, n, a, i, s, o, c, l) { var u, f, d, p, h, v, y = r[0]; n || Array.isArray(y) || (y = [y]), o ? u = 0 === i || 1 === i ? { get: curryThis1(r[3]), set: curryThis2(r[4]) } : 3 === i ? { get: r[3] } : 4 === i ? { set: r[3] } : { value: r[3] } : 0 !== i && (u = Object.getOwnPropertyDescriptor(t, a)), 1 === i ? d = { get: u.get, set: u.set } : 2 === i ? d = u.value : 3 === i ? d = u.get : 4 === i && (d = u.set); for (var g = n ? 2 : 1, m = y.length - 1; m >= 0; m -= g) { var b; if (void 0 !== (p = memberDec(y[m], n ? y[m - 1] : void 0, a, u, c, i, s, o, d, l))) assertValidReturnValue(i, p), 0 === i ? b = p : 1 === i ? (b = p.init, h = p.get || d.get, v = p.set || d.set, d = { get: h, set: v }) : d = p, void 0 !== b && (void 0 === f ? f = b : "function" == typeof f ? f = [f, b] : f.push(b)); } if (0 === i || 1 === i) { if (void 0 === f) f = function (e, t) { return t; };else if ("function" != typeof f) { var I = f; f = function (e, t) { for (var r = t, n = I.length - 1; n >= 0; n--) r = I[n].call(e, r); return r; }; } else { var w = f; f = function (e, t) { return w.call(e, t); }; } e.push(f); } 0 !== i && (1 === i ? (u.get = d.get, u.set = d.set) : 2 === i ? u.value = d : 3 === i ? u.get = d : 4 === i && (u.set = d), o ? 1 === i ? (e.push(function (e, t) { return d.get.call(e, t); }), e.push(function (e, t) { return d.set.call(e, t); })) : 2 === i ? e.push(d) : e.push(function (e, t) { return d.call(e, t); }) : Object.defineProperty(t, a, u)); }
function applyMemberDecs(e, t, r) { for (var n, a, i, s = [], o = new Map(), c = new Map(), l = 0; l < t.length; l++) { var u = t[l]; if (Array.isArray(u)) { var f, d, p = u[1], h = u[2], v = u.length > 3, y = 16 & p, g = !!(8 & p), m = r; if (p &= 7, g ? (f = e, 0 !== p && (d = a = a || []), v && !i && (i = function (t) { return _checkInRHS(t) === e; }), m = i) : (f = e.prototype, 0 !== p && (d = n = n || [])), 0 !== p && !v) { var b = g ? c : o, I = b.get(h) || 0; if (!0 === I || 3 === I && 4 !== p || 4 === I && 3 !== p) throw new Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h); b.set(h, !(!I && p > 2) || p); } applyMemberDec(s, f, u, y, h, p, g, v, d, m); } } return pushInitializers(s, n), pushInitializers(s, a), s; }
function pushInitializers(e, t) { t && e.push(function (e) { for (var r = 0; r < t.length; r++) t[r].call(e); return e; }); }
function applyClassDecs(e, t, r) { if (t.length) { for (var n = [], a = e, i = e.name, s = r ? 2 : 1, o = t.length - 1; o >= 0; o -= s) { var c = { v: !1 }; try { var l = t[o].call(r ? t[o - 1] : void 0, a, { kind: "class", name: i, addInitializer: createAddInitializerMethod(n, c) }); } finally { c.v = !0; } void 0 !== l && (assertValidReturnValue(5, l), a = l); } return [a, function () { for (var e = 0; e < n.length; e++) n[e].call(a); }]; } }
function _applyDecs(e, t, r, n, a) { return { e: applyMemberDecs(e, t, a), get c() { return applyClassDecs(e, r, n); } }; }
function _checkInRHS(e) { if (Object(e) !== e) throw TypeError("right-hand side of 'in' should be an object, got " + (null !== e ? typeof e : "null")); return e; }
_dec = log;
class Animal {
  static #_ = [_initProto] = _applyDecs(this, [[_dec, 2, "say"]], []).e;
  constructor(...args) {
    _initProto(this);
  }
  say() {}
  eat() {
    Promise.any();
  }
}
```

可见这次注入的 polyfill 就少多了，其中就包括我们代码里面使用到的 **Promise.any**。

以上几种方法都有一个弊端，就是会“污染”全局，比如 *Promise.any* 就真会在 Promise 上定义一个 any，类似的，Array 的 *toSorted* 方法就真的会在 Array.prototype 上定义一个 toSorted。

为了解决这个问题，我们就得使用 `@babel/plugin-transform-runtime`：

```sh
npm i @babel/plugin-transform-runtime @babel/runtime @babel/runtime-corejs3 -D
```

将 *babel.config.js* 修改为：

```js
module.exports = {
    plugins: [
        ["@babel/plugin-proposal-decorators", { "version": "2023-05" }],
        ["@babel/transform-runtime", {
            corejs: 3,
        }]
      ]
}
```

这一次，我们得到的是：

```js
import _bindInstanceProperty from "@babel/runtime-corejs3/core-js-stable/instance/bind";
import _Array$isArray from "@babel/runtime-corejs3/core-js-stable/array/is-array";
import _Object$getOwnPropertyDescriptor from "@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor";
import _Object$defineProperty from "@babel/runtime-corejs3/core-js-stable/object/define-property";
import _Map from "@babel/runtime-corejs3/core-js-stable/map";
var _dec, _initProto;
import _Promise from "@babel/runtime-corejs3/core-js-stable/promise";
function createAddInitializerMethod(e, t) { return function (r) { assertNotFinished(t, "addInitializer"), assertCallable(r, "An initializer"), e.push(r); }; }
function assertInstanceIfPrivate(e, t) { if (!e(t)) throw new TypeError("Attempted to access private element on non-instance"); }
function memberDec(e, t, r, n, a, i, s, o, c, l) { var u; switch (i) { case 1: u = "accessor"; break; case 2: u = "method"; break; case 3: u = "getter"; break; case 4: u = "setter"; break; default: u = "field"; } var f, d, p = { kind: u, name: o ? "#" + r : r, static: s, private: o }, h = { v: !1 }; if (0 !== i && (p.addInitializer = createAddInitializerMethod(a, h)), o || 0 !== i && 2 !== i) { if (2 === i) f = function (e) { return assertInstanceIfPrivate(l, e), n.value; };else { var v = 0 === i || 1 === i; (v || 3 === i) && (f = o ? function (e) { return assertInstanceIfPrivate(l, e), n.get.call(e); } : function (e) { return n.get.call(e); }), (v || 4 === i) && (d = o ? function (e, t) { assertInstanceIfPrivate(l, e), n.set.call(e, t); } : function (e, t) { n.set.call(e, t); }); } } else f = function (e) { return e[r]; }, 0 === i && (d = function (e, t) { e[r] = t; }); var y = o ? _bindInstanceProperty(l).call(l) : function (e) { return r in e; }; p.access = f && d ? { get: f, set: d, has: y } : f ? { get: f, has: y } : { set: d, has: y }; try { return e.call(t, c, p); } finally { h.v = !0; } }
function assertNotFinished(e, t) { if (e.v) throw new Error("attempted to call " + t + " after decoration was finished"); }
function assertCallable(e, t) { if ("function" != typeof e) throw new TypeError(t + " must be a function"); }
function assertValidReturnValue(e, t) { var r = typeof t; if (1 === e) { if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0"); void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init"); } else if ("function" !== r) { var n; throw n = 0 === e ? "field" : 5 === e ? "class" : "method", new TypeError(n + " decorators must return a function or void 0"); } }
function curryThis1(e) { return function () { return e(this); }; }
function curryThis2(e) { return function (t) { e(this, t); }; }
function applyMemberDec(e, t, r, n, a, i, s, o, c, l) { var u, f, d, p, h, v, y = r[0]; n || _Array$isArray(y) || (y = [y]), o ? u = 0 === i || 1 === i ? { get: curryThis1(r[3]), set: curryThis2(r[4]) } : 3 === i ? { get: r[3] } : 4 === i ? { set: r[3] } : { value: r[3] } : 0 !== i && (u = _Object$getOwnPropertyDescriptor(t, a)), 1 === i ? d = { get: u.get, set: u.set } : 2 === i ? d = u.value : 3 === i ? d = u.get : 4 === i && (d = u.set); for (var g = n ? 2 : 1, m = y.length - 1; m >= 0; m -= g) { var b; if (void 0 !== (p = memberDec(y[m], n ? y[m - 1] : void 0, a, u, c, i, s, o, d, l))) assertValidReturnValue(i, p), 0 === i ? b = p : 1 === i ? (b = p.init, h = p.get || d.get, v = p.set || d.set, d = { get: h, set: v }) : d = p, void 0 !== b && (void 0 === f ? f = b : "function" == typeof f ? f = [f, b] : f.push(b)); } if (0 === i || 1 === i) { if (void 0 === f) f = function (e, t) { return t; };else if ("function" != typeof f) { var I = f; f = function (e, t) { for (var r = t, n = I.length - 1; n >= 0; n--) r = I[n].call(e, r); return r; }; } else { var w = f; f = function (e, t) { return w.call(e, t); }; } e.push(f); } 0 !== i && (1 === i ? (u.get = d.get, u.set = d.set) : 2 === i ? u.value = d : 3 === i ? u.get = d : 4 === i && (u.set = d), o ? 1 === i ? (e.push(function (e, t) { return d.get.call(e, t); }), e.push(function (e, t) { return d.set.call(e, t); })) : 2 === i ? e.push(d) : e.push(function (e, t) { return d.call(e, t); }) : _Object$defineProperty(t, a, u)); }
function applyMemberDecs(e, t, r) { for (var n, a, i, s = [], o = new _Map(), c = new _Map(), l = 0; l < t.length; l++) { var u = t[l]; if (_Array$isArray(u)) { var f, d, p = u[1], h = u[2], v = u.length > 3, y = 16 & p, g = !!(8 & p), m = r; if (p &= 7, g ? (f = e, 0 !== p && (d = a = a || []), v && !i && (i = function (t) { return _checkInRHS(t) === e; }), m = i) : (f = e.prototype, 0 !== p && (d = n = n || [])), 0 !== p && !v) { var b = g ? c : o, I = b.get(h) || 0; if (!0 === I || 3 === I && 4 !== p || 4 === I && 3 !== p) throw new Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h); b.set(h, !(!I && p > 2) || p); } applyMemberDec(s, f, u, y, h, p, g, v, d, m); } } return pushInitializers(s, n), pushInitializers(s, a), s; }
function pushInitializers(e, t) { t && e.push(function (e) { for (var r = 0; r < t.length; r++) t[r].call(e); return e; }); }
function applyClassDecs(e, t, r) { if (t.length) { for (var n = [], a = e, i = e.name, s = r ? 2 : 1, o = t.length - 1; o >= 0; o -= s) { var c = { v: !1 }; try { var l = t[o].call(r ? t[o - 1] : void 0, a, { kind: "class", name: i, addInitializer: createAddInitializerMethod(n, c) }); } finally { c.v = !0; } void 0 !== l && (assertValidReturnValue(5, l), a = l); } return [a, function () { for (var e = 0; e < n.length; e++) n[e].call(a); }]; } }
function _applyDecs(e, t, r, n, a) { return { e: applyMemberDecs(e, t, a), get c() { return applyClassDecs(e, r, n); } }; }
function _checkInRHS(e) { if (Object(e) !== e) throw TypeError("right-hand side of 'in' should be an object, got " + (null !== e ? typeof e : "null")); return e; }
_dec = log;
class Animal {
  static #_ = [_initProto] = _applyDecs(this, [[_dec, 2, "say"]], []).e;
  constructor(...args) {
    _initProto(this);
  }
  say() {}
  eat() {
    _Promise.any();
  }
}
```

明显能看到 polyfill 的作用都只局限于这个文件之内，不会污染全局。但这种方法也有严重的问题——它无法指定目标环境，明显 Map 我们已经支持，但是 polyfill 还是引入了。

总之之前 babel 的这几种 polyfill 办法都不完善。现在 babel 在发展一个新的 plugin，叫做 [babel-polyfills](https://github.com/babel/babel-polyfills)，以期望得到一种更美的实现。


除了 babel 之外，像 TypeScript、esbuild 它们只会做语法的转译，而不会注入 polyfill。因此，如果有必要的话，你仍然需要引入 babel 与之配合。不过也不全是，如 [swc](https://swc.rs/) 的新兴工具，也有能力注入来自 core-js 的 polyfill。




## 小结

ECMAScript 以年为单位快速“进化”，各位前端同学不应只关注眼前的知识，如果能提早利用上准标准化的特性，不但能扩展你的视角和思路，也能实打实地提升编码效率。

当然，这很大程度上都需要转译工具的帮助，TypeScript、esbuild、swc、rome 等工具不断推陈出新，对应用最新语言特性的辅助越来越大。业界工具对 ECMAScript 也起到了反哺作用，很多提案都来源于此。

到此为止，本小册关于 JavaScript 语言的知识就到此为止了，接近 30 篇的内容基本涵盖了规范中的重要知识点。全面但并不教条，总体还是以实用为主，去除了偏门和过时的内容。接下来，我会带大家实地“考察”运行环境中的现状。为了夯实前面学过的知识，用一个小案例来做实战。

