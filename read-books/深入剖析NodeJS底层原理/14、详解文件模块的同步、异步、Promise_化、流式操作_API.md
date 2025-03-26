文件操作是我们使用 Node.js 时经常会用到的功能，在 Node.js 文件操作的能力是通过文件模块提供的，而文件模块的功能又是通过操作系统的文件系统实现的，文件系统是操作系统中负责管理文件的子系统，这里的文件并不是我们平时熟悉的 JS 或者 JSON 文件，而是更广义的文件，比如网络、普通文件、管道等等在 Linux 中都被当作文件管理，操作系统通过虚拟文件系统屏蔽了底层的实现细节，然后提供统一的 API 给用户调用。

  


因此，理解 Node.js 的文件模块是我们理解文件系统的一种方式，而理解 Node.js 的文件模块最好的方式就是去看它是怎么实现的，Node.js 文件模块提供了包括同步、异步、Promise 化、流式 API和文件监听的功能。这节课，我们首先讲解前面四种和文件操作相关的 API，下一节课再详细介绍文件监听的实现。

  


在 Node.js 中，文件模块的 API 几乎都提供了同步和异步的版本。同步的 API 是直接在主线程中调用操作系统提供的接口，它会导致主线程阻塞，异步 API 则是在 Libuv 提供的线程池中执行阻塞式 API 实现的，这样就不会导致主线程阻塞。文件 IO 不同于网络 IO，文件 IO 由于系统兼容性问题，无法像网络 IO 一样利用操作系统提供的能力直接实现异步。在 Libuv 中，文件操作是以线程池实现的，所以这种异步只是对用户而言。另外，Node.js 提供的 Promise 化 API，可以实现以同步的方式写异步代码，提供的流式 API 可以帮助同步控制消费者和生产者的读写速率。理解了这些 API 的实现不仅可以帮助我们更好地使用 Node.js，还可以帮助我们理解文件系统的知识。

  


下面具体介绍 Node.js 文件模块中文件操作的实现。

## 同步API

在 Node.js 中，同步 API 的本质是直接在主线程里调用操作系统提供的系统调用。下面以 readFileSync 为例，看一下整体的流程，如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f3aedf197cba4ecbb98a2a1c3164d373~tplv-k3u1fbpfcp-zoom-1.image)

下面看一下具体的代码。

```
function readFileSync(path, options) {  
  options = getOptions(options, { flag: 'r' });  
  // 传的是 fd 还是文件路径  
  const isUserFd = isFd(path);   
  // 传的是路径，则先同步打开文件  
  const fd = isUserFd ? path : fs.openSync(path, options.flag, 0o666);  
  // 查看文件的 stat 信息，拿到文件的大小  
  const stats = tryStatSync(fd, isUserFd);  
  // 是否是一般文件  
  const size = isFileType(stats, S_IFREG) ? stats[8] : 0;  
  let pos = 0;  
  let buffer; 
  let buffers;  
  // 分配一个大小为 size 的 buffer，size 需要小于 2G  
  buffer = tryCreateBuffer(size, fd, isUserFd);  
  
  let bytesRead;  
  // 不断地同步读文件内容  
  if (size !== 0) {  
    do {  
      bytesRead = tryReadSync(fd, isUserFd, buffer, pos, size - pos);  
      pos += bytesRead;  
    } while (bytesRead !== 0 && pos < size);  
  } else {  
    // 省略特殊情况 
  }  
  // 用户传的是文件路径，Node.js 打开了文件，所以需要关闭  
  if (!isUserFd)  
    fs.closeSync(fd);  
  // 编码处理
  if (options.encoding) buffer = buffer.toString(options.encoding);  
  // 返回文件内容
  return buffer;  
}  
```

我们重点看一下 tryReadSync。tryReadSync 调用的是 fs.readSync，readSync 调用的是 read，这对应的是 C++ 层的 Read 函数，Read 函数主要逻辑如下。

```
Environment* env = Environment::GetCurrent(args);
  // 参数处理
  const int argc = args.Length();
  const int fd = args[0].As<Int32>()->Value();
  const size_t off = static_cast<size_t>(args[2].As<Integer>()->Value());
  const size_t len = static_cast<size_t>(args[3].As<Int32>()->Value());
  const int64_t pos = args[4].As<Integer>()->Value();
  // 数据处理
  Local<Object> buffer_obj = args[1].As<Object>();
  char* buffer_data = Buffer::Data(buffer_obj);
  size_t buffer_length = Buffer::Length(buffer_obj);
  char* buf = buffer_data + off;
  uv_buf_t uvbuf = uv_buf_init(buf, len);
  // 创建一个请求对象
  FSReqBase* req_wrap_async = GetReqWrap(env, args[5]);
  // 调用 Libuv 的函数 uv_fs_read 发起读取请求
  const int bytesRead = SyncCall(env, 
                                 args[6], 
                                 &req_wrap_sync, 
                                 "read",
                                 uv_fs_read, 
                                 fd, 
                                 &uvbuf, 
                                 1, 
                                 pos); 
  // 读取的字节数 
  args.GetReturnValue().Set(bytesRead);
}
```

