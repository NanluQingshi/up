Unix 域是操作系统提供的一种IPC（进程间通信）方式，操作系统通常会提供很多种 IPC 方式，为什么我们要单独用一节课讲 Unix 域呢？因为相比其他 IPC 方式，Unix 域不仅支持传递普通的数据，还支持传递文件描述符，而传递文件描述符是操作系统提供的非常重要的技术。

在 Node.js 中，net、child_process 和 Cluster 模块都依赖 Unix 域的能力，所以这节课我们详细讲解 Unix 域相关的内容，包括操作系统中的 Unix 域、Libuv 中的 Unix 域和文件描述符传递技术。

# 操作系统中的 Unix 域

在操作系统中，Unix 域提供了 SOCK_STREAM、SOCK_DGRAM 和 SOCK_SEQPACKET 三种数据传输方式。

-   SOCK_STREAM 表示是基于连接，按照字节流发送的。
-   SOCK_DGRAM 表示不是基于连接的，按照应用层传递的数据包直接发送。
-   SOCK_SEQPACKET 表示基于连接的，按照应用层传递的数据包直接发送（Node.js 只支持 SOCK_STREAM）。

在使用上，Unix 域遵循网络编程的 API，但是和网络编程不一样，Unix 域没有端口和 IP 的概念，取而代之的是路径字符串，也就是说当我们选择通过连接的方式通信时，我们需要绑定 / 连接到一个路径中，并且需要对这个路径有一定的权限，下面我们看一个使用例子。

下面是创建一个 Unix 域服务器 unix_domain_server.c。

```
#include <stdio.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <string.h>
#include <unistd.h>
#include <sys/un.h>

const char* SERVER_PATH = "server.sock";

int main()
{
    // 删除之前创建的 sock，如果有的话
    unlink(SERVER_PATH);
    
    int server_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    
    struct sockaddr_un server_addr;
    server_addr.sun_family = AF_UNIX;
    memcpy(server_addr.sun_path, SERVER_PATH, strlen(SERVER_PATH));
    bind(server_fd, (struct sockaddr *)&server_addr, sizeof(server_addr));
    listen(server_fd, 512);

    int client_fd;
    char buf[100];
    while(1)
    {
        client_fd = accept(server_fd, NULL, NULL);
        memset(buf, 0, 100);
        read(client_fd, &buf, sizeof(buf));
        close(client_fd);
        printf("receive data: %s\n", buf);
    }
    close(server_fd);
    return 0;
}
```

执行 gcc unix_domain_server.c -o server 编译代码并执行 ./server 启动服务器，然后再创建一个 Unix 域客户端 unix_domain_client.c。

```
#include <stdio.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <string.h>
#include <unistd.h>
#include <sys/un.h>

const char* SERVER_PATH = "server.sock";

int main()
{
    // 申请 socket
    int sockfd = socket(AF_UNIX, SOCK_STREAM, 0);
    
    // 设置服务器地址
    struct sockaddr_un server_addr;
    server_addr.sun_family = AF_UNIX;
    memcpy(server_addr.sun_path, SERVER_PATH, strlen(SERVER_PATH));

    // 连接到服务器
    connect(sockfd, (struct sockaddr *)&server_addr, sizeof(server_addr));
    const char* data = "hello";
    // 发送数据
    write(sockfd, data, strlen(data));
    // 关闭连接
    close(sockfd);
    return 0;
}  
```

执行 gcc unix_domain_client.c -o client 编译并执行 ./client 启动客户端，这时候会看到服务器输出 receive data: hello。我们发现使用上和前面课程介绍的网络编程很像，这也是 Node.js net 模块的底层技术。

  


除了基于网络 API 外，Unix 还支持更简洁的使用方式，那就是通过 socketpair 同时创建一个 Unix 域客户端和服务器。

```
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/types.h>         
#include <sys/socket.h>

int main(int argc, char **argv) {
    int pid;
    int fds[2];
    // 创建一个 Unix 域客户端和服务器，fd 存在 fds 数组
    socketpair(AF_UNIX, SOCK_STREAM, 0, fds);
    // 创建子进程
    pid = fork();
    if (pid == 0) { 
        // 关闭读端
        close(fds[0]);
        const char * data = "hello";
        // 写入数据
        write(fds[1], data, strlen(data));
        close(fds[1]);
        return 0;
    }else {         
        // 关闭写端
        close(fds[1]);  
        char buf[100];
        // 读取数据
        read(fds[0], buf, sizeof(buf));
        printf("%s", buf);
        close(fds[0]);      
        return 0;
    }
    
    return 0;
}
```

