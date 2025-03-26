HTTP 模块是大部分开发者使用得最多的模块，但是在使用过程中，大家有没有用想过它是如何实现的呢？比如有没有想过一个 HTTP 服务器是怎么实现的呢？一个 HTTP 解析器又是如何实现的呢？这节课我们就来学习一下 HTTP 协议的知识、HTTP 解析器的使用和 Node.js 的 HTTP 模块的实现。

通过 HTTP 模块我们不仅可以了解 Node.js 中 HTTP 模块的实现和使用原理，而且还会加深我们对 HTTP 协议本身的学习，比如 Connect 原理、协议升级等。

# HTTP 协议

HTTP 协议是一种基于客户端 / 服务器架构的无状态的应用层协议。这一概念里有 3 个关键词，我们看看具体的解释：

1.  客户端 / 服务器架构：客户端主动发起请求，服务器被动响应。
1.  无状态：每个请求都会被单独解析，处理，没有依赖关系。
1.  应用层协议：底层可以基于 TCP、UDP 和 Unix 域等。

讲完 HTTP 协议的概念，我们再接着来看 HTTP 的请求 / 响应是如何定义的。了解了请求和响应的定义，我们就会对 HTTP 协议的工作流程有更清晰的了解。

**请求报文**

HTTP 是基于请求 / 响应格式的，首先看一下 HTTP 请求报文的格式，如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a74bf760ade24eb99e2398cf4f1a268e~tplv-k3u1fbpfcp-zoom-1.image)

请求报文分为请求行，请求头和请求体 3 个部分，它们是如下这么定义的。

1.  请求行分为请求方法（GET、POST 等）、请求 URL和协议版本（比如 HTTP / 1.1）。
1.  请求头包括多个键值对，用于传递请求的信息，比如 cookie。
1.  请求体用于传递额外的业务数据，通常用于 POST、PUT 请求方法，如果请求体是已知的大小时，可以通过请求头 content-length 表示请求体的内容大小，这样服务器收到请求时就会根据 content-length 读取对应字节数的数据，如下图所示。

```
POST / HTTP/1.1
Host: localhost:8888
Connection: close
Content-Length: 18

{"hello":"world2"}
```

如果请求体是未知大小的，需要动态计算，则可以通过设置请求头 Transfer-Encoding: chunked，然后在请求体中按照 chunk 大小 + chunk 内容的方式传输动态的数据，示例如下。

```
POST / HTTP/1.1
Host: localhost:8888
Connection: close
Transfer-Encoding: chunked

11
{"hello":"world"}
12
{"hello":"world2"}
0\r\n\r\n
```

**响应报文**

响应报文和请求报文类似，包括响应行、响应头和响应体。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8d12f4b8ecea44ac9d90f3157d20ff27~tplv-k3u1fbpfcp-zoom-1.image)

1.  响应行包括协议版本（比如 HTTP / 1.1）、响应状态码（表示请求结果）和响应状态码描述（描述请求结果）。
1.  响应头和请求头类似，是一系列的键对值。
1.  响应体是服务器返回给客户的的数据，有些请求方法是没有响应体的，比如 head 方法。和请求类似，响应体中的数据也是可以通过 content-length 告诉客户端返回的数据大小。

```
HTTP/1.1 200 OK
Date: Fri, 06 Jan 2023 14:15:48 GMT
Connection: close
Content-Length: 2

ok
```

同样，也可以使用 Transfer-Encoding: chunked 表示。

```
HTTP/1.1 200 OK
Date: Fri, 06 Jan 2023 14:14:03 GMT
Connection: close
Transfer-Encoding: chunked

2
ok
2
ok
0\r\n\r\n
```

# HTTP 解析器

