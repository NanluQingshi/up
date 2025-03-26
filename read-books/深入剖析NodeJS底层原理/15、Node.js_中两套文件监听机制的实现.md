上节课我们讲解了文件系统的概念和 Node.js 中文件操作 API 的实现。Node.js 中，除了提供文件操作的功能之外，还有另一个功能，那就是**文件监听**。文件监听是非常常用的功能，比如我们修改了文件后， 要使用 Webpack 重新打包代码或者重启 Node.js 服务都会用到这个功能。那么，Node.js 中的文件监听是如何实现的呢？

  


在 Node.js 中，实现监听的方式有两种，第一种就是定时轮询文件元信息是否有变化，第二种是通过订阅 / 发布机制订阅事件，当文件有变化时主动通知。显然，第二种实现方式更高效，就像前面讲的事件驱动模块一样，观察者订阅事件，当事件触发时，操作系统通知观察者，而不是观察者以不断轮询的方式去判断，这样会浪费资源。但是不像事件驱动模块那样，事件驱动模块虽然各个操作系统有自己的实现，但是大多数主流操作系统都支持，而基于订阅 / 发布机制的文件监听机制在不同操作系统中支持的情况不一样，具体可以参考[文档](https://nodejs.org/dist/latest-v19.x/docs/api/fs.html#fswatchfilename-options-listener)。正是因为基于轮询的方式不依赖于平台，所以 Node.js 里才会实现两套文件监听机制供用户选择。

  


这一节课，我们就来具体分析下 Node.js 中这两种文件监听方式的实现。

### 基于轮询的文件监听机制

首先来看基于轮询机制的方式，对应的 API 是 watchFile。它的实现原理是**定时获取文件** **元信息** **，然后判断当前的元信息和上次的元信息有没有变化，有** **的** **话执行回调通知用户**，以下是具体实现。

```
function watchFile(filename, options, listener) {  
  filename = getValidatedPath(filename);  
  filename = pathModule.resolve(filename);  
  let stat;  
  // 省略部分参数处理逻辑  
  options = {  
    interval: 5007,  
    // 是否阻止事件循环的退出 
    persistent: true,  
    ...options  
  };  
  
  // 缓存处理，filename 是否已经开启过监听  
  stat = statWatchers.get(filename);  
  
  if (stat === undefined) {  
    if (!watchers)  
      watchers = require('internal/fs/watchers');  
    stat = new watchers.StatWatcher(options.bigint);  
    // 开启监听  
    stat[watchers.kFSStatWatcherStart](filename,        
                                           options.persistent, 
                                           options.interval);  
    // 更新缓存            
    statWatchers.set(filename, stat);  
  }    
  stat.addListener('change', listener);  
  return stat;  
}  
```

在上面的实现中，watchFile 通过缓存的方式做了一些性能优化，因为当我们多次监听同一个文件时，Node.js 并不是在底层开启多个定时器，而是在 JS 层保存了多个订阅者，然后开启一个定时器进行轮询，当内容发生变化时，Node.js 会通知多个订阅者。除了缓存处理外，真正监听的功能由 internal/fs/watchers 模块的 StatWatcher 实现。watchFile 函数创建一个 StatWatcher 对象后，接着调用它的 watchers.kFSStatWatcherStart 方法开启监听。下面，我们来看看如何实现。

```
StatWatcher.prototype[kFSStatWatcherStart] = function(filename,persistent, interval) {  
  this._handle = new _StatWatcher(this[kUseBigint]);  
  // 文件监听是否会阻止事件循环的退出
  if (!persistent)
    this._handle.unref();
  // 文件变化执行的回调
  this._handle.onchange = onchange;  
  filename = getValidatedPath(filename, 'filename'); 
  this._handle.start(toNamespacedPath(filename), interval);  
}  
```

上面 kFSStatWatcherStart 函数中首先新建一个_StatWatcher对象，_StatWatcher 是 C++ 模块提供的 StatWatcher 对象，实现如下。

```
StatWatcher::StatWatcher(fs::BindingData* binding_data,
                         Local<Object> wrap,
                         bool use_bigint)
    : HandleWrap(...) {
  // uv_fs_poll_t watcher_;    
  uv_fs_poll_init(env()->event_loop(), &watcher_);
}
```

StatWatcher 是对 Libuv uv_fs_poll_t 的封装，uv_fs_poll_t 用来管理一个文件监听结构体，StatWatcher 构造函数里调用 uv_fs_poll_init 对 uv_fs_poll_t 结构体进行了初始化。

```
int uv_fs_poll_init(uv_loop_t* loop, uv_fs_poll_t* handle) {
  uv__handle_init(loop, (uv_handle_t*)handle, UV_FS_POLL);
  handle->poll_ctx = NULL;
  return 0;
}
```

从上面的代码中可以看到，uv_fs_poll_init 只是做了一些简单的初始化工作。

  


那创建了 StatWatcher 后，我们接着调用了它的 start 方法，对应 C++ 函数为 StatWatcher::Start。

```
void StatWatcher::Start(const FunctionCallbackInfo<Value>& args) {
  StatWatcher* wrap;
  ASSIGN_OR_RETURN_UNWRAP(&wrap, args.Holder());
  // 监听的文件
  node::Utf8Value path(args.GetIsolate(), args[0]);
  // 轮询时间
  const uint32_t interval = args[1].As<Uint32>()->Value();
  // 开始定时轮询
  uv_fs_poll_start(&wrap->watcher_, Callback, *path, interval);
}
```

StatWatcher::Start 里做了简单的参数处理后，接着调用 uv_fs_poll_start 开始了文件的监听。

```
int uv_fs_poll_start(uv_fs_poll_t* handle,
                     uv_fs_poll_cb cb,
                     const char* path,
                     unsigned int interval) {
  struct poll_ctx* ctx;
  uv_loop_t* loop;
  size_t len;
  int err;

  loop = handle->loop;
  len = strlen(path);
  // 创建 struct poll_ctx 管理文件监听
  ctx = uv__calloc(1, sizeof(*ctx) + len);
  ctx->loop = loop;
  // 调用者回调，文件变化时执行
  ctx->poll_cb = cb;
  // 轮询时间
  ctx->interval = interval ? interval : 1;
  // 上次轮询的开始时间
  ctx->start_time = uv_now(loop);
  // 关联的 hande（uv_fs_poll_t）
  ctx->parent_handle = handle;
  memcpy(ctx->path, path, len + 1);
  // 初始化定时器
  uv_timer_init(loop, &ctx->timer_handle);
  ctx->timer_handle.flags |= UV_HANDLE_INTERNAL;
  // 这个定时器不影响事件循环退出
  uv__handle_unref(&ctx->timer_handle);
  // 异步读取文件元信息
  uv_fs_stat(loop, &ctx->fs_req, ctx->path, poll_cb);
  // handle 和 ctx 互相关联
  handle->poll_ctx = ctx;
  uv__handle_start(handle);
  return 0;
}
```

uv_fs_poll_start 初始化了轮询相关的上下文，然后执行 uv_fs_stat 获取文件的元信息，因为轮询机制的原理是对比前后两次文件的元信息是否发生变化，获取成功后执行 poll_cb。

```
static void poll_cb(uv_fs_t* req) {
  uv_stat_t* statbuf;
  struct poll_ctx* ctx;
  uint64_t interval;
  uv_fs_poll_t* handle;

  ctx = container_of(req, struct poll_ctx, fs_req);
  handle = ctx->parent_handle;
  // 获取元信息
  statbuf = &req->statbuf;
  // busy_polling 等于 0 说明是第一次回调，第一次时不需要判断文件是否有变化
  // busy_polling 不等于 0 说明不是第一次回调，通过 statbuf_eq 判断文件
  // 元信息是否发生了变化，是则通知调用方
  if (ctx->busy_polling != 0)
    if (ctx->busy_polling < 0 || !statbuf_eq(&ctx->statbuf, statbuf))
      ctx->poll_cb(ctx->parent_handle, 0, &ctx->statbuf, statbuf);
  // 记录文件当前的元信息
  ctx->statbuf = *statbuf;
  // 设置标记
  ctx->busy_polling = 1;
  // 轮询间隔
  interval = ctx->interval;
  // 超时回调可能有延迟，比如被其他代码执行比较耗时或者阻塞了一段时间，
  // 这里计算延迟时间，并减去延迟的时间，下次超时时间会小于 interval
  interval -= (uv_now(ctx->loop) - ctx->start_time) % interval;
  // 重启定时器
  uv_timer_start(&ctx->timer_handle, timer_cb, interval, 0);
}
```

poll_cb 中主要的逻辑是判断文件的元信息是否发生了变化，比如修改时间、文件大小的话，具体判断在 statbuf_eq 函数中。

```
static int statbuf_eq(const uv_stat_t* a, const uv_stat_t* b) {
  return a->st_ctim.tv_nsec == b->st_ctim.tv_nsec
      && a->st_mtim.tv_nsec == b->st_mtim.tv_nsec
      && a->st_birthtim.tv_nsec == b->st_birthtim.tv_nsec
      && a->st_ctim.tv_sec == b->st_ctim.tv_sec
      && a->st_mtim.tv_sec == b->st_mtim.tv_sec
      && a->st_birthtim.tv_sec == b->st_birthtim.tv_sec
      && a->st_size == b->st_size
      && a->st_mode == b->st_mode
      && a->st_uid == b->st_uid
      && a->st_gid == b->st_gid
      && a->st_ino == b->st_ino
      && a->st_dev == b->st_dev
      && a->st_flags == b->st_flags
      && a->st_gen == b->st_gen;
}
```

如果文件元信息有变化则通知订阅者，对应的是 C++ 的 Callback 函数。

```
void StatWatcher::Callback(uv_fs_poll_t* handle,
                           int status,
                           const uv_stat_t* prev,
                           const uv_stat_t* curr) {
  StatWatcher* wrap = ContainerOf(&StatWatcher::watcher_, handle);
  Environment* env = wrap->env();
  Local<Value> arr = fs::FillGlobalStatsArray(env, wrap->use_bigint_, curr);
  USE(fs::FillGlobalStatsArray(env, wrap->use_bigint_, prev, true));

  Local<Value> argv[2] = { Integer::New(env->isolate(), status), arr };
  // 回调 JS 层的 onchange 函数
  wrap->MakeCallback(env->onchange_string(), arraysize(argv), argv);
}
```

C++ 层会执行 JS 层的 onchange 函数。

```
function onchange(newStatus, stats) {
  const self = this[owner_symbol];
  self.emit('change', getStatsFromBinding(stats),
            getStatsFromBinding(stats, kFsStatsFieldsNumber));
}
```

最终触发 onchange 事件，执行用户订阅的回调。

  


Libuv 处理完一轮轮询后，接着重新计算下次超时时间，因为 Libuv 是在单线程内执行事件循环的。如果有一个任务耗时比较长或者引起了线程阻塞，则会导致定时器没有按时执行超时回调，这被称为事件循环延时。如果存在延时，则下一次超时的时间会变短。计算出下一次超时时间后，接着执行 uv_timer_start 重启定时器等待下一次超时。这就是基于轮询的文件监听机制。

### 基于 inotify 的文件监听机制（Linux）

从上面的分析中可以看到，基于轮询的监听机制效率是很低的，因为 Node.js 需要不断地去获取文件的元数据，判断元信息是否有变化。如果文件大部分时间里都没有变化，就会白白浪费 CPU 和其他资源。那文件改变了操作后，系统能不能主动通知我们呢？当然可以，这就要用到基于 inotify 的文件监听机制。inotify 是 Linux 操作系统提供机制，使用方式如下。

1.  首先通过 init_inotify 创建一个 inotify 的实例，然后拿到一个文件描述符（Linux 万物皆文件）。
1.  当需要监听一个文件时，执行 inotify_add_watch 系统调用注册一个需监听的文件，拿到一个唯一的 id。
1.  当不再需要监听一个文件时，执行 inotify_rm_watch 系统调用告诉操作系统不再监听这个文件。
1.  注册可读事件，当可读事件触发时，执行 read 系统调用，拿到数据和数据的字节数，数据中保存了哪些文件发生了变化。

#### Libuv 中的 inotify 机制

下面来看一下如何使用 Libuv 提供的 inotify 监听机制，首先创建两个文件 test.c 和 test.js，test.c 代码如下。

```
#include <stdio.h>
#include <uv.h>

void onchange(...) {
    // 文件发生了变化
}

int main(int argc, char **argv) {    
    uv_fs_event_t req;
    // 初始化 fs_event_req 结构体  
    uv_fs_event_init(uv_default_loop(), &req);
    // 向底层注册监听文件 argv[1], onchange 是回调
    uv_fs_event_start(&req, onchange, argv[1], 0);  
    return uv_run(uv_default_loop(), UV_RUN_DEFAULT);  
} 
```

通过 gcc test.c -luv -o test && ./test test.js 命令编译执行以上代码，然后修改 test.js 的内容，可以看到输出 change，说明内容发生了变化。

  


了解了 inotify 的基础后，接着分析 Libuv 中的实现。在第一次监听文件时，Libuv 会执行 init_inotify 初始化 inotify 相关的数据结构。

```
static int init_inotify(uv_loop_t* loop) {
  // 执行系统调用 inotify_init 创建一个 inotify 实例，然后把返回的 fd 保存到 loop 中
  loop->inotify_fd = new_inotify_fd();
  // 初始化 IO 观察者 inotify_read_watcher，有文件发生变化时，执行 uv__inotify_read 回调
  uv__io_init(&loop->inotify_read_watcher, uv__inotify_read, loop->inotify_fd);
  // 设置 IO 观察者感兴趣的事件为可读，在 Poll IO 阶段注册到操作系统的事件驱动模块
  uv__io_start(loop, &loop->inotify_read_watcher, POLLIN);
  return 0;
}
```

init_inotify 首先通过系统调用创建了一个 inotify 示例并拿到一个 fd，然后注册该 fd 的可读事件并等待事件触发。

  


了解了 inotify 的初始化逻辑后，我们接着看注册监听文件信息的逻辑。

```
nt uv_fs_event_start(uv_fs_event_t* handle,
                      uv_fs_event_cb cb,
                      const char* path,
                      unsigned int flags) {
  struct watcher_list* w;
  int events;
  int err;
  int wd;

  // 初始化 inotify
  init_inotify(handle->loop);
  // 感兴趣的事件
  events = UV__IN_ATTRIB
         | UV__IN_CREATE
         | UV__IN_MODIFY
         | UV__IN_DELETE
         | UV__IN_DELETE_SELF
         | UV__IN_MOVE_SELF
         | UV__IN_MOVED_FROM
         | UV__IN_MOVED_TO;
  // 如果这个文件之前没有注册过，则把文件注册到 inotify 实例中，拿到这个文件对应的 id
  // 如果这个文件之前已经注册过了，则直接返回对应的 id
  wd = uv__inotify_add_watch(handle->loop->inotify_fd, path, events);
  // Libuv 维护了一棵红黑树，通过 id 判断该文件是否存在 Libuv 的红黑树中
  w = find_watcher(handle->loop, wd);
  // 如果已经存在红黑树中则不再插入
  if (w)
    goto no_insert;
  // 还没有注册过则插入 Libuv 维护的红黑树
  w = uv__malloc(sizeof(*w) + strlen(path) + 1);
  // 如果不在红黑树中，则创建一个 struct watcher_list 结构体，
  // 并记录相关信息到该结构体，然后把它插入红黑树
  w->wd = wd;
  w->path = strcpy((char*)(w + 1), path);
  // 初始化订阅者队列
  QUEUE_INIT(&w->watchers);
  w->iterating = 0;
  // 插入 Libuv 的红黑树, inotify_watchers 是根节点，
  // 一个文件对应红黑树一个节点，一个节点对应管理多个订阅者
  RB_INSERT(watcher_root, CAST(&handle->loop->inotify_watchers), w);

no_insert:
  // 激活该handle
  uv__handle_start(handle);
  // 因为可能有多个订阅者对同一个文件感兴趣，所以一个红黑树节点维护了一个订阅者队列
  QUEUE_INSERT_TAIL(&w->watchers, &handle->watchers);
  // 保存上下文
  handle->path = w->path;
  handle->cb = cb;
  handle->wd = wd;

  return 0;
}
```

操作系统只支持当文件发生变化时通知调用方，在这个基础上，调用方需要自己维护订阅者，Libuv 中使用红黑树维护了文件和订阅者的关系，结构体如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a069c1792db64263a8df1388f9d3cff3~tplv-k3u1fbpfcp-zoom-1.image)

