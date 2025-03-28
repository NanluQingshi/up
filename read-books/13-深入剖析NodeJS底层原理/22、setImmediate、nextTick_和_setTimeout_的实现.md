在 Node.js 中，可以通过 setImmediate、nextTick 和 setTimeout 产生一个任务，然后这个任务会在未来的某个时机被执行。那么这些 API 有什么区别呢？它们又是什么时候、如何被处理的呢？这节课我们会深入讲解这些 API 的实现，它可以帮助我们更全面地理解 Node.js。

# setImmediate

首先看一下 setImmediate，setImmediate 用于注册任务到事件循环的 check 阶段，注册的任务会在 check 阶段被执行。下面看看实现。

## 设置处理 immediate 任务的函数

在 Node.js 初始化的时候，设置了处理 immediate 任务的函数：

```
// runNextTicks 用于处理 nextTick 产生的任务，这里不关注  
const { processImmediate } = getTimerCallbacks(runNextTicks);  
setupTimers(processImmediate, ...); 
```

setupTimers 是 C++ 层导出的函数 SetupTimers。

```
void SetupTimers(const FunctionCallbackInfo<Value>& args) {  
  auto env = Environment::GetCurrent(args);  
  env->set_immediate_callback_function(args[0].As<Function>());  
}  
```

SetupTimers 在 env 中保存了 processImmediate，下面会看到具体的调用时机。

## 注册 check 阶段的回调

除了注册任务处理函数，Node.js 初始化时，同时初始化了 immediate 任务相关的数据结构和逻辑。

```
void Environment::InitializeLibuv(bool start_profiler_idle_notifier) { 
  // 初始化 immediate 相关的 handle 
  uv_check_init(event_loop(), immediate_check_handle());  
  // 修改状态为 unref，避免没有任务的时候，影响事件循环的退出  
  uv_unref(reinterpret_cast<uv_handle_t*>(immediate_check_handle()));  
  // 激活 handle，设置回调
  uv_check_start(immediate_check_handle(), CheckImmediate);   
  // 初始化一个 idle 阶段的节点
  uv_idle_init(event_loop(), immediate_idle_handle());
}  
```

上面的代码虽然只有几句，却涉及很多 Libuv 的内容，下面详细讲解下。

Node.js 初始化时会往 check 阶段插入一个 handle 节点，并设置回调为 CheckImmediate，但状态是 unref，unref 状态的 handle 不会影响事件循环的退出，这样就会带来一个问题，那就是如果 Node.js 里有 immediate 任务，但事件循环却退出了，这是不符合预期的。

大家可能会觉得可以根据是否有 immediate 任务修改 handle 状态，这的确是一个思路，但这里还有一个问题和 Libuv 的设计有关，Libuv 判断是否需要阻塞在 Poll IO 阶段时，没有把 check 阶段的任务考虑在内，我们可以看看下面用于计算 Poll IO 阶段是否需要阻塞或阻塞多久的逻辑。

```
int uv_backend_timeout(const uv_loop_t* loop) {
  if (loop->stop_flag != 0)
    return 0;

  if (!uv__has_active_handles(loop) && !uv__has_active_reqs(loop))
    return 0;

  if (!QUEUE_EMPTY(&loop->idle_handles))
    return 0;

  if (!QUEUE_EMPTY(&loop->pending_queue))
    return 0;

  if (loop->closing_handles)
    return 0;

  return uv__next_timeout(loop);
}
```

可以看到，哪怕有 check 阶段的任务，Poll IO 阶段还是可能会一直阻塞，这样一来 check 任务就无法按时执行了。这是 Libuv 的设计，但 Node.js 并不希望这样，它希望用户通过 setImmediate 产生一个任务之后可以尽快执行。

针对这个问题，Node.js 使用的解决办法是在设置一个 unref 状态的 check handle 的前提下，再通过增加一个 idle handle 来控制 Poll IO 阶段是否可以阻塞以及是否允许事件循环的退出（根据是否有 immediate 任务）。从上面代码中可以看到，idle 阶段的任务可以控制 Poll IO 会不会发生阻塞，这就是为什么 Node.js 会初始化一个 idle 节点，后面我们可以看到它的用处。

  


初始化完毕后，接下来看看创建一个 Immediate 任务的逻辑。

## 创建任务

我们可以通过 setImmediate 生成一个任务。

```
function setImmediate(callback, arg1, arg2, arg3) {  
  let i, args;  
  switch (arguments.length) {  
    case 1:  
      break;  
    case 2:  
      args = [arg1];  
      break;  
    case 3:  
      args = [arg1, arg2];  
      break;  
    default:  
      args = [arg1, arg2, arg3];  
      for (i = 4; i < arguments.length; i++) {  
        args[i - 1] = arguments[i];  
      }  
      break;  
  }  
  
  return new Immediate(callback, args);  
}          
```

setImmediate的代码比较简单，新建一个Immediate，下面是 Immediate 的类。

```
const Immediate = class Immediate {  
  constructor(callback, args) {  
    this._idleNext = null;  
    this._idlePrev = null;  
    this._onImmediate = callback;  
    this._argv = args;  
    this._destroyed = false;  
    this[kRefed] = false;    
    this.ref();  
    // Immediate 链表的节点个数，包括 ref 和 unref 状态  
    immediateInfo[kCount]++;  
    // 加入链表中  
    immediateQueue.append(this);  
  }  
  // 打上 ref 标记，往 Libuv 的 idle 链表插入一个激活状态的节点，如果还没有的话  
  ref() {    
    if (this[kRefed] === false) {  
      this[kRefed] = true;  
      if (immediateInfo[kRefCount]++ === 0)  
        toggleImmediateRef(true);  
    }  
    return this;  
  }  
  // 和上面相反  
  unref() {  
    if (this[kRefed] === true) {  
      this[kRefed] = false;  
      if (--immediateInfo[kRefCount] === 0)  
        toggleImmediateRef(false);  
    }  
    return this;  
  }  
  
  hasRef() {  
    return !!this[kRefed];  
  }  
};  
```