了解了 HTTP 协议后，我们来看一下 HTTP 协议解析器，这部分也很重要。因为对收到的数据，不管是客户端还是服务器都要按照 HTTP 协议规范解析出一个个请求和响应。Node.js 目前使用的解析器是 [llhttp](https://github.com/nodejs/llhttp)，llhttp 是以钩子函数的方式工作的，它支持了很多类型的钩子，具体可以参考 [llhttp_settings_s](https://github.com/nodejs/llhttp/blob/main/src/native/api.h)，它的使用方式如下。

1.  首先下载源码：git clone https://github.com/nodejs/llhttp。
1.  然后安装 npx 工具：npm i npx -g。
1.  然后执行 ts 生成 C 代码： npm i && npx ts-node bin/generate.ts，或者执行 make generate。
1.  这时候 build 目录下生成了 llhttp.h 和 llhttp.c，再加上 native 下的 c 代码，就是 llhttp 的全部代码，我们可以把他复制到自己的项目中直接使用，也可以以静态库或动态库的方式使用，执行 make all 就会在 build 目录下生成静态和动态库，我们把头文件 llhttp.h 和静态库或动态库复制到自己项目里使用，编译的时候加上 -lllhttp -L. 即可（可以参考 [llhttp-demo](https://github.com/theanarkh/llhttp-demo) 和 [multi-thread-serve](https://github.com/theanarkh/multi-thread-server)）。

完成了前面的步骤后，接着来看一下如何在代码里使用 llhttp，初始化解析器的时候，我们可以设置解析类型，是请求或响应报文，然后设置解析状态的回调，比如解析道 URL 时回调，解析到 header 时回调，然后收到数据时执行 llhttp_execute 解析，llhttp 就会触发不同的钩子，下面是解析请求报文的例子。

```
#include <stdio.h>
#include <string.h>
#include "llhttp.h"

#define MAX_LEN 2048

int on_message_begin(llhttp_t* parser)
{
    printf("parse start\n");
    return 0;
}

int on_url(llhttp_t* parser, const char* at, size_t length)
{
    char url[MAX_LEN];
    strncpy(url, at, length);
    url[length] = '\0';
    printf("on_url: %s\n", url);
    return 0;
}

int on_header_field(llhttp_t* parser, const char* at, size_t length)
{
    char header_field[MAX_LEN];
    strncpy(header_field, at, length);
    header_field[length] = '\0';
    printf("head field: %s\n", header_field);
    return 0;
}

int on_header_value(llhttp_t* parser, const char* at, size_t length)
{
    char header_value[MAX_LEN];
    strncpy(header_value, at, length);
    header_value[length] = '\0';
    printf("head value: %s\n", header_value);
    return 0;
}

int on_headers_complete(llhttp_t* parser)
{
    printf("on_headers_complete, major: %d, major: %d, keep-alive: %d, upgrade: %d\n", parser->http_major, parser->http_minor, llhttp_should_keep_alive(parser), parser->upgrade);
    return 0;
}

int on_body(llhttp_t* parser, const char* at, size_t length)
{
    char body[MAX_LEN];
    strncpy(body, at, length);
    body[length] = '\0';
    printf("on_body: %s\n", body);
    return 0;
}

int on_message_complete(llhttp_t* parser)
{
    printf("on_message_complete\n");
    return 0;
}

int main()
{
    llhttp_t parser;
    llhttp_settings_t settings;
    llhttp_settings_init(&settings);
    llhttp_init(&parser, HTTP_REQUEST, &settings);

    settings.on_message_begin = on_message_begin;
    settings.on_url = on_url;
    settings.on_header_field = on_header_field;
    settings.on_header_value = on_header_value;
    settings.on_headers_complete = on_headers_complete;
    settings.on_body = on_body;
    settings.on_message_complete = on_message_complete;
    
    const char* request = "POST /index.html HTTP/1.1\r\nconnection:close\r\ncontent-length: 1\r\n\r\n1\r\n\r\n";
    int request_len = strlen(request);

    enum llhttp_errno err = llhttp_execute(&parser, request, request_len);
    if (err != HPE_OK) {
       fprintf(stderr, "Parse error: %s %s\n", llhttp_errno_name(err), parser.reason);
    }

    return 0;
}
```

编译执行上面代码就会看到多个钩子函数的输出，这就是 llhttp 解析器的使用原理，Node.js 里也是这样使用的。

# HTTP服务器

了解了 HTTP 协议，也知道了 HTTP 解析器的使用方式后，接着来看 HTTP 服务器是如何使用 HTTP 解析器处理请求的。下面是 Node.js 中创建服务器的例子。

```
const http = require('http');  
http.createServer((req, res) => {  
  res.write('hello');  
  res.end();  
})  
.listen(3000);  
```

我们沿着 createServer 开始分析。

```
function createServer(opts, requestListener) {  
  return new Server(opts, requestListener);  
}  
```

createServer 中创建了一个 Server 对象，来看看 Server 初始化的逻辑。

```
function Server(options, requestListener) {  
  // 可以自定义表示请求的对象和响应的对象  
  this[kIncomingMessage] = options.IncomingMessage || IncomingMessage;  
  this[kServerResponse] = options.ServerResponse || ServerResponse;  
  // HTTP 头最大字节数  
  this.maxHeaderSize = options.maxHeaderSize;  
  // 允许半关闭  
  net.Server.call(this, { allowHalfOpen: true });  
  // 有请求时的回调  
  if (requestListener) {  
    this.on('request', requestListener);  
  }  
  // 服务器 socket 读端关闭时是否允许继续处理队列里的响应（TCP 上有多个请求，管道化）  
  this.httpAllowHalfOpen = false;  
  // 有连接时的回调，由 net 模块触发  
  this.on('connection', connectionListener);  
  // 服务器下所有请求和响应的超时时间  
  this.timeout = 0;  
  // 同一个 TCP 连接上，两个请求之前最多间隔的时间   
  this.keepAliveTimeout = 5000;  
  // HTTP 头的最大个数
  this.maxHeadersCount = null;  
  // 解析头部的最长时间，防止 ddos  
  this.headersTimeout = 60 * 1000; 
}  
```

Server 中主要做了一些字段的初始化，并且监听了 connection 和 request 两个事件，当有连接到来时会触发 connection 事件，connection 事件的处理函数会调用 HTTP 解析器进行数据的解析，当解析出一个 HTTP 请求时就会触发 request 事件通知用户。

  


创建了 Server 对象后，接着我们调用它的 listen 函数。因为 HTTP Server 继承于 net.Server，所以执行 HTTP Server 的 listen 函数时，其实是执行了 net.Serve 的 listen 函数，net.Server 的 listen 函数前面我们已经分析过，就不再分析。当有请求到来时，会触发 connection 事件，从而执行 connectionListener。

```
function connectionListener(socket) {  
  defaultTriggerAsyncIdScope(  
    getOrSetAsyncId(socket), connectionListenerInternal, this, socket  
  );  
}  

// socket 表示新连接  
function connectionListenerInternal(server, socket) {  
  // socket 所属 server  
  socket.server = server;  
  // 分配一个 HTTP 解析器  
  const parser = parsers.alloc();  
  // 初始化解析器
  parser.initialize(HTTPParser.REQUEST, ...);  
  // 关联起来
  parser.socket = socket;  
  socket.parser = parser;  
  
  const state = {  
    onData: null,  
    // 同一 TCP 连接上，请求和响应的的队列，线头阻塞的原理  
    outgoing: [],  
    incoming: [],   
  };  
  // 监听 TCP 上的数据，开始解析 HTTP 报文  
  state.onData = socketOnData.bind(undefined, 
                                   server, 
                                   socket, 
                                   parser, 
                                   state);  
  socket.on('data', state.onData);
  // 解析 HTTP 头部完成后执行的回调  
  parser.onIncoming = parserOnIncoming.bind(undefined, 
                                            server, 
                                            socket, 
                                            state);  
  /*
    如果 handle 是继承 StreamBase 的流，则在 C++ 层解析 HTTP 请求报文，
    否则使用上面的 socketOnData 函数处理 HTTP 请求报文，
    TCP 模块的 isStreamBase 为 true 
  */
  if (socket._handle && socket._handle.isStreamBase &&  
      !socket._handle._consumed) {  
    parser._consumed = true;  
    socket._handle._consumed = true;  
    parser.consume(socket._handle);  
  }  
  // 执行 llhttp_execute 时的回调
  parser[kOnExecute] = onParserExecute.bind(undefined, 
                                            server, 
                                            socket, 
                                            parser, 
                                            state);   
}  
```

上面的 connectionListenerInternal 函数中首先分配了一个 HTTP 解析器，HTTP 解析器由以下代码管理。

```
const parsers = new FreeList('parsers', 1000, function parsersCb() {
  const parser = new HTTPParser();

  cleanParser(parser);

  parser.onIncoming = null;
  // 各种钩子毁掉
  parser[kOnHeaders] = parserOnHeaders;
  parser[kOnHeadersComplete] = parserOnHeadersComplete;
  parser[kOnBody] = parserOnBody;
  parser[kOnMessageComplete] = parserOnMessageComplete;

  return parser;
});
```

parsers 用于管理 HTTP 解析器，它负责分配 HTTP 解析器，并且在 HTTP 解析器不再使用时缓存起来给下次使用，而不是每次都创建一个新的解析器。分配完 HTTP 解析器后就开始等待 TCP 上数据的到来，即 HTTP 请求报文。但是这里有一个逻辑需要注意，上面代码中 Node.js 监听了 socket 的 data 事件，处理函数为 socketOnData，下面是 socketOnData 的逻辑。

```
function socketOnData(server, socket, parser, state, d) {  
  // 交给 HTTP 解析器处理，返回已经解析的字节数  
  const ret = parser.execute(d);  
}  
```

socketOnData 调用 HTTP 解析器处理数据，这看起来没什么问题，但是有一个逻辑我们可能会忽略掉，看一下下面的代码。

```
if (socket._handle && socket._handle.isStreamBase) {  
    parser.consume(socket._handle);  
}  
```

上面代码中，如果 socket._handle.isStreamBase 为 true（TCP handle 的 isStreamBase 为 true），则会执行 parser.consume(socket._handle)，这个是做什么的呢？

```
static void Consume(const FunctionCallbackInfo<Value>& args) {
    Parser* parser;
    ASSIGN_OR_RETURN_UNWRAP(&parser, args.Holder());
    // 解析出 C++ TCPWrap 对象
    StreamBase* stream = StreamBase::FromObject(args[0].As<Object>());
    // 注册 parser 成为流的消费者，即 TCP 数据的消费者
    stream->PushStreamListener(parser);
}
```

Consume 会注册 parser 会成为流的消费者，这个逻辑会覆盖掉刚才的 onData 函数，使得所有的数据直接由 parser 处理，看一下当数据到来时，parser 是如何处理的。

```
void OnStreamRead(ssize_t nread, const uv_buf_t& buf) override {  
    // 解析 HTTP 协议
    Local<Value> ret = Execute(buf.base, nread);  
    // 执行 kOnExecute 回调
    Local<Value> cb = object()->Get(env()->context(), kOnExecute).ToLocalChecked();  
    MakeCallback(cb.As<Function>(), 1, &ret);  
}  
```

在 OnStreamRead 中会源源不断地把数据交给 HTTP 解析器处理并执行 kOnExecute 回调，并且在解析的过程中，会不断触发对应的钩子函数。比如解析到 HTTP 头部时执行 parserOnHeaders。

```
function parserOnHeaders(headers, url) {
  // 记录解析到的 HTTP 头
  if (this.maxHeaderPairs <= 0 ||
      this._headers.length < this.maxHeaderPairs) {
    this._headers = this._headers.concat(headers);
  }
  this._url += url;
}
```

parserOnHeaders 会记录解析到的 HTTP 头，当解析完 HTTP 头 时会调用 parserOnHeadersComplete。

```
function parserOnHeadersComplete(versionMajor, versionMinor, headers, method,
                                 url, statusCode, statusMessage, upgrade,
                                 shouldKeepAlive) {
  const parser = this;
  const { socket } = parser;
  // 创建一个对象表示收到的 HTTP 请求
  const ParserIncomingMessage = (socket && socket.server &&
                                 socket.server[kIncomingMessage]) ||
                                 IncomingMessage;
  // 新建一个IncomingMessage对象
  const incoming = parser.incoming = new ParserIncomingMessage(socket);
  // 执行回调
  return parser.onIncoming(incoming, shouldKeepAlive);
}
```

parserOnHeadersComplete 中创建了一个对象来表示收到的 HTTP 请求，接着执行 onIncoming 函数，对应的是 parserOnIncoming。

```
function parserOnIncoming(server, socket, state, req, keepAlive) {  

  // 请求入队（待处理的请求队列）  
  state.incoming.push(req);  
  // 新建一个表示响应的对象  
  const res = new server[kServerResponse](req);  
  /*
     socket 当前已经在处理其它请求的响应，则先排队，
     否则挂载响应对象到 socket，作为当前处理的响应  
  */
  if (socket._httpMessage) {  
    state.outgoing.push(res);  
  } else {  
    res.assignSocket(socket);  
  }  
  
  // 响应处理完毕后，需要做一些处理  
  res.on('finish', resOnFinish.bind(undefined, 
                                    req, 
                                    res, 
                                    socket, 
                                    state, 
                                    server));  
  // 触发 request 事件说明有请求到来  
  server.emit('request', req, res);  
}  
```

我们看到这里会触发 request 事件通知用户有新请求到来，并传入request和response作为参数，这样用户就可以处理请求了。另外 Node.js 本身是不会处理 HTTP 请求体的数据，当 Node.js 解析到请求体时会执行 kOnBody 钩子函数，对应的是 parserOnBody 函数。

```
function parserOnBody(b, start, len) {
  // IncomingMessage 对象，即 request 对象
  const stream = this.incoming;
  // Pretend this was the result of a stream._read call.
  if (len > 0 && !stream._dumped) {
    const slice = b.slice(start, start + len);
    const ret = stream.push(slice);
    if (!ret)
      readStop(this.socket);
  }
}
```

parserOnBody 会把数据 push 到请求对象 request 中，接着 Node.js 会触发 data 事件，所以我们可以通过以下方式获取 body 的数据。

```
const server= http.createServer((request, response) => {  
  request.on('data', (chunk) => {  
   // 处理body  
  });  
  request.on('end', () => {  
   // body结束  
  });  
})  
```

了解了 HTTP 服务器的实现后，接着来看一下 HTTP 服务器的一些常见的特性，包括管道化、HTTP Connect 方法的实现和协议升级。

### HTTP 管道化的原理和实现

HTTP 协议已经经历了几个版本的演进，接下来我们看一下在不同的 HTTP 协议版本中，HTTP 的请求 / 响应模型，然后再具体讲解 Node.js 中的 HTTP 管道化的实现。

**HTTP 1.0**

HTTP 1.0 的时候，是不支持管道化的。请求响应模型为客户端发送一个请求前，首先建立 TCP 连接，然后服务器返回一个响应，最后断开 TCP 连接，这种是最简单的实现方式，但是每次发送请求都需要走三次握手显然会带来一定的时间损耗。

**HTTP 1.1**

HTTP 1.1 版本开始支持管道化的特性，管道化的意思就是可以在一个 TCP 连接上并发发送多个请求，这样服务器就可以同时处理多个请求，但是由于 HTTP 1.1 协议的限制，多个请求的响应需要按序返回。也就是说先发送的请求会先被响应，因为在 HTTP1.1 中，没有字段标记请求和响应的对应关系，所以 HTTP 客户端会假设第一个返回的响应是对应第一个请求的。如果乱序返回，就会导致请求响应不对应的问题，流程如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/844d1d7633c34288896ebd69284d76f2~tplv-k3u1fbpfcp-zoom-1.image)

**HTTP 2.0**

而到了 HTTP 2.0，多个请求不仅可以共享一个 TCP 连接同时发送多个请求，响应也可以不按序返回。因为 HTTP 2.0 实现了新的协议格式，每个请求对应一个 StreamId，响应时也会携带 StreamId 标识该响应所属的请求，这样就算乱序返回，HTTP 客户端也可以知道响应所对应的请求，流程如下所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2a02dddf5ce3484c881057aa50ee15fa~tplv-k3u1fbpfcp-zoom-1.image)

