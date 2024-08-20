# Vue 源码阅读

## createApp

## mount

``` js
// createApp 传入的这个对象，会放在 app 的 _component 属性中
const app = Vue.createApp({
  data() {
    return {
      count: 0
    }
  },
  methods: {
    increment() {
      this.count++
    },
    decrement() {
      this.count--
    }
  }
})

// 将 app 对象（Vue实例）挂载到 #app 节点（DOM元素）上
app.mount('#app')
```

mount 方法主要做两件事：

通过 createVNode 创建虚拟节点

将虚拟节点转化为真实 DOM，渲染到页面上

## 挂载流程

template 模板 → （compile 编译）render 函数 →（执行） 虚拟节点 → （patch 函数）container 容器

## 参数归一化

## 模板归一化

## 虚拟 DOM

## patch 函数

## render 函数

## diff 算法