Immediate 类主要做了两件事儿。首先生成一个节点插入到链表，链表结构如下。

```
const immediateQueue = new ImmediateList();  
  
// 双向非循环的链表  
function ImmediateList() {  
  this.head = null;  
  this.tail = null;  
}  

ImmediateList.prototype.append = function(item) {  
  // 尾指针非空，说明链表非空，直接追加在尾节点后面  
  if (this.tail !== null) {  
    this.tail._idleNext = item;  
    item._idlePrev = this.tail;  
  } else {  
    // 尾指针是空说明链表是空的，头尾指针都指向item  
    this.head = item;  
  }  
  this.tail = item;  
};  
  
ImmediateList.prototype.remove = function(item) {  
  // 如果item在中间则自己全身而退，前后两个节点连上  
  if (item._idleNext !== null) {  
    item._idleNext._idlePrev = item._idlePrev;  
  }  
  
  if (item._idlePrev !== null) {  
    item._idlePrev._idleNext = item._idleNext;  
  }  
  // 是头指针，则需要更新头指针指向item的下一个，因为item被删除了，尾指针同理  
  if (item === this.head)  
    this.head = item._idleNext;  
  if (item === this.tail)  
    this.tail = item._idlePrev;  
  // 重置前后指针  
  item._idleNext = null;  
  item._idlePrev = null;  
};  
```

其次，更新任务个数相关的数据结构。如果 immediateInfo[kRefCount] 为 0，则说明还没有往 Libuv 的 idle 链表里插入 idle 节点，从之前的分析可以知道，Poll IO 阶段计算阻塞事件时，不会考虑 check 阶段的任务，但会考虑 idle 阶段的任务，所以当插入第一个 immediate 任务时，Node.js 会把这个 idle 节点插入 idle 阶段中，表示有任务处理，不能阻塞 Poll IO 阶段。没有 immediate 任务时，则移除 idle 节点。

总的来说，idle 节点的意义是**标记是否有 immediate 任务需要处理**，有的话就不能阻塞 Poll IO 阶段，并且不能退出事件循环，下面是 idle 节点的管理逻辑。

```
void ToggleImmediateRef(const FunctionCallbackInfo<Value>& args) { 
  Environment::GetCurrent(args)->ToggleImmediateRef(args[0]->IsTrue())
}  
  
void Environment::ToggleImmediateRef(bool ref) {  
  if (started_cleanup_) return;  
  // 插入 idle 队列，设置为 active 状态，防止在 Poll IO 阶段阻塞和事件循环的退出  
  if (ref) { 
    uv_idle_start(immediate_idle_handle(), [](uv_idle_t*){ });  
  } else {  
    // 不阻塞 Poll IO，允许事件循环退出
    uv_idle_stop(immediate_idle_handle());  
  }  
}  
```

## 处理任务

最后，我们再来看看 check 阶段是如何处理 immediate 任务的，具体的内容在 CheckImmediate 函数中。

```
void Environment::CheckImmediate(uv_check_t* handle) {  
  // 省略部分代码  
  // 没有 Immediate 任务需要处理  
  if (env->immediate_info()->count() == 0 ||  !env->can_call_into_js())  
    return;  
  do {  
    // 执行 JS 层回调 immediate_callback_function  
    MakeCallback(env->isolate(),  
                 env->process_object(),  
                 // 初始化时设置的 env->immediate_callback_function() 函数
                 env->immediate_callback_function(), 
                 0,  
                 nullptr,  
                 {0, 0}).ToLocalChecked();  
  } while (env->immediate_info()->has_outstanding() && env->can_call_into_js());  
  /* 
        所有 immediate 节点都处理完了，置 idle 阶段对应节点为非激活状态，
        允许 Poll IO 阶段阻塞和事件循环退出  
  */
  if (env->immediate_info()->ref_count() == 0)  
    env->ToggleImmediateRef(false);  
}  
```

由前面分析我们可以知道，env->immediate_callback_function() 是 processImmediate 函数，下面是processImmediate 函数的逻辑。