但是 HTTP 2.0 也存在一些问题，因为它还是基于 TCP 的，而 TCP 数据是按序发送的，前面的数据（响应 2）发送失败会导致后面的数据（响应 1）无法发送，如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/757196caae814eadb2ce624510e27e9d~tplv-k3u1fbpfcp-zoom-1.image)

**HTTP 3** **.0**

为了解决 TCP 协议本身的问题，HTTP 3.0 中使用了 UDP / QUIC 协议作为底层的传输协议，UDP 的数据可以随便发送，没有顺序的概念，比如上图中的响应 2 发送失败不会影响响应 1 的发送，然后 UDP 本身的缺点由 QUIC 协议解决，比如 UDP 不能保证数据的可靠传输。

  


了解了 HTTP 请求响应模型的发展后，我们来看一下 Node.js 的 HTTP 模块是如何实现 HTTP 1.1 的管道化的。实现管道化的重点是**需要管理好请求和响应的顺序和关系**。当服务器在一个连接上收到多个 HTTP 请求时，它可以以串行的方式进行处理，当前面请求的响应返回到客户端后，再继续处理下一个请求。这种实现方式相对简单，但明显比较低效。

其实还有另一种实现方式，就是**并行处理请求串行返回**，它可以让请求得到尽快处理，比如两个请求都访问数据库，那并行处理两个请求肯定会比串行快得多。但这种实现方式相对比较复杂，而 Node.js 就采用了这种方式。下面我们来看一下 Node.js 中是如何实现的。

  


前面分析过，Node.js 在解析完 HTTP 头部的时候会执行 parserOnIncoming。

```
function parserOnIncoming(server, socket, state, req, keepAlive) {  
  // 请求入队  
  state.incoming.push(req);  
  // 新建一个表示响应的对象，一般是 ServerResponse  
  const res = new server[kServerResponse](req);  
  /*
    socket 当前已经在处理其它请求的响应，则先排队，
   否则挂载响应对象到 socket，作为当前处理的响应
  */  
  if (socket._httpMessage) {  
    state.outgoing.push(res);  
  } else {  
    res.assignSocket(socket); // socket._httpMessage = res;  
  }  
  // 一个请求响应处理完毕后，需要做一些处理  
  res.on('finish', resOnFinish.bind(undefined, 
                                        req, 
                                        res, 
                                        socket, 
                                        state, 
                                        server));  
  // 触发 request 事件说明有请求到来  
  server.emit('request', req, res);   
}  
```

从上面代码中可以看到，当 Node.js 解析 HTTP 请求头完成后，就会创建一个 ServerResponse 对象表示响应。然后判断当前是否有正在处理的响应，如果有则排队等待处理，否则就把新建的 ServerResponse 对象作为当前需要处理的响应，最后触发 request 事件通知用户层，用户就可以进行请求的处理了。

在上面的代码中我们看到，Node.js 维护了两个队列，分别是请求和响应队列。当前处理的请求在请求队列的队首，当前请求对应的响应会挂载到 socket 的 _httpMessage 属性上，但是我们看到 Node.js 会触发 request 事件通知用户有新请求到来，所有在管道化的情况下，Node.js 会并行处理多个请求（如果是 CPU 密集型的请求则实际上还是会变成串行，这和 Node.js 的单线程有关）。那 Node.js 是如何控制响应顺序的呢？我们知道每次触发 request 事件的时候，我们都会执行一个函数。比如下面的代码。

```
 http.createServer((req, res) => {  
  // 一些网络IO  
  // 响应 
  res.end('okay');  
});  
```

我们看到每个请求的处理是独立的。假设每个请求都去操作数据库，如果请求 2 比请求 1 先完成数据库的操作，从而请求 2 先执行 res.end。那岂不是请求 2 先返回？我们看一下 ServerResponse 和 OutgoingMessage的 实现，揭开迷雾。ServerResponse 是 OutgoingMessage 的子类。write 函数是在 OutgoingMessage 中实现的，write 的调用链路很长，我们不层层分析，直接看最后的节点。

```
function _writeRaw(data, encoding, callback) {  
  const conn = this.socket;  
  // socket 对应的响应是自己并且可写  
  if (conn && conn._httpMessage === this && conn.writable) {  
    // 如果有缓存的数据则先发送缓存的数据  
    if (this.outputData.length) {  
      this._flushOutput(conn);  
    }  
    // 接着发送当前需要发送的  
    return conn.write(data, encoding, callback);  
  }  
  // socket 当前处理的响应对象不是自己，则先缓存数据。  
  this.outputData.push({ data, encoding, callback });  
  this.outputSize += data.length;  
  this._onPendingData(data.length);  
  return this.outputSize < HIGH_WATER_MARK;  
}  
```

