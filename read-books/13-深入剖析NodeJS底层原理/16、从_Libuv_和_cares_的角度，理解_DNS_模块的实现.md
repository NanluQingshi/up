DNS 是 Node.js 中非常核心的底层模块，TCP、UDP、HTTP 等模块都依赖它。那么，DNS 模块如何实现呢？

在 Node.js 中，DNS 模块是使用 cares 库和 Libuv 实现的。cares 是一个异步 DNS 解析库，它实现了 DNS 协议的封包和解析，Libuv 提供的 DNS 解析主要是利用阻塞式的系统库函数和线程池实现的。这节课我们详细讲解 Node.js DNS 模块在 cares 和 Libuv 中的实现。

# Libuv 是如何实现 DNS 的？

在 Node.js 中，lookup 和 lookupService 是由 Libuv 实现的，它们实现的原理类似，所以我们这里只分析 lookup 函数。 dns.lookup 用于查询一个域名对应的 IP 的信息。

```
dns.lookup('www.a.com', function(err, address, family) {  
    console.log(address);  
});  
```

lookup 函数的 JS 层实现在 dns.js 中。

```
const req = new GetAddrInfoReqWrap();  
req.callback = callback;  
req.family = family;  
req.hostname = hostname;  
req.oncomplete = all ? onlookupall : onlookup;  
  
const err = cares.getaddrinfo(  
  req, toASCII(hostname), family, hints, verbatim  
);  
```

GetAddrInfoReqWrap 表示一次 DNS 查询请求，然后调用 cares_wrap.cc 的 GetAddrInfo 方法。GetAddrInfo 的主要逻辑如下。

```
void GetAddrInfo(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  // JS 层请求对象
  Local<Object> req_wrap_obj = args[0].As<Object>();
  // 参数处理
  node::Utf8Value hostname(env->isolate(), args[1]);

  int32_t flags = 0;
  if (args[3]->IsInt32()) {
    flags = args[3].As<Int32>()->Value();
  }

  int family;

  switch (args[2].As<Int32>()->Value()) {
    case 0:
      family = AF_UNSPEC;
      break;
    case 4:
      family = AF_INET;
      break;
    case 6:
      family = AF_INET6;
      break;
    default:
      CHECK(0 && "bad address family");
  }
  // 创建一个 C++ GetAddrInfoReqWrap 对象，和 JS 对象 req_wrap_obj（GetAddrInfoReqWrap）互相关联
  auto req_wrap = std::make_unique<GetAddrInfoReqWrap>(env,
                                                       req_wrap_obj,
                                                       args[4]->IsTrue());

  struct addrinfo hints;
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = family;
  hints.ai_socktype = SOCK_STREAM;
  hints.ai_flags = flags;

  req_wrap->Dispatch(uv_getaddrinfo,
                     AfterGetAddrInfo,
                     *hostname,
                     nullptr,
                     &hints);
}
```

GetAddrInfo 首先做了参数处理，然后执行 Libuv 的 uv_getaddrinfo 函数，并且设置了回调函数为 AfterGetAddrInfo，我们看一下 Libuv 的 uv_getaddrinfo。

```
int uv_getaddrinfo(uv_loop_t* loop,
                   // 上层传进来的 req
                   uv_getaddrinfo_t* req,
                   // 解析完后的上层回调
                   uv_getaddrinfo_cb cb,
                   // 需要解析的 host
                   const char* hostname,
                   /*
                     查询的过滤条件：服务名。比如 http smtp。
                     也可以是一个端口。见下面注释
                   */
                   const char service,
                   // 其他查询过滤条件
                   const struct addrinfo* hints) {
        size_t hostname_len;
        size_t service_len;
        size_t hints_len;
        size_t len;
        char* buf;
        hostname_len = hostname? strlen(hostname) + 1 : 0;
        service_len = service? strlen(service) + 1 : 0;
        hints_len = hints? sizeof(*hints) : 0;
        buf = uv__malloc(hostname_len + service_len + hints_len);
        uv__req_init(loop, req, UV_GETADDRINFO);
        req->loop = loop;
        // 设置请求的回调
        req->cb = cb;
        req->addrinfo = NULL;
        req->hints = NULL;
        req->service = NULL;
        req->hostname = NULL;
        req->retcode = 0;
        len = 0;
        if (hints) {
            req->hints = memcpy(buf + len, hints, sizeof(hints));
            len += sizeof(hints);
        }
        if (service) {
            req->service = memcpy(buf + len, service, service_len);
            len += service_len;
        }
        if (hostname)
            req->hostname = memcpy(buf + len, hostname, hostname_len);
        // 传了 cb 是异步
        if (cb) {
            // 提交任务到线程池
            uv__work_submit(loop,
                            &req->work_req,
                            UV__WORK_SLOW_IO,
                            uv__getaddrinfo_work,
                            uv__getaddrinfo_done);
            return 0;
        } else {
            // 阻塞式查询，然后返回查询状态和信息
            uv__getaddrinfo_work(&req->work_req);
            uv__getaddrinfo_done(&req->work_req, 0);
            return req->retcode;
        }
}
```