当文件发生变化时，Libuv 会在 Poll IO 阶段进行处理，处理函数是 uv__inotify_read 。

```
static void uv__inotify_read(uv_loop_t* loop,
                             uv__io_t* dummy,
                             unsigned int events) {
  const struct uv__inotify_event* e;
  struct watcher_list* w;
  uv_fs_event_t* h;
  QUEUE queue;
  QUEUE* q;
  const char* path;
  ssize_t size;
  const char *p;
  /* needs to be large enough for sizeof(inotify_event) + strlen(path) */
  char buf[4096];
  // 每次只读 4096 字节，如果数据过多则需要读多次
  while (1) {
    do
      // 读取数据，size 是读取到的数据的字节数，buffer 保存了具体的数据
      size = read(loop->inotify_fd, buf, sizeof(buf));
    while (size == -1 && errno == EINTR);
    // 没有数据可取了，跳出循环
    if (size == -1) {
      // 错误码必须的是繁忙（没有数据可读了），而不是其他错误
      assert(errno == EAGAIN || errno == EWOULDBLOCK);
      break;
    }
    // 解析 buffer 的数据
    for (p = buf; p < buf + size; p += sizeof(*e) + e->len) {
      // buffer 里是多个 uv__inotify_event 结构体，
      // uv__inotify_event 结构体里是触发的事件信息和文件对应的 id
      e = (const struct uv__inotify_event*)p;
      // 判断触发的事件
      events = 0;
      if (e->mask & (UV__IN_ATTRIB|UV__IN_MODIFY))
        events |= UV_CHANGE;
      if (e->mask & ~(UV__IN_ATTRIB|UV__IN_MODIFY))
        events |= UV_RENAME;
      // 根据文件对应的 id（wd 字段）从红黑树中找到对应的 struct watcher_list 节点
      w = find_watcher(loop, e->wd);
      
      path = e->len ? (const char*) (e + 1) : uv__basename_r(w->path);
      w->iterating = 1;
      // 每个红黑树节点对应一个订阅者队列，开始通知每个订阅者
      QUEUE_MOVE(&w->watchers, &queue);
      while (!QUEUE_EMPTY(&queue)) {
        // 头结点
        q = QUEUE_HEAD(&queue);
        // 通过结构体偏移拿到首地址
        h = QUEUE_DATA(q, uv_fs_event_t, watchers);
        // 从处理队列中移除
        QUEUE_REMOVE(q);
        // 放回原队列
        QUEUE_INSERT_TAIL(&w->watchers, q);
        // 执行回调
        h->cb(h, path, events, 0);
      }
    }
  }
}
```