```
function processImmediate() {  
  /*
      执行 processImmediate 时，会先把 immediateInfo[kHasOutstanding] 置 1，
      就是设置执行 processImmediate 会有未捕获的异常，当有异常时 outstandingQueue 
      保存了未执行的节点，C++ 的 CheckImmediate 函数里会判断 
      env->immediate_info()->has_outstanding() 的值，为 true 则
      再次执行 processImmediate 处理 outstandingQueue 队列的节点  
  */
  const queue = outstandingQueue.head !== null ? outstandingQueue : immediateQueue;  
  let immediate = queue.head;  
  /* 
      在执行 immediateQueue 队列的话，先置空队列，避免执行回调
      的时候一直往队列加节点，死循环。所以新加的节点会插入新的队列， 不会在本次被执行。
      
      immediateInfo[kHasOutstanding] 置 1，如果顺利执行完 processImmediate 则置 0，
      如果发生异常，则 CheckImmediate 中 env->immediate_info()->has_outstanding() 
      为 1， 会再次执行 processImmediate 处理剩余的任务（记录在 outstandingQueue 队列）
  */  
  if (queue !== outstandingQueue) {  
    queue.head = queue.tail = null;  
    immediateInfo[kHasOutstanding] = 1;  
  }  
 
  let prevImmediate;  
  let ranAtLeastOneImmediate = false;  
  while (immediate !== null) {  
    // 执行微任务  
    if (ranAtLeastOneImmediate)  
      runNextTicks();  
    else  
      ranAtLeastOneImmediate = true;  
 
    // 前面的任务或微任务把该节点删除了，则不需要执行它的回调了，继续下一个  
    // 任务被删除时会脱离链表，所以需要一个 prevImmediate 记录前一个节点，才能找到
    // 被销毁节点后面的一个节点
    if (immediate._destroyed) {  
      outstandingQueue.head = immediate = prevImmediate._idleNext;  
      continue;  
    }  
 
    immediate._destroyed = true;  
    // 执行完要修改个数  
    immediateInfo[kCount]--;  
    if (immediate[kRefed])  
      immediateInfo[kRefCount]--;  
    immediate[kRefed] = null;  
    // 见上面if (immediate._destroyed)的注释  
    prevImmediate = immediate;  
    // 执行回调，指向下一个节点  
    try {  
      const argv = immediate._argv;  
      immediate._onImmediate(...argv);  
    } finally {  
      immediate._onImmediate = null;  
      // immediate 指向下一个，下一轮 while 循环执行
      // outstandingQueue.head 也实时指向下一个节点，保证 processImmediate
      // 处理报错时，下次继续处理剩余的任务
      outstandingQueue.head = immediate = immediate._idleNext;  
    }  
  }  
  // 当前执行的是 outstandingQueue 的话则把它清空  
  if (queue === outstandingQueue)  
    outstandingQueue.head = null;  
  // 全部节点顺利执行完  
  immediateInfo[kHasOutstanding] = 0;  
}  
```

processImmediate 的逻辑就是逐个执行 immediate 任务队列的节点。setImmediate 函数把 immediate 任务插入到 immediateQueue 队列，正常情况下会被顺利执行完。如果执行时发生异常也需要保证后续任务可以继续执行，所以开始处理时，immediateInfo[kHasOutstanding] 为 1，且每次处理 immediate 后会把下一个剩余节点同时记录在 outstandingQueue 队列中。如果 immediate 任务执行异常，则会直接退出 processImmediate 函数，接着回到 C++ 的 CheckImmediate 中，这时候 env->immediate_info()->has_outstanding() 为 1，会继续处理剩余的任务。例如以下场景。

```
setImmediate(() => {
    throw new Error();
});

setImmediate(() => {
    console.log(1);
});

process.on('uncaughtException', () =>{})
```

## setTimeout(fn,0) 和 setImmediate

setTimeout(fn, 0) 和 setImmediate 谁先执行的问题是一个比较热门的话题，我们首先看看下面这段代码：

```
setTimeout(()=> { console.log('setTimeout'); },0)  
setImmediate(()=> { console.log('setImmedate');})  
```

我们执行上面这段代码后，会发现输出是不确定的，这是为什么呢？

Node.js 的事件循环分为几个阶段( phase )。setTimeout 属于定时器阶段，setImmediate 属于 check 阶段。从顺序上来说，定时器阶段会比 check 阶段更早被执行。需要注意的是， setTimeout 的实现代码里有一个很重要的细节，我们一起来看下。

```
after *= 1;
if (!(after >= 1 && after <= TIMEOUT_MAX)) {  
  if (after > TIMEOUT_MAX) {  
    process.emitWarning(`错误提示`);  
  }  
  after = 1; // schedule on next tick, follows browser behavior  
}  
```

我们发现，虽然传的超时时间是 0，但是 0 不是合法值，Node.js 会把超时时间变成 1。这就导致了上面的代码输出不确定。Node.js 启动的时候，执行上面的代码，首先启动一个定时器，然后创建一个 setImmediate 任务，再进入Libuv 的事件循环。在执行定时器阶段，Libuv 判断从开启定时器到现在是否已经过去了 1 毫秒，是就执行定时器回调，否则会执行 check 阶段。从而执行 setImmediate 的回调。所以，一开始的那段代码的输出结果是取决于开始启动定时器到 Libuv 执行定时器阶段的时间是否过去了 1 毫秒。

# nextTick

了解 setImmediate 后，接着来看另一个创建异步任务的 API nextTick。nextTick 用于异步执行一个回调函数，和 setTimeout、setImmediate 类似，但它们的执行时机不同。setTimeout 和 setImmediate 的任务属于事件循环的一部分，而 nextTick 的任务不属于事件循环的一部分，具体的执行细节我们会在后面分析。

## 初始化

nextTick 函数是在 Node.js 启动过程中挂载到 process 对象中的。

```
function setupTaskQueue() {   
  setTickCallback(processTicksAndRejections);  
  return {  
    nextTick,  
  };  
}
const { nextTick, runNextTicks } = setupTaskQueue();  
process.nextTick = nextTick;  
```

setupTaskQueue 中除了返回 nextTick 函数外，还执行 setTickCallback 注册了处理 tick 任务的函数。

```
static void SetTickCallback(const FunctionCallbackInfo<Value>& args) {  
  Environment* env = Environment::GetCurrent(args);  
  env->set_tick_callback_function(args[0].As<Function>());  
}  
```