uv_getaddrinfo 首先对一个 request 结构体进行初始化，然后根据是否传了回调，决定走异步还是同步的模式。同步的方式比较简单，就是直接阻塞线程，直到解析完成，但是 DNS 解析可能会非常慢，所以 Node.js 并没有提供同步的 API。异步方式则是给线程池提交一个慢 IO 的任务，工作函数是 uv__getaddrinfo_work，回调是uv__getaddrinfo_done。我们看一下这两个函数的实现：

```
// 解析的工作函数
static void uv__getaddrinfo_work(struct uv__work* w) {
    uv_getaddrinfo_t* req;
    int err;
    // 根据结构体的字段获取结构体首地址
    req = container_of(w, uv_getaddrinfo_t, work_req);
    // 阻塞在这
    err = getaddrinfo(req->hostname, req->service, req->hints, &req->addrinfo);
    req->retcode = uv__getaddrinfo_translate_error(err);
}
```

工作函数主要是调用了底层提供的 getaddrinfo 去做解析，然后阻塞线程。结果返回后，执行 uv__getaddrinfo_done 处理结果。

```
static void uv__getaddrinfo_done(struct uv__work* w, int status) {
    uv_getaddrinfo_t* req;
    req = container_of(w, uv_getaddrinfo_t, work_req);
    uv__req_unregister(req->loop, req);
    // 释放初始化时申请的内存
    if (req->hints)
        uv__free(req->hints);
    else if (req->service)
        uv__free(req->service);
    else if (req->hostname)
        uv__free(req->hostname);
    else
        assert(0);
    req->hints = NULL;
    req->service = NULL;
    req->hostname = NULL;
    // 解析请求被用户取消了
    if (status == UV_ECANCELED) {
        req->retcode = UV_EAI_CANCELED;
    }
    // 执行上层回调
    if (req->cb)
        req->cb(req, req->retcode, req->addrinfo);
}
```

uv__getaddrinfo_done 最后执行 C++ 层回调 AfterGetAddrInfo，AfterGetAddrInfo 最终执行 JS 层的回调 oncomplete，这样一次 DNS 解析就完成了。

# cares 是如何实现 DNS 的？

除了dns.lookup 和 dns.lookService 外，其余的 DNS 功能都由 cares 实现，cares 提供了一系列 API，可结合事件驱动模块实现真正的异步 DNS 解析。基于 cares，Node.js 提供的核心功能由 Resolver 对象提供。

## 实现 DNS 解析的对象：Resolver

```
const {
  ChannelWrap,
} = internalBinding('cares_wrap');

class Resolver {
  constructor() {
    this._handle = new ChannelWrap();
  }

  cancel() {
    this._handle.cancel();
  }

  getServers() {
    return this._handle.getServers().map((val) => {
      // ...
    });
  }

  setServers(servers) {
    this._handle.setServers(...);
  }
}
```

Resolver 主要是对 C++ 层 ChannelWrap 的封装，ChannelWrap 则是对 cares 的封装。除此之外，Resolver 还有一系列函数，下面列举几个。

