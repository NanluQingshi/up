学习一门技术的之前，最重要的是了解它的整体架构，这可以帮助我们建立一个宏观的认识，基于宏观认识，再去学习相关的技术细节，我们就能够掌握得更加全面和深入。


所以这一节课，我们先来聊聊 Node.js 的整体架构，讲讲 Node.js 是什么、核心组成、应用架构和执行架构等等。学完本节课后，我们就会对 Node.js 有一个整体的认识，后面再深入细节，就能对 Node.js 有更深刻的了解和理解。

## **Node.js** **是什么？**

Node.js 是一个基于 Google JS 引擎 V8 的 JS 运行时，它由 Ryan Dahl 在 2009 年创建。在这个定义里面有两个关键词，第一个就是 JS 引擎，第二个是 JS 的运行时。那什么叫 JS 引擎呢？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e51a29c264744dd49292716c48bb6dec~tplv-k3u1fbpfcp-zoom-1.image)

JS 引擎就是把我们写的一些 JS 的代码进行解析执行，最后得到一个结果。比如我们看上图的左边用 JS 的语法定义一个变量 a 等于 1，b 等于 1，然后把 a 加 b 的值赋值给新的变量 c，接着把这个字符串传入 JS 引擎里，JS 引擎就会进行解析执行，执行完之后就可以得到对应的结果。

  


那么 JS 运行时又是什么呢 ？它和 JS 本身有什么区别 ？JS 是一门语言，有独立的语法规范，提供一些内置对象和 API（如数组、对象、函数等）。但和其他语言（C、C++等）不一样的是，JS 不提供网络、文件、进程等功能，这些额外的功能是由运行时环境实现和提供的，比如浏览器或 Node.js。所以，**JS 运行时可以理解为 JS 本身** **（下图左侧）** **+ 一些拓展的能力** **（下图右侧）** **所组成的一个运行环境**，具体我们可以看看下面这张图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/082a5415b36e40c0a05c017158a8285d~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，这些运行时都不同程度地拓展了 JS 本身的功能。JS 运行时封装底层复杂的逻辑，对上层暴露 JS API，开发者只需要了解 JS 的语法，就可以使用这些 JS 运行时做很多 JS 本身无法做到的事情。

## Node.js 的组成

了解了 Node.js 的本质后，我们再来说说 Node.js 的组成。Node.js 主要是由 V8、Libuv 和一些第三方库组成的。

首先，V8 是一个 JS 引擎，它不仅实现了 JS 解析和执行，还支持自定义拓展。这有什么用处呢？比如说，在下面这张图中我们直接使用了 A 函数，但 JS 本身并没有提供 A 这个函数。这个时候，我们给 V8 引擎提供的 API 里注入一个全局变量 A ，就可以直接在 JS 里使用这个 A 函数了。正是因为 V8 支持这个自定义的拓展，才有了 Node.js 等 JS 运行时。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f8992d79dc1c4f6e828c5479d9d782d6~tplv-k3u1fbpfcp-zoom-1.image)

示例代码如下，完整代码可以参考[这里](https://github.com/theanarkh/nodejs-book/tree/master/src/js_runtime_demo)。

```c++
int main(int argc, char* argv[]) {
  // 创建一个 isolate
  Isolate* isolate = Isolate::New(...);
  {
    Isolate::Scope isolate_scope(isolate);
    HandleScope handle_scope(isolate);
    // 创建一个对象模块
    Local<ObjectTemplate> global = ObjectTemplate::New(isolate);
    // 创建一个执行上下文
    Local<Context> context = Context::New(isolate, nullptr, global);
    Context::Scope context_scope(context);
    // 创建一个对象
    Local<Object> A = Object::New(isolate);
    // 获取执行上下文中的全局对象
    Local<Object> globalInstance = context->Global();
    // 给全局对象设置一个属性 A，值是上面创建的 A 对象
    globalInstance->Set(context, String::NewFromUtf8Literal(isolate, "A", NewStringType::kNormal), A);
    {
      // 在代码里访问刚才设置的 A 对象，改成其他字符串试试
      const char* code = "A";
      // 表示要执行的代码
      Local<String> source = String::NewFromUtf8(isolate, code, NewStringType::kNormal, strlen(code)).ToLocalChecked();
      // 编译
      Local<Script> script = Script::Compile(context, source).ToLocalChecked();
      // 执行
      Local<Value> result = script->Run(context).ToLocalChecked();
    }
  }
}
```

  


接着看 Libuv，Libuv 是一个跨平台的异步 IO 库，它主要是封装各个操作系统的一些 API，提供网络还有文件进程这些功能。我们知道在 JS 里面是没有网络文件这些功能的，前端是由浏览器提供，而 Node.js 里则是由 Libuv 提供。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a36a84af9c8c4f32b11ee5db31158147~tplv-k3u1fbpfcp-zoom-1.image)