Read 函数首先进行了参数的处理，比如从文件当哪个位置开始读取，读取多少字节等等，主要是把 V8 的数据转成 C、C++ 的数据，然后调用 SyncCall 函数，SyncCall 是所有同步 API 的通用函数，接下来看看 SyncCall 的实现。

```
int SyncCall(...) {  
  /*
      req_wrap->req 是一个 uv_fs_t 结构体，属于 request 类，管理一次文件操作的请求 
      fn 是具体的 Libuv 函数，这里是 uv_fs_read 
  */
  int err = fn(env->event_loop(), 
               &(req_wrap->req), 
               args..., 
               nullptr);  
  // 忽略出错处理
  // 返回读到的字节数
  return err;  
}  
```

我们看到 SyncCall 函数最终调用的是调用方传进来的函数，这里是 Libuv 的 uv_fs_read，并使用 uv_fs_t 管理本次请求。

```
int uv_fs_read(uv_loop_t* loop, uv_fs_t* req,
               uv_file file,
               const uv_buf_t bufs[],
               unsigned int nbufs,
               int64_t off,
               uv_fs_cb cb) {
  // 初始化请求结构体，设置请求类型
  UV_REQ_INIT(req, UV_FS); 
  // 请求子类型                                                 
  req->fs_type = UV_FS_READ;
  // 读取的字节数                                         
  req->result = 0;                                                          
  req->bufs = NULL;   
  // 回调，同步时为空                                                      
  req->cb = cb;   
  // 读取哪个文件
  req->file = file;
  // 保存读取的数据
  // buf 个数
  req->nbufs = nbufs;
  // 保存数据的 buf 地址
  req->bufs = req->bufsml;
  // 复制保存数据的元信息到 req->bufs，后续把数据读到 req->bufs 指向的内存
  memcpy(req->bufs, bufs, nbufs * sizeof(*bufs));
  // 从哪个位置开始读
  req->off = off;
  // 执行文件操作
  uv__fs_work(&req->work_req); 
  return req->result;      
}
```

uv_fs_read 中根据 Libuv 的约定也做了一些初始化工作，然后接着调用了 uv__fs_work 函数。

```
static void uv__fs_work(struct uv__work* w) {
  int retry_on_eintr;
  uv_fs_t* req;
  ssize_t r;

  req = container_of(w, uv_fs_t, work_req);
  // 调用操作系统 API，数据保存到 req->bufs 中
  r = uv__fs_read(req);
  if (r == -1)
    req->result = UV__ERR(errno);
  else
    req->result = r;
}
```

uv__fs_work 最终以阻塞的方式调用操作系统的 read 函数。当第一次读取文件的数据时，操作系统会先给底层的硬盘发送请求，然后阻塞线程，等待硬盘完成数据读取后，会通过中断通知操作系统，从而操作系统唤醒线程。

另外，操作系统底层也做了很多优化，比如后续再读取一样的内容时，就不需要再请求硬盘了，因为操作系统会缓存在内存里，这里还会涉及淘汰机制，数据被修改时的同步问题，有兴趣的可以参考操作系统的知识或者参考这篇[文章](https://zhuanlan.zhihu.com/p/64536225)。

## 异步API

了解了同步 API 的实现后，接下来看一下异步 API 的实现。异步 API 的实现是依赖于 Libuv 的线程池，Node.js 把任务放到线程池，然后返回主线程继续处理其它事情，等到条件满足时，比如文件读写完毕，线程池就会通知主线程，主线程就会执行回调。我们以 readFile 为例讲解这个过程。异步读取文件的流程图，如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/152b0b4df28a4feebab6655192e027d2~tplv-k3u1fbpfcp-zoom-1.image)

下面我们看具体的实现。

