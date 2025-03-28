前面两节课我们介绍了面向连接的 TCP 协议，这节课我们再介绍另一个协议：UDP。

UDP 是一种无连接、不可靠的传输层数据报协议，实现上不像 TCP 协议那么复杂。无连接的意思是不需要建立连接就可以往对端直接发送数据，减少了三次握手带来的时延，但是不可靠可能会导致数据丢失，所以比较适合要求时延低，少量丢包不影响整体功能的场景。

这节课我们就来聊一聊 UDP 的基础内容以及 Node.js 的 UDP 模块是怎么实现的。

# UDP 协议基础

UDP 是无连接、不可靠的数据报协议。这里面有 3 个关键词：无连接、数据报和不可靠，我们一一来解释。

1.  无连接：指定目的地 IP 和端口，直接发送数据，不需要建立连接，而 TCP 通信前是需要先建立连接的，这样减少了三次握手带来的时延。
1.  数据报：每次发送是一个单独的数据包，如果大小超过系统限制则报错，而 TCP 通常是把应用层的数据缓存下来，根据一定的算法组织数据发送的，并不是应用层每次调用发送函数，TCP 就会发送一个报文。
1.  不可靠：UDP 只管发送，不管是否可以到达对端。发送失败的原因可能是网络问题、对端缓冲区已满或者对端没有监听对应的端口等，而 TCP 是有一套机制保证数据的可靠性，UDP 一般适合少量丢包不影响整体的场景，比如视频播放。

## UDP 服务器

接下来看一下在网络编程中，如何创建一个 UDP 服务器（伪代码）

```
    // 申请一个socket    
    int fd = socket(...);    
    // 绑定一个众所周知的地址，像TCP一样    
    bind(fd, ip， port);    
    // 直接阻塞等待消息的到来，UDP不需要listen    
    recvmsg()；  
```

和 TCP 不同的是，UDP 只需要创建一个 socket 并绑定到某个地址，就可以接收来自任何客户端到数据，不需要建立连接。

## UDP 客户端

接着看一下创建一个客户端的流程。客户端的流程有多种方式，原因在于源IP、端口和目的IP、端口可以有多种设置方式。不像服务器需要对外公布监听到地址，客户端可以显式绑定到某个地址，也可以由操作系统自行决定，下面我们看看各种使用方式。

### 由操作系统决定源 IP 和端口

```
// 申请一个socket  
int fd = socket(...);  
// 给服务器发送数据  
sendto(fd, 服务器ip,服务器端口, data)  
```

客户端只需要申请一个 socket，然后调用 sendto 函数就可以直接发送数据了。其中发送方的地址由操作系统选择，对于 IP，如果是多宿主主机，每次调用 sendto 的时候，操作系统会动态选择源 IP。对于端口，操作系统会在第一次调用 sendto 的时候随机选择一个端口，并且不能修改，服务器的地址则在调用 sendto 函数时传入。因为 UDP 不是面向连接的，所以使用 UDP 时，不需要调用 connect 建立连接，只要我们知道服务器的地址，直接给服务器发送数据就行。另外，sendto 可以每次发送数据给不同的服务器。

### 显式指定源 IP 和端口

```
    // 申请一个socket  
    int fd = socket(...);  
    // 绑定一个客户端的地址  
    bind(fd, ip， port);  
    // 给服务器发送数据  
    sendto(fd, 服务器ip,服务器端口, data);  
```

除了让操作系统选择发送方的地址，我们也可以使用 bind 函数来设置发送方的地址。

### 显式绑定服务器地址

除了在发送时传入服务器的地址，我们也可以提前绑定服务器地址。

```
// 申请一个 socket  
int fd = socket(...);  
connect(fd, 服务器 IP，服务器端口);  
/*
  给服务器发送数据,或者 sendto(fd, null,null, data)，
  调用 sendto 则不需要再指定服务器 IP 和端口  
*/
write(fd, data);  
```

我们可以先调用 connect 绑定服务器 IP 和端口到 socket，这样后面调用发送函数时就不需要指定了，但是这个 socket 只能发送数据给绑定的服务器，除非再次调用 connect 重新绑定新的服务器地址。另外需要注意的是，如果我们调用 connect 绑定了地址后，尽量不要在发送函数中再传入地址，比如调用 sendto 时，这样可能会导致报错，例如 MacOS 下的错误信息是 Socket is already connected。

  


虽然使用方式很多，但是归根到底还是对四元组设置的管理。bind 是绑定源 IP 端口到 socket，connect 是绑定服务器 IP 端口到 socket，sendto 是动态指定服务器地址。对于源 IP 和端口，我们可以主动设置，也可以让操作系统随机选择。对于目的 IP 和端口，我们可以在发送数据前设置，也可以在发送数据时设置。

## 发送 / 接收缓冲区

前面 TCP 的课程中讲过，TCP 协议会把应用层的数据先缓存到 socket 的发送缓冲区中，然后根据算法进行发送。同样地，操作系统收到数据时，会先把数据缓存到 socket 的接收缓冲区，然后等待应用层读取。

  


UDP 也有发送和接收缓冲区的概念。但是和 TCP 不太一样，因为 UDP 是面向数据包的协议，所以发送数据时不需要缓存，而是直接发送。那么它的发送缓冲区有什么用呢？UDP 的发送缓冲区是用于控制应用层单次可以发送多少字节的数据，比如我们设置发送缓冲区大小为 1 字节，然后发送 2 字节则会报错。UDP 的接收缓冲区则和 TCP 的类似，因为操作系统收到数据时都是先缓存到 socket 的接收缓冲区，所以接收缓冲区就是控制可以累积多少还没被应用层读取的数据，如果超过这个值则会丢弃数据包，对于 TCP 协议来说，对端操作系统会主动需要重传，对于 UDP 则需要应用层进行处理，重传或忽略。

# Node.js 中 UDP 模块的实现

了解 UDP 协议基础后，来看一下 Node.js 中 UDP 模块的实现。

## 服务器

看一下 Node.js 如何创建一个 UDP 服务器。

```
    const dgram = require('dgram');  
    // 创建一个 UDP 对象  
    const server = dgram.createSocket('udp4');  
    // 监听 UDP 数据的到来  
    server.on('message', (msg, rinfo) => {  
      // 处理数据  
    });  
    // 绑定端口  
    server.bind(41234);  
```

我们看到创建一个 UDP 服务器很简单，绑定到端口后就可以通过 message 事件接收客户端发送的数据。看一下 createSocket 的实现。