uv__inotify_read 首先调用 read 把数据从操作系统中读取出来，这些数据是一个个 struct uv__inotify_event 结构体，每个结构体保存了哪些文件触发了哪些事件，接着根据 struct uv__inotify_event 的 wd 字段，也就是文件对应的 id，从红黑树中找到对应的节点，最终拿到该节点维护的订阅者队列并执行订阅者的回调。

#### inotify 机制的使用

在 Libuv 的 inotify 机制的基础上，Node.js 提供了 fs.watch API 实现文件监听功能。

```
function watch(filename, options, listener) {  
  options = copyObject(options);  
  // 是否阻止事件循环的退出
  if (options.persistent === undefined) 
      options.persistent = true;  
  // 如果是目录，是否监听所有子目录和文件的变化
  if (options.recursive === undefined) 
      options.recursive = false;  
  // 有些平台不支持
  if (options.recursive && !(isOSX || isWindows))  
    throw new ERR_FEATURE_UNAVAILABLE_ON_PLATFORM('watch recursively');  
  if (!watchers)  
    watchers = require('internal/fs/watchers');  
  // 新建一个 FSWatcher 对象管理文件监听，然后开启监听
  const watcher = new watchers.FSWatcher();  
  watcher[watchers.kFSWatchStart](filename,  
                                  options.persistent,  
                                  options.recursive,  
                                  options.encoding);  
  
  if (listener) {  
    watcher.addListener('change', listener);  
  }  
  
  return watcher;  
}  
```