```
function resolver(bindingName) {
  function query(name, /* options, */ callback) {
    let options;
    if (arguments.length > 2) {
      options = callback;
      callback = arguments[2];
    }
    const req = new QueryReqWrap();
    req.bindingName = bindingName;
    req.callback = callback;
    req.hostname = name;
    req.oncomplete = onresolve;
    req.ttl = !!(options && options.ttl);
    // this._handle 是 C++ 层 ChannelWrap 对象
    this._handle[bindingName](req, toASCII(name));
    return req;
  }
  ObjectDefineProperty(query, 'name', { value: bindingName });
  return query;
}

Resolver.prototype.resolveAny = resolver('queryAny');
Resolver.prototype.resolve4 = resolver('queryA');
Resolver.prototype.resolve6 = resolver('queryAaaa');
```

Resolver 的 API 通过 resolver 函数统一提供，resolver 函数主要是创建了一个 QueryReqWrap 请求对象，然后根据bindingName 直接调用 C++ 层 ChannelWrap 对象的相应函数。所以我们重点来看一下 C++ 层的 ChannelWrap，下面是把 ChannelWrap 导出到 JS 的逻辑。

```
Local<FunctionTemplate> channel_wrap = env->NewFunctionTemplate(ChannelWrap::New);

env->SetProtoMethod(channel_wrap, "queryAny", Query<QueryAnyWrap>);
env->SetProtoMethod(channel_wrap, "queryA", Query<QueryAWrap>);
// ... 还有类似的很多函数

Local<String> channelWrapString = FIXED_ONE_BYTE_STRING(env->isolate(), "ChannelWrap");
channel_wrap->SetClassName(channelWrapString);
target->Set(env->context(),  channelWrapString, channel_wrap->GetFunction(context).ToLocalChecked()).Check();
```

当在 JS 层 new ChannelWrap 时，就会执行 ChannelWrap::New。

```
void ChannelWrap::New(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  new ChannelWrap(env, args.This());
}
```

ChannelWrap::New 创建了一个 ChannelWrap 对象。看一下类 ChannelWrap 的定义。

```
class ChannelWrap : public AsyncWrap {  
 public:  
  // ...  
  
 private:  
  // 超时管理  
  uv_timer_t* timer_handle_;  
  // cares 结构体，用于管理多个查询请求  
  ares_channel channel_;  
  // 标记查询结果  
  bool query_last_ok_;  
  bool is_servers_default_;  
  // 是否已经初始化 cares 库  
  bool library_inited_;  
  // 正在发起的查询个数  
  int active_query_count_;  
  // 发起查询的任务队列  
  node_ares_task_list task_list_;  
};  
```

了解了 ChannelWrap 的字段后，接着看看 ChannelWrap 构造函数的代码。

```
ChannelWrap::ChannelWrap(...) {  
  Setup();  
}  
```

ChannelWrap 里调用了 Setup。

```
void ChannelWrap::Setup() {  
  struct ares_options options;  
  memset(&options, 0, sizeof(options));  
  options.flags = ARES_FLAG_NOCHECKRESP;   
  /*
    caresd socket 状态（读写）发生变更时，执行的函数，
    第一个入参是 sock_state_cb_data
  */
  options.sock_state_cb = ares_sockstate_cb;  
  options.sock_state_cb_data = this;  
  
  // 还没初始化则初始化 
  if (!library_inited_) {  
   Mutex::ScopedLock lock(ares_library_mutex);  
   // 初始化 cares 库，每次调用会使得引用数加一，析构时减一  
   ares_library_init(ARES_LIB_INIT_ALL);  
 }  
 // 设置 channel 的配置  
 ares_init_options(&channel_,  
                   &options,  
                   ARES_OPT_FLAGS | ARES_OPT_SOCK_STATE_CB);
 library_inited_ = true;  
}  
```

Setup 中除了增加 cares 库的引用计数，最重要的就是设置了 cares socket 状态变更时执行的回调 ares_sockstate_cb（比如 socket 可以读取数据或者写入数据）。前面讲到 cares 是和事件驱动模块配合使用的，那么它们是如何配合的呢？cares 提供了一种机制，当调用方发起 DNS 查询时，cares 会创建一个 socket，然后把请求报文发送出去，接着传递创建的 socket 给调用者（比如 Node.js），调用者把 socket 对应 fd 注册到事件驱动模块等待读事件（DNS 响应），数据可读时再调用 cares 函数解析 DNS 响应。流程如下图所所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ffa6dc897aac4f51a9689ba4817e6894~tplv-k3u1fbpfcp-zoom-1.image)

