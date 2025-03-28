上节课我们讲了 Node.js 的进程模块，进程模块使得 Node.js 具备了创建子进程的能力，而 Cluster 模块在进程模块的基础上使得多个进程可以监听同一个端口，实现服务器的多进程架构。

Cluster 模块使用到的技术不是 Node.js 中独有的，而是现代服务器软件通用的技术。而要了解 Cluster 模块的基础，我们就要从服务器架构的演进开始讲起。这之后，我们会深入 Node.js Cluster 模块的实现，并且实现出自己的 Cluster 模块。

# 服务器的架构演进

服务器是现代软件中非常重要的一个组成，它的底层技术和架构也一直在演变。其中，如何高效地处理连接一直是操作系统和服务器软件都在研究的问题，高效处理连接才能满足互联网日益增长的流量，也为用户节省更多资源，提升整体使用体验。下面，我们就一起看看服务器处理连接的架构演进。

一个基于 TCP 协议的服务器，创建流程如下（伪代码）。

```
int server_fd = socket();
bind(server_fd);
listen(server_fd);
```

执行完以上步骤，一个服务器正式启动。基于上面的模型，接下来分析各种处理连接的架构。

## 串行模式

串行模式就是服务器逐个处理连接，处理完前面的连接后才能继续处理后面的连接，逻辑如下。

```
while(1) {
    int client_fd  = accept(server_fd);
    read(client_fd);
    write(client_fd);
}
```

上面是服务器处理连接方式中最朴素的模型，如果没有连接，则服务器处于阻塞状态，如果有连接服务器就会不断地调用 accept 摘下完成三次握手的连接并处理。我们看看这种模式的处理过程。假设此时有 n 个请求到来，进程会从accept 中被唤醒，然后拿到一个新的 socket 用于通信，结构图如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/efe63a79e2244312ad1ab00d7155b037~tplv-k3u1fbpfcp-zoom-1.image)

这种处理模式下，如果处理的过程中调用了阻塞 API，比如文件 IO，就会影响后面请求的处理，可想而知，效率是非常低的，而且，并发量比较大的时候，监听 socket 对应的队列很快就会被占满（已完成连接队列有一个最大长度），导致后面的连接无法完成。这是最简单的模式，虽然服务器的设计中肯定不会使用这种模式，但是它让我们了解了一个服务器处理请求的整体过程。

  


上面的过程不仅涉及连接处理，还涉及连接的建立，即三次握手，很多同学都了解三次握手是什么，但可能很少会深入思考它是如何实现的，这样碰到连接相关的问题时就无法解决，比如为什么发起连接时会收到 RST 包，又比如遇到面试题：服务器通过操作系统监听一个端口后，收到连接时如何处理 ？一个服务器最多可以接收多少个连接呢？

众所周知，一个服务器启动的时候会监听一个端口，其实就是新建了一个 socket。如果有一个连接到来的时候，我们通过 accept 就能拿到这个新连接对应的 socket，那这个 socket 和监听的 socket 是不是同一个呢？

其实 socket 分为监听型和通信型。表面上，服务器用一个端口实现了多个连接，但是这个端口是用于监听的，底层用于和客户端通信的其实是另一个 socket。每当一个连接到来的时候，操作系统会根据请求包的目的地址信息找到对应的监听 socket，如果找不到就会回复 RST 包，如果找到就会生成一个新的 socket 与之通信（accept 的时候返回的那个）。监听 socket 里保存了监听的 IP 和端口，通信 socket 首先从监听 socket 中复制 IP 和端口，然后把客户端的 IP 和端口也记录下来。这样一来，下次再收到一个数据包，操作系统就会根据四元组从 socket 池子里找到该 socket，完成数据的处理。因此理论上，一个服务器能接受多少连接取决于服务器的硬件配置，比如内存大小。

## 多进程模式

串行模式中，所有请求都在一个进程中排队被处理，效率非常低下。为了提高效率，我们可以把请求分给多个进程处理。因为在串行处理的模式中，如果有文件 IO 操作就会阻塞进程，继而阻塞后续请求的处理。在多进程的模式中，即使一个请求阻塞了进程，操作系统还可以调度其它进程继续执行新的任务。多进程模式分为几种，下面我们一一讲解。

### **fork 模式**

fork 模式是主进程监听端口，有连接到来时，主进程执行 accept 摘取连接，然后通过 fork 创建子进程处理连接，逻辑如下。

```
while(1) {  
    int client_fd = accept(socket); 
    // 忽略出错处理 
    if (fork() > 0) {  
        continue;
        // 父进程负责 accept  
    } else {  
        // 子进程  
        handle(client_fd); 
        exit(); 
    }  
} 
```

这种模式下，每次来一个请求，就会新建一个进程去处理。这种模式比串行模式稍微好了一点，每个请求都被独立处理。假设 a 请求阻塞在文件 IO，不会影响 b 请求的处理，尽可能地做到了并发。它的瓶颈就是系统的进程数有限，如果有大量的请求，系统扛不住，而且进程的开销会很大，对于系统来说是一个沉重的负担。

### **pre-fork 模式 + 主进程 accept**