watch 没有在 JS 层支持多个订阅者的功能，因为底层的 Libuv 实现了该功能。watch 有两个特性需要注意，一个是 persistent，另一个是 recursive。前者表示文件监听操作是否会阻止事件循环的退出，后面表示是否监听的文件是目录时（Linux 中目录也是文件，叫目录文件），是否监听子目录的变化。接着看一下核心逻辑，具体由 internal/fs/watchers 的 FSWatcher 实现。

```
function FSWatcher() {
  EventEmitter.call(this);

  this._handle = new FSEvent();
  this._handle[owner_symbol] = this;
  this._handle.onchange = (status, eventType, filename) => {
    // C++ 层执行的回调，下面具体分析
  };
}

FSWatcher.prototype[kFSWatchStart] = function(filename,
                                              persistent,
                                              recursive,
                                              encoding) {
  filename = getValidatedPath(filename, 'filename');
  this._handle.start(toNamespacedPath(filename),
                     persistent,
                     recursive,
                     encoding);

};
```

FSWatcher 函数是对 C++ 层 FSEvent 模块的封装。FSWatcher 中创建了一个 FSEvent 对象并执行了它的 start 函数，看看 FSEvent 的 start 函数的逻辑。

```
void FSEventWrap::Start(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);

  FSEventWrap* wrap = Unwrap<FSEventWrap>(args.This());
  
  const int argc = args.Length();
  
  BufferValue path(env->isolate(), args[0]);
  
  unsigned int flags = 0;
  if (args[2]->IsTrue())
    flags |= UV_FS_EVENT_RECURSIVE;

  wrap->encoding_ = ParseEncoding(env->isolate(), args[3], kDefaultEncoding);
  // 初始化 uv_fs_event_t 结构体
  int err = uv_fs_event_init(wrap->env()->event_loop(), &wrap->handle_);
  // 注册文件，开始监听，回调是 OnEvent
  err = uv_fs_event_start(&wrap->handle_, OnEvent, *path, flags);
  // 是否影响事件循环的退出
  if (!args[1]->IsTrue()) {
    uv_unref(reinterpret_cast<uv_handle_t*>(&wrap->handle_));
  }

  args.GetReturnValue().Set(err);
}
```