SetTickCallback 只是简单地保存处理 tick 任务的函数到 env 中，后续会用到。

## 创建任务

接着看一下 nextTick 是如何创建一个 tick 任务的。

```
function nextTick(callback) {  
  let args;  
  switch (arguments.length) {  
    case 1: break;  
    case 2: args = [arguments[1]]; break;  
    case 3: args = [arguments[1], arguments[2]]; break;  
    case 4: args = [arguments[1], arguments[2], arguments[3]]; break;  
    default:  
      args = new Array(arguments.length - 1);  
      for (let i = 1; i < arguments.length; i++)  
        args[i - 1] = arguments[i];  
  }  
  // 第一个任务，开启 tick 处理逻辑，用于 C++ 层判断是否有 tick 任务需要处理  
  if (queue.isEmpty())  
    setHasTickScheduled(true);  
  // 一个任务对应的上下文
  const tickObject = {  
    [async_id_symbol]: asyncId,  
    [trigger_async_id_symbol]: triggerAsyncId,  
    callback,  
    args  
  };  
  // 插入队列  
  queue.push(tickObject);  
}  
```

这就是我们执行 nextTick 时的逻辑，每次调用 nextTick 都会往队列中追加一个节点。

## 处理任务

我们再看一下处理的 tick 任务的逻辑。Nodejs 在初始化时，通过执行 setTickCallback(processTicksAndRejections) 注册了处理 tick 任务的函数。那什么时候会处理 tick 任务呢？一共有 3 个时机。

1.  每次执行完 JS 回调时。

执行 JS 回调的函数是 MakeCallback。

```
MaybeLocal<Value> AsyncWrap::MakeCallback(const Local<Function> cb,
                                          int argc,
                                          Local<Value>* argv) {
  
  MaybeLocal<Value> ret = InternalMakeCallback(...);
}
```

MakeCallback 会调用 InternalCallbackScope。

```
MaybeLocal<Value> InternalMakeCallback(...) {  
  InternalCallbackScope scope(env, recv, asyncContext);  
  // 执行用户层 JS 回调  
  scope.Close();  
  
  return ret;  
}  
```

InternalMakeCallback 里定义了一个 InternalCallbackScope 对象，并在执行完 JS 回调后执行 InternalCallbackScope 的 Close 函数。

```
void InternalCallbackScope::Close() {  
  // 省略部分代码  
  TickInfo* tick_info = env_->tick_info();  
  // 没有 tick 任务则不需要往下走，在插入 tick 任务的时候会设置这个为 true，
  // 没有任务时变成 false  
  if (!tick_info->has_tick_scheduled() && !tick_info->has_rejection_to_warn()) {  
    return;  
  }  
  
  HandleScope handle_scope(env_->isolate());  
  Local<Object> process = env_->process_object();  
  
  // 获取处理 tick 任务的函数  
  Local<Function> tick_callback = env_->tick_callback_function();  
  // 处理 tick 任务  
  if (tick_callback->Call(env_->context(), process, 0, nullptr).IsEmpty()) {  
    failed_ = true;  
  }  
}  
```

Close 函数中会判断是否有 tick 任务需要处理，有到话执行 tick 的处理函数 env_->tick_callback_function，也就是初始化时设置的 JS 函数 processTicksAndRejections，所以每次执行 JS 层的回调时就会处理 tick 任务，流程如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/696e01eb07044eb185995df7d95baa33~tplv-k3u1fbpfcp-zoom-1.image)

2.  Node.js 启动时，执行完用户 JS 后。 在 InternalCallbackScope 对象析构时也会调用 Close 函数，下面是 Node.js 启动的部分代码。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/009f6c3dc07a49a882a6ffc4346f1dd1~tplv-k3u1fbpfcp-zoom-1.image)

在第一个花括号结束后，InternalCallbackScope 对象就会被析构。

```
InternalCallbackScope::~InternalCallbackScope() {
  Close();
}
```

析构函数里会调用 Close，从而处理 tick 任务，我们在主入口 JS 文件里执行 nextTick 函数生成的任务就会在这时候被执行。

3.  补偿处理 因为 tick 属于微任务，根据规范，每执行完一个宏任务就会清空微任务。上面的 1 和 2 都符合这个规范，但也有些特例。首先我们看一下一般处理 JS 回调时的流程。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/db6a513461444065b2be16b6c2b8abde~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，通常一个底层任务完成时，会执行一个 JS 回调，并且是一对一的，比如异步读文件完成后执行用户的 JS 回调，如果回调里产生 tick 任务，则执行完回调后就会被执行。但是定时器和 setImmediate 比较特殊，因为这两个类型的任务做了一些优化，每次执行一次 JS 回调（Node.js 内置的 JS 函数）时会执行多个用户的 JS 回调，如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/444850b7594840a5b89684b68c33e30d~tplv-k3u1fbpfcp-zoom-1.image)

这样就会导致用户 JS 回调里产生的 tick 任务需要等待所有同类型的任务处理完后才能被处理（callback1 回调里产生的tick 任务没有在下一个宏任务（callback2）执行前被处理），而不是执行完一个用户 JS 回调后就被处理，这不符合规范，所以这一部分需要补偿处理一下。具体是通过 runNextTicks 实现的，我们可以看一下相关代码。