上面代码中，有一个关键的地方是当用户通过响应对象 res 返回数据给客户端时，Node.js 会判断 res 是不是当前正在处理的响应，如果是才会真正发送数据，否则会先把数据缓存起来。那么这些缓存的数据什么时候被发送出去呢？当一个响应结束的时候，Node.js 会触发 finish 事件，对应的处理函数是 resOnFinish。

```
function resOnFinish(req, res, socket, state, server) {  
        // 删除响应对应的请求  
        state.incoming.shift();  
        clearIncoming(req);  
        // 解除 socket 上挂载的响应对象  
        /*
                socket._httpMessage = null;
                this.socket = null;
        */
        res.detachSocket(socket);  
        // 是不是最后一个响应  
        if (res._last) {  
            // 是则销毁 socket  
            if (typeof socket.destroySoon === 'function') {  
             socket.destroySoon();  
            } else {  
             socket.end();  
            }  
        } else if (state.outgoing.length === 0) {  
          /*
            没有待处理的响应了，则重新设置超时时间，
            等待请求的到来，一定时间内没有请求则触发 timeout 事件
          */  
          if (server.keepAliveTimeout && typeof socket.setTimeout === 'function') {  
            socket.setTimeout(server.keepAliveTimeout);  
            state.keepAliveTimeoutSet = true;  
          }  
        } else {  
          // 还有待处理的响应则获取下一个要处理的响应  
          const m = state.outgoing.shift();  
          // 挂载到 socket 作为当前待处理的响应  
          if (m) {  
            m.assignSocket(socket);  
          }  
        }  
}  
```

我们看到，Node.js 处理完一个响应后会做一些判断。这里主要分三类，我们分别分析。

1.  是否是最后一个响应？

什么情况下会被认为是最后一个响应？我们知道，响应和请求是一一对应的，最后一个响应就意味着最后一个请求了，那么什么时候会被认为是最后一个请求呢？

非管道化的情况下，一个请求一个响应，然后客户端或服务器就会关闭 TCP 连接，那这种情况下，TCP 上第一个也是唯一一个请求就是最后一个请求。管道化的情况下，理论上就没有所谓的最后一个响应。但是在 HTTP 服务器的实现上会做一些限制。在管道化的情况下，可以通过设置 HTTP 响应头 connection 来定义是否在响应完毕后就断开连接，或者请求个数达到阈值也会强制断开。此外，当读端关闭的时候，也被认为是最后一个请求，毕竟不会再发送请求了。接下来，我们就重点看看读端关闭的逻辑。

```
function socketOnEnd(server, socket, parser, state) {  
  const ret = parser.finish();  
  // 不允许半开关则终止请求的处理，不响应，关闭写端  
  if (!server.httpAllowHalfOpen) {  
    abortIncoming(state.incoming);  
    if (socket.writable) socket.end();  
  } else if (state.outgoing.length) {  
    /*
      允许半开关，并且还有响应需要处理，
      标记响应队列最后一个节点为最后的响应，
      处理完就关闭 socket
    */  
    state.outgoing[state.outgoing.length - 1]._last = true;  
  } else if (socket._httpMessage) {  
    /*
      没有等待处理的响应了，但是还有正在处理的响应，
      则标记为最后一个响应
     */  
    socket._httpMessage._last = true;  
  } else if (socket.writable) {  
    // 否则关闭 socket 写端  
    socket.end();  
  }  
}  
```

以上就是 Node.js 中判断是否是最后一个响应的一些情况，如果一个响应被认为是最后一个响应，那么发送响应后就会关闭连接。

2.  响应队列为空

如果不是最后一个响应的时候，Node.js 又是怎么处理的呢？如果当前的待处理响应队列为空，说明当前处理的响应是目前最后一个需要处理的，但不是 TCP 连接上最后一个响应。这时候，Node.js 会设置超时时间，如果超时还没有新的请求或者请求数达到阈值，则 Node.js 会关闭连接。

3.  响应队列非空

如果当前待处理队列非空，处理完当前请求后会继续处理下一个响应。并从队列中删除该响应。我们来看一下 Node.js 是如何处理下一个响应的。

```
// 把响应对象挂载到 socket，标记 socket 当前正在处理的响应  
ServerResponse.prototype.assignSocket = function assignSocket(socket) {  
  // 挂载到 socket上，标记是当前处理的响应  
  socket._httpMessage = this;  
  socket.on('close', onServerResponseClose);  
  this.socket = socket;  
  this.emit('socket', socket);  
  this._flush();  
};  
```

Node.js 是通过 _httpMessage 标记当前处理的响应的，配合响应队列来实现响应的按序返回。标记完后执行 _flush 发送响应的数据（如果这时候请求已经被处理完成），这样之前缓存的数据就可以被发送出去了，以下是 flush 的逻辑。

```
OutgoingMessage.prototype._flush = function _flush() {  
  const socket = this.socket;  
  if (socket && socket.writable) {  
    const ret = this._flushOutput(socket);  
};  
  
OutgoingMessage.prototype._flushOutput = function _flushOutput(socket) {  
  // 缓存的数据 
  const outputLength = this.outputData.length;  
  const outputData = this.outputData;  
  // 加塞，让数据一起发送出去  
  socket.cork();  
  // 把缓存的数据写到 socket  
  let ret;  
  for (let i = 0; i < outputLength; i++) {  
    const { data, encoding, callback } = outputData[i];  
    ret = socket.write(data, encoding, callback);  
  }  
  socket.uncork();  
  
  this.outputData = [];  
  this._onPendingData(-this.outputSize);  
  this.outputSize = 0;  
  
  return ret;  
}  
```

flush 最终会调用 socket 对象把数据发送出去，以上就是 Node.js 中对于管道化的实现。

### HTTP Connect 方法的原理和实现

HTTP Connect 方法用于客户端请求代理服务器时，指示代理服务器转发客户端的 TCP 数据到另一个服务器，同时把服务器的数据透明代理到客户端，流程如图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eb929bf1b7fe4a11963d6547cd472cf6~tplv-k3u1fbpfcp-zoom-1.image)

下面通过一个例子理解一下这个过程。

```
const http = require('http');  
const net = require('net');  
const { URL } = require('url');  
// 真正的服务器
const server = http.createServer((req, res) => res.end('ok')).listen(9999);
// 创建一个 HTTP 服务器作为代理服务器  
const proxy = http.createServer();  

// 监听 connect 事件，有 HTTP CONNECT 请求时触发  
proxy.on('connect', (req, clientSocket, head) => {  
  // 获取真正要连接的服务器地址并发起连接  
  const { port, hostname } = new URL(`http://${req.url}`);  
  const serverSocket = net.connect(port || 80, hostname, () => {  
    // 连接成功告诉客户端  
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +  
                       'Proxy-agent: Node.js-Proxy\r\n\r\n');  
    // 透传客户端和服务器的数据    
    serverSocket.write(head);              
    serverSocket.pipe(clientSocket);  
    clientSocket.pipe(serverSocket);  
  });  
});  
  
proxy.listen(8888, () => {  
  // 发起 HTTP Connect 请求  
  const req = http.get({  
    // 代理服务器的地址  
    port: 8888,  
    host: '127.0.0.1',  
    method: 'CONNECT',  
    // 真正需要访问的服务器地址
    path: '127.0.0.1:9999',
  });  
  // CONNECT 请求成功后触发  
  req.on('connect', (res, socket, head) => {  
    // 发送真正的请求  
    socket.write('GET / HTTP/1.1\r\n' +  
                 'Host: 127.0.0.1:9999\r\n' +  
                 'Connection: close\r\n' +  
                 '\r\n');  
    socket.on('data', (chunk) => {  
      console.log(chunk.toString());  
    });  
    socket.on('end', () => {  
      proxy.close();  
      server.close();
    });  
  });  
});  
```

上面的例子首先创建了一个 HTTP 服务器，然后发起了一个 HTTP Connect 请求，这时候服务器会触发 connect 事件。connect 事件的处理函数会通过请求 URL 拿到需要代理的服务器地址，然后发起 TCP 连接，连接成功后，服务器给客户端返回了 200，接着客户端和服务器就可以传输 TCP 数据了，而代理服务器会透明转发。下面是客户端和代理服务器的通信过程。

1.  客户端发送的 HTTP Connect 请求报文。

```
CONNECT 127.0.0.1:9999 HTTP/1.1
Host: 127.0.0.1:8888
Connection: close
```

2.  代理服务器连接服务器成功后，返回给客户端的响应报文。

```
HTTP/1.1 200 Connection Established
```

3.  客户端和服务器就可以通过代理服务器传输 TCP 数据了。

我们也可以通过 WireShark 和过滤条件 tcp.srcport == 8888 || tcp.dstport == 8888 || tcp.srcport == 9999 || tcp.dstport == 9999 查看具体的通信过程。

  


下面我们看一下 Node.js 中 Connect 的实现。之前已经分析过，客户端和 Node.js 服务器建立 TCP 连接后，Node.js 收到数据时会执行 OnStreamRead 处理。

```
void OnStreamRead(ssize_t nread, const uv_buf_t& buf) override {
    // 解析 HTTP 请求
    Local<Value> ret = Execute(buf.base, nread);
    Local<Value> cb = object()->Get(env()->context(), kOnExecute).ToLocalChecked();
    // 执行 kOnExecute 回调
    MakeCallback(cb.As<Function>(), 1, &ret);
  }