```
function createSocket(type, listener) {  
  return new Socket(type, listener);  
} 
 
function Socket(type, listener) {  
  EventEmitter.call(this);  
  let lookup;  
  let recvBufferSize;  
  let sendBufferSize;  
  
  let options;  
  if (type !== null && typeof type === 'object') {  
    options = type;  
    type = options.type;  
    lookup = options.lookup;  
    recvBufferSize = options.recvBufferSize;  
    sendBufferSize = options.sendBufferSize;  
  }  
  const handle = newHandle(type, lookup);   
  this.type = type;  
  if (typeof listener === 'function')  
    this.on('message', listener);  
  // 保存上下文
  this[kStateSymbol] = {  
    handle,  
    receiving: false,  
    // 还没有执行bind
    bindState: BIND_STATE_UNBOUND,  
    connectState: CONNECT_STATE_DISCONNECTED,  
    queue: undefined,  
    // 端口复用，只使于多播   
    reuseAddr: options && options.reuseAddr, 
    ipv6Only: options && options.ipv6Only,  
    // 发送缓冲区和接收缓冲区大小
    recvBufferSize,  
    sendBufferSize  
  };  
}  
```

socket 对象是对底层一个 handle 的一个封装，那 handle 是什么呢？

```
function newHandle(type, lookup) {  
  // 用于 DNS 解析的函数，比如我们调 send 的时候，传的是一个域名  
  if (lookup === undefined) {  
    if (dns === undefined) {  
      dns = require('dns');  
    }  
    lookup = dns.lookup;  
  }   
  
  if (type === 'udp4') {  
    const handle = new UDP();  
    handle.lookup = lookup4.bind(handle, lookup);  
    return handle;  
  }  
  // 忽略 ipv6 的处理  
}  
```

handle 是对 UDP 模块的封装，UDP 是 C++ 模块，当我们在 JS 层 new UDP 的时候，会新建一个 C++ 对象。

```
UDPWrap::UDPWrap(Environment* env, Local<Object> object)  
    : HandleWrap(env,  
                 object,  
                 reinterpret_cast<uv_handle_t*>(&handle_),  
                 AsyncWrap::PROVIDER_UDPWRAP) {  
  int r = uv_udp_init(env->event_loop(), &handle_);  
}  

int uv_udp_init(uv_loop_t* loop, uv_udp_t* handle) {
  return uv_udp_init_ex(loop, handle, AF_UNSPEC);
}

int uv_udp_init_ex(uv_loop_t* loop, uv_udp_t* handle, unsigned flags) {
  int domain = flags & 0xFF;
  uv__udp_init_ex(loop, handle, flags, domain);
}

int uv__udp_init_ex(uv_loop_t* loop,
                    uv_udp_t* handle,
                    unsigned flags,
                    int domain) {
  int fd = -1;
  uv__handle_init(loop, (uv_handle_t*)handle, UV_UDP);
  handle->alloc_cb = NULL;
  handle->recv_cb = NULL;
  handle->send_queue_size = 0;
  handle->send_queue_count = 0;
  // IO 观察者的回调为 uv__udp_io，可读可写时执行
  uv__io_init(&handle->io_watcher, uv__udp_io, fd);
  QUEUE_INIT(&handle->write_queue);
  QUEUE_INIT(&handle->write_completed_queue);

  return 0;
}
```

创建 C++ 层的对象主要是对 Libuv 数据结构 uv_udp_t 进行了初始化，其中关键的是设置了 IO 观察者的回调是 uv__udp_io，当 socket 有数据可读或者 socket 可写时会执行 uv__udp_io。接着我们来看一下执行 bind 时候的逻辑。

```
Socket.prototype.bind = function(port_, address_ /* , callback */) {  
  let port = port_;  
  // socket 的上下文  
  const state = this[kStateSymbol];    
  // 否则标记已经绑定了  
  state.bindState = BIND_STATE_BINDING;  
  // 没传地址则默认绑定所有地址  
  if (!address) {  
    if (this.type === 'udp4')  
      address = '0.0.0.0';  
    else  
      address = '::';  
  }  
  // DNS 解析后再绑定，如果需要的话  
  state.handle.lookup(address, (err, ip) => {  
     state.handle.bind(ip, port || 0, flags);  
     startListening(this);  
  }
  return this;  
}  
```

bind 函数主要的逻辑是 handle.bind 和 startListening。我们一个个看，首先看一下 C++ 层的 bind。

```
void UDPWrap::DoBind(const FunctionCallbackInfo<Value>& args, int family) {  
  UDPWrap* wrap;  
  ASSIGN_OR_RETURN_UNWRAP(&wrap,  
                          args.Holder(),  
                          args.GetReturnValue().Set(UV_EBADF));  
  node::Utf8Value address(args.GetIsolate(), args[0]);  
  Local<Context> ctx = args.GetIsolate()->GetCurrentContext();  
  uint32_t port, flags;  
  struct sockaddr_storage addr_storage;  
  int err = sockaddr_for_family(family, 
                                   address.out(), 
                                   port, 
                                   &addr_storage);  
  if (err == 0) {  
    err = uv_udp_bind(&wrap->handle_,  
                      reinterpret_cast<const sockaddr*>(&addr_storage),  
                      flags);  
  }  
  
  args.GetReturnValue().Set(err);  
}                  
```

DoBind 也没有太多逻辑，处理参数再执行 uv_udp_bind 设置一些标记、属性和端口复用（端口复用后续会单独分析），然后执行操作系统 bind 的函数把本端的 IP 和端口保存到 socket 中。

```
int uv_udp_bind(uv_udp_t* handle,
                const struct sockaddr* addr,
                unsigned int flags) {
  unsigned int addrlen;

  if (addr->sa_family == AF_INET)
    addrlen = sizeof(struct sockaddr_in);
  else if (addr->sa_family == AF_INET6)
    addrlen = sizeof(struct sockaddr_in6);
  else
    return UV_EINVAL;

  return uv__udp_bind(handle, addr, addrlen, flags);
}

int uv__udp_bind(uv_udp_t* handle,
                 const struct sockaddr* addr,
                 unsigned int addrlen,
                 unsigned int flags) {
  int yes;
  int fd;
  // 创建一个 UDP socket
  fd = uv__socket(addr->sa_family, SOCK_DGRAM, 0);
  // 保存到 handle 中
  handle->io_watcher.fd = fd;
  // 设置端口复用，后续单独分析
  if (flags & UV_UDP_REUSEADDR) {
    uv__set_reuse(fd);
  }

  if (flags & UV_UDP_IPV6ONLY) {
    // 设置 IPV6 Only，只能发送和接收 IPV6 的数据包
    setsockopt(fd, IPPROTO_IPV6, IPV6_V6ONLY, &yes, sizeof yes);
  }
  // 绑定地址到 socket
  bind(fd, addr, addrlen);
  // 设置已绑定地址标记
  handle->flags |= UV_HANDLE_BOUND;
  return 0;
}
```