下面我们看一下使用 cares 进行 DNS 查询的具体实现，我们从发起一个 cname 查询开始分析（其他函数的实现是类似的），代码如下。

```
const req = new QueryReqWrap();
req.bindingName = bindingName;
req.callback = callback;
req.hostname = name;
req.oncomplete = onresolve;
req.ttl = !!(options && options.ttl);
this._handle['queryCname'](req, toASCII(name));
```

上面代码最终调用了 C++ 层导出的 queryCname 函数。

```
env->SetProtoMethod(channel_wrap, "queryCname", Query<QueryCnameWrap>);
```

queryCname 对应的是 C++ 的 Query 函数，Query 是 C++ 模板函数，QueryCnameWrap 是 C++ 类。

```
template <class Wrap>  
static void Query(const FunctionCallbackInfo<Value>& args) {  
  Environment* env = Environment::GetCurrent(args);  
  ChannelWrap* channel;  
  ASSIGN_OR_RETURN_UNWRAP(&channel, args.Holder());  
  // 拿到 JS 层的请求对象 QueryReqWrap
  Local<Object> req_wrap_obj = args[0].As<Object>();  
  Local<String> string = args[1].As<String>();  
  /*
    根据参数新建一个 C++ 对象，这里是 QueryCnameWrap，
    QueryCnameWrap 和 JS 对象 QueryReqWrap 互相关联
  */
  Wrap* wrap = new Wrap(channel, req_wrap_obj);  
  
  node::Utf8Value name(env->isolate(), string);
  // 发起请求数加一  
  channel->ModifyActivityQueryCount(1);  
    // 调用 Send 函数发起查询
  int err = wrap->Send(*name);  
  // 失败则请求数减一
  if (err) {  
    channel->ModifyActivityQueryCount(-1);  
    delete wrap;  
  }  
  
  args.GetReturnValue().Set(err);  
 }  
```

Query 只实现了一些通用的逻辑，然后调用 Send 函数，具体的 Send 函数逻辑由各个具体的类实现，QueryCnameWrap 类的 Send 实现如下。

```
int Send(const char* name) override {  
    AresQuery(name, ns_c_in, ns_t_cname);  
    return 0;  
  }  
```

Send 函数最终会调用基类的 AresQuery 函数，基类 QueryWrap 中 AresQuery 的实现如下所示。

```
void AresQuery(const char* name,  
                       int dnsclass,  
                       int type) {  
    ares_query(channel_->cares_channel(), 
               name, 
               dnsclass, 
               type, 
               Callback,  
               static_cast<void*>(this));  
  }  
```

AresQuery 函数提供统一的发送查询操作，cares 查询完成后执行 Callback 回调。接下来就涉及 cares 和 Node.js 的具体交互了。我们看一下ares_query 的关键逻辑。

```
void ares_query(ares_channel channel, const char *name, int dnsclass,  
                int type, ares_callback callback, void *arg)  
{  
  struct qquery *qquery;  
  unsigned char *qbuf;  
  int qlen, rd, status;  

  // 构造 DNS 报文，内容在 qbuf
  rd = !(channel->flags & ARES_FLAG_NORECURSE);
  status = ares_create_query(name, dnsclass, type, channel->next_id, rd, &qbuf,
              &qlen, (channel->flags & ARES_FLAG_EDNS) ? channel->ednspsz : 0);
              
  qquery = ares_malloc(sizeof(struct qquery));  
  // 保存 Node.js 的回调，查询完成时回调  
  qquery->callback = callback;  
  qquery->arg = arg;  
  // 发送报文，回调是 qcallback
  ares_send(channel, qbuf, qlen, qcallback, qquery);  
}  
    
void ares__send_query(ares_channel channel, struct query *query,
                      struct timeval *now)
{
  struct send_request *sendreq;
  struct server_state *server;
  int timeplus;

  server = &channel->servers[query->server];
  // 如果还没有创建 socket，则创建一个 UDP socket
  if (server->udp_socket == ARES_SOCKET_BAD)
    {
      open_udp_socket(channel, server);
    }
  // 发送 qbuf 里的数据，发起 DNS 查询
  socket_write(channel, server->udp_socket, query->qbuf, query->qlen);
}
```