Start 函数透过 C++ 层调用了 Libuv 的 uv_fs_event_start 函数往 inotify 实例中注册文件的信息。当文件发生变化时，就会执行 OnEvent 回调。

```
void FSEventWrap::OnEvent(...) {
  FSEventWrap* wrap = static_cast<FSEventWrap*>(handle->data);
  Environment* env = wrap->env();
  // 忽略参数处理
  Local<Value> argv[] = {
    Integer::New(env->isolate(), status),
    event_string,
    Null(env->isolate())
  };
  // 执行 onchange 回调
  wrap->MakeCallback(env->onchange_string(), arraysize(argv), argv);
}
```

OnEvent 执行了 JS 的 onchange 回调，最后 JS 层触发 onchange 事件。

  


### 总结

这节课详细介绍了 Node.js 两种文件监听机制的使用和实现原理。文件监听是非常常用的功能，我们了解了底层原理后，可以知道两种机制的使用场景和效率是不一样的。

1.  基于轮询机制的效率是比较低的，因为它的原理是通过定时器实现的，如果文件在大多数情况下没有发生变化，则白白浪费资源。这种方式的好处是系统兼容性比较好，
1.  基于订阅 / 发布机制的效率比较高的，因为当文件没有发生变化时，应用没有额外的开销，当文件发生变化后，操作系统会自动通知应用，这种方式的问题是可能在某些操作系统中无法支持得很好。

我们可以根据自己的场景选择不同的机制，根据 Node.js 官方建议，可以用基于订阅 / 发布机制时尽量使用这种方式。