```

OnStreamRead 通过 Execute 解析 HTTP 数据，然后执行 JS 回调 kOnExecute，对应的 JS 函数是onParserExecute。

```
// 连接上有数据到来  
function onParserExecute(server, socket, parser, state, ret) {
    onParserExecuteCommon(server, socket, parser, state, ret, undefined);
}

function onParserExecuteCommon(server, socket, parser, state, ret, d) { 
  // 解析完 HTTP 头并且设置了 upgrade 字段
  if (parser.incoming && parser.incoming.upgrade) {  
    // 处理 Upgrade 或者 CONNECT 请求  
    const req = parser.incoming;  
    const eventName = req.method === 'CONNECT' ?  'connect' : 'upgrade';  
    // 监听了对应的事件或者是协议升级请求则处理，否则关闭连接  
    if (eventName === 'upgrade' || server.listenerCount(eventName) > 0) {  
      // 还没有解析的数据  
      const bodyHead = d.slice(ret, d.length);  
      server.emit(eventName, req, socket, bodyHead);  
    } else {  
      socket.destroy();  
    }  
  }  
}  
```

onParserExecuteCommon 中会判断收到的请求是不是 Connect 或者协议升级请求，如果是并且监听了对应的事件则处理该请求，否则关闭连接，这就是 Node.js 中 Connect 的原理和实现了。

  


另外，在代码中我们发现一个有意思的地方，那就是在触发 connect 事件的时候，Node.js 给回调函数传入的参数。

```
server.emit('connect', req, socket, bodyHead);  
```

第一第二个参数没什么特别的，但是第三个参数就有意思了，bodyHead 代表的是 HTTP Connect 请求中除了请求行和 HTTP 头之外的数据。因为 Node.js 解析完 HTTP 头后就不继续处理了，而是把剩下的数据交给了用户。这样我们就可以做一些好玩的事情。

```
const http = require('http');  
const net = require('net');  
const { URL } = require('url');  

const server = http.createServer((req, res) => res.end('ok')).listen(9999);
  
const proxy = http.createServer();  

proxy.on('connect', (req, clientSocket, head) => {  
  const { port, hostname } = new URL(`http://${req.url}`);  
  const serverSocket = net.connect(port || 80, hostname, () => {  
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +  
                       'Proxy-agent: Node.js-Proxy\r\n\r\n');  
    // 把 connect 请求剩下的数据转发给服务器                 
    serverSocket.write(head);  
    serverSocket.pipe(clientSocket);  
    clientSocket.pipe(serverSocket);  
  });  
});  
  
proxy.listen(8888, () => {  
  const net = require('net');  
  const body = 'GET http://127.0.0.1:9999 HTTP/1.1\r\nConnection: close\r\n\r\n';  
  const socket = net.connect(8888);  
  socket.write(`CONNECT 127.0.0.1:9999 HTTP/1.1\r\n\r\n${body}`);  
  socket.setEncoding('utf-8');  
  socket.on('data', (chunk) => {  
    console.log(chunk);
  });  
  socket.on('end', () => {
    proxy.close();
    server.close();
  })
});  
```

上面的代码中，我们新建一个 socket，然后自己构造 HTTP Connect 报文，并且在 HTTP 行后面加一个额外的字符串，这个字符串是一个 HTTP 请求，当 Node.js 服务器收到 Connect 请求后，connect 事件的处理函数会把 Connect 请求多余的那一部分数据传给真正的服务器，这样就可以在一个请求里做两个事情，节省了发送一个请求的时间。

### 协议升级

除了 HTTP Connect 特性外，HTTP 协议还有一个特性是**协议升级** **。** 协议升级就是先通过 HTTP 协议进行通信协商，然后升级到另一种协议，后续就可以使用另一种协议进行通信了，比如 Websocket 协议。

接着来，我们看看协议升级的过程。当客户端试图升级到一个新的协议时，先发送一个普通的 HTTP 请求，这个请求带有以下 header。

1.  Connection: Upgrade 表示这是一个升级请求。
1.  Upgrade: 协议1,协议2 指定一项或多项协议名，按优先级排序，以逗号分隔。
1.  根据不同的协议可以带上协议相关的 header，比如 WebSocket 的 Sec-WebSocket-Extensions。

下面是一个协议升级请求的例子。

```
GET / HTTP/1.1
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: G+Gcwl/FXe2fns7dF5aUIQ==
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
Host: localhost:8888
```

服务器收到升级请求后会返回相应的信息。

1.  Upgrade: websocket 表示同意升级到 WebSocket 协议。
1.  Connection: Upgrade 表示协议升级响应。
1.  根据不同的协议可以带上协议相关的 header，比如 WebSocket 的 Sec-WebSocket-Accept。

下面是一个协议升级响应的例子。

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: 5psuA6qQUa3bYFsz3aqP5t3x8UA=
```

  


接着，我们再通过一个例子看看 Node.js 中如何实现 WebSocket 协议升级。

```
const http = require('http');
const { createHash } = require('crypto');
const WebSocket = require('ws');

// 创建一个 http server
const httpServer = http.createServer();

// 监听协议升级请求
httpServer.on('upgrade', (req, socket, head) => {
    // 按照 WebSocket 协议计算返回 header
    const digest = createHash('sha1')
    .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

    // 设置返回状态码和 headers
    const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${digest}`
    ];  
    socket.write(headers.concat('\r\n').join('\r\n'));
});

// 启动服务器
httpServer.listen(8888, () => {
    // 建立 Websocket 连接
    const ws = new WebSocket('ws://localhost:8888');
    ws.on('open', () => {
        console.log('success');
        process.exit();
    });
});
```

上面的代码中，首先建立了一个 HTTP 服务器并监听了 upgrade 事件，然后客户端创建了一个 WebSocket 连接，这时候服务器就会收到 upgrade 事件，upgrade 事件处理函数中，会根据请求计算出响应所需要的信息，接着给客户的返回 200 和相关的 HTTP 头表示同意协议升级，后续客户端和服务器之间就可以通过 WebSocket 协议进行通信了。流程如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c1db852fdca4c41910d3fc32a9d0a0c~tplv-k3u1fbpfcp-zoom-1.image)

# HTTP 客户端

了解完 HTTP 服务器的实现和特性后，接着看一下 HTTP 客户端的实现。Node.js 中，可以通过 http.request 发送一个 HTTP 请求。

```
function request(url, options, cb) {  
  return new ClientRequest(url, options, cb);  
}  
```

request 中创建了一个 ClientRequest 对象表示一个 HTTP 请求，下面逐步分析具体的逻辑。

```
function ClientRequest(input, options, cb) {  
  // 继承 OutgoingMessage  
  OutgoingMessage.call(this);  
  // 是否使用 agent  
  let agent = options.agent;   
  // 忽略 agent 的处理，主要用于复用 TCP 连接，具体参考 _http_agent.js 和下面的 Agent 章节
  this.agent = agent;  
  // 监听响应事件  
  if (cb) {  
    this.once('response', cb);  
  }  
  // 使用 agent 时，socket 由 agent 提供，否则自己创建 socket  
  if (this.agent) {  
    this.agent.addRequest(this, options);  
  } else {  
    // 不使用 agent 则每次创建一个 socket，默认使用 net 模块的接口
    this.onSocket(net.createConnection(options)); 
  }  
  // 连接成功后发送待缓存的数据，支持连接过程中，用户调用了 write 或者 end 的情况  
  this._deferToConnect(null, null, () => this._flush());  
}  
```

获取一个 ClientRequest 实例后，不管是通过 agent 还是自己创建一个 TCP 连接，在连接成功后都会执行 onSocket，onSocket 函数逻辑如下。

```
// socket 可用时的回调  
ClientRequest.prototype.onSocket = function onSocket(socket) {  
  process.nextTick(onSocketNT, this, socket);  
};  
  