cares 会根据查询类型构造请求报文，如果还没有创建 socket 的话，则创建一个 UDP socket（也可以使用 TCP socket），最后调用 socket_write 把数据发送出去。这个过程中有一个重要的逻辑是把创建的 socket 告诉 Node.js，具体逻辑在 open_udp_socket 中。

```
static int open_udp_socket(ares_channel channel, struct server_state *server)
{
  ares_socket_t s;
  ares_socklen_t salen;
  union {
    struct sockaddr_in  sa4;
    struct sockaddr_in6 sa6;
  } saddr;
  struct sockaddr *sa;
  // 拿到服务器地址
  switch (server->addr.family)
    {
      case AF_INET:
        sa = (void *)&saddr.sa4;
        salen = sizeof(saddr.sa4);
        memset(sa, 0, salen);
        saddr.sa4.sin_family = AF_INET;
        if (server->addr.udp_port) {
          saddr.sa4.sin_port = aresx_sitous(server->addr.udp_port);
        } else {
          saddr.sa4.sin_port = aresx_sitous(channel->udp_port);
        }
        memcpy(&saddr.sa4.sin_addr, &server->addr.addrV4,
               sizeof(server->addr.addrV4));
        break;
      // 忽略 IPV6 的处理
    }

  // 创建一个 UDP socket
  s = open_socket(channel, server->addr.family, SOCK_DGRAM, 0);
  // 设置一些属性，比如非阻塞、发送缓冲区和接收缓冲区大小
  configure_socket(s, server->addr.family, channel);
  // 设置服务器地址
  connect_socket(channel, s, sa, salen);
  // 通知调用方，socket 状态变更，1，0 表示需要可读事件，即 DNS 响应
  channel->sock_state_cb(channel->sock_state_cb_data, s, 1, 0);  
  // 保存 socket，下次查询不用再创建了
  server->udp_socket = s;
  return 0;
}
```

open_udp_socket 创建完 socket 后通过 channel->sock_state_cb 通知 Node.js，也就是初始化 ChannelWrap 时，ChannelWrap::Setup 中设置的 ares_sockstate_cb。

```
void ares_sockstate_cb(void* data,
                       ares_socket_t sock,
                       int read,
                       int write) {
  ChannelWrap* channel = static_cast<ChannelWrap*>(data);
  node_ares_task* task;

  node_ares_task lookup_task;
  lookup_task.sock = sock;
  // 判断 sock 是否已经存在任务队列中
  auto it = channel->task_list()->find(&lookup_task);
  
  task = (it == channel->task_list()->end()) ? nullptr : *it;
  // 需要注册读或写事件
  if (read || write) {
    // 之前还没有保存这个 sock，则创建一个相应的任务并插入任务队列
    if (!task) {
      // 启动定时器，如果很久都没有触发感兴趣的事件则触发超时，超时后通知 cares
      channel->StartTimer();
      task = ares_task_create(channel, sock);
      channel->task_list()->insert(task);
    }
    // 注册 sock 对应的 IO 观察者和事件到 Libuv 中
    uv_poll_start(&task->poll_watcher,
                  (read ? UV_READABLE : 0) | (write ? UV_WRITABLE : 0),
                  ares_poll_cb);

  } else { // 不需要注册事件，说明不使用了
    // 从任务队列中删除，
    channel->task_list()->erase(it);
    channel->env()->CloseHandle(&task->poll_watcher, ares_poll_close_cb);
    // 如果任务队列为空，则清除定时器
    // 一个 ChannelWrap 对象中，只有一个定时器，它负责 cares channel 中所有 DNS 解析请求的超时管理
    if (channel->task_list()->empty()) {
      channel->CloseTimer();
    }
  }
}
```

ares_sockstate_cb 往 Libuv 中注册了事件（这里是可读事件），然后等待 DNS 响应数据包到达后，就执行 ares_poll_cb 处理响应。