pre-fork 模式就是服务器启动的时候，预先创建一定数量的进程，但是这些进程是 worker 进程，不负责接收连接，只负责处理请求。处理过程为主进程负责接收连接，然后把接收到的连接交给 worker 进程处理，流程如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5792e61fe9d24ab8bcf9cda602ef43e8~tplv-k3u1fbpfcp-zoom-1.image)

逻辑如下：

```
let fds = [[], [], [], …进程个数];  
let process = [];  
for (let i = 0 ; i < 进程个数; i++) {  
    // 创建管道用于传递文件描述符  
    socketpair(fds[i]);  
    let pid;  
    if (pid = fork() > 0) {  
        // 父进程  
        process.push({pid, 其它字段});  
    } else {  
        const index = i;  
        // 子进程处理请求  
        while(1) {  
            // 从管道中读取文件描述符  
            var client_fd = read(fd[index][1]);  
            // 处理请求  
            handle(client_fd);  
        }  
    }  
}  
// 主进程 accept
for (;;) {  
    const clientFd = accept(socket);  
    // 找出处理该请求的子进程  
    const i = findProcess();  
    // 传递文件描述符  
    write(fds[i][0], clientFd);  
}  
```

和 fork 模式相比，pre-fork 模式相对比较复杂，因为在前一种模式中，主进程收到一个请求就会实时 fork 一个子进程，这个子进程会继承主进程中新请求对应的 fd，可以直接处理该 fd 对应的请求。但是在进程池的模式中，子进程是预先创建的，当主进程收到一个请求的时候，子进程中无法拿得到该请求对应的 fd 。这时候就需要主进程使用传递文件描述符的技术，把这个请求对应的 fd 传给子进程。

### **pre-fork 模式 + 子进程 accept**

前面介绍的两种模式中，都是主进程接收连接，然后传递给子进程处理，这样主进程就会成为系统的瓶颈，它可能来不及接收和分发请求给子进程，而子进程却很空闲。子进程 accept 这种模式不是等到请求来的时候再创建进程，而是在服务器启动的时候，就会创建多个进程，然后多个子进程分别调用 accept，逻辑如下。

```
int server_fd = socket();
bind(server_fd);
for (let i = 0 ; i < 进程个数; i++) {  
    if (fork() > 0) {  
        // 父进程负责监控子进程  
    } else {  
        // 子进程处理请求  
        listen(server_fd);
        while(1) {  
            int client_fd = accept(socket);  
            handle(client_fd);  
        }  
    }  
}  
```

这种模式下多个子进程都阻塞在 accept，如果这时候有一个请求到来，那么所有的子进程都会被唤醒，但是先被调度的子进程会摘下这个请求节点，后续的进程被唤醒后可能会遇到已经没有请求可以处理，而又进入睡眠，这种进程被无效唤醒的现象就是著名的惊群现象。这种模式的处理流程如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e46cecf81f845d0946604ba0b3d3245~tplv-k3u1fbpfcp-zoom-1.image)

Nginx 中解决了惊群这个问题，它的处理方式是在 accpet 之前先加锁，拿到锁的进程才进行 accept，这样就保证了只有一个进程会阻塞在 accept，不会引起惊群问题，但是新版操作系统已经在内核层面解决了这个问题，每次只会唤醒一个进程。

## 多线程模式

除了使用多进程外，也可以使用多线程技术处理连接，多线程模式和多进程模式类似，也分为 3 种： 1. 主线程 accept，创建子线程处理 2. 线程池 3. 子线程 accept 1、3 和多进程模式中的一样，第 2 种比较特别，所以我们重点来介绍。在子进程模式时，每个子进程都有自己的 task_struct，这就意味着在 fork 之后，每个进程负责维护自己的数据、资源。线程则不一样，线程共享进程的数据和资源，主线程从 accept 中拿到一个 fd 传给线程之后，线程就可以直接操作它，所以线程池模式的架构如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/86b362383c2d4148be7f7c61d336a318~tplv-k3u1fbpfcp-zoom-1.image)