```
function readFile(path, options, callback) {  
  // 管理文件读的对象  
  if (!ReadFileContext)  
    ReadFileContext = require('internal/fs/read_file_context'); 
  const context = new ReadFileContext(callback, options.encoding)
  // 传的是文件路径还是 fd  
  context.isUserFd = isFd(path);
  // C++ 层的对象，封装了 uv_fs_t 结构体，管理一次文件读请求  
  const req = new FSReqCallback();  
  req.context = context;  
  // 设置回调，打开文件后，执行  
  req.oncomplete = readFileAfterOpen;  
  // 传的是 fd，则不需要打开文件，下一个 tick 直接执行回调读取文件  
  if (context.isUserFd) {  
    process.nextTick(function tick() {  
      req.oncomplete(null, path);  
    });  
    return;  
  }  
  
  const flagsNumber = stringToFlags(options.flags);  
  // 调用 C++ 层 open 打开文件  
  binding.open(pathModule.toNamespacedPath(path),  
        flagsNumber,  
        0o666,  
        req);  
}  
```

ReadFileContext 对象用于管理文件读操作整个过程，FSReqCallback 是对 uv_fs_t 的封装，每次读操作对于 Libuv 来说就是一次请求，该请求的上下文就是使用 uv_fs_t 表示。请求完成后，会执行 FSReqCallback 对象的 oncomplete 函数。因为读取文件时我们通常传的是一个文件路径，所以需要先打开一个文件，我们先看 readFileAfterOpen。

```
    function readFileAfterOpen(err, fd) {  
      const context = this.context;  
      // 保存打开文件的 fd  
      context.fd = fd;  
      // 新建一个 FSReqCallback 对象管理下一个异步请求和回调  
      const req = new FSReqCallback();  
      req.oncomplete = readFileAfterStat; 
      // 保存操作的结果 
      req.context = context;  
      // 获取文件的元数据，拿到文件大小  
      binding.fstat(fd, false, req);  
    }  
```

binding.fstat 用于异步获取文件的元信息，比如文件大小、创建者和修改时间等，这里主要用于获取文件的大小，拿到元信息后，接着执行 readFileAfterStat。

```
function readFileAfterStat(err, stats) {
  const context = this.context;
  // 文件大小
  const size = context.size;
  // 根据文件大小分配内存
  context.buffer = Buffer.allocUnsafeSlow(size);
  // 开始执行读操作
  context.read();
}
```

readFileAfterStat 根据元数据中记录的文件大小，分配一个 buffer 用于后续读取文件内容。然后调用 context.read 进行读操作。

```
read() {  
    const buffer = this.buffer;  
    const offset = this.pos;  
    const length = MathMin(kReadFileBufferLength, this.size - this.pos);;  

    // 省略部分 buffer 处理的逻辑  
    // 创建一个读操作请求
    const req = new FSReqCallback();  
    req.oncomplete = readFileAfterRead;  
    req.context = this;  

    read(this.fd, buffer, offset, length, -1, req);  
  }  
```

read 新建了一个 FSReqCallback 对象管理异步读取操作和回调。我们看一下 C++ 层 read 函数的实现。

```
// 拿到 JS FSReqCallback 对象关联的 C++ 对象
FSReqBase* req_wrap_async = GetReqWrap(env, args[5]);  
// 异步调用 uv_fs_read，回调是 AfterInteger  
AsyncCall(env, req_wrap_async, args, "read", UTF8, AfterInteger,uv_fs_read, fd, &uvbuf, 1, pos);  
```

AsyncCall 的逻辑和分析同步 API 时类似，最后调用 Libuv 的 uv_fs_read 函数。我们看一下这个函数的关键逻辑。

```
uv__req_register(loop, req);    
uv__work_submit(loop,      
                &req->work_req,   
                UV__WORK_FAST_IO,   
                uv__fs_work,  
                uv__fs_done);   
return 0;   
```

uv__work_submit 是给线程池提交一个任务，当子线程执行这个任务时，就会执行uv__fs_work，uv__fs_work 会调用操作系统的系统调用 read（和刚才同步的方式一样，区别是异步模式时 read 是在子线程执行，所以不会阻塞主线程）。等到读取成功后执行 uv__fs_done。uv__fs_done 会执行 C++ 层的回调 AfterInteger。

```
void AfterInteger(uv_fs_t* req) {
  FSReqBase* req_wrap = FSReqBase::from_req(req);
  FSReqAfterScope after(req_wrap, req);
  req_wrap->Resolve(Integer::New(req_wrap->env()->isolate(), req->result));
}

void FSReqCallback::Resolve(Local<Value> value) {
  Local<Value> argv[2] {
    Null(env()->isolate()),
    value
  };
  MakeCallback(env()->oncomplete_string(),
               value->IsUndefined() ? 1 : arraysize(argv),
               argv);
}
```

最终执行 JS 层 oncpmolete 的回调，对应的是 readFileAfterRead 函数。