```
// Immediate 任务处理函数        
function processImmediate() {
  while (immediate !== null) {
    // 执行第一个任务时不需要执行 runNextTicks，执行后面的任务才需要
    if (ranAtLeastOneImmediate)
      runNextTicks();
    else
      ranAtLeastOneImmediate = true;

  }
}
        
// 定时器任务处理函数
function processTimers(now) {
   
   let ranAtLeastOneList = false;
   while (list = timerListQueue.peek()) {
     if (ranAtLeastOneList)
       runNextTicks();
     else
       ranAtLeastOneList = true;
     listOnTimeout(list, now);
   }
   return 0;
}

function listOnTimeout(list, now) {
    while (timer = L.peek(list)) {
      if (ranAtLeastOneTimer)
        runNextTicks();
      else
        ranAtLeastOneTimer = true;
  }  
```

处理逻辑是类似的，就是除了处理第一个任务不需要执行 runNextTicks 外，处理剩下的任务都需要执行 runNextTicks，因为前一个任务可能会产生 tick 任务。最后看一下处理 tick 任务的具体逻辑，具体实现在 processTicksAndRejections 函数中。

```
function processTicksAndRejections() {  
  let tock;  
  do {  
    while (tock = queue.shift()) {  
      try {  
        const callback = tock.callback;  
        if (tock.args === undefined) {  
          callback();  
        } else {  
          const args = tock.args;  
          switch (args.length) {  
            case 1: callback(args[0]); break;  
            case 2: callback(args[0], args[1]); break;  
            case 3: callback(args[0], args[1], args[2]); break;  
            case 4: callback(args[0], args[1], args[2], args[3]); break;  
            default: callback(...args);  
          }  
        }  
      } finally {  
        //  。。。
      }   
    }  
    // 执行微任务，比如 Promise
    runMicrotasks();  
  } while (!queue.isEmpty() || processPromiseRejections()); 
  // 处理完设置标记 
  setHasTickScheduled(false);  
  setHasRejectionToWarn(false);  
}  
```

从 processTicksAndRejections 代码中我们可以看到，除了处理了 tick 任务外，还处理了其他微任务，比如 Promise。但有一个问题需要处理，就是 Node.js 是实时从任务队列里取节点执行的，如果我们在 nextTick 的回调里一直调用 nextTick 的话，就会导致死循环。

```
function test() {  
  process.nextTick(() => {  
    console.log(1);  
    test()  
  });  
}  
test();  
  
setTimeout(() => {  
 console.log(2)  
}, 10);
```

上面的代码中，会一直输出 1，不会输出 2，所以我们需要防止 nextTick 的嵌套调用。

## 使用

我们知道 nextTick 可用于延迟执行一些逻辑，我们看一下哪些场景下可以使用 nextTick。

```
const { EventEmitter } = require('events');  
class DemoEvents extends EventEmitter {  
  constructor() {  
    super();  
    this.emit('start');  
  }  
}  
  
const demoEvents = new DemoEvents();  
demoEvents.on('start', () => {  
  console.log('start');  
});  
```

以上代码在构造函数中会触发 start 事件，但是事件的注册却在构造函数之后执行，而在构造函数之前我们还没有拿到 DemoEvents 对象，无法完成事件的注册。这时候，我们就可以使用nextTick。

```
const { EventEmitter } = require('events');  
class DemoEvents extends EventEmitter {  
  constructor() {  
    super();  
    process.nextTick(() => {  
      this.emit('start');  
    })  
  }  
}  
  
const demoEvents = new DemoEvents();  
demoEvents.on('start', () => {  
  console.log('start');  
});  
```

# 定时器

Node.js V14 对定时器模块进行了重构，之前版本的实现是用一个 map，以超时时间为键，每个键对应一个队列，即有同样相对超时时间的节点在同一个队列，每个队列对应 Libuv 的一个定时器节点（二叉堆里的节点）。Node.js 在事件循环的 timer 阶段会从二叉堆里找出超时的节点，然后执行回调，回调里会遍历队列，判断哪个节点超时了。

  


因为定时器是高频操作，JS 到 C、C++ 层数据转换的开销、内存申请 / 回收的开销等都会影响性能，所以重构后，Node.js 只使用了一个二叉堆的节点。我们看一下它的实现，首先是定时器模块的整体关系图，如下所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bf56007efed3434096c48dfbd98dc20a~tplv-k3u1fbpfcp-zoom-1.image)

我们可以看到：

1.  Node.js在 JS 层维护了一个二叉堆；
1.  堆的每个节点维护了一个链表，这个链表中最久超时的排到后面；
1.  此外，Node.js 还维护了一个 map，map 的 key 是相对超时时间，值就是对应的二叉堆节点；
1.  堆的所有节点对应底层的一个超时节点。

当我们调用 setTimeout 的时候，首先根据 setTimeout 的入参，从 map 中找到二叉堆节点，然后插入链表的尾部。必要的时候，Node.js 会根据 JS 二叉堆的最快超时时间来更新底层节点的超时时间。当事件循环处理定时器阶段的时候，Node.js 会遍历 JS 二叉堆，然后拿到过期的节点，再遍历过期节点中的链表，逐个判断是否需要执行回调。必要的时候调整 JS 二叉堆和底层的超时时间。以上就是定时器的大致原理，深入讲解实现前，我们首先了解下定时器相关的几个核心数据结构。

## 核心数据结构

核心数据结构主要包括 TimersList 和优先队列，下面我们分别来看。首先，我们来说说 TimersList。

相对超时时间一样的定时器会被放到同一个队列，比如当前执行 setTimeout(()=>{}, 10000}) 和 5 秒后执行 setTimeout(()=>{}, 10000})，这两个任务就会在同一个 List 中，这个队列由TimersList 来管理。

