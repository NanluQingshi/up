什么是 Benchmark（基准测试）？

基准测试是一种测量和评估软件、系统或设备性能的方法。它通过在特定的测试场景下运行一系列标准化的测试程序来评价性能指标。

我们为什么需要 Benchmark？
- 从开发者角度，Benchmark 可以识别性能瓶颈，从而可以有针对性的进行优化。在版本迭代时，可以避免裂化。
- 从使用者角度，Benchmark 可以帮助用户做出选择，提高使用者的信心。


# Benny

 
本章采用 [Benny](https://github.com/caderek/benny) 来对 Jotai 性能来进行基准测试，引用官方一句话：
`A dead simple benchmarking framework for JS/TS libs`
（一个极其简单的用于 JS/TS 库的基准测试框架），他基于 benchmark.js 库之上进行封装从而使得使用更为简单。

我们新起一个 package：

```js
npm init -y
```

安装一下 Benny 库：

```js
npm install benny -D
```

编写文件 benchmark.js：

```js
const b = require("benny");

b.suite(
  // 任务名称
  "Example",

  // 添加第一个用例
  b.add("Reduce two elements", () => {
    [1, 2].reduce((a, b) => a + b);
  }),

  // 添加第二个用例
  b.add("Reduce five elements", () => {
    [1, 2, 3, 4, 5].reduce((a, b) => a + b);
  }),

  // 添加第三个用例
  b.add("Reduce ten elements", () => {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, b) => a + b);
  }),

  // 可以传入一个函数，会在每个用例执行完后运行
  b.cycle(),
  // 可以传入一个函数，会在整个任务执行完后运行
  b.complete(),
  // 保持测试结果，如果没有传入format会保存为json格式
  b.save({ file: "reduce", version: "1.0.0" }),
  b.save({ file: "reduce", format: "chart.html" })
);
```

执行：

```js
node benchmark.js
```

得到结果：


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6cd32934541b4188a6f803dfb5787060~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=802&h=538&s=81308&e=png&b=1e1e1e" alt="image.png" width="70%" /></p>

可以看到运行了三个任务，140 931 370 ops/s 代表执行效率，该方法每秒执行了 140 931 370 次，±0.55% 为单次执行时的误差范围值。其中：
- Reduce two elements 用例效率最快。
- Reduce five elements 用例效率相比 Reduce two elements 用例低了 27.41%。
- Reduce ten elements 用例效率最慢，相比 Reduce two elements 用例低了 27.98%。

并会在当前目录下创建 `benchmark/results` 目录，在该目录下包含 `reduce.chart.html` 和 `reduce.json` 两个文件，其中 `reduce.json` 文件内容为：


```js
{
  "name": "Example",
  "date": "2024-01-01T08:33:50.720Z",
  "version": "1.0.0",
  "results": [
    {
      "name": "Reduce two elements",
      "ops": 140931370,
      "margin": 0.55,
      "percentSlower": 0
    },
    {
      "name": "Reduce five elements",
      "ops": 102295173,
      "margin": 0.46,
      "percentSlower": 27.41
    },
    {
      "name": "Reduce ten elements",
      "ops": 101502751,
      "margin": 1.2,
      "percentSlower": 27.98
    }
  ],
  "fastest": {
    "name": "Reduce two elements",
    "index": 0
  },
  "slowest": {
    "name": "Reduce ten elements",
    "index": 2
  }
}
```
在浏览器中打开 `reduce.chart.html` 可以可视化的展示 Benchmark 结果：

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3a5be9dd3db84f939dc26008177c47f0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2736&h=1542&s=122140&e=png&b=ffffff" alt="image.png" width="70%" /></p>

# 为 mini-jotai 编写 Benchmark

## 编写 Benchmark


在本节中我们会对 Jotai 的 `set` 和 `get` 性能进行测试，首先我们来编写 Jotai `set` 的 Benchmark：

```js
import { add, complete, cycle, save, suite } from "benny";
import { PrimitiveAtom, atom } from "../src/atom";

import { createStore } from "../src/store";

const createStateWithAtoms = (n: number) => {
  let targetAtom: PrimitiveAtom<number> | null = null;
  const store = createStore();
  for (let i = 0; i < n; ++i) {
    const a = atom(i);
    if (!targetAtom) {
      targetAtom = a;
    }
    store.set(a, i);
  }
  if (!targetAtom) {
    throw new Error();
  }
  return [store, targetAtom] as const;
};

const suiteCases = [2, 3, 4, 5, 6].map((n) =>
  add(`atoms=${10 ** n}`, () => {
    const [store, targetAtom] = createStateWithAtoms(10 ** n);
    return () => store.get(targetAtom);
  })
);

const main = async () => {
  await suite(
    "simple-read",
    ...suiteCases,
    cycle(),
    complete(),
    save({
      folder: __dirname,
      file: "simple-read",
      format: "json",
    }),
    save({
      folder: __dirname,
      file: "simple-read",
      format: "chart.html",
    })
  );
};

main();
```
前面说 Benny `add` 可以用来增加测试用例，当 `add` 接受的回调函数返回一个函数，这时候 Benny 会执行返回的那个函数来进行性能测试。这种情况适用于做一些预设，Benny 调用外层来做必要的设置并执行返回函数用来测试性能。在上面这个例子中我们分别测试了 100、1000、10000、100000、1000000 个 atom 时的 `get` 性能，首先我们调用`createStateWithAtoms`创建对应个数的atom，并返回 store 和第一个 atom 的二元组，最终返回一个用来 `get` 的函数用来测试性能。


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/15ee26882978484bafd2bf5fd8998222~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2756&h=1560&s=123867&e=png&b=ffffff)