从代码中可以看到 socketpair 可以直接创建两个 fd 给父子进程进行通信，使用上简单很多，这也是 Node.js 进程间通信的底层技术。

  


除了了解 Unix 域的使用方式外，有几个知识我们也需要了解。

1.  基于连接模式时，Unix 域是使用字符串路径作为客户端和服务器连接的地址，它会在文件系统中创建一个文件，所以服务器要保证有写和执行权限才能启动成功，客户端保证有写权限才能连接到服务器。如果你发现服务器明明监听了这个路径，但是客户端连接却失败了，就可以这样去排查，这点和监听端口不一样，我之前也修复了一个 Node.js 中相关的问题，有兴趣可以参考这个 [PR](https://github.com/nodejs/node/pull/43634)。
1.  不基于连接模式时，客户端需要保证有写权限才能发送数据给服务器。
1.  在基于连接模式的通信中，操作系统不会自动删除服务器创建的地址文件，需要应用自己删除，否则下次再使用会报地址已使用的错误（Libuv 会自动删除）。
1.  在支持匿名路径的内核中。如果使用匿名路径，则不会创建路径文件，也不需要删除，内核会在 socket 引用数为 0 时自动删除相关的数据结构。

# Libuv 中的 Unix 域

了解了操作系统中的 Unix 域后，我们接着来看一下 Libuv 中是如何封装的。Libuv 提供的 API 和操作系统有点类似，首先使用前需要通过 uv_pipe_init 初始化 Unix 域相关的数据结构。

```
int uv_pipe_init(uv_loop_t* loop, uv_pipe_t* handle, int ipc) {
    uv__stream_init(loop, (uv_stream_t*)handle, UV_NAMED_PIPE);
    // 发起关闭的结构体
    handle->shutdown_req = NULL;
    // 发起连接的结构体
    handle->connect_req = NULL;
    // 路径地址
    handle->pipe_fname = NULL;
    // 是否用于 ipc
    handle->ipc = ipc;
    return 0;
}
```

uv_pipe_init 逻辑很简单，就是初始化 uv_pipe_t 结构体，其中 ipc 是需要重点关注的字段，该字段表示该 handle 是否支持传递文件描述符，Node.js 中有两种使用场景，一种情况下，ipc 是 1（进程间通信），另一种是 0（通过 net 模块使用 Unix 域）。

  


初始化 handle 后，可以调用 uv_pipe_open 直接绑定 fd 到 handle。

```
int uv_pipe_open(uv_pipe_t* handle, uv_file fd) {
  // 设置非阻塞模式
  uv__nonblock(fd, 1);
  return uv__stream_open((uv_stream_t*)handle, fd, ...);
}

int uv__stream_open(uv_stream_t* stream, int fd, int flags) {
  stream->flags |= flags;
  // 记录 fd 到 handle
  stream->io_watcher.fd = fd;
  return 0;
}
```

通过 uv_pipe_open 绑定了 fd 后就可以直接对 handle 进行读写操作了。

  


另外，初始化 handle 后也可以调用 uv_pipe_bind 创建一个 fd，然后绑定地址到 fd 中，最后把 fd 保存到 handle 里。

```
int uv_pipe_bind(uv_pipe_t* handle, const char* name) {
    struct sockaddr_un saddr;
    const char* pipe_fname;
    int sockfd;
    int err;
    
    pipe_fname = NULL;
    
    pipe_fname = uv__strdup(name);
    name = NULL;
    // Unix 域套接字
    sockfd = uv__socket(AF_UNIX, SOCK_STREAM, 0);
    // 初始化监听的地址
    memset(&saddr, 0, sizeof saddr);
    uv__strscpy(saddr.sun_path, pipe_fname, sizeof(saddr.sun_path));
    saddr.sun_family = AF_UNIX;
    
    // 绑定路径地址
    bind(sockfd, (struct sockaddr*)&saddr, sizeof saddr);
    // 记录路径字符串，后续需要删除它对应的文件和释放内存
    handle->pipe_fname = pipe_fname;
    // 保存socket fd，用于后面监听
    handle->io_watcher.fd = sockfd;
    return 0;
}
```

uv_pipe_bind 函数首先申请一个 socket 套接字并拿到一个 fd，然后把路径地址绑定 Unix 域路径到 socket 中，从中可以看到 Libuv 中，使用的 SOCK_STREAM 数据模式。

  


绑定了路径后，就可以调用 listen 函数开始监听。

```
int uv_pipe_listen(uv_pipe_t* handle, int backlog, uv_connection_cb cb) {
    // 修改 socket 为监听状态
    listen(uv__stream_fd(handle), backlog);
    // 保存回调，有连接到来时由 uv__server_io 函数触发
    handle->connection_cb = cb;
    // IO 观察者的回调，有连接到来时在 Poll IO 阶段被执行
    handle->io_watcher.cb = uv__server_io;
    // 注册 IO 观察者到事件驱动模块，等待连接，即读事件到来
    uv__io_start(handle->loop, &handle->io_watcher, POLLIN);
    return 0;
}
```

uv_pipe_listen 执行 listen 函数使得 socket 成为监听状态，这样才能接收连接，然后把 socket 对应的文件描述符和回调封装成 IO 观察者，注册到事件驱动模块，等到有读事件到来（有连接到来），就会执行 uv__server_io 函数，uv__server_io 摘下对应的连接，最后执行 connection_cb 回调。

  


这时候就成功启动了一个服务，接着就是看客户端的逻辑。客户端首先也是需要调用 uv_pipe_init 初始化 Unix 域相关的 handle，然后调用 uv_pipe_connect 发起连接。

```
void uv_pipe_connect(uv_connect_t* req,
                     uv_pipe_t* handle,
                     const char* name,
                     uv_connect_cb cb) {
    struct sockaddr_un saddr;
    int new_sock;
    int err;
    int r;
    // 保存 socket 对应的文件描述符到 IO 观察者
    handle->io_watcher.fd = uv__socket(AF_UNIX, SOCK_STREAM, 0);
    // 需要连接的服务器信息
    memset(&saddr, 0, sizeof saddr);
    uv__strscpy(saddr.sun_path, name, sizeof(saddr.sun_path));
    saddr.sun_family = AF_UNIX;
    
    // 连接服务器
    do {
        r = connect(uv__stream_fd(handle),(struct sockaddr*)&saddr, sizeof saddr);
    }
    while (r == -1 && errno == EINTR);
    // 忽略错误处理逻辑
    // 注册可写事件，然后把 IO 观察者注册到事件驱动模块，等待连接结果执行 uv__stream_io
    uv__io_start(handle->loop, &handle->io_watcher, POLLOUT);
    
out:
    // 记录请求上下文，连接结束后回调
    handle->connect_req = req;
    uv__req_init(handle->loop, req, UV_CONNECT);
    req->handle = (uv_stream_t*)handle;
    req->cb = cb;
    QUEUE_INIT(&req->queue);
}
```

执行 uv_pipe_connect 后，客户端就可以继续处理其他代码了，等到连接有结果后，就会调用 uv__stream_io 函数（uv_pipe_t 是 uv_stream_t 的子类），uv__stream_io 函数会继续调用 uv__stream_connect 函数处理连接结果。

```
 static void uv__stream_connect(uv_stream_t* stream) {
  int error;
  uv_connect_t* req = stream->connect_req;
  socklen_t errorsize = sizeof(int);
  // 获取连接结果
  getsockopt(uv__stream_fd(stream),
             SOL_SOCKET,
             SO_ERROR,
             &error,
             &errorsize);
  error = UV__ERR(error);
  // 执行回调
  if (req->cb)
    req->cb(req, error);
}
```

uv__stream_connect 通过操作系统获取连接结果，然后执行调用，通知连接发起方连接结果。这样，一个连接流程就结束了。

  


剩下的服务器处理连接以及数据通信在 Libuv 流机制和 TCP 课程中已经讲过，它们是类似的，就不再详细讲解。

# 文件描述符传递

了解了 Unix 域的基础后，下面来看一下什么是文件描述符传递。假设有一个进程，我们称之为父进程，初始化时没有打开任何文件，然后父进程通过 fork 创建一个子进程，创建子进程后父进程打开了一个文件，如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b6a0a68e5f234892b65e65957b1b471e~tplv-k3u1fbpfcp-zoom-1.image)