```
function TimersList(expiry, msecs) {  
  // 用于链表  
  this._idleNext = this;   
  this._idlePrev = this;   
  // 绝对时间
  this.expiry = expiry;  
  this.id = timerListId++; 
  // 相对时间
  this.msecs = msecs;  
  // 在优先队列里的位置  
  this.priorityQueuePosition = null;  
}  
```

expiry 记录的是链表中最快超时的节点的绝对时间。每次执行定时器阶段时会动态更新，msecs 是超时时间的相对值（相对插入时的当前时间），用于计算该链表中的节点是否超时。后续我们会看到具体的用处。

1.  优先队列

```
const timerListQueue = new PriorityQueue(compareTimersLists, setPosition)  
```

Node.js 用优先队列对所有 TimersList 链表进行管理，优先队列本质是一个二叉堆（小根堆），每个 TimersList 链表在二叉堆里对应一个节点。根据 TimersList 的结构，我们知道每个链表都保存链表中最快到期的节点的过期时间。二叉堆以该时间为依据，即最快到期的 list 对应二叉堆中的根节点。根节点的到期时间就是整个 Node.js 定时器最快到期的时间，Node.js 把 Libuv 中定时器节点的超时时间设置为该值，在事件循环的定时器阶段就会处理定时的节点，并且不断遍历优先队列，判断当前节点是否超时，如果超时就需要处理，否则就说明整个二叉堆的节点都没有超时。然后重新设置 Libuv 定时器节点新的到期时间。

另外，Node.js 中用一个 map 保存了超时时间到 TimersList 链表的映射关系。 这样可以根据相对超时时间快速找到对应的列表，利用空间来换时间。了解完定时器整体的组织和核心数据结构，我们可以开始进入真正的分析了。

## 初始化

Node.js 在初始化的时候设置了处理定时器的函数。

```
setupTimers(..., processTimers);  
```

setupTimers 对应的 C++ 函数是 SetupTimers。

```
void SetupTimers(const FunctionCallbackInfo<Value>& args) {  
  auto env = Environment::GetCurrent(args);  
  env->set_timers_callback_function(args[1].As<Function>());  
} 
```

除了设置处理函数外，还需要设置超时的回调函数。Node.js 会每次调用 setTimeout 时会计算当前最快超时时间，然后执行 scheduleTimer 设置 Libuv 中对应节点的超时时间。

```
void ScheduleTimer(const FunctionCallbackInfo<Value>& args) {  
  auto env = Environment::GetCurrent(args);  
  env->ScheduleTimer(args[0]->IntegerValue(env->context()).FromJust());  
}  
  
void Environment::ScheduleTimer(int64_t duration_ms) {  
  if (started_cleanup_) return;  
  uv_timer_start(timer_handle(), RunTimers, duration_ms, 0);  
}  
```

ScheduleTimer 用于设置 Libuv 中定时器的超时时间，回调函数是 RunTimers。当有节点超时的时候，Node.js 会执行 RunTimers 函数处理超时的节点，后续会看到该函数的具体处理逻辑。那么，如何设置一个定时器呢？

## 创建定时器

```
function setTimeout(callback, after, arg1, arg2, arg3) {  
  // 忽略处理参数args逻辑
    // 新建一个Timeout对象
  const timeout = new Timeout(callback, 
                              after, 
                              args, 
                              false, 
                              true);  
  insert(timeout, timeout._idleTimeout);  
  return timeout;  
}  
```

setTimeout 主要包含两个操作，new Timeout 和 insert，我们逐个来分析。

```
function Timeout(callback, after, args, isRepeat, isRefed) {  
  after *= 1;
  if (!(after >= 1 && after <= TIMEOUT_MAX)) { 
    after = 1; 
  }  
  // 超时时间相对值  
  this._idleTimeout = after;  
  // 前后指针，用于链表  
  this._idlePrev = this;  
  this._idleNext = this;  
  // 定时器的开始时间  
  this._idleStart = null; 
  // 超时回调    
  this._onTimeout = callback;  
  // 执行回调时传入的参数  
  this._timerArgs = args;  
  // 是否定期触发超时，用于 setInterval  
  this._repeat = isRepeat ? after : null;  
  this._destroyed = false;  
  // 激活底层的定时器节点（二叉堆的节点），说明有定时节点需要处理  
  if (isRefed)  
    incRefCount(); 
  // 记录状态 
  this[kRefed] = isRefed;  
 }  
```

Timeout 主要是新建一个对象记录一些定时器的上下文信息，这里有一个关键的逻辑是 isRefed的值。Node.js 支持 ref 和 unref 状态的定时器（setTimeout 和 setUnrefTimeout），unref 状态的定时器不会影响事件循环的退出。即只有 unref 状态的定时器时，事件循环会结束，当 isRefed 为 true 时会执行 incRefCount();

```
function incRefCount() {  
  if (refCount++ === 0)  
    toggleTimerRef(true);  
}  
  
void ToggleTimerRef(const FunctionCallbackInfo<Value>& args) {  
  Environment::GetCurrent(args)->ToggleTimerRef(args[0]->IsTrue());  
}  
  
void Environment::ToggleTimerRef(bool ref) {  
  if (started_cleanup_) return;  
  // 打上 ref 标记，  
  if (ref) {  
    uv_ref(reinterpret_cast<uv_handle_t*>(timer_handle()));  
  } else {  
    uv_unref(reinterpret_cast<uv_handle_t*>(timer_handle()));  
  }  
}  
```