function onSocketNT(req, socket) {  
  // 申请 socket 过程中，请求已经终止  
  if (req.aborted) {
    // 不使用 agent，直接销毁 socket  
    if (!req.agent) {  
      socket.destroy();  
    } else {  
      // 触发 free 事件，由 agent 处理 socket  
      req.emit('close');  
      socket.emit('free');  
    }  
  } else {  
    // 处理 socket  
    tickOnSocket(req, socket);  
  }  
}  
```

正常情况下，onSocketNT 中会执行 tickOnSocket 函数继续处理请求。

```
function tickOnSocket(req, socket) {  
    // 分配一个 HTTP 解析器解析响应数据  
    const parser = parsers.alloc();  
    req.socket = socket;  
    // 初始化，处理响应报文  
    parser.initialize(HTTPParser.RESPONSE, ...);  
    parser.socket = socket;  
    parser.outgoing = req;  
    req.parser = parser;  
    socket.parser = parser;  
    // socket 正处理的请求  
    socket._httpMessage = req;  
    // 解析完 HTTP 头部的回调  
    parser.onIncoming = parserOnIncomingClient;  
    socket.on('data', socketOnData);  
    socket.on('end', socketOnEnd);  
    req.emit('socket', socket);  
}  
```

拿到一个 socket 后，申请一个 HTTP 解析器用于解析 HTTP 响应报文，然后监听 data 事件等待响应数据，对应的处理函数是 socketOnData。

```
function socketOnData(d) {  
  const socket = this;  
  // 请求对象
  const req = this._httpMessage;  
  const parser = this.parser;  
  // 交给 HTTP 解析器处理  
  const ret = parser.execute(d);  
  // ...  
}  
```

当 Node.js 收到响应报文时，会把数据交给 HTTP 解析器处理，HTTP 在解析的过程中会不断触发钩子函数，比如解析完 HTTP 头后会触发 kOnHeadersComplete 钩子，对应函数为 parserOnHeadersComplete。

```
function parserOnHeadersComplete(...) {  
  const parser = this;  
  const { socket } = parser;  
  const ParserIncomingMessage = IncomingMessage;  
  // 新建一个 IncomingMessage 对象  
  const incoming = parser.incoming = new ParserIncomingMessage(socket);  
  // 执行回调  
  return parser.onIncoming(incoming, shouldKeepAlive);  
}  
```

解析完头部后会执行另一个回调 onIncoming，并传入 IncomingMessage 实例，onIncoming 的值是 parserOnIncomingClient。

```
function parserOnIncomingClient(res, shouldKeepAlive) {  
  const socket = this.socket;  
  // 请求对象  
  const req = socket._httpMessage;  
  req.res = res;  
  res.req = req;  
  // 监听响应结束事件，响应结束后会清除定时器、判断是否需要关闭 TCP 连接  
  res.on('end', responseOnEnd);  
  // 请求终止了或 emit 返回 false 说明没有监听 response 事件，则丢弃数据  
  if (req.aborted || !req.emit('response', res))  
    res._dump();  
}  
```

从上面代码中可以看到，Node.js 解析完 HTTP 响应头时，就通过触发 response 事件执行了 http.request 设置的回调函数，例如下面代码中的回调。

```
http.request('url', (res) => {  
    // 解析body
    res.on('data', (data) => {  
      //   
    });
     // 解析body结束，响应结束
     res.on('end', (data) => {  
      //   
    });  
});  
// ...
```

因为 Node.js 不负责解析 HTTP body 数据，所以在 http.request 回调中可以通过 data 事件获取响应的数据，前面分析过，Node.js 收到 body 时会调用 kOnBody 钩子，对应的函数是 parserOnBody。

```
function parserOnBody(b, start, len) {  
    const stream = this.incoming;  
    // 数据
    const slice = b.slice(start, start + len);  
    // 把数据 push 到流中，流会触发 data 事件  
    const ret = stream.push(slice);  
    // 数据过载，暂停接收  
    if (!ret)  
      readStop(this.socket);  
}  
```

parserOnBody 解析 body 过程中会不断往 res 流中 push 数据，从而不断触发 res 的 data 事件。解析 body 结束后会执行 kOnMessageComplete 钩子，对应函数为 parserOnMessageComplete。

```
function parserOnMessageComplete() {  
    const parser = this;  
    const stream = parser.incoming;  
    // 流结束  
    stream.push(null); 
}  
```

parserOnMessageComplete 中执行 push(null) 通知流读取结束，从而触发 res 的 end 事件，这样一个请求的响应过程就结束了。

  


分析完响应的处理后，接着再来看一下发送请求的逻辑。执行完 http.request 后，我们会得到一个表示请求的对象 ClientRequest，然后可以执行它的 write 方法发送 HTTP 请求数据，因为 ClientRequest 继承 OutgoingMessage，所以实际上调用的是 OutgoingMessage 的 write 函数。

```
OutgoingMessage.prototype.write = function write(chunk, encoding, callback) {  
  const ret = write_(this, chunk, encoding, callback, false);  
  // 返回 false 说明先不要写入数据，等待 drain 事件后再写
  if (!ret)  
    this[kNeedDrain] = true;  
  return ret;  
};  
  
function write_(msg, chunk, encoding, callback, fromEnd) { 
  //  把请求行和请求头保存到 msg._header 中
  msg._implicitHeader();   
    
  let ret;  
  // chunk 模式则需要额外加一下字段，否则直接发送  
  if (msg.chunkedEncoding && chunk.length !== 0) {  
    const len = Buffer.byteLength(chunk, encoding);   
    /* 
      chunk模式时，报文的格式如下 
      chunk长度，回车换行 
      数据 回车换行 
    */  
    msg._send(len.toString(16), 'latin1', null);  
    msg._send(crlf_buf, null, null);  
    msg._send(chunk, encoding, null);  
    ret = msg._send(crlf_buf, null, callback);  
  } else {  
    ret = msg._send(chunk, encoding, callback);  
  }  
  
  return ret;  
}  
```

write_ 函数首先拼接请求行和请求头，把它们保存到 _header 字段中，然后判断使用哪种方式发送 body 数据（如果有的话）。比如说，我们通过 http.request 拿到 ClientRequst 对象后，执行 ClientRequst 的 write 的函数，这时候 Node.js 无法知道 body 的具体大小，所以只能使用 chunk 模式进行发送。而如果是调用 ClientRequst 的 end 函数的话，Node.js 就可以直接算出 body 的长度，从而使用 content-length 模式。我们可以执行下面例子的代码，然后通过 WireShark 抓包观察（过滤条件为 tcp.srcport == 8888 || tcp.dstport == 8888）。

```
const http = require('http');
http.createServer((req, res) => {
    res.end('ok')
}).listen(8888, () => {
    const client = http.request({
        port: 8888,
        method: 'post'
    });
    // chunk 模式
    client.write('hello');
    client.end();
    // content-length 模式
    // client.end('world');
})
```

不管是 chunk 模式还是 content-length 模式，最终都是调用 _send 函数发送数据。

```
OutgoingMessage.prototype._send = function _send(data, encoding, callback) {  
    // 请求行 + 请求头 + 数据
    data = this._header + data;   
    return this._writeRaw(data, encoding, callback);  
};  
  