如果父进程想把这个 fd 传到子进程那怎么办？把这个 fd 直接当作一般数据发送到子进程可以吗？答案是不可以的。因为每个进程都有自己的 fd 列表，父进程的 fd 可能在子进程中已经被使用了。另外，fd 只是个索引，只传递索引没有传递它关联的资源是没有意义的。这时候就需要使用文件描述符传递技术，它可以把一个进程中 fd 和资源的映射关系复制到另一个进程中。如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f7e7f5d19cef466e82b6f3ec0399ab1f~tplv-k3u1fbpfcp-zoom-1.image)

具体来说就是，父进程不仅要把 fd 传给子进程，还需要把 fd 对应的资源也传递过去，这个是指示操作系统去完成的，具体是通过 Unix 域来实现。下面，我们来看一下 Libuv 中对于文件描述符传递的处理。

  


**首先看发送端的处理**，具体逻辑在 uv__write 函数中。

```
static void uv__write(uv_stream_t* stream) {
  struct iovec* iov;
  QUEUE* q;
  uv_write_t* req;
  int iovmax;
  int iovcnt;
  ssize_t n;
  int err;

  q = QUEUE_HEAD(&stream->write_queue);
  req = QUEUE_DATA(q, uv_write_t, queue);
  /*
    struct iovec {
        ptr_t iov_base; // 数据首地址
        size_t iov_len; // 数据长度
    };  
    iovec 和 bufs 结构体的定义一样
  */
  // 待发送的数据
  iov = (struct iovec*) &(req->bufs[req->write_index]);
  iovcnt = req->nbufs - req->write_index;
  // 最多能写几个
  iovmax = uv__getiovmax();

  // 取最小值
  if (iovcnt > iovmax)
    iovcnt = iovmax;

  // 有需要传递的描述符
  if (req->send_handle) {
    int fd_to_send;
    /*
      struct msghdr {
        void         *msg_name;       // optional address 
        socklen_t     msg_namelen;    // size of address 
        struct iovec *msg_iov;        // scatter/gather array 
        size_t        msg_iovlen;     // # elements in msg_iov 
        void         *msg_control;    // ancillary data, see below 
        size_t        msg_controllen; // ancillary data buffer len 
        int           msg_flags;      // flags on received message 
      };  
    */
    struct msghdr msg;
    /*
      struct cmsghdr  { 
         socklen_t cmsg_len ;  
         int  cmsg_level ;   
         int  cmsg_type ;  
      } ; 
    */
    struct cmsghdr *cmsg;
    /*
            scratch是个联合体，data[64] 是用于存储 cmsghdr 和紧跟后面的数据
    */
    union {
      char data[64];
      struct cmsghdr alias;
    } scratch;
    
    // 需要发送的 fd
    fd_to_send = uv__handle_fd((uv_handle_t*) req->send_handle);

    memset(&scratch, 0, sizeof(scratch));

    // 下面两个字段用于udp
    msg.msg_name = NULL;
    msg.msg_namelen = 0;
    // 要发送的数据
    msg.msg_iov = iov;
    msg.msg_iovlen = iovcnt;
    msg.msg_flags = 0;
    // 指向一个cmsghdr
    msg.msg_control = &scratch.alias;
    // 要发送的 fd
    msg.msg_controllen = CMSG_SPACE(sizeof(fd_to_send));
    cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SOCKET;
    cmsg->cmsg_type = SCM_RIGHTS;
    cmsg->cmsg_len = CMSG_LEN(sizeof(fd_to_send));

    {
      void* pv = CMSG_DATA(cmsg);
      int* pi = pv;
      // 写入需要传递的文件描述符
      *pi = fd_to_send;
    }

    do {
      // 发送数据和文件描述符
      n = sendmsg(uv__stream_fd(stream), &msg, 0);
    } while (n == -1 && errno == EINTR);
  } 
}
```