uv__udp_bind 主要是创建了一个 UDP socket 并设置了一些标记和绑定地址到 socket 中。这样服务器就启动完成了。

## 客户端

接着我们来看一下客户端的使用方式和使用流程。

```
const dgram = require('dgram');  
const message = Buffer.from('Some bytes');  
const client = dgram.createSocket('udp4');  
client.connect(41234, 'localhost', (err) => {  
  client.send(message, (err) => {  
    client.close();  
  });  
});  
```

具体的流程是先调用 connect 函数绑定服务器的地址，再调用 send 函数发送信息，最后调用 close 函数关闭 socket。那我们先来看看 connect 函数的实现。

```
Socket.prototype.connect = function(port, address, callback) {  
  const state = this[kStateSymbol];  
  // 设置socket状态  
  state.connectState = CONNECT_STATE_CONNECTING;  
  // 还没有绑定客户端地址信息，则先绑定随机地址（操作系统决定）  
  if (state.bindState === BIND_STATE_UNBOUND)  
    this.bind({ port: 0, exclusive: true }, null);  
  // 执行 bind 的时候，如果 bind 不是同步执行的，则入队等待处理，比如需要 DNS 解析
  if (state.bindState !== BIND_STATE_BOUND) {  
    enqueue(this, _connect.bind(this, port, address, callback));
    return;  
  }  
  // 否则继续 connect
  _connect.call(this, port, address, callback);  
};  
```

上面的代码逻辑分为两种情况，一种是在 connect 之前已经调用了 bind，第二种是没有调用 bind，如果没有调用 bind，则在 connect 之前先要调用 bind（这里并不是因为 UDP socket 一定需要设置客户端地址，而是因为 bind 里面会创建 socket，没有 socket 后续就无法通信）。我们只分析没有调用 bind 的情况，因为这是最长的路径。bind 刚才我们分析过了，我们从以下代码继续分析 connect 的实现。

```
if (state.bindState !== BIND_STATE_BOUND) {  
    enqueue(this, _connect.bind(this, port, address, callback)); 
    return;  
}  
```

enqueue 把任务加入任务队列，并且监听了 listening 事件（该事件在 bind 成功后触发）。

```
function enqueue(self, toEnqueue) {  
  const state = self[kStateSymbol];  
  if (state.queue === undefined) {  
    state.queue = [];  
    self.once('error', onListenError);  
    self.once('listening', onListenSuccess);  
  }  
  state.queue.push(toEnqueue);  
}  
```

这时候 connect 函数就执行完了，等待 bind 成功后会执行 startListening 函数。

```
function startListening(socket) {  
 // 触发listening事件  
 socket.emit('listening');  
}  
```

startListening 触发了 listening 事件，从而执行我们刚才入队的回调 onListenSuccess。

```
function onListenSuccess() {  
  this.removeListener('error', onListenError);  
  clearQueue.call(this);  
}  
  
function clearQueue() {  
  const state = this[kStateSymbol];  
  const queue = state.queue;  
  state.queue = undefined;  
  
  for (const queueEntry of queue)  
    queueEntry();  
}  
```

回调就是把队列中的回调执行一遍，connect 函数设置的回调是 _connect。

```
function _connect(port, address, callback) {  
  const state = this[kStateSymbol];  

  const afterDns = (ex, ip) => {  
    defaultTriggerAsyncIdScope(  
      this[async_id_symbol],  
      doConnect,  
      ex, this, ip, address, port, callback  
    );  
  };  
  
  state.handle.lookup(address, afterDns);  
}  
```

这里的 address 是服务器地址，_connect 函数主要逻辑是对服务器地址进行 DNS 解析。解析成功后执行 afterDns，最后执行 doConnect，并传入解析出来的 IP。看看 doConnect 函数的实现。

```
function doConnect(ex, self, ip, address, port, callback) {  
  const state = self[kStateSymbol];  
  // DNS 解析成功，执行底层的 connect  
  state.handle.connect(ip, port);  
  // connect 成功，触发 connect 事件  
  state.connectState = CONNECT_STATE_CONNECTED;  
  process.nextTick(() => self.emit('connect'));  
}  
```

connect 接着调用了 C++ 层的 Connect 函数。

```
void UDPWrap::Connect(const FunctionCallbackInfo<Value>& args) {
  DoConnect(args, AF_INET);
}

void UDPWrap::DoConnect(const FunctionCallbackInfo<Value>& args, int family) {
  UDPWrap* wrap;
  ASSIGN_OR_RETURN_UNWRAP(&wrap,
                          args.Holder(),
                          args.GetReturnValue().Set(UV_EBADF));

  node::Utf8Value address(args.GetIsolate(), args[0]);
  Local<Context> ctx = args.GetIsolate()->GetCurrentContext();
  uint32_t port;
  struct sockaddr_storage addr_storage;
  int err = sockaddr_for_family(family, address.out(), port, &addr_storage);
  if (err == 0) {
    err = uv_udp_connect(&wrap->handle_,
                         reinterpret_cast<const sockaddr*>(&addr_storage));
  }

  args.GetReturnValue().Set(err);
}
```

C++ 层的 Connect 函数做了些简单的处理，接着调用 Libuv 的 uv_udp_connect。

```
int uv_udp_connect(uv_udp_t* handle, const struct sockaddr* addr) {
  return uv__udp_connect(handle, addr, addrlen);
}

int uv__udp_connect(uv_udp_t* handle,
                    const struct sockaddr* addr,
                    unsigned int addrlen) {

  connect(handle->io_watcher.fd, addr, addrlen);
  return 0;
}
```

最终调用了操作系统的 connect。UDP 的 connect 和 TCP 不一样，TCP 的 connect 会发起三次握手，UDP 的 connect 只是把服务器地址保存到 socket 中。后续发送数据时就不需要显式指定了，当然我们也可以不调用 connect，然后在发送数据时指定。connect 的流程就走完了，接下来我们就可以发送和接收数据。

## 发送数据

发送数据接口是 send（sendto 最终也是调用了 send）。