最后我们编写 `set`：


```js
#!/usr/bin/env npx tsx

import { add, complete, cycle, save, suite } from "benny";
import { PrimitiveAtom, atom } from "../src/atom";

import { createStore } from "../src/store";

const createStateWithAtoms = (n: number) => {
  let targetAtom: PrimitiveAtom<number> | undefined;
  const store = createStore();
  for (let i = 0; i < n; ++i) {
    const a = atom(i);
    if (!targetAtom) {
      targetAtom = a;
    }
    store.set(a, i);
  }
  if (!targetAtom) {
    throw new Error();
  }
  return [store, targetAtom] as const;
};

const suiteCases = [2, 3, 4, 5, 6].map((n) =>
  add(`atoms=${10 ** n}`, () => {
    const [store, targetAtom] = createStateWithAtoms(10 ** n);
    return () => store.set(targetAtom, (c) => c + 1);
  })
);

const main = async () => {
  await suite(
    "simple-write",
    ...suiteCases,
    cycle(),
    complete(),
    save({
      folder: __dirname,
      file: "simple-write",
      format: "json",
    }),
    save({
      folder: __dirname,
      file: "simple-write",
      format: "chart.html",
    })
  );
};

main();
```


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/553d45c092e841cb8f900648577e3f1b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2760&h=1554&s=124034&e=png&b=ffffff)

## 将 Benchmark 融入 workflow

当然我们编写好了 Benchmark 之后，我们需要对 CI 增加一个卡点，从而让这个 Benchmark 发挥作用，比如：

- 当用户的当前 PR 造成了明显的性能裂化，就让当前 CI 失败。
- 将 Benchmark 结果展示到页面中，可以让仓库 maintainers 快速识别该 PR 造成的影响，增加 maintainers 合入该代码的信心。

比如 React PR 中会展示打包体积的变化，方便衡量当前 PR 的影响范围：


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dde08147bf8b44499c80b711cdec1f19~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2876&h=1618&s=488296&e=png&b=ffffff)

我们在我们的[仓库](https://github.com/L-Qun/state-management-collection)下也实现了一个，将 Benchmark 数据评论到当前 PR 下面会借助 `peter-evans/create-or-update-comment@v2` Action 来完成，我们在仓库中额外配置一个 `workflows/benchmark.yml` 来实现这个过程：https://github.com/L-Qun/state-management-collection/blob/main/.github/workflows/benchmark.yml

最终效果如下：https://github.com/L-Qun/state-management-collection/pull/5


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0829cf174b404dc6be9a811fd3b462b9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1862&h=1434&s=218708&e=png&b=ffffff)


# 总结

本章介绍了 Benchmark 的概念以及我们为什么需要 Benchmark。接下来介绍了 Benny 库并使用该库完成了对 mini-jotai 的 Benchmark 的测试，当然 Daishi 说 Jotai Benchmark 并不全面，如果你看到这里并且对 Jotai 感兴趣也欢迎对 Jotai [仓库](https://github.com/pmndrs/jotai)贡献 Benchmark 用例。