OutgoingMessage.prototype._writeRaw = function _writeRaw(data, encoding, callback) {     
    const conn = this.socket; 
    // 已经建立了连接 && 当前待处理的对象是自己 && 可写
    if (conn && conn._httpMessage === this && conn.writable) {
        // 如果有缓存的数据则先发送缓存的数据
        if (this.outputData.length) {
          this._flushOutput(conn);
        }
        // 接着发送当前需要发送的
        return conn.write(data, encoding, callback);
    }
    // 还不具备发送的条件，先缓存数据，等待条件满足
    this.outputData.push({ data, encoding, callback });
    this.outputSize += data.length;
    this._onPendingData(data.length);
    return this.outputSize < HIGH_WATER_MARK;
}  
```

_writeRaw 中会判断当前是否满足发送的条件，比如是否已经建立了 TCP 连接，如果满足条件则直接调用 socket 发送数据，否则先缓存数据等待满足条件后再发送，比如连接成功后，Node.js 会调用 _flush 函数发送缓存的数据。

```
OutgoingMessage.prototype._flush = function _flush() {
  const socket = this.socket;
  const ret = this._flushOutput(socket);
};

OutgoingMessage.prototype._flushOutput = function _flushOutput(socket) {
  // 之前设置了加塞，则操作 socket 先积攒数据
  while (this[kCorked]) {
    this[kCorked]--;
    socket.cork();
  }

  const outputLength = this.outputData.length;
  const outputData = this.outputData;
  socket.cork();
  // 把缓存的数据写到socket
  let ret;
  // 发送缓存的数据
  for (let i = 0; i < outputLength; i++) {
    const { data, encoding, callback } = outputData[i];
    ret = socket.write(data, encoding, callback);
  }
  socket.uncork();
  // 更新数据结构
  this.outputData = [];
  this._onPendingData(-this.outputSize);
  this.outputSize = 0;

  return ret;
};
```

写完数据后，执行 ClientRequest 的 end 函数标记 HTTP 请求的结束。

# 请求 Agent

刚才讲解 HTTP 客户端时，我们讲到了 Agent 的概念，Agent 是对 TCP 连接进行了池化管理。简单的情况下，比如客户端发送一个 HTTP 请求之前，会先建立一个 TCP 连接，收到响应后会立刻关闭 TCP 连接。但是我们知道，TCP 的三次握手比较耗时，所以如果我们能复用 TCP 连接，在一个 TCP 连接上发送多个 HTTP 请求和接收多个 HTTP 响应，那性能肯定会得到一定的提升。

不过我们需要注意的是，Agent 的模式是在一个 TCP 连接上串行地发送请求和接收响应，不支持 HTTP PipeLine 模式。下面我们看一下 Agent 模块是如何实现 TCP 连接复用的。

```
function Agent(options) {  
  EventEmitter.call(this);  
  this.defaultPort = 80;  
  this.protocol = 'http:';  
  this.options = { ...options };  
  // path 字段表示是本机的进程间通信时使用的路径，比如 Unix 域路径  
  this.options.path = null;  
  // socket 个数达到阈值后，等待空闲 socket 的请求  
  this.requests = {};  
  // 正在使用的 socket  
  this.sockets = {};  
  // 空闲 socket  
  this.freeSockets = {};  
  // 空闲 socket 的存活时间  
  this.keepAliveMsecs = this.options.keepAliveMsecs || 1000;  
  /* 
    用完的 socket 是否放到空闲队列， 
      开启 keepalive 才会放到空闲队列， 
      不开启keepalive 
        还有等待 socket 的请求则复用 socket 
        没有等待 socket 的请求则直接销毁 socket 
  */  
  this.keepAlive = this.options.keepAlive || false;  
  // 最大的 socket 个数，包括正在使用的和空闲的 socket  
  this.maxSockets = this.options.maxSockets || Agent.defaultMaxSockets;  
  // 最大的空闲 socket 个数，超过后直接销毁  
  this.maxFreeSockets = this.options.maxFreeSockets || 256;  
}  
```

Agent 维护了几个数据结构，分别是等待 socket 的请求、正在使用的 socket、空闲 socket。每一个数据结构是一个对象，对象的 key 是根据 HTTP 请求参数计算的，对象的值是一个队列，具体结构如图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a82b37cf5d3745b09286dcb5a657bee2~tplv-k3u1fbpfcp-zoom-1.image)

下面看一下 Agent 模块的具体实现。

## key 的计算

key 的计算是池化管理的核心，正确地设计 key 的计算规则，才能更好地利用池化带来的好处。

```
// 一个请求对应的 key  
Agent.prototype.getName = function getName(options) {  
  let name = options.host || 'localhost'; 
  name += ':';  
  if (options.port)  
    name += options.port;  
  name += ':';  
  if (options.localAddress)  
    name += options.localAddress;  
  if (options.family === 4 || options.family === 6)  
    name += `:${options.family}`;  
  if (options.socketPath)  
    name += `:${options.socketPath}`; 
  return name;  
};  
```

key 由 host、port、本地地址、地址簇类型、Unix 路径计算而来，所以不同的请求只有这些因子都一样的情况下才能复用连接。

## 创建一个socket

当调用方需要一个 socket，但是空闲 socket 队列里没有可用 socket 时就会创建一个新的 socket，对应的函数为 createSocket。

```
 function createSocket(req, options, cb) {  
   options = { ...options, ...this.options };  
   // 计算 key
   const name = this.getName(options);  
   // 创建 socket 完毕后执行的回调
   const oncreate = (err, s) => {  
     if (!this.sockets[name]) {  
       this.sockets[name] = [];  
     }  
     // 插入正在使用的 socket 队列  
     this.sockets[name].push(s); 
      // 监听 socket 的一些事件，用于回收 socket 
     installListeners(this, s, options); 
     // 有可用 socket，通知调用方 
     cb(null, s);  
   };  
   // 创建一个新的 socket，默认使用 net.createConnection  
   this.createConnection(options, oncreate); 
 }  
   
 function installListeners(agent, s, options) { 
   /* 
     监听 socket 空闲事件，调用方使用完 socket 后触发，
     通知 agent socket 用完了，agent 会回收该 socket 到空闲队列   
   */ 
   s.on('free', function onFree() {  
     agent.emit('free', s, options);  
   });  
   
   // socket 关闭则 agent 会从 socket 队列中删除它  
   s.on('close', function onClose(err) {  
     agent.removeSocket(s, options);  
   });  
   
   // 触发 agentRemove 事件，从 agent 中删除它，比如 socket 发生了错误  
   s.on('agentRemove', function onRemove() {  
     agent.removeSocket(s, options);  
     s.removeListener('close', onClose);  
     s.removeListener('free', onFree);  
     s.removeListener('agentRemove', onRemove);  
   });   
 }  
```

createSocket 首先调用 net 模块创建一个 socket，然后插入使用中的 socket 队列，最后通知调用方 socket 创建成功。同时 createSocket 也会监听 socket 的一些事件，比如 close 事件触发时从 Agent 的 socket 队列中删除该 socket，free 事件触发时通知 agent 回收该 socket。

## 使用连接池

接着我们看一下如何使用 Agent，刚才讲解 HTTP 客户端时讲过，当发起一个请求并且使用了 agent 时，Node.js 先调用 addRequest 创建一个连接，然后再发送请求。

```
function addRequest(req, options, port, localAddress) {  
  options = { ...options, ...this.options };  
  // 拿到请求对应的 key  
  const name = this.getName(options);  
  // 该 key 还没有在使用的 socekt 则初始化数据结构  
  if (!this.sockets[name]) {  
    this.sockets[name] = [];  
  }  
  // 该 key 对应的空闲 socket 列表
  const freeLen = this.freeSockets[name] ? this.freeSockets[name].length : 0;
  // 该 key 对应的所有 socket 个数
  const sockLen = freeLen + this.sockets[name].length;
  // 该 key 有对应的空闲 socekt
  if (freeLen) {
    // 获取一个该 key 对应的空闲 socket
    const socket = this.freeSockets[name].shift();
    // 取完了删除，防止内存泄漏
    if (!this.freeSockets[name].length)
      delete this.freeSockets[name];
    // 设置 ref 标记，因为正在使用该socket
    this.reuseSocket(socket, req);
    // 设置请求对应的 socket
    setRequestSocket(this, req, socket);
    // 插入正在使用的socket队列
    this.sockets[name].push(socket);
  } else if (sockLen < this.maxSockets) { 
    /*
      如果该 key 没有对应的空闲 socket 并且使用的
      socket 个数还没有得到阈值，则继续创建
    */
    this.createSocket(req, options, handleSocketCreation(this, req, true));
  } else {
    // 没有空闲 socket 并且创建的个数也已经达到阈值了，
    // 则插入对待队列，等待该 key 下有空闲的 socket
    if (!this.requests[name]) {
      this.requests[name] = [];
    }
    this.requests[name].push(req);
  }
}  
```

addRequest 的代码很长，主要分为三种情况。

1.  有空闲 socket，则把它插入正在使用的 socket 队列中，并执行 setRequestSocket 通知调用方有可用 socket。

```
function setRequestSocket(agent, req, socket) {  
  // 通知请求 socket 创建成功  
  req.onSocket(socket);   
}  