```
Socket.prototype.send = function(buffer,  
                                 offset,  
                                 length,  
                                 port,  
                                 address,  
                                 callback) {  
  
  let list;  
  const state = this[kStateSymbol];  
  const connected = state.connectState === CONNECT_STATE_CONNECTED;  
  // 没有调用过 connect 绑定过服务端地址，则需要传服务端地址信息  
  if (!connected) {  
    // ...
  } else {  
    // ...
    // 已经绑定了服务端地址，则不能再传了  
    if (port || address)  
      throw new ERR_SOCKET_DGRAM_IS_CONNECTED();  
  }  
  // 如果没有绑定服务器端口，则这里需要传，并且校验  
  if (!connected)  
    port = validatePort(port);  
  // 忽略一些参数处理逻辑  
  // 没有调用过 bind，则需要先调用 bind 创建 socket，发送方地址由操作系统决定
  if (state.bindState === BIND_STATE_UNBOUND)  
    this.bind({ port: 0, exclusive: true }, null);  
  // bind 还没有完成，则先入队，等待 bind 完成再执行  
  if (state.bindState !== BIND_STATE_BOUND) {  
    enqueue(this, this.send.bind(this, 
                                    list, 
                                    port, 
                                    address, 
                                    callback));  
    return;  
  }  
  const afterDns = (ex, ip) => {  
    defaultTriggerAsyncIdScope(  
      this[async_id_symbol],  
      doSend,  
      ex, this, ip, list, address, port, callback  
    );  
  };  
  
  // 已经绑定服务器地址了，则直接发送，否则首先走 DNS 流程（如果传的是域名的话）
  if (!connected) {  
    state.handle.lookup(address, afterDns);  
  } else {  
    afterDns(null, null);  
  }  
}  
```

send 函数很多逻辑都是和 bind 以及 connect 类似的，因为发送数据前需要保证 socket 状态的正确性，总的来说就是要保证通信时，需要有一个 socket、绑定了客户端和设置了服务器地址，接着看 doSend 函数。

```
function doSend(ex, self, ip, list, address, port, callback) {  
  const state = self[kStateSymbol];  
  // 定义一个请求对象  
  const req = new SendWrap();  
  req.list = list;
  req.address = address;  
  req.port = port;  
  /*
    设置 Node.js 和用户的回调，oncomplete 由 C++ 层调用，
    callback 由 oncomplete 调用 
  */ 
  if (callback) {  
    req.callback = callback;  
    req.oncomplete = afterSend;  
  }  
  
  let err;  
  // 根据是否需要设置服务端地址，调 C++ 层函数  
  if (port)  
    err = state.handle.send(req, list, list.length, port, ip, !!callback);  
  else  
    err = state.handle.send(req, list, list.length, !!callback);  
}  
```

doSend 创建了一个请求对象 SendWrap，并在其中记录了请求信息，然后调用 C++ 层的 Send。

```
void UDPWrap::Send(const FunctionCallbackInfo<Value>& args) {
  DoSend(args, AF_INET);
}

void UDPWrap::DoSend(const FunctionCallbackInfo<Value>& args, int family) {
  // sendto 代表还没有绑定对端地址，send 的时候才指定
  bool sendto = args.Length() == 6;

  Local<Object> req_wrap_obj = args[0].As<Object>();
  Local<Array> chunks = args[1].As<Array>();
  // 待发送数据的个数，每一个里面有一部分数据
  size_t count = args[2].As<Uint32>()->Value();
  const bool have_callback = sendto ? args[5]->IsTrue() : args[3]->IsTrue();

  size_t msg_size = 0;

  MaybeStackBuffer<uv_buf_t, 16> bufs(count);

  // 数据处理
  for (size_t i = 0; i < count; i++) {
    Local<Value> chunk = chunks->Get(env->context(), i).ToLocalChecked();

    size_t length = Buffer::Length(chunk);

    bufs[i] = uv_buf_init(Buffer::Data(chunk), length);
    msg_size += length;
  }

  int err = 0;
  struct sockaddr_storage addr_storage;
  sockaddr* addr = nullptr;
  // 设置了对端地址则进行处理
  if (sendto) {
    const unsigned short port = args[3].As<Uint32>()->Value();
    node::Utf8Value address(env->isolate(), args[4]);
    err = sockaddr_for_family(family, address.out(), port, &addr_storage);
    if (err == 0) {
      addr = reinterpret_cast<sockaddr*>(&addr_storage);
    }
  }
  // 待发送的数据
  uv_buf_t* bufs_ptr = *bufs;
  // 没有设置这个 flag 则尝试调 uv_udp_try_send 直接发送，
  // 失败或没有发送完毕再调 uv_udp_send 排队等待发送，发送结束后触发 JS 层回调
  // 如果直接发送成功并全部发送完毕则 JS 直接触发回调
  if (err == 0 && !UNLIKELY(env->options()->test_udp_no_try_send)) {
    err = uv_udp_try_send(&wrap->handle_, bufs_ptr, count, addr);
    // 发送失败
    if (err == UV_ENOSYS || err == UV_EAGAIN) {
      err = 0;
    } else if (err >= 0) { // 发送成功，可能发完了也可能只发送了一部分
      // 已发送到字节数
      size_t sent = err;
      // 通过已发送的字节计算出哪些 buf 的数据被发送了，bufs_ptr 记录还没有被发送的
      while (count > 0 && bufs_ptr->len <= sent) {
        sent -= bufs_ptr->len;
        bufs_ptr++;
        count--;
      }
      // count > 0 说明还有数据没有被发完，
      //     此时 sent 可能是 0，恰好前几个 buf 被发完了
      //     sent 也可能非 0，说明第 n 个 buf 的数据被发送了一部分
      // 所以需要更新下一个待发送 buf 的数据指针
      if (count > 0) {
        bufs_ptr->base += sent;
        bufs_ptr->len -= sent;
      } else {
        // 发完了则直接返回 JS
        args.GetReturnValue().Set(static_cast<uint32_t>(msg_size) + 1);
        return;
      }
    }
  }
  // 否则排队等待发送
  if (err == 0) {
     err = req_wrap->Dispatch(uv_udp_send, ...);
  }

  return err;
}
```

默认情况下，UDP 发送数据时会先尝试直接发送。

```
int uv__udp_try_send(uv_udp_t* handle,
                     const uv_buf_t bufs[],
                     unsigned int nbufs,
                     const struct sockaddr* addr,
                     unsigned int addrlen) {
  int err;
  struct msghdr h;
  ssize_t size;

  memset(&h, 0, sizeof h);
  h.msg_name = (struct sockaddr*) addr;
  h.msg_namelen = addrlen;
  h.msg_iov = (struct iovec*) bufs;
  h.msg_iovlen = nbufs;

  do {
    // 发送数据
    size = sendmsg(handle->io_watcher.fd, &h, 0);
  } while (size == -1 && errno == EINTR);
  // 发送失败则返回错误码
  if (size == -1) {
    if (errno == EAGAIN || errno == EWOULDBLOCK || errno == ENOBUFS)
      return UV_EAGAIN;
    else
      return UV__ERR(errno);
  }

  return size;
}
```