通过上图我们可以知道，主线程负责 accept 请求，然后通过互斥的方式插入一个任务到共享队列中，线程池中的子线程同样是通过互斥的方式，从共享队列中摘取节点进行处理。有兴趣的同学可以参考这个[仓库](https://github.com/theanarkh/multi-thread-server)。

## 事件驱动

从之前的处理模式中我们知道，为了应对大量的请求，服务器需要大量的进程 / 线程，这是个非常大的开销。现在很多服务器（Nginx、Nodejs、Redis）都开始使用单进程 + 事件驱动模式去设计，这种模式可以在单个进程中轻松处理成千上万的请求。

但也正因为单进程模式下，再多的请求也只在一个进程里处理，这样一个任务会一直在占据 CPU，后续的任务就无法执行了。因此，事件驱动模式不适合 CPU 密集型的场景，更适合 IO 密集的场景（一般都会提供线程 / 线程池，负责处理 CPU 或者阻塞型的任务）。

大部分操作系统都提供了事件驱动的 API，但是事件驱动在不同系统中实现不一样，所以一般都会有一层抽象层抹平这个差异。这里以 Linux 的 epoll 为例子。

```
// 创建一个 epoll 实例
int epoll_fd = epoll_create();  
/* 
    在 epoll 给某个文件描述符注册感兴趣的事件，这里是监听的 socket，注册可读事件，即连接到来 
    event = { 
        event: 可读 
        fd： 监听 socket 
        // 一些上下文 
    } 
*/  
epoll_ctl(epoll_fd , EPOLL_CTL_ADD , socket, event);  
while(1) {  
    // 阻塞等待事件就绪，events 保存就绪事件的信息，total 是个数  
    int total= epoll_wait(epoll_fd , 保存就绪事件的结构events, 事件个数, timeout);  
    for (let i = 0; i < total; i++) {  
        if (events[fd] === 监听 socket) {  
            int client_fd = accpet(socket);  
            // 把新的 socket 也注册到 epoll，等待可读，即可读取客户端数据  
            epoll_ctl(epoll_fd , EPOLL_CTL_ADD , client_fd, event);  
        } else {  
            //  从events[i] 中拿到一些上下文，执行相应的回调  
        }  
    }  
}  
```

事件驱动模式的处理流程为服务器注册文件描述符和事件到 epoll 中，然后 epoll 开始阻塞，当有事件触发时 epoll 就会返回哪些 fd 的哪些事件触发了，接着服务器遍历就绪事件并执行对应的回调，在回调里可以再次注册 / 删除事件，就这样不断驱动着进程的运行。

epoll 的原理其实也类似事件驱动，它底层维护用户注册的事件和文件描述符，本身也会在文件描述符对应的文件 / socket / 管道处注册一个回调，等被通知有事件发生的时候，就会把 fd 和事件返回给用户，大致原理如下。

```
function epoll_wait() {  
    for 事件个数  
        // 调用文件系统的函数判断  
        if (事件 [i] 中对应的文件描述符中有某个用户感兴趣的事件发生 ？) {  
            插入就绪事件队列  
        } else {  
            /*
                在事件 [i] 中的文件描述符所对应的文件 / socke / 管道等资源中注册回调。
                感兴趣的事件触发后回调 epoll，回调 epoll 后，epoll 把该 event[i] 插入
                就绪事件队列返回给用户  
            */
        }  
}  
```

## SO_REUSEPORT 端口复用

前面我们主要介绍了 3 种连接处理方式：

1.  单进程串行处理；
1.  主进程接收连接，分发给子进程处理；
1.  主进程管理子进程，子进程共同处理连接。

从串行处理到多进程 / 多线程模式，在处理连接上有了很大的改进，但依然存在一些问题。2 中的问题是，虽然有多个子进程处理请求，但只有一个进程接收请求，这远远不够。

3 中的问题是，多个子进程虽然可以同时 accept，但也会导致惊群问题。而且，被唤醒处理连接的进程应该处理多少个连接也是一个问题，比如有 10 个连接，进程 1 被唤醒后是全部处理，还是只处理一个然后把剩下的留给其它进程处理呢？即使新版的内核已经解决了惊群问题，但是被唤醒的进程应该处理多少个连接的问题依然存在，所以**如何接收请求和分发请求**是两个可以改进的地方。

  


新版 Linux 支持 SO_REUSEPORT 特性后，使得处理请求的模式有了很大的改善。 SO_REUSEPORT 之前，一个 socket 是无法绑定到同一个地址的，通常的做法是主进程 bind 后 fork 子进程，然后子进程 listen，但共享的是同一个 socket。SO_REUSEPORT 特性支持多个 socket 绑定到同一个地址，当连接到来时，操作系统会根据地址信息找到一组 socket，然后根据策略选择一个 socket 并唤醒阻塞在该 socket 的进程。这样之前多进程共享 socket 的模式下，被唤醒的进程应该处理多少个请求的问题也解决了，因为 SO_REUSEPORT 模式中，每个进程一个 socket，对应一个请求队列，内核会把请求负载均衡地分发到各个进程中，被 socket 唤醒的进程只处理自己的监听 socket 下的连接就行，架构如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c2d9cc7cfc70414e8fcc324012f32524~tplv-k3u1fbpfcp-zoom-1.image)

这种模式在底层解决了多进程请求分发的问题，提高了处理请求的效率同时实现了负载均衡。

  


以上是服务器处理请求的架构演变，服务器作为对性能要求极高的软件，在技术演变的过程中，不仅应用层做了很多改进，操作系统内核层面也做了很多改进，这些也是 Node.js Cluster 模块中使用到的技术。

# Node.js 中的连接处理

接下来，我们就来看看 Node.js 是如何处理连接的。首先看一下 Cluster 模块的一个使用例子。

```
const cluster = require('cluster');  
const http = require('http');  
const numCPUs = require('os').cpus().length;  
  
if (cluster.isMaster) {  
  for (let i = 0; i < numCPUs; i++) {  
    cluster.fork();  
  }  
} else {  
  http.createServer((req, res) => {  
    res.writeHead(200);  
    res.end('hello world\n');  
  }).listen(8888);  
}  
```

以上代码在第一次执行的时候，cluster.isMaster 为 true，说明是主进程，然后通过 fork 调用创建一个子进程，在子进程里同样执行以上代码，但是 cluster.isMaster 为 false，从而执行了 else 的逻辑。我们看到每个子进程都会监听 8888 这个端口但是又不会引起 EADDRINUSE 错误，为什么呢？

## 主进程初始化

我们先看主进程 require('cluster') 的时候，Node.js 是怎么处理的。