上图中第一个部分是 JS 本身的功能，也就是 V8 实现的功能。第二部分是一些C++ 胶水代码，这块我们可以暂时不用关注。第三部分是 Libuv 的代码，V8 和 Libuv 通过第二部分的胶水代码粘合在一起，最后就形成了整一个 Node.js。我们看到，在 Node.js 里面不仅可以使用 JS 本身给我们提供的一些变量，如数组、函数，还能使用 JS 本身没有提供的 TCP、文件操作和定时器功能。不过 Node.js 并不是通过全局变量的方式实现的，具体我们会在模块加载器章节里再详细讲解。Libuv 是我们学习 Node.js 时的重点，它包含了跨平台系统编程的实现，这也是 Node.js 与 JS 的本质区别。因此，如果我们想基于 V8 或其他 JS 引擎实现自己的 JS 运行时，就可以从 Libuv 开始学习相关知识，写一个单独的组件来替换 Libuv，比如 Deno 中就没有使用 Libuv。至于 V8，它只是提供了 JS 解析执行和拓展 JS 的机制，知识相对来说比较固定，但 V8 比较复杂，我们不可能重新实现一个 JS 引擎。所以我们写运行时的时候，通常是直接选用业界成熟的 JS 引擎，而其他部分则可以考虑自己实现。

  


有了 JS 引擎和拓展 JS 能力的 Libuv，理论上就可以写一个 JS 运行时了，但是随着 JS 运行时功能的不断增加，Libuv 已经不能满足需求，比如实现加密解密、压缩解压缩。这时候就需要使用一些经过业界验证的第三方库，比如异步 DNS 解析 c-ares 库、HTTP 解析器 llhttp、HTTP2 解析器 nghttp2、解压压缩库 zlib、加密解密库 openssl 等等。这些库对我们理解 Node.js 原理没有太大帮助，只是一些工具代码，所以不需要过多关注（后面核心模块中我们会讲到 c-ares 和 llhttp），我们更多需要关注的是 Node.js 里一些关键和通用的技术，比如 JS 引擎的用法，事件驱动、IO 模型和网络编程等。

  


了解了 Node.js 的核心组成后，再来简单看一下 Node.js 代码的组成。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b1536f2dbcfe4ff890a43261e0c9a9b7~tplv-k3u1fbpfcp-zoom-1.image)

Node.js 代码主要是分为三个部分，分别是 C、C++ 和 JS。

**首先是** **JS** **层** **。**

JS 代码就是我们平时使用的那些 JS 模块，像 http 和 fs 这些模块。Node.js 之所以流行，有很大一部分原因在于选择了 JS 语言。Node.js 内核通过 C、C++ 实现了核心的功能，然后通过 JS API 暴露给用户使用，这样用户只需要了解 JS 语法就可以进行开发。相比其他的语言，这个门槛降低了很多。

**其次是** **C++ 层** **，** C++ 代码主要分为三个部分。

第一部分主要是封装 Libuv 和第三方库的 C++ 代码，比如 net 和 fs 这些模块都会对应一个 C++ 模块，它主要是对底层 Libuv 的一些封装。

第二部分是不依赖 Libuv 和第三方库的 C++ 代码，比方像 Buffer 模块的实现，主要依赖于 V8。

第三部分 C++ 代码是 V8 本身的代码。

C++ 代码中最重要的是了解如何通过 V8 API 把 C、C++ 的能力暴露给 JS 层使用，正如前面讲到的通过拓展一个全局变量 A，然后就可以在 JS 层使用 A。了解了这部分知识，离我们实现一个 JS 运行时又近了一步。

**最后是** **C 语言层** **。**