如果直接发送成功且全部发送完毕则直接返回 JS 了，如果直接发送失败或者还没发送完毕则进行排队，等待可写事件触发后再调用 uv__udp_send 进行发送。

```
int uv__udp_send(uv_udp_send_t* req,
                 uv_udp_t* handle,
                 const uv_buf_t bufs[],
                 unsigned int nbufs,
                 const struct sockaddr* addr,
                 unsigned int addrlen,
                 uv_udp_send_cb send_cb) {
  int err;
  int empty_queue;
  // 当前是否没有数据等待发送，是的话可以直接进行发送操作
  empty_queue = (handle->send_queue_count == 0);
  // 初始化请求
  uv__req_init(handle->loop, req, UV_UDP_SEND);
  // 需要发送给哪个服务器
  if (addr == NULL)
    req->addr.ss_family = AF_UNSPEC;
  else
    memcpy(&req->addr, addr, addrlen);
  // 记录请求上下文到请求结构体
  req->send_cb = send_cb;
  req->handle = handle;
  req->nbufs = nbufs;

  req->bufs = req->bufsml;
  // 默认的不够则扩容
  if (nbufs > ARRAY_SIZE(req->bufsml))
    req->bufs = uv__malloc(nbufs * sizeof(bufs[0]));
  // 复制指向数据到元信息到请求结构体
  memcpy(req->bufs, bufs, nbufs * sizeof(bufs[0]));
  // 记录待发送到字节数和请求个数
  handle->send_queue_size += uv__count_bufs(req->bufs, req->nbufs);
  handle->send_queue_count++;
  QUEUE_INSERT_TAIL(&handle->write_queue, &req->queue);
  uv__handle_start(handle);
  // 如果当前没有数据等待发送，则尝试直接发送
  if (empty_queue && !(handle->flags & UV_HANDLE_UDP_PROCESSING)) {
    uv__udp_sendmsg(handle);
    // 如果还没有发送完则注册可写事件等下次发送
    if (!QUEUE_EMPTY(&handle->write_queue))
      uv__io_start(handle->loop, &handle->io_watcher, POLLOUT);
  } else {
    // 如果当前有数据正在等待发送，则注册可写，等待发送
    uv__io_start(handle->loop, &handle->io_watcher, POLLOUT);
  }

  return 0;
}
```

我们只分析最长路径，那就是当前不可直接发送，需要等待可写事件触发再发送，可写事件触发时执行的函数是 uv__udp_io。

```
static void uv__udp_io(uv_loop_t* loop, uv__io_t* w, unsigned int revents) {
  uv_udp_t* handle;

  handle = container_of(w, uv_udp_t, io_watcher);
  // 可发送
  if (revents & POLLOUT) {
    uv__udp_sendmsg(handle);
    uv__udp_run_completed(handle);
  }
}
```

从上面代码中可以看到，当可写事件触发时会执行 uv__udp_sendmsg。

```
static void uv__udp_sendmsg(uv_udp_t* handle) {
  uv_udp_send_t* req;
  QUEUE* q;
  struct msghdr h;
  ssize_t size;

  while (!QUEUE_EMPTY(&handle->write_queue)) {
    q = QUEUE_HEAD(&handle->write_queue);
    req = QUEUE_DATA(q, uv_udp_send_t, queue);
    memset(&h, 0, sizeof h);
    // 如果发送时才执行对端地址，则设置对端地址，如果发送前调用 connect 绑定了地址则不需要再指定
    if (req->addr.ss_family == AF_UNSPEC) {
      h.msg_name = NULL;
      h.msg_namelen = 0;
    } else {
      h.msg_name = &req->addr;
      if (req->addr.ss_family == AF_INET6)
        h.msg_namelen = sizeof(struct sockaddr_in6);
      else if (req->addr.ss_family == AF_INET)
        h.msg_namelen = sizeof(struct sockaddr_in);
      else if (req->addr.ss_family == AF_UNIX)
        h.msg_namelen = sizeof(struct sockaddr_un);
    }
    h.msg_iov = (struct iovec*) req->bufs;
    h.msg_iovlen = req->nbufs;

    do {
      size = sendmsg(handle->io_watcher.fd, &h, 0);
    } while (size == -1 && errno == EINTR);
    // 发送失败则跳出循环等待下次可写事件触发
    if (size == -1) {
      if (errno == EAGAIN || errno == EWOULDBLOCK || errno == ENOBUFS)
        break;
    }
    // 发送结果
    req->status = (size == -1 ? UV__ERR(errno) : size);

    // 移出待发送队列
    QUEUE_REMOVE(&req->queue);
    // 插入发送结束队列
    QUEUE_INSERT_TAIL(&handle->write_completed_queue, &req->queue);
    // 在 pending 阶段继续处理
    uv__io_feed(handle->loop, &handle->io_watcher);
  }
}
```

执行了发送操作后，如果失败则继续等待下一次可写事件的触发，如果成功了就会把发送请求对应的节点插入结束队列，然后通过 uv__udp_run_completed 处理。

```
static void uv__udp_run_completed(uv_udp_t* handle) {
  uv_udp_send_t* req;
  QUEUE* q;

  handle->flags |= UV_HANDLE_UDP_PROCESSING;
  // 遍历节点，执行回调
  while (!QUEUE_EMPTY(&handle->write_completed_queue)) {
    q = QUEUE_HEAD(&handle->write_completed_queue);
    QUEUE_REMOVE(q);

    req = QUEUE_DATA(q, uv_udp_send_t, queue);
    uv__req_unregister(handle->loop, req);
    // 重新计算待发送数据的信息
    handle->send_queue_size -= uv__count_bufs(req->bufs, req->nbufs);
    handle->send_queue_count--;
    // 如果申请了堆内存则释放
    if (req->bufs != req->bufsml)
      uv__free(req->bufs);
    req->bufs = NULL;
    // 执行回调
    if (req->status >= 0)
      req->send_cb(req, 0);
    else
      req->send_cb(req, req->status);
  }
  // 如果待写队列为空则注销可写事件，因为没有数据写了
  if (QUEUE_EMPTY(&handle->write_queue)) {
    uv__io_stop(handle->loop, &handle->io_watcher, POLLOUT);
    if (!uv__io_active(&handle->io_watcher, POLLIN))
      uv__handle_stop(handle);
  }

  handle->flags &= ~UV_HANDLE_UDP_PROCESSING;
}
```