```
const childOrMaster = 'NODE_UNIQUE_ID' in process.env ? 'child' : 'master';  
module.exports = require(`internal/cluster/${childOrMaster}`)  
```

从代码中可以看到，Node.js 会根据环境变量 NODE_UNIQUE_ID 的值加载不同的模块。因为主进程中不存在 NODE_UNIQUE_ID，所以会加载 master 模块。

```
cluster.isWorker = false;  
cluster.isMaster = true; 
// 调度策略  
cluster.SCHED_NONE = SCHED_NONE;    
cluster.SCHED_RR = SCHED_RR;     
// 调度策略的选择   
let schedulingPolicy = {  
  'none': SCHED_NONE,  
  'rr': SCHED_RR  
}[process.env.NODE_CLUSTER_SCHED_POLICY];  

cluster.schedulingPolicy = schedulingPolicy;  
// 创建子进程函数  
cluster.fork = function(env) {  
  // 参数处理
  cluster.setupMaster();  
  const id = ++ids;  
  // 设置环境变量 NODE_UNIQUE_ID 到子进程的环境变量中
  const workerEnv = { ...process.env, ...env, NODE_UNIQUE_ID: `${id}` };
  // 调用 child_process 模块的 fork 创建子进程
  const workerProcess = fork(cluster.settings.exec, cluster.settings.args, {
    env: workerEnv,
    // ...
  });
  // 一个 Worker 表示一个子进程
  const worker = new Worker({  
    id: id,  
    process: workerProcess  
  });  
  // 接收子进程的消息
  worker.process.on('internalMessage', internal(worker, onmessage));  
  process.nextTick(emitForkNT, worker);  
  cluster.workers[worker.id] = worker;  
  return worker;  
};        
```

主进程的逻辑如下。

1.  选择工作模式，Node.js 提供的工作模式有轮询和共享两种工作模式。
1.  封装了一个 fork 函数，cluster.fork 是对 child_process 模块 fork 的封装，用户每次执行 cluster.fork 时，就会新建一个子进程，并且传递一个 NODE_UNIQUE_ID 环境变量给子进程，这样子进程加载 cluster 模块时就会加载到 child 模块。
1.  监听 internalMessage 事件接收子进程的消息，这个消息包括子进程主动发送给父进程的，和父进程主动发送给子进程然后子进程回复的，来看看 internalMessage 事件处理函数和发送数据的逻辑。

```
const callbacks = new Map();  
let seq = 0;  

// 发送消息给父/子进程
function sendHelper(proc, message, handle, cb) {
  message = { cmd: 'NODE_CLUSTER', ...message, seq };
  // 设置回调
  if (typeof cb === 'function')
    callbacks.set(seq, cb);

  seq += 1;
  return proc.send(message, handle);
}

// 接收父/子进程的消息
// worker 表示子进程，即和哪个子进程通信，cb 是 onmessage
function internal(worker, cb) {  
  return function onInternalMessage(message, handle) {  
    // 只处理 NODE_CLUSTER 命令的消息
    if (message.cmd !== 'NODE_CLUSTER')  
      return;  
  
    let fn = cb;  
    // 有 ack 字段说明是父进程发送消息返回的 ack，比如发送连接给子进程，处理函数 ack 对应的 callback
    // 否则说明是子进程请求父进程，这时候处理函数为 onmessage
    if (message.ack !== undefined) {  
      const callback = callbacks.get(message.ack);  
  
      if (callback !== undefined) {  
        fn = callback;  
        callbacks.delete(message.ack);  
      }  
    }  
    
    fn.apply(worker, arguments);  
  };  
}  
```

sendHelper 和 internal 函数是对异步消息通信做了一层封装，因为进程间通信是异步的，当我们发送多个消息后，如果收到一个回复，我们无法辨别出该回复是针对哪一个请求的，Node.js 通过 seq 的方式对每一个请求和响应做了一个编号，从而区分响应对应的请求。如果是子进程主动发送给父进程的请求，则不存在回调，这时候会执行 onmessage 处理，看一下 onmessage 的实现。

```
function onmessage(message, handle) {  
  const worker = this;  
  if (message.act === 'online')  
    online(worker);  
  else if (message.act === 'queryServer')  
    queryServer(worker, message);  
  else if (message.act === 'listening')  
    listening(worker, message);  
  else if (message.act === 'exitedAfterDisconnect')  
    exitedAfterDisconnect(worker, message);  
  else if (message.act === 'close')  
    close(worker, message);  
}  
```

onmessage 根据不同的消息类型进行相应的处理，后面我们再具体分析。至此，主进程的逻辑就分析完了。

## 子进程初始化

接着看一下子进程的逻辑。当子进程启动时，会在 initializeClusterIPC 中进行相关处理，逻辑如下。

```
function initializeClusterIPC() {
  if (process.argv[1] && process.env.NODE_UNIQUE_ID) {
    const cluster = require('cluster');
    cluster._setupWorker();
    delete process.env.NODE_UNIQUE_ID;
  }
}
```

initializeClusterIPC 中调用了 _setupWorker 初始化。