当请求设置了需要发送文件描述符时，Libuv 会把数据和文件描述符打包到 struct msghdr 结构体中，然后调 sendmsg 发送，当这个数据到达接收方时，操作系统会帮我们处理好文件描述符传递的问题（有兴趣可以参考这个[文章](https://zhuanlan.zhihu.com/p/381683155)）。

  


接着，**我们再** **来看接收方的实现**，具体逻辑在 uv__read 函数中。

```
static void uv__read(uv_stream_t* stream) {
     uv_buf_t buf;
     ssize_t nread;
     struct msghdr msg;
     char cmsg_space[CMSG_SPACE(UV__CMSG_FD_SIZE)];
     int count;
     int err;
    
     buf = uv_buf_init(NULL, 0);
     // 分配内存，地址保存在buf中
     stream->alloc_cb((uv_handle_t*)stream, 64 * 1024, &buf);
     // 传递了文件描述符
     msg.msg_flags = 0;
     // 读取的数据存放到 buf
     msg.msg_iov = (struct iovec*) &buf;
     msg.msg_iovlen = 1;
     msg.msg_name = NULL;
     msg.msg_namelen = 0;
     msg.msg_controllen = sizeof(cmsg_space);
     msg.msg_control = cmsg_space;
    // 读取数据和传递的文件描述符
    nread = uv__recvmsg(uv__stream_fd(stream), &msg, 0);
    // 处理读取的文件描述符
    uv__stream_recv_cmsg(stream, &msg);
    // 执行回调
    stream->read_cb(stream, nread, &buf);
}
```

接收方除了接收一般的数据外还会接收传递过来的文件描述符 ，并调用 uv__stream_recv_cmsg 处理收到的文件描述符。

```
static int uv__stream_recv_cmsg(uv_stream_t* stream, struct msghdr* msg) {
  struct cmsghdr* cmsg;

  for (cmsg = CMSG_FIRSTHDR(msg); cmsg != NULL; cmsg = CMSG_NXTHDR(msg, cmsg)) {
    char* start;
    char* end;
    int err;
    void* pv;
    int* pi;
    unsigned int i;
    unsigned int count;
    pv = CMSG_DATA(cmsg);
    pi = pv;

    start = (char*) cmsg;
    end = (char*) cmsg + cmsg->cmsg_len;
    count = 0;
    // 多少个 fd
    while (start + CMSG_LEN(count * sizeof(*pi)) < end)
      count++;
      
    // 保存收到的 fd，优先存储在 stream->accepted_fd，然后排队到 stream->queued_fds
    for (i = 0; i < count; i++) {
      if (stream->accepted_fd != -1) {
        err = uv__stream_queue_fd(stream, pi[i]);
      } else {
        stream->accepted_fd = pi[i];
      }
    }
  }

  return 0;
}
```

uv__stream_recv_cmsg 的逻辑涉及到操作系统层面的一些知识可以不用过多理解，我们只需要知道 uv__stream_recv_cmsg 完成了 fd 的解析和保存。uv__stream_recv_cmsg 会把接收到的第一个 fd 保存到 accepted_fd 中，然后剩下的通过 uv__stream_queue_fd 进行排队。接下来，我们看看 uv__stream_queue_fd 是如何实现排队的。

```
static int uv__stream_queue_fd(uv_stream_t* stream, int fd) {
  uv__stream_queued_fds_t* queued_fds;
  unsigned int queue_size;
  // fd 队列
  queued_fds = stream->queued_fds;
  if (queued_fds == NULL) {
    queue_size = 8;
    // uv__stream_queued_fds_t 结构体的大小 + 数组的大小
    queued_fds = uv__malloc((queue_size - 1) * sizeof(*queued_fds->fds) + sizeof(*queued_fds));
    queued_fds->size = queue_size;
    queued_fds->offset = 0;
    stream->queued_fds = queued_fds;
  }
  // 省略扩容逻辑
  queued_fds->fds[queued_fds->offset++] = fd;
  return 0;
}
```

想要理解上面的代码，我们首先需要理解 uv__stream_queued_fds_t 结构体，uv__stream_queued_fds_t 结构体用于管理接收到的多个 fd，定义如下。

```
struct uv__stream_queued_fds_s {
  // 容量
  unsigned int size;
  // 当前空闲位置的索引
  unsigned int offset;
  // 数组，内存是动态申请的
  int fds[1];
};
```

下面看看结构图。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/932cc55e8d35479782a8215ae9e37212~tplv-k3u1fbpfcp-zoom-1.image)