uv__udp_run_completed 会执行每一个写请求的回调，这里是 C++ 层的 OnSend 函数。

```
void UDPWrap::OnSend(uv_udp_send_t* req, int status) {
  std::unique_ptr<SendWrap> req_wrap{static_cast<SendWrap*>(req->data)};
  if (req_wrap->have_callback()) {
    Environment* env = req_wrap->env();
    HandleScope handle_scope(env->isolate());
    Context::Scope context_scope(env->context());
    Local<Value> arg[] = {
      Integer::New(env->isolate(), status),
      Integer::New(env->isolate(), req_wrap->msg_size),
    };
    req_wrap->MakeCallback(env->oncomplete_string(), 2, arg);
  }
}
```

OnSend 直接回调 JS 层。到这里，数据发送的流程就结束了。

## 接收数据

我们调用 bind 之后，会接着执行 startListening。

```
function startListening(socket) {  
  const state = socket[kStateSymbol];  
  // 有数据时的回调，触发 message 事件  
  state.handle.onmessage = onMessage;  
  // 注册可读事件，开始监听数据  
  state.handle.recvStart();  
  state.receiving = true;  
  state.bindState = BIND_STATE_BOUND;  
   // 设置操作系统的接收和发送缓冲区大小
  if (state.recvBufferSize)  
    bufferSize(socket, state.recvBufferSize, RECV_BUFFER);  
  
  if (state.sendBufferSize)  
    bufferSize(socket, state.sendBufferSize, SEND_BUFFER);  
  
  socket.emit('listening');  
}  
```

和 TCP 不一样，TCP 的 listen 是等待连接的到来，因为 UDP 不是面向连接的，所以 startListening 主要是为了设置可读事件，等待数据的到来。startListening 函数除了会设置发送和接收缓冲区的大小，以及设置接收数据的回调 onMessage 外，重点是 recvStart 函数，我们看 C++ 的实现。

```
void UDPWrap::RecvStart(const FunctionCallbackInfo<Value>& args) {  
  UDPWrap* wrap;  
  ASSIGN_OR_RETURN_UNWRAP(&wrap,  
                          args.Holder(),  
                          args.GetReturnValue().Set(UV_EBADF));  
  int err = uv_udp_recv_start(&wrap->handle_, OnAlloc, OnRecv);  
  args.GetReturnValue().Set(err);  
}  
```

OnAlloc, OnRecv 分别是分配内存接收数据的函数和数据到来时执行的回调，最终调用 uv__udp_recv_start 注册等待可读事件，看一下 uv_udp_recv_start 函数的实现。

```
int uv_udp_recv_start(uv_udp_t* handle,
                      uv_alloc_cb alloc_cb,
                      uv_udp_recv_cb recv_cb) {
    return uv__udp_recv_start(handle, alloc_cb, recv_cb);
}

int uv__udp_recv_start(uv_udp_t* handle,
                       uv_alloc_cb alloc_cb,
                       uv_udp_recv_cb recv_cb) {
  // 保存回调
  handle->alloc_cb = alloc_cb;
  handle->recv_cb = recv_cb;
  // 注册可读事件
  uv__io_start(handle->loop, &handle->io_watcher, POLLIN);
  uv__handle_start(handle);

  return 0;
}
```

uv_udp_recv_start 会注册 socket 的可读事件，等待数据的到来。当操作系统收到数据后，会通知 Node.js ，Node.js 会在 Poll IO 阶段处理。

```
static void uv__udp_io(uv_loop_t* loop, uv__io_t* w, unsigned int revents) {
  uv_udp_t* handle;

  handle = container_of(w, uv_udp_t, io_watcher);
  if (revents & POLLIN)
    uv__udp_recvmsg(handle);
}
```

来看一下 uv__udp_recvmsg 函数的实现。

```
static void uv__udp_recvmsg(uv_udp_t* handle) {
  struct sockaddr_storage peer;
  struct msghdr h;
  ssize_t nread;
  uv_buf_t buf;
  int flags;
  int count;

  count = 32;
  // 循环读，但是不要一直读，这样会导致事件循环的其他事件无法被处理
  do {
    buf = uv_buf_init(NULL, 0);
    // 分配内存接收数据，保证大于一个数据包的长度
    handle->alloc_cb((uv_handle_t*) handle, 64 * 1024, &buf);
    memset(&h, 0, sizeof(h));
    memset(&peer, 0, sizeof(peer));
    // 保存对端的地址信息
    h.msg_name = &peer;
    h.msg_namelen = sizeof(peer);
    // 保存数据
    h.msg_iov = (void*) &buf;
    h.msg_iovlen = 1;

    do {
      nread = recvmsg(handle->io_watcher.fd, &h, 0);
    }
    while (nread == -1 && errno == EINTR);
    // 忽略错误处理
    // 回调上层
    handle->recv_cb(handle, nread, &buf, (const struct sockaddr*) &peer, flags);
  }
  /* recv_cb callback may decide to pause or close the handle */
  while (nread != -1
      && count-- > 0
      && handle->io_watcher.fd != -1
      && handle->recv_cb != NULL);
}
```

上层对应的 C++ 回调是 OnRecv。

```
void UDPWrap::OnRecv(uv_udp_t* handle,
                     ssize_t nread,
                     const uv_buf_t* buf_,
                     const struct sockaddr* addr,
                     unsigned int flags) {
  UDPWrap* wrap = static_cast<UDPWrap*>(handle->data);
  Environment* env = wrap->env();

  AllocatedBuffer buf(env, *buf_);
  
  Local<Object> wrap_obj = wrap->object();
  // 回调时的参数
  Local<Value> argv[] = {
    Integer::New(env->isolate(), nread),
    wrap_obj,
    Undefined(env->isolate()),
    Undefined(env->isolate())
  };
  
  buf.Resize(nread);
  argv[2] = buf.ToBuffer().ToLocalChecked();
  argv[3] = AddressToJS(env, addr);
  // 执行 JS 的 onmessage 回调
  wrap->MakeCallback(env->onmessage_string(), arraysize(argv), argv);
}
```

C++ 层执行了 JS 的 onmessage 函数，从而触发 message 事件，这样，一次数据接收的流程就结束了。

```
function onMessage(nread, handle, buf, rinfo) {
  const self = handle[owner_symbol];
  self.emit('message', buf, rinfo);
}
```

# 发送 / 接收缓冲区