ClientRequest.prototype.onSocket = function onSocket(socket) {
  process.nextTick(onSocketNT, this, socket);
};

function onSocketNT(req, socket) {
  tickOnSocket(req, socket);
}

function tickOnSocket(req, socket) {
  const parser = parsers.alloc();
  req.socket = socket;
  parser.initialize(HTTPParser.RESPONSE, ...);
  socket.on('error', socketErrorListener);
  socket.on('data', socketOnData);
  socket.on('end', socketOnEnd);
}
```

setRequestSocket 函数通过 req.onSocket(socket) 通知调用方有可用 socket，并分配了一个解析响应的 HTTP 解析器，这个刚才讲解 HTTP 客户端时已经讲过，就不再分析。

2.  没有空闲 socket，但是使用的 socket 个数还没有达到阈值，则创建新的 socket，然后执行 handleSocketCreation，handleSocketCreation 中会执行 setRequestSocket 通知调用方。
2.  没有空闲 socket 并且创建的个数也已经达到阈值了，则把请求插入等待 socket 队列，当有 socket 空闲时会触发 free 事件，我们看一下该事件的处理逻辑。

```
// this 为 Agent 对象
this.on('free', (socket, options) => {
    // 计算 key
    const name = this.getName(options);
    // socket还可写并且还有等待 socket 的请求，则复用 socket
    if (socket.writable && this.requests[name] && this.requests[name].length) {
      // 拿到一个等待 socket 的请求，然后通知它有 socket 可用
      const req = this.requests[name].shift();
      setRequestSocket(this, req, socket);
      // 没有等待 socket 的请求则删除，防止内存泄漏
      if (this.requests[name].length === 0) {
        // don't leak
        delete this.requests[name];
      }
    } else {
      // socket 不可用写或者没有等待 socket 的请求了
      const req = socket._httpMessage;
      // socket 可写并且允许复用 socket
      if (req &&
          req.shouldKeepAlive &&
          socket.writable &&
          this.keepAlive) {
        let freeSockets = this.freeSockets[name];
        // 该 key 下当前的空闲 socket 个数
        const freeLen = freeSockets ? freeSockets.length : 0;
        let count = freeLen;
        // 正在使用的 socket 个数
        if (this.sockets[name])
          count += this.sockets[name].length;
        // 该 key 使用的 socket 个数达到阈值或者空闲 socket 达到阈值，则不复用 socket，直接销毁 socket
        if (count > this.maxSockets || freeLen >= this.maxFreeSockets) {
          socket.destroy();
        } else if (this.keepSocketAlive(socket)) { // 重新设置 socket 的存活时间，keepSocketAlive 一定返回 true
          freeSockets = freeSockets || [];
          this.freeSockets[name] = freeSockets;
          socket._httpMessage = null;
          // 把 socket 从正在使用队列中移除
          this.removeSocket(socket, options);
          // 插入 socket 空闲队列
          freeSockets.push(socket);
        } else {
          // 不复用则直接销毁
          socket.destroy();
        }
      } else {
        socket.destroy();
      }
    }
  });
```

当有 socket 空闲时，分为以下几种情况。

1.  如果有等待 socket 的请求，则直接复用 socket。
1.  如果没有等待 socket 的请求，允许复用并且 socket 个数没有达到阈值则插入空闲队列。
1.  直接销毁。

## Agent 的使用

接下来，我们再通过一个例子来加深对 Agent 的理解。

```
const http = require('http');  

let connections = 0;  

http.createServer((req, res) => {  
    res.end('ok');
}).listen(8888, () => {
    startClient();
}).on('connection', () => {
    console.log('收到连接个数：', ++connections);  
});

function startClient() {
    const options = { 
        port: 8888, 
        headers: {
            Connection: 'keep-alive',
        },
        agent: new http.Agent({ keepAlive: true, maxSockets: 1 }),
    };
    // 往同一个 host 和 port 发起两个连接
    for (let i = 0; i < 2; i++) {
        let index = i + 1;
        http.get(options, (res) => {
            // 监听 data 才能触发 end 事件
            res.on('data', () => {});
            res.on('end', () => {
                console.log(`request${index} end`);
            });
        });
    }  
    let requests = 0;
    for (const [k, v] of Object.entries(options.agent.requests)) {
        requests += v.length;
    }
    // 输出等待的请求个数，通过打印 options.agent.requests 可以看到请求对应的 key
    console.log('等待 TCP 连接的请求数: ', requests);
}
```

上面的代码中，首先创建了一个 HTTP 服务器，然后在客户端发起 HTTP 请求并使用 agent 管理 TCP 连接，但是 maxSocket 的值为 1，代表最多只能有一个 socket，而这时候客户端同时发送两个请求，所以有一个请求就会在排队，服务器也只收到了一个连接。

输出如下。

```
等待 TCP 连接的请求数:  1
收到连接个数： 1
request1 end
request2 end
```

可以看到 Agent 只创建了一个 socket，由两个请求是共用这个 socket，当一个请求用完这个 socket 后，下一个请求才会被发送。通过 WireShark 抓包如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a53859877ca24a3c8b09fe7868602b70~tplv-k3u1fbpfcp-zoom-1.image)

如果把 maxSockets 改成 2，则输出如下。

```
等待 TCP 连接的请求数:  0
收到连接个数： 1
收到连接个数： 2
request2 end
request1 end
/*
    或
    request1 end
    request2 end
*/
```

可以看到这时候 Agent 创建了两个 socket 给两个请求使用，最终哪个请求先返回也不确定。通过 WireShark 抓包如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5f9328423acf4b3ebdee6ec421b7e20c~tplv-k3u1fbpfcp-zoom-1.image)

  


# 总结

HTTP 协议是我们日常工作中使用的最多的协议，在 Node.js 中，通过 API 可以非常简单地创建一个 HTTP 服务器和客户端，这背后其实涉及很多知识。这节课，我们从多方面对 Node.js 中的 HTTP 模块进行讲解，通过深入学习 Node.js 中 HTTP 模块的实现，可以加深我们对 HTTP 协议的理解，同时也帮助我们更好地使用 HTTP 模块。下面回顾一下这节课的内容。

1.  HTTP 协议是一种基于客户端 / 服务器架构的无状态的应用层协议，它的数据可以通过 TCP、UDP 和 Unix 进行传输。
1.  llhttp 是目前 Node.js 的 HTTP 解析器，相对之前的解析器来说，llhttp 性能上有了比较大的提升。llhttp 通过钩子函数工作，通过了解 llhttp 的工作方式，不仅可以加深对 Node.js HTTP 模块的理解，我们还可以把 llhttp 用于自己的项目中。
1.  详细讲解了 Node.js HTTP 服务器的实现过程，主要分为两个部分，首先通过 net 模块启动一个 TCP 服务器，然后通过 llhttp 来解析 TCP 服务器上收到的 HTTP 数据。除了基本的功能外，我们还介绍了 HTTP 管道化（在同一个 TCP 连接中并发发送多个请求，但是响应需要按序返回）、Connect 方法（通过 Connect 让 HTTP 代理服务器转发客户端的 TCP 流量到另一个真正的服务器中）以及协议升级（通过 HTTP 协议协商升级到另一个通信协议，后续就可以使用新的协议进行通信了）的功能，这些都是 HTTP 协议中比较核心的内容。
1.  详细讲解了 HTTP 客户端的实现，HTTP 客户端的实现和服务器有点类似，首先创建一个 TCP 连接，然后发送 HTTP 请求报文，接着通过 llhttp 解析 TCP 连接上返回的 HTTP 响应报文。除了基本功能外，Node.js 还实现了 Agent 来管理客户端的 TCP 连接，它本质上是一个连接池，负责管理 Node.js 和第三方通信时的连接建立、空闲回收等。