```
function readFileAfterRead(err, bytesRead) {
  // 读出错
  if (err)
      return context.close(err);
  const context = this.context;
  // bytesRead 为读取了多少字节，更新 pos，更新下一个读取位置
  context.pos += bytesRead;
  // 读够了或者读完了，执行 close
  if (context.pos === context.size || bytesRead === 0) {
    context.close();
  } else {
    // 否则接着读
    context.read();
  }
}
```

readFileAfterRead 判断是否需要停止读操作，比如读取的字节数和需要读取的相等了或者文件内容被读完了（需要读 100 字节，文件内容只有 50 字节）。如果还需要读则继续调用 read，以此类推，不断重复这个过程，直到满足结束条件。

## Promise化API

Node.js 的 API 都是遵循 callback 模式的，比如我们要读取一个文件的内容。我们通常会这样写：

```
const fs = require('fs');  
fs.readFile('filename', 'utf-8' ,(err,data) => {  
  console.log(data)  
});
```

在需要调用大量 callback 风格的函数时，这样的写法会导致回调地狱，使得代码很难维护。为了支持 Promise 模式，我们通常这样写：

```
const fs = require('fs');  
function readFile(filename) {  
    return new Promise((resolve, reject) => {  
        fs.readFile(filename, 'utf-8' ,(err,data) => {  
            err ?  reject(err) : resolve(data);  
        });  
    });  
}  
```

这种方法可行，但是会增加了用户的负担，但在后期的 Node.js 版本中，文件模块支持了 Promise 化的 API，这样我们就可以直接使用 await 进行文件操作。来看一个使用例子。

```
const { readFile} = require('fs').promises;  
async function runDemo() {   
  try {  
    console.log(await readFile('11111.md', { encoding: 'utf-8' }));  
  } catch (e){  
  
  }  
}  
runDemo();  
```

从例子中看到，我们不用再写回调了，而是通过 await 的方式接收结果，这只是新版 API 的特性之一，同时新版 API 还支持面向对象的调用方式。

```
const { open,readFile } = require('fs').promises;  
async function runDemo() {  
  let filehandle;  
  try {  
    filehandle = await open('filename', 'r');  
    console.log(await filehandle.readFile({ encoding: 'utf-8' }));  
  } finally {  
    if (filehandle) {  
        await filehandle.close();     
    }  
  }  
}  
runDemo();  
```

面向对象的模式中，我们首先需要通过 open 函数拿到一个 FileHandle 对象（对文件描述符的封装），然后就可以在该对象上调各种文件操作的函数。在使用面向对象模式的 API 时有一个需要注意的地方，那就是即使文件操作出错，Node.js 也不会为我们关闭文件描述符。因此，我们需要自己手动关闭文件描述符，否则就会造成文件描述符泄漏。而在非面向对象模式中，在文件操作完毕后，不管成功还是失败，Node.js 都会为我们关闭文件描述符。

  


无论是面向对象的方式还是直接使用 API 的方式，底层的实现都是一样的，它们都是首先通过 open 函数拿到一个 FileHandle，然后基于 FileHandle 实现其他操作。下面以 readFile 为例看一下具体的实现。

```
async function readFile(path, options) {
  options = getOptions(options, { flag: 'r' });
  const flag = options.flag || 'r';
  const fd = await open(path, flag, 0o666);
  return readFileHandle(fd, options).finally(fd.close);
}
```

readFile 首先调用 open 打开文件。

```
async function open(path, flags, mode) {
  return new FileHandle(await binding.openFileHandle(...));
}
```

open 调用了 C++ 层的 openFileHandle 打开文件并且以其返回值创建了一个 FileHandle 对象。来看一下 openFileHandle。

```
static void OpenFileHandle(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  Isolate* isolate = env->isolate();

  const int argc = args.Length();
  BufferValue path(isolate, args[0]);
  const int flags = args[1].As<Int32>()->Value();
  const int mode = args[2].As<Int32>()->Value();
  // req_wrap_async 为 FSReqPromise 对象
  FSReqBase* req_wrap_async = GetReqWrap(env, args[3]);
  // 异步打开文件
  AsyncCall(env, req_wrap_async, args, "open", UTF8, AfterOpenFileHandle,
            uv_fs_open, *path, flags, mode);
}
```

首先通过 GetReqWrap 创建了一个 FSReqPromise 对象。