我们看到最终会调用 Libuv 的 uv_ref 或 uv_unref 修改定时器相关 handle 的状态，因为 Node.js 只会在 Libuv 中注册一个定时器 handle 并且是常驻的，如果 JS 层当前没有设置定时器，则需要修改定时器 handle 的状态为 unref，否则会影响事件循环的退出。

refCount 值便是记录 JS 层 ref 状态的定时器个数的，所以当我们第一次执行 setTimeou t的时候，Node.js 会激活 Libuv 的定时器节点，为 0 时就会清除 ref 状态。接着，我们看一下 insert。

```
let nextExpiry= Infinity;
// item 为刚才创建的 Timeout 对象，msecs 为相对超时时间
function insert(item, msecs, start = getLibuvNow()) {  
  msecs = MathTrunc(msecs);  
  // 记录定时器的开始时间 
  item._idleStart = start;  
  // 该相对超时时间是否已经存在对应的链表  
  let list = timerListMap[msecs];  
  // 还没有  
  if (list === undefined) {  
    // 算出绝对超时时间，第一个节点是该链表中最早到期的节点  
    const expiry = start + msecs;  
    // 新建一个链表  
    timerListMap[msecs] = list = new TimersList(expiry, msecs);  
    // 插入优先队列  
    timerListQueue.insert(list);  
    /*
      nextExpiry 记录所有超时节点中最快到期的节点，
      如果有更快到期的，则修改底层定时器节点的过期时间  
    */
    if (nextExpiry > expiry) {  
      // 修改底层超时节点的超时时间  
      scheduleTimer(msecs);  
      nextExpiry = expiry;  
    }  
  }  
  // 把当前节点加到链表里  
  L.append(list, item);  
}  
```

Insert 的主要逻辑如下。

1.  如果该超时时间还没有对应的链表，则新建一个链表，每个链表都会记录该链表中最快到期的节点的值，即第一个插入的值。然后把链表插入优先队列，优先队列会根据该链表的最快过期时间的值，把链表对应的节点调整到相应的位置。
1.  如果当前设置的定时器比之前所有的定时器都快到期，则需要修改底层的定时器节点，使得更快触发超时。
1.  把当前的定时器节点插入对应的链表尾部，即该链表中最久超时的节点。

接着，来看一下不同情况下对应的结构图。

假设我们在 0s 的时候插入一个节点，下面是插入第一个节点时的结构图如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7018bf5fab50422395cc969e7f851bbe~tplv-k3u1fbpfcp-zoom-1.image)

我们再来看看多个节点的情况。假设 0s 的时候插入两个节点 10s 过期和 11s 过期。如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ca9be3b0247c493086011317b86e2824~tplv-k3u1fbpfcp-zoom-1.image)

然后在 1s 的时候，插入一个新的 11s 过期的节点，9s 的时候插入一个新的 10s 过期节点。这时候的关系图如下所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3eff9a3a23e541238c8ef55d39bab58e~tplv-k3u1fbpfcp-zoom-1.image)

我们看到优先队列中，每一个节点是 TimeList，它是一个链表，父节点对应链表的第一个元素比子节点链表的第一个元素先超时，但链表中后续节点的超时就不一定，比如子节点 1s 开始的节点就比父节点 9s 开始的节点先超时，因为同一队列只是相对超时时间一样，但是开始的时间也是一个重要的因素，即使节点的相对超时时间长，只要开始得早，那么就有可能先超时。

## 处理定时器

从前面的分析中我们可以知道，定时器处理函数是 RunTimers，RunTimers 会执行 timers_callback_function，timers_callback_function 是在 Node.js 初始化的时候设置的 processTimers 函数。

```
void Environment::RunTimers(uv_timer_t* handle) {  
    Local<Function> cb = env->timers_callback_function();  
    MaybeLocal<Value> ret;  
    Local<Value> arg = env->GetNow();  
    
    do {  
        // 执行 JS processTimers 函数  
        ret = cb->Call(env->context(), process, 1, &arg);  
    } while (ret.IsEmpty() && env->can_call_into_js());  
    
    // 如果还有未超时的节点，则 ret 为第一个未超时的节点的超时时间
    int64_t expiry_ms = ret.ToLocalChecked()->IntegerValue(env->context()).FromJust();  
    uv_handle_t* h = reinterpret_cast<uv_handle_t*>(handle);  
  
    /*  
      1 等于 0 说明所有节点都执行完了，但是定时器节点还是在 Libuv 中， 
        需要改成 unref 状态，让 Libuv 可以退出。
        
      2 不等于 0 说明没有还要节点需要处理，这种情况又分为两种 
        1 还有激活状态的定时器，即不允许事件循环退出 
        2 定时器都是非激活状态的，允许事件循环退出
    */  
    if (expiry_ms != 0) {  
        // 算出下次超时的相对值  
        int64_t duration_ms = llabs(expiry_ms) - (uv_now(env->event_loop()) - env->timer_base());  
        // 重新把 handle 插入 Libuv 的二叉堆 ，更新定时器超时时间 
        env->ScheduleTimer(duration_ms > 0 ? duration_ms : 1);  
        /* 
          见 internal/timer.js 的 processTimers 
          1 大于 0 说明还有节点没超时，并且不允许事件循环退出， 
            需要保持定时器的 ref 状态（如果之前是 ref 状态则不影响）， 
          2 小于 0 说明定时器不影响 Libuv 的事件循环的结束，改成 unref 状态 
        */  
        if (expiry_ms > 0)  
          uv_ref(h);  
        else  
          uv_unref(h);  
    } else {  
      uv_unref(h);  
    }  
}
```