刚才讲过 Libuv 会把接收到的第一个 fd 保存在 accepted_fd 字段，那么接收的额外 fd 就是存储在 fds 数组里 **。**

  


把传递过来的 fd 保存起来后，接着就需要在读回调里消费这些 fd，示例代码如下。

```
// 是否还有待处理的 fd
while (uv_pipe_pending_count(server_stream) > 0) {
  uv_stream_t stream;
  // 摘取收到的文件描述符到 stream
  uv_accept(server_stream, stream);
}
```

上面的 uv_pipe_pending_count 函数用于判断是否有还没被消费的 fd。

```
int uv_pipe_pending_count(uv_pipe_t* handle) {
  uv__stream_queued_fds_t* queued_fds;
  // accepted_fd 记录第一个待消费的 fd，等于 -1 说明没有 fd 可被消费
  if (handle->accepted_fd == -1)
    return 0;
  // queued_fds 表示除了 accepted_fd 的 fd 外还有多少个 fd 等待消费
  // 等于 NULL 说明只有 accepted_fd 中的一个 fd 等待消费
  if (handle->queued_fds == NULL)
    return 1;
  // 否则返回 queued_fds 中的 fd 个数 + accepted_fd 中的一个
  queued_fds = handle->queued_fds;
  return queued_fds->offset + 1;
}
```