```
cluster.isWorker = true;  
cluster.isMaster = false; 
cluster._setupWorker = function() {  
  // worker 代表子进程自己
  const worker = new Worker({  
    id: +process.env.NODE_UNIQUE_ID | 0,  
    process: process,  
    state: 'online'  
  });  
  
  cluster.worker = worker;  
  // 处理和父进程的通信
  process.on('internalMessage', internal(worker, onmessage));  
  // 通知主进程子进程启动成功  
  send({ act: 'online' }); 
   
  // 处理主进程发过来的消息
  function onmessage(message, handle) {  
    // 新连接到来
    if (message.act === 'newconn')  
      onconnection(message, handle);  
    else if (message.act === 'disconnect')  
      _disconnect.call(worker, true);  
  }  
};  
```

_setupWorker 中和父进程一样，也监听了 internalMessage 事件，然后通知父进程自己启动成功了。

## net.createServer 的处理

主进程和子进程执行完初始化代码后，子进程开始执行业务代码 http.createServer，http.createServer 最后会调用 net 模块的 listen，然后调用 listenIncluster。我们从该函数开始分析。

```
function listenIncluster(server, address, port, addressType,  
                         backlog, fd, exclusive, flags) {  
    
  const serverQuery = {  
    address: address,  
    port: port,  
    addressType: addressType,  
    fd: fd,  
    flags,  
  };  
  
  cluster._getServer(server, serverQuery, listenOnMasterHandle);    
  function listenOnMasterHandle(err, handle) {  
    server._handle = handle;  
    server._listen2(address,
                    port, 
                    addressType, 
                    backlog, 
                    fd, 
                    flags);  
  }  
}  
```

listenIncluster 函数会调用子进程 cluster 模块的 _getServer 函数。

```
cluster._getServer = function(obj, options, cb) {  
  let address = options.address;  
  const message = {  
    act: 'queryServer',  
    index,  
    data: null,  
    ...options  
  };  
  
  message.address = address;  
  // 给主进程发送消息  
  send(message, (reply, handle) => {  
    // 根据不同模式做处理
    if (handle)  
      shared(reply, handle, indexesKey, cb);  
    else  
      rr(reply, indexesKey, cb);             
  });  
};  
```

从上面代码中可以看到，_getServer 函数会给主进程发送一个 queryServer 的请求并设置了一个回调函数。

  


看一下主进程是如何处理 queryServer 请求的。

```
function queryServer(worker, message) {  
  const key = `${message.address}:${message.port}:${message.addressType}:${message.fd}:${message.index}`;  
  let handle = handles.get(key);  
  
  if (handle === undefined) {  
    let address = message.address;  
    let constructor = RoundRobinHandle;  
    // 根据策略选取不同的构造函数，UDP 只能使用共享模式，因为 UDP 不是基于连接的，没有连接可以分发  
    if (schedulingPolicy !== SCHED_RR ||  
        message.addressType === 'udp4' ||  
        message.addressType === 'udp6') {  
      constructor = SharedHandle;  
    }  
  
    handle = new constructor(key,  
                             address,  
                             message.port,  
                             message.addressType,  
                             message.fd,  
                             message.flags);  
    handles.set(key, handle);  
  }  
  handle.add(worker, (errno, reply, handle) => {  
    const { data } = handles.get(key);  
    // 返回结果给子进程
    send(worker, {  
      errno,  
      key,  
      ack: message.seq,  
      data,  
      ...reply  
    }, handle);  
  });  
}  
```

queryServer 首先根据调度策略选择构造函数并创建一个对象，然后执行该对象的 add 方法并且传入一个回调。下面我们看看不同策略下的处理。

### 共享模式

首先看看共享模式的实现，共享模式对应前面分析的主进程管理子进程，多个子进程共同 accept 处理连接这种方式。

```
function SharedHandle(key, address, port, addressType, fd, flags) {  
  this.key = key;  
  this.workers = [];  
  this.handle = null;  
  this.errno = 0;  
  
  let rval;  
  if (addressType === 'udp4' || addressType === 'udp6')  
    rval = dgram._createSocketHandle(address, 
                                     port, 
                                     addressType, 
                                     fd, 
                                     flags);  
  else  
    rval = net._createServerHandle(address,  
                                   port, 
                                   addressType, 
                                   fd, 
                                   flags);  
  
  if (typeof rval === 'number')  
    this.errno = rval;  
  else  
    this.handle = rval;  
}  
```

SharedHandle 是共享模式，即主进程创建好 handle，交给子进程处理，接着看它的 add 函数。

```
SharedHandle.prototype.add = function(worker, send) {  
  this.workers.push(worker);  
  send(this.errno, null, this.handle);  
};  
```

SharedHandle 的 add 把 SharedHandle 中创建的 handle 返回给子进程。

  


接着看子进程拿到 handle 后的处理。

```
function shared(message, handle, indexesKey, cb) {  
  const key = message.key;  
    
  const close = handle.close;  
  
  handle.close = function() {  
    send({ act: 'close', key });  
    handles.delete(key);  
    indexes.delete(indexesKey);  
    // 因为是共享的，可以直接 close 掉而不会影响其它子进程等
    return close.apply(handle, arguments);  
  };  
  handles.set(key, handle); 
  // 执行 net 模块的回调 
  cb(message.errno, handle);  
}  
```

shared 函数把接收到的 handle 再回传到调用方，即 net 模块的 listenOnMasterHandle 函数，listenOnMasterHandle 会执行 listen 开始监听地址。