```
void ares_poll_cb(uv_poll_t* watcher, int status, int events) {
  node_ares_task* task = ContainerOf(&node_ares_task::poll_watcher, watcher);
  ChannelWrap* channel = task->channel;
  // 调用 cares 函数处理响应并告知触发了什么事件，
  // 第二个参数代表是否触发可读事件，第三个参数表示是否触发可写事件
  ares_process_fd(channel->cares_channel(),
                  events & UV_READABLE ? task->sock : ARES_SOCKET_BAD,
                  events & UV_WRITABLE ? task->sock : ARES_SOCKET_BAD);
}

void ares_process_fd(ares_channel channel,
                     ares_socket_t read_fd, /* use ARES_SOCKET_BAD or valid file descriptors */
                     ares_socket_t write_fd)
{
  processfds(channel, NULL, read_fd, NULL, write_fd);
}
```

ares_poll_cb 中执行了 cares 的 ares_process_fd 函数进行处理，ares_process_fd 进一步执行了 processfds。

```
static void processfds(ares_channel channel,
                       fd_set *read_fds, ares_socket_t read_fd,
                       fd_set *write_fds, ares_socket_t write_fd)
{
  struct timeval now = ares__tvnow();
  read_udp_packets(channel, read_fds, read_fd, &now);
}
```

这里我们只关注 processfds 中的 read_udp_packets 函数，不需要关注其它的逻辑，比如查询超时。

```
static void read_udp_packets(ares_channel channel, fd_set *read_fds,
                             ares_socket_t read_fd, struct timeval *now)
{
  struct server_state *server;
  int i;
  ares_ssize_t count;
  unsigned char buf[MAXENDSSZ + 1];
  ares_socklen_t fromlen;
  union {
    struct sockaddr     sa;
    struct sockaddr_in  sa4;
    struct sockaddr_in6 sa6;
  } from;
  do {
    // 读取数据和对端地址信息
    if (server->addr.family == AF_INET)
        fromlen = sizeof(from.sa4);
    else
        fromlen = sizeof(from.sa6);
    count = socket_recvfrom(channel, server->udp_socket, (void *)buf,
                            sizeof(buf), 0, &from.sa, &fromlen);
    // 处理数据
    process_answer(channel, buf, (int)count, i, 0, now);
  } while (count > 0); // 没读完接着读
}
```

read_udp_packets 调用 socket_recvfrom 读取响应数据，接着执行 process_answer 处理数据。

```
static void process_answer(ares_channel channel, unsigned char *abuf, int alen, ...)
{
  end_query(channel, query, ARES_SUCCESS, abuf, alen);
}

static void end_query(ares_channel channel, struct query *query, int status,
                       unsigned char *abuf, int alen)
{
  // 执行回调
  query->callback(query->arg, status, query->timeouts, abuf, alen);
  // 释放内存
  ares__free_query(query);
}
```

process_answer 调用了 end_query，end_query 最终调用了 query->callback，query->callback 是在发起查询时（ares_query）设置的 qcallback。

```
static void qcallback(void *arg, int status, int timeouts, unsigned char *abuf, int alen)
{
  struct qquery *qquery = (struct qquery *) arg;
  qquery->callback(qquery->arg, status, timeouts, abuf, alen);
}
```

qcallback 最终调用了调用方设置的回调，比如 Node.js 的 Callback。

```
  static void Callback(void* arg, int status, int timeouts,
                       unsigned char* answer_buf, int answer_len) {
    QueryWrap* wrap = FromCallbackPointer(arg);
    
    unsigned char* buf_copy = nullptr;
    if (status == ARES_SUCCESS) {
      buf_copy = node::Malloc<unsigned char>(answer_len);
      memcpy(buf_copy, answer_buf, answer_len);
    }

    wrap->response_data_ = std::make_unique<ResponseData>();
    ResponseData* data = wrap->response_data_.get();
    data->status = status;
    data->is_host = false;
    data->buf = MallocedBuffer<unsigned char>(buf_copy, answer_len);
    // 继续下一步处理
    wrap->QueueResponseCallback(status);
  }
  
  void QueueResponseCallback(int status) {
    BaseObjectPtr<QueryWrap> strong_ref{this};
    // 插入一个任务，check 阶段处理
    env()->SetImmediate([this, strong_ref](Environment*) {
      AfterResponse();
    });

    channel_->set_query_last_ok(status != ARES_ECONNREFUSED);
    // 请求完成，请求数减一
    channel_->ModifyActivityQueryCount(-1);
  }
```