uv_accept 用于消费收到的 fd。

```
int uv_accept(uv_stream_t* server, uv_stream_t* client) {
  int err;
  // 保存 accepted_fd 到 client
  uv__stream_open(client, server->accepted_fd, UV_HANDLE_READABLE | UV_HANDLE_WRITABLE);

  // 还有排队的
  if (server->queued_fds != NULL) {
    uv__stream_queued_fds_t* queued_fds;
    queued_fds = server->queued_fds;
    // 把队列中的第一个移到 accepted_fd
    server->accepted_fd = queued_fds->fds[0];
    // offset 是当前空闲位置的索引，-- 后即最后一个 fd 的位置，如果是 0，说明没有需要处理的 fd 了，释放内存
    if (--queued_fds->offset == 0) {
      uv__free(queued_fds);
      server->queued_fds = NULL;
    } else {
      // 元素往前移
      memmove(queued_fds->fds,
              queued_fds->fds + 1,
              queued_fds->offset * sizeof(*queued_fds->fds));
    }
  } else {
    // 没有则重置 accepted_fd
    server->accepted_fd = -1;
    // 继续注册可读事件
    uv__io_start(server->loop, &server->io_watcher, POLLIN);
  }
  return err;
}
```

每次调用 uv_accept 就会拿到一个 fd，并且 uv_accept 会自动更新相关的数据结构，并把下一个待消费的 fd 保存到 accepted_fd 中，直到处理完所有的 fd。这就是 Libuv 中关于文件描述符的处理逻辑，下节课讲进程间通信时会进一步讲解 Node.js 是如何处理文件描述符传递的。

# 总结

Unix 域作为一种操作系统提供的 IPC 技术，在很多软件中都少不了它的身影，Node.js 也不例外。在 Node.js，Unix 域的作用主要有两个：第一是作为进程间通信的方式，使得任意有权限的进程间都可以通信；第二是实现文件描述符传递。文件描述符传递在操作系统和 Node.js 中都是非常重要的技术，比如 Node.js 的服务器实现就依赖于文件描述符传递。

  


这节课首先介绍了操作系统中 Unix 域的两种使用方式，一种是基于网络编程 API 的，可用于任意进程间通信，一种是基于 socketpair 系统调用的，通常用于父子进程间通信。接着介绍了 Libuv 中对 Unix 域的封装和使用，Libuv 提供了类似网络编程的 API，使用上比较简单，最后介绍了非常重要的文件描述符技术，主要讲了文件描述符的发送 / 接收 / 消费过程。