```
function setupListenHandle(address, port, addressType, backlog, fd, flags) {
  // this._handle 即主进程返回的 handle
  // 连接到来时的回调
  this._handle.onconnection = onconnection;
  this._handle[owner_symbol] = this;
  const err = this._handle.listen(backlog || 511);
}
```

这样多个子进程就成功启动了服务器，但是有连接到来时，系统只会有一个进程拿到该连接。所以所有子进程存在竞争关系导致负载不均衡，这取决于操作系统的实现。共享模式的核心逻辑是主进程在 _createServerHandle 创建 handle 时执行 bind 绑定了地址（但没有 listen），然后通过文件描述符传递的方式传给子进程，子进程执行 listen 的时候就不会报端口已经被监听的错误了，因为端口被监听的错误是执行 bind 的时候返回的。逻辑如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57d5feca53804d4397a7f0cfb077a002~tplv-k3u1fbpfcp-zoom-1.image)

看一个共享模式的使用例子。

```
const cluster = require('cluster');
const os = require('os');
// 设置为共享模式
cluster.schedulingPolicy = cluster.SCHED_NONE;

// 主进程 fork 多个子进程
if (cluster.isMaster) {
  // 通常根据 CPU 核数创建多个进程 os.cpus().length
  for (let i = 0; i < 3; i++) {
    cluster.fork();
  }
} else { // 子进程创建服务器
  const net = require('net');
  const server = net.createServer((socket) => {
    socket.destroy();
    console.log(`handled by process: ${process.pid}`);
  });
  server.listen(8080);
}
```

然后查看一下哪个进程监听了端口 8080（lsof -i:8080）。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b34868540a6141f980e7776bd2c1bde0~tplv-k3u1fbpfcp-zoom-1.image)

可以看到多个进程都监听了这个端口，然后发起多个请求看看处理情况。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9d70e23340694b40934659d9550845ab~tplv-k3u1fbpfcp-zoom-1.image)

输出是不确定且无规律的，取决于哪个进程成功抢到了这个请求。

### 轮询模式

接着看轮询模式，轮询模式对应前面的主进程 accept，分发给多个子进程处理这种方式。

```
function RoundRobinHandle(key, address, port, addressType, fd, flags) {  
  this.key = key;  
  this.all = new Map();  
  this.free = [];  
  this.handles = [];  
  this.handle = null;  
  this.server = net.createServer(assert.fail);  
  
  if (fd >= 0)  
    this.server.listen({ fd });  
  else if (port >= 0) {  
    this.server.listen({  
      port,  
      host: address,  
      ipv6Only: Boolean(flags & constants.UV_TCP_IPV6ONLY),  
    });  
  } else  
    this.server.listen(address);  // UNIX socket path.  
  // 监听成功后，注册 onconnection 回调，有连接到来时执行  
  this.server.once('listening', () => {  
    this.handle = this.server._handle;  
    this.handle.onconnection = (err, handle) => this.distribute(err, handle);  
    this.server._handle = null;  
    this.server = null;  
  });  
}  
```

因为 RoundRobinHandle的 工作模式是主进程负责监听，收到连接后分发给子进程，所以 RoundRobinHandle 中直接启动了一个服务器，当收到连接时执行 this.distribute 进行分发。接着看一下RoundRobinHandle 的 add 函数。

```
RoundRobinHandle.prototype.add = function(worker, send) {  
   this.all.set(worker.id, worker);  
  
   const done = () => {  
    // send 的第三个参数是 null，说明没有 handle
    if (this.handle.getsockname) {  
      const out = {};  
      this.handle.getsockname(out);  
      send(null, { sockname: out }, null);  
    } else {  
      send(null, null, null);  // UNIX socket.  
    }  
  
    this.handoff(worker);   
  };  
  // 否则等待 listen 成功后执行回调  
  this.server.once('listening', done);  
};  
```

RoundRobinHandle 会在 listen 成功后执行回调。我们回顾一下执行 add 函数时的回调。

```
handle.add(worker, (errno, reply, handle) => {  
  const { data } = handles.get(key);  
  send(worker, {  
    errno,  
    key,  
    ack: message.seq,  
    data,  
    ...reply  
  }, handle);  
});  
```

回调函数会把 handle 等信息返回给子进程。但是在 RoundRobinHandle 和 SharedHandle 中返回的 handle 是不一样的，分别是 null 和 net.createServer 实例，因为前者不需要启动一个服务器，它只需要接收来自父进程传递的连接就行。

  


接着我们回到子进程的上下文，看子进程是如何处理的，刚才我们讲过，不同的调度策略，返回的 handle 是不一样的，我们看轮询模式下的处理。

```
function rr(message, indexesKey, cb) { 
   let key = message.key;  
   // 不需要 listen，空操作
   function listen(backlog) {  
       return 0;  
   }  
  
   function close() {
       // 因为 handle 是共享的，所以无法直接关闭，需要告诉父进程，引用数减一
       if (key === undefined)
         return;
    
       send({ act: 'close', key });
       handles.delete(key);
       indexes.delete(indexesKey);
       key = undefined;
  } 
  // 构造假的 handle 给调用方
  const handle = { close, listen, ref: noop, unref: noop };  
  
  handles.set(key, handle); 
  // 执行 net 模块的回调 
  cb(0, handle);  
}  
```