```
FSReqBase* GetReqWrap(Environment* env, v8::Local<v8::Value> value) {
  // JS 层传入的 kUsePromises
  if (value->StrictEquals(env->fs_use_promises_symbol())) {
    return FSReqPromise<AliasedFloat64Array>::New(env);
  }
}

FSReqPromise<AliasedBufferT>::New(Environment* env, ...) {
  v8::Local<v8::Object> obj;
  // 创建一个 JS 对象 FSReqPromise 并保存到 obj 中
  if (!env->fsreqpromise_constructor_template()
           ->NewInstance(env->context())
           .ToLocal(&obj)) {
    return nullptr;
  }
  v8::Local<v8::Promise::Resolver> resolver;
  // 在 JS 对象 obj（FSReqPromise） 中设置一个 promise 属性
  if (!v8::Promise::Resolver::New(env->context()).ToLocal(&resolver) ||
      obj->Set(env->context(), env->promise_string(), resolver).IsNothing()) {
    return nullptr;
  } 
  // 创建一个 C++ 对象 FSReqPromise，C++ FSReqPromise 和 JS FSReqPromise（obj） 互相关联
  return new FSReqPromise(env, obj, ...);
}
```

从上面的分析可以知道 GetReqWrap 拿到了一个 FSReqPromise 对象，这个对象又关联了一个 JS 对象 FSReqPromise。接着执行 AsyncCall。

```
FSReqBase* AsyncCall(...) {
  return AsyncDestCall(...);
}

FSReqBase* AsyncDestCall(...) {
  // req 是一个 FSReqPromise 对象
  req_wrap->Init(syscall, dest, len, enc);
  // fn 为 Libuv 的文件操作 API
  int err = req_wrap->Dispatch(fn, fn_args..., after);
  req_wrap->SetReturnValue(args);
  return req_wrap;
}
```

AsyncCall 首先调用 Libuv 发起了一个异步操作，然后调用 req_wrap->SetReturnValue。因为 req_wrap 是 FSReqPromise 对象，来看看它的 SetReturnValue。

```
void FSReqPromise<AliasedBufferT>::SetReturnValue(...) {
  // 取出 JS 对象 FSReqPromise 的 promise 属性的值
  v8::Local<v8::Value> val =
      object()->Get(env()->context(),
                    env()->promise_string()).ToLocalChecked();
  v8::Local<v8::Promise::Resolver> resolver = val.As<v8::Promise::Resolver>();
   // 返回一个 Promise 给 JS
  args.GetReturnValue().Set(resolver->GetPromise());
}
```

SetReturnValue 最终给 JS 层返回了一个 Promise 对象，因为 JS 层使用 await 等待了这个 Promise 决议。那我们来看看决议后的值是什么，当文件打开成功后会执行 AfterOpenFileHandle。

```
void AfterOpenFileHandle(uv_fs_t* req) {
  // req_wrap 是 FSReqPromise 对象
  FSReqBase* req_wrap = FSReqBase::from_req(req);
  FSReqAfterScope after(req_wrap, req);
  // req->result 是文件描述符
  // FileHandle::New 创建了一个 C++ 对象 FileHandle，并关联了一个 JS 对象
  FileHandle* fd = FileHandle::New(..., req->result);
  // 返回 FileHandle 中关联的 JS 对象
  req_wrap->Resolve(fd->object());
}
```

AfterOpenFileHandle 中拿到了文件对应的文件描述符，然后创建了一个 FileHandle，该 FileHandle 对象里记录了这个文件描述符，最后调用 req_wrap->Resolve。

```
void FSReqPromise<AliasedBufferT>::Resolve(v8::Local<v8::Value> value) {
  finished_ = true;
  v8::HandleScope scope(env()->isolate());
  InternalCallbackScope callback_scope(this);
  v8::Local<v8::Value> val =
      object()->Get(env()->context(),
                    env()->promise_string()).ToLocalChecked();
  v8::Local<v8::Promise::Resolver> resolver = val.As<v8::Promise::Resolver>();
  USE(resolver->Resolve(env()->context(), value).FromJust());
}
```

Resolve 实际上就是执行了 Promise 对象的 resolve 函数，并把 C++ FileHandle 关联的 JS 对象返回给 JS 层。流程图如下。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4e1aa2c42101442b83bb11fb02ede8f7~tplv-k3u1fbpfcp-zoom-1.image)

再回到 JS 的 open 函数，open 函数把 C++ 层返回的 JS 对象封装在 FileHandle 中。

```
async function open(path, flags, mode) {
  return new FileHandle(await binding.openFileHandle(...));
}
```

通过 open 拿到一个 FileHandle 对象后，就可以基于这个 FileHandle 对象进行操作。

```
async function readFile(path, options) {
  // fd 为 FileHandle 对象
  const fd = await open(path, flag, 0o666);
  return readFileHandle(fd, options).finally(fd.close);
}
```

看一下 readFileHandle。