Node.js 的回调会插入一个任务到 Immediate 队列，然后在 check 阶段被处理。接着看 AfterResponse。

```
  void AfterResponse() {
    Parse(response_data_->host.get());
  }
```

不同的查询类型对应不同的 Parse 逻辑，下面看一下 cname 查询对应的逻辑。

```
void Parse(unsigned char* buf, int len) override {
    HandleScope handle_scope(env()->isolate());
    Context::Scope context_scope(env()->context());

    Local<Array> ret = Array::New(env()->isolate());
    int type = ns_t_cname;
    // 调用 ares_parse_a_reply 进行解析
    ParseGeneralReply(env(), buf, len, &type, ret);

    this->CallOnComplete(ret);
  }
  
  void CallOnComplete(Local<Value> answer,
                      Local<Value> extra = Local<Value>()) {
    
    Local<Value> argv[] = {
      Integer::New(env()->isolate(), 0),
      answer,
      extra
    };
    const int argc = arraysize(argv) - extra.IsEmpty();
    // 执行 JS 层回调
    MakeCallback(env()->oncomplete_string(), argc, argv);
 }
```

最终通过 MakeCallback 把解析结果告诉 JS 层。整体结构图如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/70685430e2a84cf9a2a3f006fc4b90be~tplv-k3u1fbpfcp-zoom-1.image)

从上图中可以看到，一个 JS 层的 Resolver 是对 C++ 层 ChannelWrap 的封装，ChannelWrap 则是对 cares ares_channel 的封装，每个 ares_channel 中有多个 UDP 服务器的配置。当一个 UDP 服务器失败时，cares 会尝试使用下一个，cares 和每一个 UDP 服务器通信前会创建一个 UDP socket，然后通知 Node.js，Node.js 再把 socket 封装成一个个任务插入到 ChannelWrap 的任务对队列中。

## DNS 的超时管理