round-robin 模式下，Node.js 会构造一个假的 handle 返回给 net 模块，因为调用方会调用 handle 的这些函数。当有请求到来时，round-bobin 模块会执行 distribute 分发连接给子进程。

```
RoundRobinHandle.prototype.distribute = function(err, handle) {  
  // 首先保存 handle 到队列  
  this.handles.push(handle);  
  // 从空闲队列获取一个子进程  
  const worker = this.free.shift();  
  // 分发  
  if (worker)  
    this.handoff(worker);  
};  
  
RoundRobinHandle.prototype.handoff = function(worker) {  
  // 拿到一个 handle  
  const handle = this.handles.shift();  
  // 没有 handle，则子进程重新入队  
  if (handle === undefined) {  
    this.free.push(worker);
    return;  
  }  
  // 通知子进程有新连接  
  const message = { act: 'newconn', key: this.key };  
  
  sendHelper(worker.process, message, handle, (reply) => {  
    // 接收成功  
    if (reply.accepted)  
      handle.close();  
    else  
      // 结束失败，则重新分发  
      this.distribute(0, handle);
    // 继续分发
    this.handoff(worker);  
  });  
};  
```

可以看到 Node.js 没用按照严格的轮询，而是哪个进程接收连接快，就继续给它分发。接着看一下子进程是怎么处理该请求的。

```
function onmessage(message, handle) {  
    if (message.act === 'newconn')  
      onconnection(message, handle);  
}  
  
function onconnection(message, handle) {  
  const key = message.key;  
  const server = handles.get(key);  
  const accepted = server !== undefined;  
  // 回复接收成功  
  send({ ack: message.seq, accepted });  
    
  if (accepted)  
     // 在 net 模块设置
    server.onconnection(0, handle);  
}  
```

最终执行 server.onconnection 进行连接的处理。逻辑如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/adad220943fa43f78fd2d91a2f2fe19b~tplv-k3u1fbpfcp-zoom-1.image)

看一下轮询模式的使用例子。

```
const cluster = require('cluster');
const os = require('os');
// 设置为轮询模式
cluster.schedulingPolicy = cluster.SCHED_RR;

// 主进程 fork 多个子进程
if (cluster.isMaster) {
  // 通常根据 CPU 核数创建多个进程 os.cpus().length
  for (let i = 0; i < 3; i++) {
    cluster.fork();
  }
} else { // 子进程创建服务器
  const net = require('net');
  const server = net.createServer((socket) => {
    socket.destroy();
    console.log(`handled by process: ${process.pid}`);
  });
  server.listen(8080);
}
```

执行后看一下哪个进程监听了 8080 端口。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/89617f2c24254de9b8abffab81cea0f7~tplv-k3u1fbpfcp-zoom-1.image)

可以看到只有一个进程监听了这个端口，那就是主进程，当主进程收到连接后会通过文件描述符的方式分发给子进程。下面是输出。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/956cdf7250bd46b698ddaca87734e165~tplv-k3u1fbpfcp-zoom-1.image)

Node.js 会尽可能快地进行轮询分发，而不是严格地轮询分发，所以输出不一定是有序的。

# 实现自己的 Cluster 模块

了解了Cluster 模块的原理后，我们自己来实现一个 Cluster 模块。

## 轮询模式

首先创建一个在 parent.js 文件，该文件在主进程中执行。

```
constchildProcess = require('child_process');  
const net = require('net');  
const workers = [];  
const workerNum = 10;  
let index = 0;  
for (let i = 0; i < workerNum; i++) {  
  workers.push(childProcess.fork('child.js', {env: {index: i}}));
}  
  
const server = net.createServer((client) => {  
    workers[index].send(null, client);  
    console.log('dispatch to', index);  
    index = (index + 1) % workerNum;  
});  
server.listen(11111);  
```

主进程负责监听请求，主进程收到请求后，按照一定的算法把请求通过文件描述符的方式传给worker 进程。接着再创建一个 child.js 文件，该文件在 worker 进程中执行。

```
process.on('message', (message, client) => {  
    console.log('receive connection from master');  
});  
```

worker 进程通过监听 message 事件接收来自父进程发送过来的连接，然后处理连接。这里没有实现子进程回复确认收到的逻辑，但这是必要的，因为当子进程接收连接成功后，主进程需要把本进程内连接对应的 fd 关闭，否则会造成 fd 泄露，这个关闭的时机就是子进程回复成功接收到连接时。

## 共享模式

首先创建一个在 parent.js 文件，该文件在主进程中执行。

```
const childProcess = require('child_process');  
const net = require('net');  
const workers = [];  
const workerNum = 10    ;  
const handle = net._createServerHandle('127.0.0.1', 11111, 4);  
  
for (let i = 0; i < workerNum; i++) {  
    const worker = childProcess.fork('child.js', {env: {index: i}});  
    workers.push(worker);  
    worker.send(null ,handle);  
}  
```

主进程负责绑定端口，把 handle 传给 worker 进程。接着再创建一个 child.js 文件，该文件在 worker 进程中执行。