```
async function readFileHandle(filehandle, options) {
  // 获取文件元信息，kUsePromises 表示使用 Promise 方式
  const statFields = await binding.fstat(filehandle.fd, false, kUsePromises);
  // 获取文件大小
  const size = statFields[8/* size */];
  const chunks = [];
  // 计算每次读取的大小
  const chunkSize = size;
  let endOfFile = false;
  do {
    // 分配存储数据的内存
    const buf = Buffer.alloc(chunkSize);
    // 读取的数据和大小
    const { bytesRead, buffer } = await read(filehandle, buf, 0, chunkSize, -1);
    // 是否读完了
    endOfFile = bytesRead === 0;
    // 读取了有效数据则把有效数据部分存起来
    if (bytesRead > 0)
      chunks.push(buffer.slice(0, bytesRead));
  } while (!endOfFile);

  const result = Buffer.concat(chunks);
  if (options.encoding) {
    return result.toString(options.encoding);
  } else {
    return result;
  }
}
```

readFileHandle 首先获取了文件夹大小，接着不断调用 read 函数进行数据读取。

```
async function read(handle, buffer, offset, length, position) {
  const bytesRead = (await binding.read(handle.fd, buffer, offset, length, position, kUsePromises));
  return { bytesRead, buffer };
}
```

read 从 handle（FileHandle） 中获取文件描述符（open 时拿到的）然后调用 C++ 层 Read 函数读取数据并且通过 kUsePromises 表示使用 Promise 的方式。

## 流式API

前面分析了 Node.js 中多种文件操作的方式，不管是同步、异步还是 Promise 化的 API，它们都有一个问题，就是对于用户来说，文件操作都是一次性完成的。比如我们调用 readFile 读取一个文件时，Node.js 会通过一次或多次调用操作系统的接口把所有的文件内容读到内存中，这对内存来说是非常有压力的。假设我们有这样的一个场景，我们需要读取一个文件的内容，然后返回给前端，如果我们直接读取整个文件内容，然后再执行写操作这无疑是非常消耗内存，也是非常低效的。

```
const http = require('http');  
const fs = require('fs');  
const server = http.createServer((req, res) => {  
  fs.readFile('11111.md', (err, data) => {  
    res.end(data);  
  })  
}).listen(11111);  
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/024e9ccaeb274372886c9e9380926fd4~tplv-k3u1fbpfcp-zoom-1.image)

这时候，我们需要使用流式的 API。

```
const http = require('http');  
const fs = require('fs');  
const server = http.createServer((req, res) => {  
  fs.createReadStream('11111.md').pipe(res);  
}).listen(11111);  
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ddad0c3a23be42218dffb71872fc7f0f~tplv-k3u1fbpfcp-zoom-1.image)

流式 API 的好处在于文件的内容并不是一次性读取到内存，而是部分读取，也就是消费完后再继续读取。Node.js 内部帮我们做了流量的控制。下面看一下流式 API 的具体实现。

### 可读文件流

可读文件流是对流式读取文件内容的抽象。可以通过 fs.createReadStream 创建一个文件可读流。文件可读流继承于可读流，所以我们可以以可读流的方式使用它。我们可以实现自定义的可写流，然后通过 pipe 消费可读流的数据。

```
const fs= require('fs');  
const { Writable } = require('stream');  
class DemoWritable extends Writable {  
  _write(data, encoding, cb) {  
    console.log(data);  
    cb(null);  
  }  
}  
fs.createReadStream('11111.md').pipe(new DemoWritable);  
```

我们也可以通过可读流的 data 事件接收可读流的数据，然后再决定如何消费。

```
const fs = require('fs');  
const readStream = fs.createReadStream('11111.md');  
readStream.on('data', (data) => {  
    console.log(data)  
});  
```

我们看一下 createReadStream 的实现。

```
fs.createReadStream = function(path, options) {  
  return new ReadStream(path, options);  
};  
```

CreateReadStream 是对 ReadStream 的封装。

```
function ReadStream(path, options) {  
  options = copyObject(getOptions(options, {}));  
  // 支持其他文件模块，默认是 Node.js 内置的 fs 模块
  this[kFs] = options.fs || fs;
  
  Readable.call(this, options);  
  
  this.path = toPathIfFileURL(path);
  // 支持传文件路径或文件描述符  
  this.fd = options.fd === undefined ? null : options.fd;  
  this.flags = options.flags === undefined ? 'r' : options.flags;  
  this.mode = options.mode === undefined ? 0o666 : options.mode;  
  // 读取的开始和结束位置  
  this.start = options.start; 
  this.end = options.end;
  // 流出错或结束时是否自动销毁流  
  this.autoClose = options.autoClose === undefined ? true : options.autoClose;  
  this.pos = undefined;  
  // 已读的字节数  
  this.bytesRead = 0;  
  // 流是否已经关闭  
  this.closed = false;  
  if (this.start !== undefined) {
    this.pos = this.start;
  } 
  // 如果是根据一个文件名创建一个流，则首先打开这个文件  
  if (typeof this.fd !== 'number')  
    _openReadFs(this);  
  
  this.on('end', function() {  
    // 流结束时自动销毁流  
    if (this.autoClose) {  
      this.destroy();  
    }  
  });  
}  
```