C 语言代码主要是包括 Libuv 和第三方库的代码，它们大多数是纯 C 语言实现的代码。Libuv 等库提供了一系列 C API，然后在 Node.js 的 C++ 层对其进行封装使用，最终暴露 JS API 给 JS 层使用。

## Node.js 的应用架构

了解了 Node.js 的一些概念和组成后，接下来看一下 Node.js 的 应用架构。Node.js 中的 应用架构和大多数服务器软件类似，如 Nginx、Redis，它们都是**一个“单线程” + 事件驱动 + 非阻塞** **IO** **的应用**。接下来，我们来讲一下这三个概念。

  


**首先是单线程**。从开发者角度来看，Node.js 是单线程的。但从实现来看，Node.js 是多线程的，只不过多线程是对开发者透明的。单线程具体体现在开发者的 JS 代码是跑在单个线程里的，但是底层的代码可能会跑在多个线程里，比如发起一个异步的文件操作，这个操作就会在一个子线程里执行，但是当操作完成后，这个回调会由主线程进行调度执行，而不是在子线程里直接执行 JS 层回调，所以对于开发者来说，所有的代码都是串行被执行的，不存在多线程并发的问题。因为 Node.js 的单线程属性，开发者在日常开发时尽量不要在主线程中执行耗时的代码和使用阻塞式 API，比如 readFileSync。

**然后是事件驱动**。事件驱动是操作系统提供的订阅发布机制，由操作系统的 IO 多路复用模块实现，不同的操作系统中提供的 API 不一样，比如 Linux 的 epoll、MacOs 的 kqueue、windows 的 IOCP，使用上类似 Node.js 的 events 模块，比如可以订阅网络 IO 是否可读，当可读时操作系统就会通知 Node.js，而不需要通过轮询的方式去感知任务是否完成或者数据是否准备好。这是 Node.js 中非常核心的部分，当 Node.js 中没有任务处理时，它就会阻塞在这里，有事件发生后，就会被唤醒继续执行，整个应用就是这样靠着各种事件来驱动运行的。

具体来说就是进程可以往事件驱动模块中订阅对某个 fd(file descriptor) 的某事件感兴趣，那么当事件发生时，事件驱动模块就会通知进程。不过事件驱动模块只是负责通知，它不会帮进程进行数据的读写，所以进程被通知后，需要自己调读写函数进行读写。

除此之外，事件驱动还有一个重要的内容是工作机制。比如 epoll 有水平触发和边缘触发两种工作方式，水平触发意思是当一个文件描述符的事件就绪时，如果用户没有处理完，则下次事件驱动模块还会继续触发该事件。边缘触发则不会，边缘触发只有在事件就绪和非就绪之间发生变化时才会通知用户。比如工作在水平触发模式的事件驱动模块通知用户某个文件描述符可读时，如果用户只读取了一部分数据，那么事件驱动模块会继续通知用户有可读事件触发，而工作在边缘触发模式时，用户需要把数据全部读取完，否则事件驱动模块不会再通知用户可读事件。

**最后是非阻塞IO**。阻塞 IO 是当调用一个系统调用时，如果条件没有满足，调用者会被阻塞，无法继续执行后面的代码。比如读取一个文件，如果数据没有准备好，线程就会被阻塞。而使用非阻塞 IO， 线程则不会被阻塞 ，而是返回错误码表示数据还没有准备好，看起来非阻塞 IO 比阻塞 IO 更好，但是非阻塞 IO 面临的问题是，**如何知道条件什么时候可以满足？** 这就需要刚才提到的事件驱动机制了，在事件驱动 + 非阻塞 IO 的架构中，调用一个系统调用的流程通常如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/06d180fa387a4edd8f42c1e0f7cb5855~tplv-k3u1fbpfcp-zoom-1.image)

在这个过程中，当事件触发时，操作系统就会通过事件驱动模块通知开发者，然后开发者以非阻塞方式调用系统调用进行数据读写。这里的事件驱动和非阻塞 IO 是相互配合的，除了前面提到的非阻塞 IO 依赖事件驱动通知事件触发，当事件触发时，开发者需要使用非阻塞 IO 进行读写操作。

  