```
const net = require('net');  
process.on('message', (message, handle) => {  
    net.createServer(() => {  
        console.log(process.env.index, 'receive connection');  
    }).listen({handle});  
});  
```

worker 进程各自执行 listen 监听 socket。当有连接到来时，操作系统会唤醒进程，先被调度的 worker 进程会处理该连接。

  


**实现共享模式的重点在于理解 EADDRINUSE 错误是怎么来的。** 当一个进程执行 bind 的时候，如果其它进程也执行 bind 并且端口也一样，则操作系统会告诉我们端口已经被监听了（EADDRINUSE）。但是如果我们在子进程里不执行 bind 的话，就可以绕过这个限制。那么重点在于，**如何在子进程中不执行bind，但是又可以绑定到同样的端口呢**？实际上有 2 种方式。

  


**第** **1** **种是通过 fork。** 我们知道 fork 的时候，子进程会继承主进程的文件描述符。所以首先在主进程中执行 bind 然后 fork 子进程，接着在子进程中执行 listen 就可以接收连接了。下面是使用 C 语言实现的例子。

```
#include <stdio.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <string.h>
#include <sys/wait.h>

int main(int argc, char* argv[])
{
    int server_fd;
    struct sockaddr_in server_addr;

    server_fd = socket(AF_INET, SOCK_STREAM, 0);

    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
    server_addr.sin_port = htons(1234);

    bind(server_fd, (struct sockaddr*)&server_addr, sizeof(server_addr));
    // 创建多个子进程
    for (int i = 0; i < 3; i++) {
        int ret = fork();
        if (ret == 0) { // 子进程
            printf("sub thread: %d\n", getpid());
            listen(server_fd, 500);
            while(1) {
                int fd = accept(server_fd, NULL, NULL);
                printf("%d receive connection: %d\n", getpid(), fd);
                close(fd);
            }
            close(server_fd);
            return 0;
        }
    }
    printf("main thread: %d\n", getpid());
    waitpid(-1, NULL, 0);
    close(server_fd);
    return 0;
}
```

我们可以看到，编译执行后请求 1234 端口可以看到每次输出的 pid 是不一样的。

**第** **2** **种是通过文件描述符传递。** 在这种方式中，我们首先可以创建一个 socket 并绑定到一个地址中，然后通过操作系统的文件描述符传递技术，把 socket 对应的 fd 发送到另一个进程中。通过这种方式，我们就绕过了 bind 同一个端口的问题。对于传递文件描述符，Node.js 中支持很多种方式。共享模式中的例子是创建了一个 socket 并通过 bind 绑定了地址，我们还可以执行 listen 使得主进程也可以处理连接。接下来我们看个例子。

首先在主进程中启动服务器，代码如下。

```
const childProcess = require('child_process');  
const net = require('net');  
const workers = [];  
const workerNum = 10;  
const server = net.createServer(() => {  
    console.log('master receive connection');  
})  
server.listen(11111);  
for (let i = 0; i < workerNum; i++) {  
    const worker = childProcess.fork('child.js', {env: {index: i}});  
    workers.push(worker);  
    worker.send(null, server);  
}  
     
```

主进程完成了 bind 和 listen，然后把 server 传递给子进程，子进程代码如下。

```
const net = require('net');  
process.on('message', (message, server) => {  
    server.on('connection', () => {  
        console.log(process.env.index, 'receive connection');  
    })  
});  
```

子进程通过监听 message 事件接收主进程传递过来的 server，然后监听该 server 的 connection 事件，这样子进程就可以接收连接了。在这种方式中，主进程和子进程都可以处理连接。

  


最后，我们写一个客户端测试，看一下请求是否可以被主进程和子进程同时处理。

```
const net = require('net');  
for (let i = 0; i < 50; i++) {  
    net.connect({port: 11111});  
}  
```

执行上面的代码我们就可以看到主进程和子进程处理连接的情况。

# 总结

服务器知识并不是 Node.js 中独有的，而是现代服务器的通用技术，像是 Nginx、Redis 等优秀的服务器软件底层的基础也是基于这些技术发展而来的。

  


回顾服务器的发展，无论是服务器本身还是操作系统，在提升处理连接效率方面都做了非常多的努力和探索，在发展的过程中，经历了串行处理、多进程 / 多线程、事件驱动、端口复用等模式，还有现在 Go 语言的协程模式。目前大多数服务器软件使用的技术是事件驱动和端口复用，包括 Node.js、Nginx、Redis 等服务器软件。

  


有了这些基础，我们就可以很好地理解 Node.js 是如何基于服务器的基础技术实现自己的服务区架构的。Node.js 的服务器架构支持共享和轮询两种模式，前者是主进程负责管理子进程，子进程接收并处理连接，后者则是主进程接收连接再分发给子进程，前者的问题是惊群问题和负载不均衡，后者问题是父进程会成为整个系统的瓶颈，从中可以看出 Node.js 使用的是比较常用的模式，这个主要是因为底层的 Libuv 为了系统兼容性问题，没有支持 SO_REUSEPORT，所以 Node.js 中也没有支持 SO_REUSEPORT。

  


最后，我们也实现了一个自己的 Cluster 模块，并体验了一下文件描述符技术。希望经过这节课的学习，大家不仅知道 Node.js 服务器的原理，也会服务器技术本身有很多的了解和理解。