当我们发起 DNS 请求时，如果服务器一直不返回，我们总不能一直等待，这时就需要超时管理机制。前面讲过一个 ares_channel 负责管理多个 DNS 查询，但是 cares 不支持给每一个查询设置超时时间，只能按照 ares_channel 的维度设置一个超时时间，有兴趣的同学可以参考这个 [issue](https://github.com/c-ares/c-ares/issues/135)。 刚才讲解 ChannelWrap 时已经提到了超时的逻辑，下面再来具体看一下。

```
void ares_sockstate_cb(void* data,
                       ares_socket_t sock,
                       int read,
                       int write) {
  ChannelWrap* channel = static_cast<ChannelWrap*>(data);
  node_ares_task* task;

  node_ares_task lookup_task;
  lookup_task.sock = sock;
  auto it = channel->task_list()->find(&lookup_task);

  task = (it == channel->task_list()->end()) ? nullptr : *it;

  if (read || write) {
    if (!task) {
      channel->StartTimer();
      task = ares_task_create(channel, sock);
      channel->task_list()->insert(task);
    }
  } else {
    channel->task_list()->erase(it);
    channel->env()->CloseHandle(&task->poll_watcher, ares_poll_close_cb);

    if (channel->task_list()->empty()) {
      channel->CloseTimer();
    }
  }
}
```

从上面的代码中可以看到，每次创建一个新的 UDP socket 时，就会生成一个任务并执行 StartTimer 启动定时器，每次 socket 不再使用时就会从队列中删除该任务，如果队列为空则关闭定时器。下面看看 StartTimer。

```
void ChannelWrap::StartTimer() {
  if (timer_handle_ == nullptr) {
    timer_handle_ = new uv_timer_t();
    timer_handle_->data = static_cast<void*>(this);
    uv_timer_init(env()->event_loop(), timer_handle_);
  } else if (uv_is_active(reinterpret_cast<uv_handle_t*>(timer_handle_))) {
    return;
  }
  uv_timer_start(timer_handle_, AresTimeout, 1000, 1000);
}
```

StartTimer 的逻辑很简单，就是如果还没有启动定时器则启动它，否则不做任何处理。定时器每一秒就会触发一次超时（后续的 Node.js 版本支持设置这个时间），除非有响应数据返回，比如 ares_poll_cb 是有数据返回时的回调，它会重置定时器。

```
void ares_poll_cb(uv_poll_t* watcher, int status, int events) {
  node_ares_task* task = ContainerOf(&node_ares_task::poll_watcher, watcher);
  ChannelWrap* channel = task->channel;
  uv_timer_again(channel->timer_handle());
}
```

那么如果一直没有数据返回就会触发超时回调 AresTimeout，但是定时器超时并不代表 DNS 查询超时，这里只是定时调用 cares 的函数，由 cares 判断是否超时。

```
void ChannelWrap::AresTimeout(uv_timer_t* handle) {
  ChannelWrap* channel = static_cast<ChannelWrap*>(handle->data);
  ares_process_fd(channel->cares_channel(), ARES_SOCKET_BAD, ARES_SOCKET_BAD);
}
```

ares_process_fd 调用 process_timeouts。

```
static void process_timeouts(ares_channel channel, struct timeval *now)
{
  time_t t;  /* the time of the timeouts we're processing */
  struct query *query;
  struct list_node* list_head;
  struct list_node* list_node;
  // 遍历请求，判断是否已经超时，如果超时了则换一个服务器
  for (t = channel->last_timeout_processed; t <= now->tv_sec; t++)
    {
      list_head = &(channel->queries_by_timeout[t % ARES_TIMEOUT_TABLE_SIZE]);
      for (list_node = list_head->next; list_node != list_head; )
        {
          query = list_node->data;
          list_node = list_node->next;  /* in case the query gets deleted */
          if (query->timeout.tv_sec && ares__timedout(now, &query->timeout))
            {
              query->error_status = ARES_ETIMEOUT;
              // 记录超时次数
              ++query->timeouts;
              next_server(channel, query, now);
            }
        }
     }
  // 更新上次处理时间
  channel->last_timeout_processed = now->tv_sec;
}
```

当 DNS 请求超时时，cares 会调用 next_server 切换到下一个服务器。

```
static void next_server(ares_channel channel, struct query *query,
                        struct timeval *now)
{
  // 请求错误次数是否到达阈值，否则换一个服务器
  while (++(query->try_count) < (channel->nservers * channel->tries))
    {
      struct server_state *server;
      // 更新查询对应的服务器
      query->server = (query->server + 1) % channel->nservers;
      // 拿到服务器结构体
      server = &channel->servers[query->server];
      // 判断服务器是否可用，是则再次发起查询
      if (...)
        {
           ares__send_query(channel, query, now);
           return;
        }
    }

  // 请求错误次数达到阈值或者没有可用的服务器了，则报错，比如执行 Node.js 回调。
  end_query(channel, query, query->error_status, NULL, 0);
}
```

在服务器没有数据返回的情况下，Node.js 会定时触发定时器，再由 cares 判断是否有超时的请求。整体流程如下所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1bde7a2f83e14f3291b139d4bf13a766~tplv-k3u1fbpfcp-zoom-1.image)

因为无法针对某一个查询请求设置超时时间，所以如果同一个 channel 下有一个请求耗时很久，但是其他请求响应正常，则会导致这个耗时很长的请求没有如期超时。

# 总结

这节课，我们从 Libuv 和 cares 的角度讲解了 Node.js 中 DNS 模块的实现。

  


在 Libuv 中，DNS 查询功能主要是利用了底层的线程池和系统库提供的阻塞式函数实现的。

  


cares 中主要是利用了 cares 这个异步 DNS 解析库，这个库只实现了处理 DNS 数据的逻辑，数据驱动机制则是交给调用者实现，比如 Libuv。当 Node.js 发起 DNS 查询时，cares 会创建一个 socket（如果还没有创建的话），接着把 DNS 查询报文发送出去并且把 socket 传递给 Node.js，Node.js 会把这个 socket 注册到事件驱动模块等待 DNS 响应，当 DNS 响应到达时，Node.js 会通知 cares 进行处理（解析 DNS 响应）。

  


理解了底层之后，上层就很容易理解了，JS 层默认设置了一个默认的 Resolver 对象，我们平时使用的 setServers 或者 resolvexxx 函数都是来自这个 Resolver 对象。我们也可以自己创建一个 Resolver 来进行 DNS 查询，比如后续 Node.js 的 Resolver 函数支持自定义的重试和超时配置，可以根据自己的情况来使用。