这里大家可能觉得奇怪，**事件已经触发了，使用阻塞** **IO** **或非阻塞 IO 有什么区别？** 反正也不会导致线程阻塞，因为条件是肯定满足的。但实际情况并非总是如此，比如在早期的操作系统中，两个进程以共享底层 socket 的方式监听了同一个端口，那么当有连接到来时，操作系统会唤醒所有进程，然后进程 1 处理了这个连接，等到进程 2 再尝试处理时发现已经没有连接可以处理了，这时候如果使用的是阻塞 IO，进程就会被阻塞，导致后面的代码无法继续执行，直到下一个可被处理的连接。

  


另外，设置文件描述符为非阻塞方式的另一个原因是，在注册到事件驱动模块前，通常会先进行一次系统调用。比如写入数据时，如果 Libuv 维护的写队列为空，就可以直接调 write 函数，不需要等到事件驱动的通知。又比如发起 TCP 连接时，是直接调用 connect，如果不设置非阻塞，那么条件不满足时就会引起进程阻塞。

  


## Node.js 的执行架构

最后我们来看一下 Node.js 的执行架构，**Node.js 的执行架构是 Node.js 的骨架**，**理解这个骨架是理解 Node.js** **至关重要的一环。** 这个骨架是由 Libuv 实现的，所以我们接下来就聊聊 Libuv 的架构。Libuv 的架构本质上是一个生产者 / 消费者的模型。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ba72ccccaae64791bcae7bb65a07f3fa~tplv-k3u1fbpfcp-zoom-1.image)

从上面这个图中，我们可以看到在 Libuv 中有很多种生产任务的方式，一个网络 IO 有数据到达时，Node.js 初始化的时候设置一个定时器，或者是在线程池完成一些操作时。这些方式都可以生产任务，Libuv 在事件循环中会不断去消费这些任务，从而驱动整个进程运行。

  


在 Node.js 中，任务有不同的类型和优先级。Node.js 的任务分为宏任务和微任务，宏任务包括定时器、网络 IO、文件 IO，微任务包括 Promise、process.nextTick。另外，任务还有优先级的属性。具体来说，微任务比宏任务优先级高，每次执行完一个宏任务，就会处理所有的微任务，再执行下一个宏任务。这里先了解下就可以了，后面我们会具体分析。

  


这个生产者 / 消费者的模型是通过**事件循环**实现的，而实现生产者 / 消费者模型关键的问题是**消费者和生产者之间怎么同步** **。** 换句话说**当消费者** **队** **列** **没有任务时，消费者应该怎么处理** ？

1.  消费者一直轮询判断是否有任务。

```js
while(1) {
    while(queue.length) {
        const task = queue.shift();
        task();
    }
    sleep(times);
}
```

2.  变成阻塞状态，等待唤醒。

```js
while(1) {
    while(queue.length) {
        const task = queue.shift();
        task();
    }
    阻塞等待唤醒
}
```

显然，第一种方案很低效，浪费 CPU。第二种看起来比较合适，但阻塞在哪里呢？又由谁来唤醒阻塞的进程呢？这就需要用到前面讲的事件驱动机制。接下来看一下事件驱动的大致执行流程。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/09d0ba594c4a405392436406d50384d9~tplv-k3u1fbpfcp-zoom-1.image)

应用层代码可以通过事件驱动模块的 epoll_ctl 订阅 fd 的事件，然后同样地通过事件驱动模块的 epoll_wait 判断是否有事件触发。如果有事件触发，就可以通过事件驱动模块知道进程哪些 fd 的事件触发了，从而回调应用层的代码。如果没有事件发生，这种时候可以选择不阻塞，定时阻塞或者一直阻塞直到有事件发生。要不要阻塞或者说阻塞多久，是根据当前系统的情况。比如 Node.js 里面如果有定时器的节点，那么 Node.js 就会定时阻塞，这样就可以保证定时器按时执行。