ReadStream 初始化完后做了两个操作，首先调用 open 打开文件（如果需要的话），接着监听流结束事件，用户可以设置 autoClose 选项控制当流结束或者出错时是否销毁流，对于文件流来说，销毁流意味着关闭底层的文件描述符。接着，我们来看看 open 的实现。

```
function _openReadFs(stream) {  
  stream[kFs].open(stream.path, stream.flags, stream.mode, function(er, fd) {  
    // 保存文件对应的文件描述符
    stream.fd = fd;  
    // 打开成功后开始流式读取文件内容  
    stream.read();  
  });  
};  
```

open 函数首先打开文件，打开成功后开启流式读取。这样一来，文件内容就会源源不断地流向目的流。读取操作的具体实现如下：

```
// 实现可读流的钩子函数  
ReadStream.prototype._read = function(n) {   
  this[kFs].read(this.fd, pool, pool.used, toRead, this.pos, (er, bytesRead) => {
    // push 到底层流的 bufferList 中，底层的 push 会触发 data 事件  
    this.push(b);  
  });  
};  
```

主要的逻辑是调用异步 read 函数读取文件的内容再放到可读流中，可读流会触发 data 事件通知用户有数据到来，然后继续执行 read 函数，不断驱动着数据的读取（可读流会根据当前情况判断是否继续执行 read 函数，以达到流量控制的目的）。

### 可写文件流

可写文件流是对流式写入文件的抽象（我们不需要关注它的实现细节，只要遵循它的约定来使用）。我们可以通过 fs.createWriteStream 创建一个文件可写流。文件可写流继承于可写流，所以我们可以以可写流的方式使用它。

```
const fs = require('fs');  
const writeStream = fs.createWriteStream('123.md');
writeStream.end('world');  
// 或者
const fs = require('fs');  
const { Readable } = require('stream');  
  
class DemoReadStream extends Readable {  
    constructor() {  
        super();  
        this.i = 0;  
    }  
    _read(n) {  
        this.i++;  
        if (this.i > 10) {  
            this.push(null);  
        } else {  
            this.push('1'.repeat(n));  
        }  
          
    }  
}  
new DemoReadStream().pipe(fs.createWriteStream('123.md'));  
```

我们看一下 createWriteStream 的实现。

```
fs.createWriteStream = function(path, options) {  
  return new WriteStream(path, options);  
};  
```

createWriteStream 是对 WriteStream 的封装，看一下 WriteStream 的实现

```
function WriteStream(path, options) {  
  options = copyObject(getOptions(options, {}));  
  this[kFs] = options.fs || fs;
  Writable.call(this, options);  
  this.path = toPathIfFileURL(path);
  this.fd = options.fd === undefined ? null : options.fd;  
  this.flags = options.flags === undefined ? 'w' : options.flags;  
  this.mode = options.mode === undefined ? 0o666 : options.mode;  
  // 写入的开始位置  
  this.start = options.start;  
  // 流结束和触发错误的时候是否销毁流  
  this.autoClose = options.autoClose === undefined ? true : !!options.autoClose;  
  // 当前写入位置  
  this.pos = undefined;  
  // 写成功的字节数  
  this.bytesWritten = 0;  
  this.closed = false;  
  
  // 没有传文件描述符则打开一个新的文件  
  if (typeof this.fd !== 'number')
    _openWriteFs(this);
}  

// 写结束后是否自动销毁流
WriteStream.prototype._final = function(callback) {
  if (this.autoClose) {
    this.destroy();
  }

  callback();
};
```

WriteStream 初始化了一系列字段后，接着打开文件（如果需要的话）。

```
function _openWriteFs(stream) {
  stream[kFs].open(stream.path, stream.flags, stream.mode, (er, fd) => {
    stream.fd = fd;
    stream.emit('open', fd);
    stream.emit('ready');
  });
}
```

打开文件后会触发 open 事件并拿到 fd，这样就可以开始执行写操作了，写入文件的逻辑如下：