了解了 Node.js UDP 服务器、客户端以及数据通信等实现后，接下来看一下数据通信时缓冲区的概念，因为缓存区不足会导致发送送/ 接收数据包失败。

  


UDP 模块提供了设置发送和接收缓冲区大小的 API。前面讲过，发送缓冲区用于控制单次可以发送多大的数据包，接收缓冲区用于控制可以缓存多少还没有被应用层读取的数据。首先来看一下发送缓冲区的使用。

```
const { createSocket } = require('dgram');
const socket = createSocket('udp4');
socket.bind(8888, () => {
    socket.setSendBufferSize(300);
    console.log('sendBufferSize:', socket.getSendBufferSize());
    socket.send('1'.repeat(500), 9999, (err) => {
        console.log(err)
    }); 
});
```

上面的代码设置了发送缓冲区为 300，然后发送了 500 个字节，最终导致了报错，错误信息如下。

```
Error: send EMSGSIZE undefined:9999
    at doSend (dgram.js:681:16)
    at defaultTriggerAsyncIdScope (internal/async_hooks.js:313:12)
    at afterDns (dgram.js:627:5)
    at processTicksAndRejections (internal/process/task_queues.js:85:21) {
  errno: -40,
  code: 'EMSGSIZE',
  syscall: 'send',
  address: undefined,
  port: 9999
}
```

EMSGSIZE 代表发送的数据太大了，当我们改成发送 200 个字节就可以了。那我们接着看接收缓冲区的使用。

```
const { createSocket } = require('dgram');
const socket = createSocket('udp4');
socket.bind(8888, () => {
    socket.setRecvBufferSize(100);
    console.log('RecvBufferSize:', socket.getRecvBufferSize());
    socket.on('message', console.log);
    createSocket('udp4').send("1".repeat(200), 8888);
});
```

上面代码首先创建了一个 UDP 服务器，然后再创建一个 UDP 客户端，但是执行后发现没有输出，因为发送的数据大于服务器的接收缓冲区了，我们把 200 改成 50 就可以了。

  


# UDP 的端口复用 REUSEADDR

我们在网络编程中经常会遇到端口重复绑定的错误，前面的 TCP 课程中，已经讲过端口复用 REUSEADDR，UDP 中也支持端口复用的功能，但是它支持的功能、用途和 TCP 不太一样。下面我们来分析一下 UDP 的端口复用特性。在 Node.js 中，使用UDP的时候，可以通过 reuseAddr 选项使得进程可以复用端口，并且每一个想复用端口的 socket 都需要设置 reuseAddr。接下来，我们看看 reuseAddr 的逻辑。

```
Socket.prototype.bind = function(port_, address_ /* , callback */) {  
  let flags = 0;  
    if (state.reuseAddr)  
      flags |= UV_UDP_REUSEADDR;  
    state.handle.bind(ip, port || 0, flags);  
};  
// 我们看到在 bind 的时候会处理 reuseAddr 字段。我们直接看 Libuv 的逻辑。
int uv__udp_bind(uv_udp_t* handle,  
                 const struct sockaddr* addr,  
                 unsigned int addrlen,  
                 unsigned int flags) {  
  if (flags & UV_UDP_REUSEADDR) {  
    err = uv__set_reuse(fd);  
  }  
  bind(fd, addr, addrlen))
  return 0;  
}  
  
static int uv__set_reuse(int fd) {  
  int yes;  
  yes = 1;  
  
  if (setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes)))  
    return UV__ERR(errno);  
  return 0;  
}  
```

我们看到 Libuv 最终通过 setsockopt 设置了端口复用，并且是在 bind 之前。接下来，我们看一下在 UDP 中 SO_REUSEADDR 的作用。

## 单播下的端口复用

首先，我们看一个端口复用的例子。

```
const dgram = require('dgram');    
function startServer() {
  for (let i = 0; i < 2; i++) {   
    let index = i + 1;
    const udp = dgram.createSocket({type: 'udp4', reuseAddr: true});    
    udp.bind(8080);    
    udp.on('message', (msg) => {  
      console.log(`server ${index}`, msg.toString('utf-8'));  
    });  
  }
}

function startClient() {
  const message = Buffer.from('Some bytes');  
  const client = dgram.createSocket('udp4');  
  // 发送数据
  client.send(message, 8080, () => { 
    // 关闭 socket
    client.close();  
  });  
}

startServer();
startClient();
```

执行以上代码，我们会发现只有一个进程会收到数据。在单播模式下（一个数据包只能被一个主机接收），如果有两个进程都监听了同一个 IP 和端口，那么哪一个进程会收到数据取决于操作系统的实现，在 Linux 中，后启动的服务器会收到数据，Windows下则相反，先启动的服务器会收到数据。那么端口复用有什么用呢？

## 多播下的端口复用

UDP 的端口复用主要是用于多播，多播就是客户端发送一个数据包可以被多个主机收到。除了多播还有多播组，也就是多个主机的集合。客户端发送一个多播数据包时（多播数据包即给某个多播组发送一个数据包），通过多播 IP 指定哪个多播组的主机可以收到这个数据包。例如下图中，主机 1 发送给多播组 1.1.1.1 的包，主机 3，4可以收到，2 收不到。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b722ddb38adb42db89eeed2a526f7748~tplv-k3u1fbpfcp-zoom-1.image)

下面看看在多播的情况下端口复用的使用，看一个例子。

```
const dgram = require('dgram');

function startServer() {
  for (let i = 0; i < 2; i++) {
    let index = i + 1;
    const udp = dgram.createSocket({type: 'udp4', reuseAddr: true});    
    udp.bind(8080, () => {   
        // 设置 127.0.0.1 对应的接口加入多播组 224.0.0.114
        // 局域网多播地址（224.0.0.0~224.0.0.255，该范围的多播数据包，路由器不会转发）   
        udp.addMembership('224.0.0.114', '127.0.0.1'); 
    });    
    udp.on('message', (msg, rinfo) => {  
      console.log(`server ${index}`, msg.toString('utf-8'), rinfo);
    });  
  }
}

function startClient() {
  const udp = dgram.createSocket({type: 'udp4'}); 
  // 1234 为客户端地址
  udp.bind(1234,() => {
    // 设置多播包的出口地址，不设置操作系统会默认选一个，如果选的不是 server 加入的 ip，则 server 收不到数据
    udp.setMulticastInterface('127.0.0.1');
  }); 
  // 给多播组发送数据
  udp.send('test', 8080, '224.0.0.114', (err) => {});   
}

startServer();
startClient();
```

上面代码使得两个服务器都监听了同样的 IP 和端口并且加入了同一个多播组。当客户端给这个多播组发送了一个数据，可以看到两个服务器进程都收到了数据。输出如下。