RunTimers 函数主要是执行 JS 回调函数处理定时器，并重新设置 Libuv 定时器的时间和状态。下面是 JS 处理函数 processTimers 的逻辑。

```
function processTimers(now) {  
   nextExpiry = Infinity;  
   let list;  
   let ranAtLeastOneList = false;  
   // 取出优先队列的根节点，即最快到期的节点  
   while (list = timerListQueue.peek()) {  
     // 还没过期，则取得下次到期的时间，重新设置超时时间  
     if (list.expiry > now) {  
       nextExpiry = list.expiry;  
       // 返回下一次过期的时间，负的说明允许事件循环退出  
       return refCount > 0 ? nextExpiry : -nextExpiry;  
     }  
 
     // 处理超时节点
     listOnTimeout(list, now);  
   }  
   // 所有节点都处理完了
   return 0;  
 }  
 
 // 处理一个 list 里的节点
 function listOnTimeout(list, now) {  
   const msecs = list.msecs;  
   let ranAtLeastOneTimer = false;  
   let timer;  
   // 遍历具有统一相对过期时间的队列  
   while (timer = L.peek(list)) {  
     // 算出已经过去的时间  
     const diff = now - timer._idleStart;  
     // 过期的时间比超时时间小，还没过期  
     if (diff < msecs) {  
       /* 
           整个链表节点的最快过期时间等于当前
           还没过期节点的值，链表是有序的  
       */
       list.expiry = MathMax(timer._idleStart + msecs, now + 1);  
       // 更新 id，用于决定在优先队列里的位置  
       list.id = timerListId++;  
       /*
           调整过期时间后，当前链表对应的节点不一定是优先队列
           里的根节点了，可能有它更快到期，即当前链表对应的节
           点可能需要往下沉
       */  
       timerListQueue.percolateDown(1);  
       return;  
     }  
 
     // 准备执行用户设置的回调，删除这个节点  
     L.remove(timer);  
 
     let start;  
     if (timer._repeat)  
       start = getLibuvNow(); 
     try {  
       const args = timer._timerArgs;  
       // 执行用户设置的回调  
       timer._onTimeout(...args);  
     } finally {  
       /* 
           设置了重复执行回调，即来自 setInterval。
           则需要重新加入链表。  
       */
       if (timer._repeat && timer._idleTimeout !== -1) {  
         // 更新超时时间，一样的时间间隔  
         timer._idleTimeout = timer._repeat;  
         // 重新插入链表  
         insert(timer, timer._idleTimeout, start);  
       } else if (!timer._idleNext && 
                  !timer._idlePrev && 
                  !timer._destroyed) {          
             timer._destroyed = true;
             // 是 ref 类型，则减去一个，防止阻止事件循环退出  
         if (timer[kRefed])  
           refCount--;  
   }  
   // 为空则删除  
   if (list === timerListMap[msecs]) {  
     delete timerListMap[msecs];  
     // 从优先队列中删除该节点，并调整队列结构
     timerListQueue.shift();  
   }  
 }  
```

上面的代码主要是遍历优先队列，处理逻辑如下。

1.  如果当前节点超时，则遍历它对应的链表，遍历链表的时候如果遇到超时的节点则执行，如果遇到没有超时的节点，则说明后面的节点也不会超时了，因为链表是有序的。接着重新计算出最快超时时间，修改链表的 expiry 字段，调整在优先队列的位置，因为修改后的 expiry 可能会导致位置发生变化。如果链表的节点全部都超时了，则从优先队列中删除链表对应的节点，重新调整优先队列的节点。
1.  如果当前节点没有超时则说明后面的节点也不会超时了，因为当前节点是优先队列中最快到期（最小的）的节点。接着设置 Libuv 的定时器时间为当前节点的时间，等待下一次超时处理。

# 总结

这节课详细讲解了 Node.js 的三个产生异步任务的 API，分别是 setImmediate、nextTick 和 setTimeout。这些 API 的使用很简单，但我们依然需要花时间去理解它们的原理和实现，因为这些知识在面试中经常会被问到，比如 nextTick 相关的知识点，以及 setImmediate 和 setTimeout 谁先执行这样的问题。面试官不仅想要知道你的答案，他更想知道你的分析过程。

此外，从 nextTick 的实现中我们也可以深刻理解宏任务和微任务的执行机制。这节课的最后我们再来简单回顾下重点知识。

1.  setImmediate 通过队列维护了所有的任务，然后在 check 阶段进行处理。值得注意的是 immediate，还通过一个额外的 idle 节点来控制事件循环是否可以阻塞，从而保证 immediate 任务可以尽快执行。
1.  nextTick 也是通过队列维护了所有的任务，然后在每次执行完宏任务后处理所有的 tick 任务和 Promise 任务。这个执行时机一共有三种：第一种是从 Libuv 回调 C++ 再到 JS 之后；第二种是 Node.js 启动后进入事件循环之前；第三种是来自处理 immediate 和 timeout 任务时的补偿处理，使得 Node.js 符合宏任务和微任务的处理规范。
1.  setTimeout 的实现比较复杂，主要是因为定时器的操作频繁，所以 Node.js 做了很多性能优化。setTimeout 是基于 Libuv 定时器的，但只使用了 Libuv 的一个定时器节点，具体的任务是在 JS 层通过 map 和一个优先队列管理的，并且实现了复杂的算法和逻辑管理了 JS 层的数据结构。从中可以看到一个简单的 API 在 Node.js 中的实现也不一定简单。