下面看一个事件驱动模块的使用例子，以 MacOS 的 kqueue 为例，具体代码可参考[这里](https://github.com/theanarkh/nodejs-book/tree/master/src/kqueue)。

```c
#include <sys/event.h>
#include <fcntl.h>
#include <stdio.h>

int main(int argc, char **argv)
{   
    // 用于注册事件到 kqueue
    struct  kevent event;
    // 用于接收从 kqueue 返回到事件，表示哪个 fd 触发了哪些事件
    struct  kevent emit_event;
    int kqueue_fd, file_fd, result;
    // 打开需要监控的文件，拿到一个 fd
    file_fd = open(argv[1], O_RDONLY);
    if (file_fd == -1) {
      printf("Fail to open %s", argv[1]);
      return 1;
    }
    // 创建 kqueue 实例
    kqueue_fd = kqueue();
    // 设置需要监听的事件，文件被写入时触发
    EV_SET(&event,file_fd, EVFILT_VNODE, EV_ADD | EV_CLEAR, NOTE_RENAME, 0, NULL);
    // 注册到操作系统
    result = kevent(kqueue_fd, &event, 1, NULL, 0, NULL);
    // 不断阻塞等待，直到文件被写入
    while(1) {
        // result 返回触发事件的 fd 个数，这里是一个
        result = kevent(kqueue_fd, NULL, 0, &emit_event,  1, NULL);
        if (result > 0) {
            printf("%s have been renamed\n", argv[1]);
        }
    }
}
```

编译执行上面代码，然后执行的时候传入一个我们想要监控的文件，接着把这个文件修改名字，操作系统就会监控到变化，然后通过事件驱动模块通知订阅了该事件的进程。如果我们继续改名，这个事件会还会继续触发。


事件驱动模块非常强大，也非常高效，但是也存在一些限制。比如 Linux 的 epoll 不支持普通的文件操作（不能监听普通文件可读可写的事件），也不适合执行耗时操作，包括大量 CPU 计算，引起进程阻塞的任务。因为事件驱动通常是搭配单线程的，如果在单线程里执行耗时或阻塞的任务，就会导致后面的任务无法执行。针对这个问题，Libuv 提供的解决方案是使用线程池，这也是很多软件所采用的方案。下面来看一下引入了线程池之后，线程池和主线程的关系。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b9a8fe54e3734fbbba1ae92ccdea43af~tplv-k3u1fbpfcp-zoom-1.image)

从这个图中我们可以看到，当应用层提交任务时，像 CPU 计算还有文件操作不是交给主线程去处理的，而是直接交给线程池处理的，线程池处理完之后它会通知主线程。但是引入了多线程后会带来一个问题，就是怎么去保证上层代码跑在单个线程里面。因为我们知道 JS 是单线程的，如果线程池处理完一个任务之后，直接执行上层回调，上层代码就完全乱了。这时候就需要一个异步通知的机制，也就是说当一个线程处理完任务的时候，它不是直接去执行上程回调的，而是通过异步机制去通知主线程来执行这个回调，回到刚才聊的生产者 / 消费者模型中，就是生产一个任务到事件循环中。

  


Libuv 中具体通过 fd 的方式（管道或 eventfd）来实现异步机制的。当线程池完成任务时，它会修改这个 fd 为可读的，然后在主线程事件循环的 Poll IO 阶段时，它就会执行这个可读事件的回调，从而执行上层的回调。可以看到，Node.js 虽然是跑在多线程上面的，但是所有的 JS 代码都是跑在单个线程里的，这也是我们经常讨论的问题，**Node.js 是单线程还是多线程的，从不同的角度去看就会得到不同的答案**。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bec9a7e2cf7c4fc7bb680a0b470f662d~tplv-k3u1fbpfcp-zoom-1.image)

除了主线程和 Libuv 的线程池外，Node.js 还有一些额外的辅助线程，比如看门狗线程 Watchdog、调试线程 Inspector、消费 trace event 数据的 Trace 线程，还有用来做后台任务的线程，如 GC 的线程。下面是 Node.js 的整体架图。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03459c10da38456a8ab344d5347c9d86~tplv-k3u1fbpfcp-zoom-1.image)

## 总结

本节课，我们从多个角度介绍了 Node.js，相信你学完之后，一定会在宏观上对 Node.js 有更多地了解，下面我们再梳理下核心内容。

首先，我们需要知道 Node.js 本质上是一个基于 JS 引擎再通过其他组件拓展 JS 功能的运行环境。

了解了 Node.js 的本质后，我们又从组件、代码的角度了解了 Node.js 的组成以及它们的角色、作用。

最后，我们介绍了 Node.js 的应用 / 执行架构，了解了 Node.js 底层到底是多线程还是单线程的，同时也介绍了事件驱动模块和非阻塞 IO 等核心内容。

了解了这些，我们再深入细节去学习将会有更好的效果。