```
server 1 test { address: '127.0.0.1', family: 'IPv4', port: 1234, size: 4 }
server 2 test { address: '127.0.0.1', family: 'IPv4', port: 1234, size: 4 }
```

我们也可以把 127.0.0.1 改成其他的局域网 IP，比如我电脑的 192.168.3.9。输出如下。

```
server 1 test { address: '192.168.3.9', family: 'IPv4', port: 1234, size: 4 }
server 2 test { address: '192.168.3.9', family: 'IPv4', port: 1234, size: 4 }
```

但是如果客户端通过 setMulticastInterface 和服务器通过 addMembership 设置的 IP 不一样，则服务器无法收到数据。如果 addMembership 没有设置第二个参数，而操作系统会自己选择一个。

```
const dgram = require('dgram');

function startServer() {
  for (let i = 0; i < 2; i++) {
    let index = i + 1;
    const udp = dgram.createSocket({type: 'udp4', reuseAddr: true});    
    udp.bind(8080, () => {   
        udp.addMembership('224.0.0.114'); 
    });    
    udp.on('message', (msg, rinfo) => {  
      console.log(`server ${index}`, msg.toString('utf-8'), rinfo);
    });  
  }
}

function startClient() {
  const udp = dgram.createSocket({type: 'udp4'}); 
  // 1234 为客户端地址
  udp.bind(1234,() => {
    //  udp.setMulticastInterface('127.0.0.1');
  }); 
  // 给多播组发送数据
  udp.send('test', 8080, '224.0.0.114', (err) => {});   
}

startServer();
startClient();
```

上面的代码在我们的电脑中输出如下。

```
server 1 test { address: '192.168.3.9', family: 'IPv4', port: 1234, size: 4 }
server 2 test { address: '192.168.3.9', family: 'IPv4', port: 1234, size: 4 }
```

说明客户端的数据包出口地址是 192.168.3.9，如果客户端打开 udp.setMulticastInterface('127.0.0.1') 注释，服务器则无法收到数据。另外可以多次调用 udp.addMembership 设置接收来自多个入口 IP 的数据。例如下面的例子。

```
const dgram = require('dgram');

function startServer() {
  for (let i = 0; i < 2; i++) {
    let index = i + 1;
    const udp = dgram.createSocket({type: 'udp4', reuseAddr: true});    
    udp.bind(8080, () => {   
        udp.addMembership('224.0.0.114', '127.0.0.1'); 
        udp.addMembership('224.0.0.114', '192.168.3.9'); 
    });    
    udp.on('message', (msg, rinfo) => {  
      console.log(`server ${index}`, msg.toString('utf-8'), rinfo);
    });  
  }
}

function startClient(ip, port) {
  const udp = dgram.createSocket({type: 'udp4'}); 
  udp.bind(port,() => {
    udp.setMulticastInterface(ip);
  }); 
  udp.send('test', 8080, '224.0.0.114', (err) => {});   
}

startServer();
startClient('127.0.0.1', 1234);
startClient('192.168.3.9', 5678);
```

上面的代码创建了两个客户端，分别设置了两个不同的出口 IP，同时服务器也设置了两个入口 IP，所以服务器可以收到所有的数据。输出如下。

```
server 1 test { address: '127.0.0.1', family: 'IPv4', port: 1234, size: 4 }
server 1 test { address: '192.168.3.9', family: 'IPv4', port: 5678, size: 4 }
server 2 test { address: '127.0.0.1', family: 'IPv4', port: 1234, size: 4 }
server 2 test { address: '192.168.3.9', family: 'IPv4', port: 5678, size: 4 }
```

多播是一个比较复杂的内容，这里例举几个例子，大家有兴趣可以参考官网或者 Linux 文档。

# 总结

UDP 是 TCP / IP 协议簇中一个非常重要的协议，HTTP 3.0 和 DNS 都用到了 UDP 协议作为传输协议，另外像音频、视频数据的传输也经常是使用 UDP 协议。这节课我们详细地讲解了 UDP。

1.  UDP 是无连接、不可靠的数据报协议，发送数据前不需要建立连接，而是直接把应用层的数据作为一个单独的数据包进行发送，并且不保证数据可以到达对端，这些需要应用层进行处理。
1.  UDP 和 TCP 一样，也有客户端和服务器的概念，使用上遵循网络编程的那一套逻辑，客户端可以调用 bind 和 connect 分别绑定本端和对端端地址，然后通过 sendto / write 函数发送数据。服务器则只需要调用 bind 绑定地址，然后就可以通过 recvmsg 等函数接收对端的数据。相比 TCP 来说，UDP 使用上比较简单。
1.  Node.js 中 UDP 客户端和服务器的实现，本质上是结合了操作系统提供的 API 和 V8 的能力。如果我们理解了 UDP 基础部分，再学习 Node.js 的实现就会变得非常简单。
1.  除了正常的 UDP 通信外，UDP 还有一些特性，比如发送 / 接收缓冲区分别控制发送的数据包最大字节数和接收的数据包最大字节数。另外还有端口复用，端口复用使得可以有多个 UDP 服务器监听同一个地址，但是在单播的情况下，只有一个 UDP 服务器可以收到客户端的数据。而结合多播的能力，我们就可以在多个服务器中同时接收客户端的数据。

最后我们也来总结下 TCP 和 UDP 协议的区别。

| 协议  | 数据格式                                                              | 可靠性                                                                     | 是否基于连接                                     | 使用场景                                              |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| TCP | 流式：TCP 把应用层的数据当作字节流发送，接收方需要实现解析器解析出每一个应用层协议包。                     | 可靠：TCP 通过数据缓存、超时重传、ACK 等机制保证了数据的可靠性，但是如果达到一定的条件，TCP 也会放弃数据包，比如重传次数达到阈值。 | 是：使用TCP 通信之前需要先通过三次握手建立虚拟连接，然后才能发送 / 接收数据。 | TCP 协议通常用于需要保证数据可靠性的场景，比如 HTTP 协议、DNS 主从机器间的数据同步。 |
| UDP | 数据包格式：UDP 协议按照应用层下发到数据组包发送，对端是否需要实现解析器取决于发送方每次发送的数据包是否是完整的应用层数据包。 | 不可靠：需要应用层保证可靠性，比如 QUIC 协议。                                              | 否：每次应用层传递一个数据给 UDP 协议时，UDP 协议直接发送到对端。      | UDP 协议通常用户对数据实时性比较高，但数据可靠性比较低的场景，比如视频播放。