```
WriteStream.prototype._write = function(data, encoding, cb) {  
  // 文件还没有打开成功，则先监听 open 事件
  if (typeof this.fd !== 'number') {
    return this.once('open', function() {
      this._write(data, encoding, cb);
    });
  }
  // 执行写操作,0代表从data的哪个位置开始写，这里是全部写入，所以是0，pos代表文件的位置  
  this[kFs].write(this.fd, data, 0, data.length, this.pos, (er, bytes) => { 
    // 写成功的字节数
    this.bytesWritten += bytes; 
    // 执行回调通知继续写
    cb();  
  });  
};  
```

WriteStream 继承 Writable，但是 Writable 只实现了一些通用的逻辑，具体的写逻辑是子类的 _write 或 _writev 实现的。因为这两个函数的实现原理是类似的，所以这里只分析 _write，_write 就是根据用户传入数据的大小，不断调用 fs.write 往底层写入数据，直到写完成或者出错。接下来，我们看看关闭文件可写流的实现。

```
WriteStream.prototype.close = function(cb) {  
  /* 
      如果 autoClose 是 false，说明流结束触发 finish 事件时，
      不会销毁流，见 WriteStream 初始化代码
      
      所以以这里需要监听 finish 事件，保证可写流结束时可以关闭文件描述符 
  */  
  if (!this.autoClose) {  
    this.on('finish', this.destroy.bind(this));  
  }  
  
  // 结束流，会触发finish事件  
  this.end();  
};  
```

可写文件流和可读文件流的销毁机制不一样，默认情况下，在可读流读完文件内容后，Node.js 会自动销毁流（关闭文件描述符）。而在某些情况下，Node.js 是无法知道可写流是什么结束的，这需要我们显式地通知 Node.js。在下面的例子中，我们是不需要显式通知 Node.js 的。

```
 fs.createReadStream('11111.md').pipe(fs.createWriteStream('123.md'));  
```

因为可读文件流在文件读完后会调用可写文件的 end 方法，从而关闭可读流和可写流对应的文件描述符。而在以下代码中情况就变得复杂。

```
const stream = fs.createWriteStream('123.md');  
stream.write('hello');  
// stream.close 或 stream.end();
```

在默认情况，我们可以调用 end 或者 close 去通知 Node.js 流结束。但如果我们设置 autoClose 为 false，就只能调用 close 而不能调用 end，否则文件描述符就会泄漏。因为 end 只是结束写入数据，没有触发销毁流的逻辑，而 close 会触发销毁流的逻辑，我们看下面这个例子。

```
const fs = require('fs');  
// autoClose 默认为 true
const stream = fs.createWriteStream('123.md');  
stream.end('hello');  
setInterval(() => {}, 1000);  
```

执行上面的代码，然后执行 lsof -p your_pid | grep 123.md 查看，我们发现没有 123.md 文件对应的文件描述符，即它被关闭了。接着修改一下代码，autoClose 改成 false：

```
const fs = require('fs');  
const stream = fs.createWriteStream('123.md', { autoClose: false });  
stream.end('hello');  
setInterval(() => {});  
```

执行上面的代码，然后执行 lsof -p your_pid | grep 123.md 查看，我们发现 123.md 对应的文件没有被关闭，由此可见，当 autoClose 为 false 时，使用 end 是无法关闭文件描述符的，从而造成文件描述符泄露。接着把 end 改成 close 函数看看。

```
const fs = require('fs');  
const stream = fs.createWriteStream('123.md', {autoClose: false})
stream.close();  
setInterval(() => {});  
```

执行上面的代码，然后执行 lsof -p your_pid | grep 123.md 查看，我们发现没有 123.md 文件对应的文件描述符，即它被关闭了。

## 总结

文件系统是操作系统的核心子系统，主要负责文件管理的功能，这里的文件包括网络、普通文件等底层资源，Node.js 的文件系统正是对操作系统文件系统功能的封装，所以理解 Node.js 的文件系统有助于我们更好地使用 Node.js 和理解文件系统。这节课我们重点讲了同步 API、异步 API、Promise 化 API 和流式 API。

1.  同步 API：同步 API 原理比较简单，直接在线程中调用系统调用就行。它的问题在于会阻塞线程，所以我们一般尽量避免使用。
1.  异步 API：异步 API 和同步 API 相似，都是对系统调用的简单调用，区别是异步 API 的实现中，是在 Libuv 的线程池中调用系统调用，这样不会导致主线程阻塞，一般推荐使用这类 API。
1.  Promise 化 API：Promise 化 API 我们可以理解为异步 API 的 Promise 方式，它简化了我们代码的编写，使得我们可以方便地以同步的方式写异步代码。
1.  流式 API：流式 API 相比前面三种 API 来说，好处在于流量控制，因为它会控制生产者和消费者的速度，减轻内存压力。