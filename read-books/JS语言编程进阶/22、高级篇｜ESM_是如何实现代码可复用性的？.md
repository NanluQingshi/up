本文是小册高级篇的首篇，在高级篇中我们不再拘束于个别 API 的使用，而是把视界放到整个语言的概念上。先来了解**模块化**。

随着代码量的增加，**复用**是提升开发和运行效率的必然途径。一般来说，复用可以有从函数、文件到软件包的不同粒度，尤其以文件级别的复用最为关键。

在早期的 JavaScript 开发中，由于缺乏模块化的支持，开发者往往需要将所有的代码都写在一个文件中。这种方式存在以下几个问题：

1. **命名冲突**：由于所有的代码都在同一个作用域中，不同的代码可能会使用相同的变量名，导致命名冲突的问题。
1. **全局污染**：所有的代码都在全局作用域中执行，可能会污染全局变量，造成不可预料的错误。
1. **难以维护**：所有的代码都在同一个文件中，代码量庞大，难以阅读和维护。

为了解决这些问题，社区陆续出现了一些模块化的解决方案，例如 CommonJS、AMD 和 UMD 等。

1.  CommonJS：CommonJS 是一种用于服务器端的模块化规范，于 2009 年提出。它的主要特点是同步加载模块，使用 `require` 和 `exports` 来导入和导出模块。
1.  AMD：AMD（`Asynchronous Module Definition`）是一种用于浏览器端的模块化规范，于 2011 年提出。它的主要特点是异步加载模块，使用 `define` 和 `require` 来导入和导出模块。
1.  UMD：UMD（`Universal Module Definition`）是一种兼容 CommonJS 和 AMD 的模块化规范，可以在浏览器端和服务器端通用。

这些模块化规范在一定程度上解决了模块化的问题，但是它们都是基于特定的语法和加载器实现的，没有被纳入 JavaScript 语言标准中。而且在浏览器环境中，它们的本质还是要靠 window 全局共享作为媒介。


## ESM 的基本语法

ESM（`ECMAScript Modules`）是 ECMAScript 官方的模块化规范，于 2015 年发布的 ES6 中引入。ESM 的目标是提供一种原生的、标准的模块化方式，使得模块的导入和导出更加简洁和直观，并且完全不依赖全局环境。

### 导出模块

在 ESM 中，可以使用 `export` 关键字将模块中的变量、函数或类导出为一个模块。例如：

```js
// 导出一个变量
export const name = 'John';

// 导出一个函数
export function sayHello() {
  console.log('Hello!');
}

// 导出一个类
export class Person {
  constructor(name) {
    this.name = name;
  }
}

// 批量导出
export {
    var1, var2
};
```

> 💡 TypeScript 扩展出了 `export type` 语法，但并不是 ECMAScript 的范围。

### 导入模块

可以使用 `import` 关键字来导入其他模块中的变量。例如：

```js
// 导入一个变量
import { name } from './module.js';

// 别名
import { name as myName } from './module.js';

// 聚合
import * as person from './module.js';
```

不仅仅 JavaScript 文件可以被 import 导入，相信你也在实际项目中使用过导入图片、音乐、视频或 JSON。这里面虽然基本都是构建工具的功劳，但也不完全是，JSON 就可以作为 JavaScript 的补充，被原生支持，在 Node.js 中可以直接拿来用，甚至实现了一种 [Import assertions](https://v8.dev/features/import-assertions) 语法：

```js
import data from './data.json' assert { type: 'json' };

// dynamic
import('./foo.json', { assert: { type: 'json' }});
```

目前，这个语法已经把 assert 关键字修改为 `with`，作为 ECMAScript 的[草案](https://github.com/tc39/proposal-import-attributes)已经进入 Stage 3，相信很快就会加入到正式规范中。

### 默认导出

在 ESM 中可以使用 `export default` 语法来导出一个模块的默认值。一个模块只能有一个默认导出。例如：

```js
// 导出一个默认值
export default function() {
  console.log('Default export');
}

// 导入一个默认值
import myFunc from './module.js';
```

### 动态导入

ESM 也支持动态导入，可以在运行时根据条件来导入模块。例如：

```js
// 动态导入一个模块
import('./module.js')
  .then(module => {
    // 使用导入的模块
    console.log(module.name);
  })
  .catch(error => {
    console.error(error);
  });
```

它返回一个 Promise 对象，我们刚刚在前一篇讲到过。



## ESM 的特性

我们必须得承认，ESM 的导入导出语法都比 AMD、UMD、CommonJs 要简洁明了，功能强大，并且可扩展性强。但这就是 ESM 被引入的全部原因吗？

ESM 有很多优点，但它`对依赖的静态引用`绝对是其中的最重要一员。

什么叫做“静态引用”？举个反例，我们写 Node.js 代码：

```js
const fn = require(`lodash/${fn}.js`);
```

这样的写法有什么问题呢？没错，你`没办法提前知道这个文件有哪些依赖`，这里的“提前”是指运行之前。

这对于服务端环境还好，毕竟所有的文件都在本地，即时访问会很快，但对于浏览器却是致命的，我们`无法通过静态分析得到足够完整的依赖图谱`，从而不能实现提前加载。

如果不能提前加载，那么意味着就会有明显的串行请求阻塞，严重拖慢页面的加载速度。

所以，你看现代的构建工具，比如 Vite，默认都会把依赖项声明到 `link preload` 中，从而实现预载。

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5dbd3a7607c44c2f9b8fd702c50c7f22~tplv-k3u1fbpfcp-watermark.image?)

ESM 的语法注定了其对依赖的声明都是静态的，或者说是固定的，既不能在 import 语句中使用变量，也不能把 import 声明到非顶端的位置：

```js
import a from `${path}` // ❌

var fn; import m from './m'; // ❌
```

静态依赖分析还有哪些好处呢？`Tree Shaking`。对这个特性应用得比较强的就是著名打包工具 `Rollup`。它能实现的 `Tree Shaking` 的前提条件就是，代码是 ESM 格式的。虽然 Webpack 也能实现非 ESM 的，但是可想而知，这种摇树优化一定是有很大盲区的，甚至产生错误。

`Tree Shaking` 也是为了浏览器端减少代码传输量而存在的，可见 ESM 对前端是多么地重要。


除了能够静态分析依赖之外，ESM 与其他传统模块化方案还有一项关键区别：`ESM 始终是传递引用的`。

我先举一个 CommonJS 的例子：

```js
// bar.js
exports.bar = 23;

exports.getBar = function() {
    return bar;
}

exports.setBar = function(v) {
    bar = v;
}

// index.js
const { bar, setBar, getBar } = require('./bar.js');
console.log(bar); // 23
setBar(34);
console.log(bar, getBar()); // 23 34
```

看出来了么？bar 中的变量发生变化后，不影响 index 中导入的值，除非用函数来访问。

这也很容易理解，const 关键字已经说明了导入的 bar 只是 index 内的变量。

再来看 ESM 的实现：


```js
// bar.mjs
export let bar = 23;

export const getBar = function() {
    return bar;
}

export const setBar = function(v) {
    bar = v;
}

// index.mjs
import { bar, setBar, getBar } from './bar.mjs';
console.log(bar); // 23
setBar(34);
console.log(bar, getBar()); // 34 34
```

看到区别了吧，即便是对于 Primitive 类型，ESM 也仅仅是导入了句柄，而不是拷贝值。

之所以具备这样的特性，我就要搬出本小册的第二节 [《基础篇｜作用域：变量的可访问性原理》](https://juejin.cn/book/7226969813581889575/section/7232856919495409720) 中的 **Environment Records** 概念，有个子类叫做 `Module Environment Records`，代表的就是 ESM 的上下文。

在 ECMAScript 有这么一段话：

> In additional to normal mutable and immutable bindings, Module Environment Records `also provide immutable import bindings which are bindings that provide indirect access to a target binding that exists in another Environment Record`.

所以可以这样理解，ESM 对 import 变量的引用相当于进入到了另一个 Module 的内部去访问，只不过能访问哪些变量，还必须由目标 Module 主动声明（export）。

传递引用的这种特性也可以用 CommonJS 模拟，不然我们如今依旧很难完全用 ESM 来编写源码，同时引用大量由 CommonJS 发布的 npm 依赖。我用 `babel` 转译了上面的 index 代码，得到：

```js
var _bar = require("./bar.mjs");
console.log(_bar.bar); // 23
(0, _bar.setBar)(34);
console.log(_bar.bar, (0, _bar.getBar)());
```

转换得很巧妙，虽然 bar 本身是引用，但我们把它挂载到一个对象下，作为属性，每次访问自然也是引用，从而模拟了 ESM 的特性。

注意不要尝试在 index 中修改 bar 的值，因为 import 导入的值是只读的（const），看到上面的 `immutable` 了吗？就是这个意思。

`Module Environment Records` 还有几个特性需要关注，首先是它的 `[[OuterEnv]]` 是 `Global Environment Records`，因此在 ESM 内部是可以访问到全局变量的。其次是它也有 this 变量，只不过始终都是 undefined，这就避免了很多歧义，要想访问全局变量，必须用 window 或者 `globalThis`。

接下来我们看看在页面上跑 ESM 都有哪些需要关注的。



## HTML 与 ESM

由于与传统 JS 代码存在很大差异性，在 HTML 页面上引用 ESM 格式的 JS 需要特殊的指令，在 \<script>   上需要添加 `type="module"`：

```html
<script type="module" src="./module.js"></script>
```

这是必须的，即便你的文件后缀用 *.mjs* 也仍然是必须的。但是 `dynamic import` 语法却不受此限制：

```html
<script>
    import('./module.mjs').then(...
</script>
```

`type="module"` 的脚本还有一个特性：它等价开启了 `defer` 指令。也就是说，ESM 代码总是不会阻塞 HTML 的解析，但会在 `DOMContentLoaded` 之前完成加载和执行。

给大家留一个思考题，下面代码中三段代码的执行顺序是什么？

```html
<head>
    <script type="module">
        console.log(1);
    </script>
</head>
<body>
    <script>
        console.log(2);
    </script>
    <script defer src="./index.js"></script>
</body>
```

以上只是涉及并列的脚本，如果脚本之间有依赖，那么还是要按照依赖的先后顺序下载和执行，这里就要提到路径问题，比如在 `/static/js/index.mjs` 内导入 `/static/js/module.mjs` 怎么写。当然可以用绝对路径，但是在部署 CDN 之后，相当于它们之间索引的路径也必须用编码 CDN 域名，这是不希望的。

```js
// index.mjs
import m from 'https://somecdn.com/static/js/module.mjs'
```

因此，参考 CSS 对图片、字体的引用，ESM 也是采用了`相对路径`来导入模块，上面就可以这样写：

```js
// index.mjs
import m from './module.mjs';
```

就如同在 Node.js 环境一样。这样的话，如果你想切换 ESM 资源的域名，只需要改动入口处的那一个就可以了。

但是我们如果想不侵入整个 ESM 依赖树，实现对个别模块的路径指定该怎么办？有一种叫做 `importmap` 的技术可以实现，我们来看案例：

```html
<script type="importmap">
  {
    "imports": {
      "react": "https://www.unpkg.com/react@16.7.0/umd/react.production.min.js"
    }
  }
</script>
```

当我们在这个页面上执行 `import react from "react"` 或者 `import("react")` 时，实际上导入目标是上面那个 URL。

注意这个 \<script> 标签只需要加上 `type="importmap"`，不能包含其他额外属性，其内部也只能是一个 JSON，而不是 JavaScript 对象。

`importmap` 的功能很强大，包括前缀匹配和作用域：

```html
<script type="importmap">
  {
    "imports": {
      "lib/": "/common/lib/"
    },
    "scopes": {
      "/thirdparty/": {
        "react": "https://www.unpkg.com/react@16.7.0/umd/react.production.min.js"
      }
    }
  }
</script>
```

只不过目前浏览器对 `importmap` 的支持还比较有限，特别是 Safari 从 16.4 才支持，好在业界已经有了相应的 polyfill 方案，有兴趣的同学可以试一试。

注意以上在 HTML 中的内容都已经超出了 ECMAScript 的范畴，它们属于 `whatwg` 的规范。此规范中还有大家耳熟能详的是 `import.meta`。

就如同 `new.target` 一样，`import.meta` 也不可简单地理解成获取对象属性，它更像是一种语法。meta 对象本身是被 ECMAScript 定义的，但其内容则是 *host-defined*，即由运行环境决定。

`whatwg` 规定 meta 中至少包含 url 和 resolve。前者代表当前 ESM 模块的地址，可能是外链脚本的 URL，也可能是当前页面的 URL。后者获取另一个 ESM 的地址，比如在上面 `importmap` 的环境下：

```js
import.meta.resolve('react') // "https://www.unpkg.com/react@16.7.0/umd/react.production.min.js"
```

和 Node.js 中的 *require.resolve* 功能是很类似的。

meta 可以被扩展，比如现代构建工具中都会将环境变量注入到 meta 中成为 `import.meta.env`。

## 小结

在今年甚至更早的时间点，几乎完全可以认为所有用户的设备都支持 ESM，你可以放心使用 Vite 等工具来构建全新一代 HTML 页面。当然，\<script> 的 `nomodule` 属性也能够允许你优雅地降级到 UMD。

ESM 的引入为前端带来了规范化的模块操作体验，大家谨记`静态依赖声明`是其最大特点，直接拉动了在预处理环节的革命性升级，使得 `preload`、`Tree Shaking` 变得足够健壮。

ESM 在实际应用中需要关注不少细节，比如引用导入、\<script>、`importmap`、`import.meta` 等等。事实上，目前 Node.js 的新版本也都原生支持了 ESM，如果 package.json 中声明了 `type="module"`，那么工程内所有 *.js* 都会被当作 ESM，除非改写成 *.cjs* 来避免。

