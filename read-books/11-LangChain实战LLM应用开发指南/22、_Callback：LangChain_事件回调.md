大家好，欢迎继续学习 LangChain 实战课程。

在编程领域，回调是一个非常重要的概念，尤其是前端同学，肯定对回调函数不陌生，回调函数可以当成一个参数传给其他函数，在适当的时机被调用。

LangChain几乎全部的组件，在各个执行环节都设计了相关的回调 hook，能触发相关回调事件函数，这允许我们在特定事件执行自定义逻辑。这在日志纪录，性能监控、审计纪录等许多场景都非常有用，有助于我们监控、调试系统。

今天，我们将结合示例详细介绍 LangChain中回调处理器的原理及使用，最后，会通过一个 token 消耗审计的实战项目来演示回调函数在实际场景中的应用。


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e8ddd82c5d5d4f19aa6d5a2ff73cd72c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1100&h=399&s=45299&e=png&b=ffffff)
# 回调处理器的工作流程
首先，我们先看看 LangChain 都有哪些回调事件，全部回调函数处理函数都继承自`BaseCallbackHandler`，所以我们直接看看该类是如何定义的：
```python
class BaseCallbackHandler(
    LLMManagerMixin,
    ChainManagerMixin,
    ToolManagerMixin,
    RetrieverManagerMixin,
    CallbackManagerMixin,
    RunManagerMixin,
):
    ...

class LLMManagerMixin:
    """Mixin for LLM callbacks."""

    def on_llm_new_token(...) -> Any:
        """Run on new LLM token. Only available when streaming is enabled."""
    def on_llm_end(...) -> Any:
        """Run when LLM ends running."""
    def on_llm_error(...) -> Any:
        """Run when LLM errors."""
        
class ChainManagerMixin:
    """Mixin for chain callbacks."""

    def on_chain_end(...) -> Any:
        """Run when chain ends running."""

    def on_chain_error(...) -> Any:
        """Run when chain errors."""

    def on_agent_action(...) -> Any:
        """Run on agent action."""

    def on_agent_finish(...) -> Any:
        """Run on agent end."""
        
class ToolManagerMixin:
    """Mixin for tool callbacks."""

    def on_tool_end(...) -> Any:
        """Run when tool ends running."""

    def on_tool_error(...) -> Any:
        """Run when tool errors."""

class RetrieverManagerMixin:
    """Mixin for Retriever callbacks."""

    def on_retriever_error(...) -> Any:
        """Run when Retriever errors."""

    def on_retriever_end(...) -> Any:
        """Run when Retriever ends running."""

class CallbackManagerMixin:
    """Mixin for callback manager."""

    def on_llm_start(...) -> Any:
        """Run when LLM starts running."""

    def on_chat_model_start(...) -> Any:
        """Run when a chat model starts running."""

    def on_retriever_start(...) -> Any:
        """Run when Retriever starts running."""

    def on_chain_start(...) -> Any:
        """Run when chain starts running."""

    def on_tool_start(...) -> Any:
        """Run when tool starts running."""

class RunManagerMixin:
    """Mixin for run manager."""

    def on_text(...) -> Any:
        """Run on arbitrary text."""

    def on_retry(...) -> Any:
        """Run on a retry event."""
```
LangChain 将事件进行划分，并归到不同的抽象类中，这些事件名也非常清晰，比如，`on_llm_start`是LLM执行前触发的事件，当 LLM 返回后，`on_llm_end`会被触发。

每个组件基本上都是有三个事件：执行前、执行后、执行异常：
* LLM：[on_llm_start, on_chat_model_start, on_llm_end, on_llm_error, on_llm_new_token]
* Chain: [on_chain_start, on_chain_end, on_chain_error]
* Tool: [on_tool_start, on_tool_end, on_tool_error]
* Retriever: [on_retriever_start, on_retriever_end, on_retriever_error]
* Agent: [on_agent_action, on_agent_finish]


一般情况下，有两种方式指定回调处理函数：构造组件实例时指定和请求调用时指定。

**构造函数传入回调：** 创建组件实例时通过`callbacks`参数指定，比如：`LLMChain(callbacks=[handler])`，这种情况下，回调函数在该组件实例的全部调用中都生效。
```python
from langchain_openai import OpenAI
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, TypeVar, Union

class ConstructorCallbackHandler(BaseCallbackHandler):
    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        print("ConstructorCallbackHandler on_llm_start")

# 创建 OpenAI 实例时指定回调函数，该实例的每次请求都会触发回调
llm = OpenAI(callbacks=[ConstructorCallbackHandler()])
model.invoke("hello")

# output
> ConstructorCallbackHandler on_llm_start
```

**请求调用时指定回调：** 也可以在实际调用时指定回调函数，比如，`invoke(config={'callbacks' : [handler]})`。这种情况下，回调函数只会作用在单次请求上。

```python
from langchain_openai import OpenAI
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, TypeVar, Union

class RequestCallbackHandler(BaseCallbackHandler):
    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        print("RequestCallbackHandler on_llm_start")

model = OpenAI()
model.invoke("hello", config={"callbacks": [RequestCallbackHandler()]})

# output
> RequestCallbackHandler on_llm_start
```

需要注意的是，如果对一个实例在这两个地方同时指定回调处理函数，这两处的函数都会被触发。
```python
llm = OpenAI(callbacks=[ConstructorCallbackHandler()])
llm.invoke("hello", config={"callbacks": [RequestCallbackHandler()]})

#output
> RequestCallbackHandler on_llm_start
> ConstructorCallbackHandler on_llm_start
```

在实际系统开发过程中，我们可能希望对日志添加用户的uid或ip等元信息，这对我们排查问题很有帮助。

LangChain支持在指定`callbacks`时，同时指定`tags`，该标签将会被传递到回调方法的`tags`参数。以`RequestCallbackHandler`为例：
```python
from langchain_openai import OpenAI
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, TypeVar, Union

class RequestCallbackHandler(BaseCallbackHandler):
    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        print(tags)
        print("RequestCallbackHandler on_llm_start")

model = OpenAI()
model.invoke("hello", config={"callbacks": [RequestCallbackHandler()], "tags": ["request_tag"]})

# output
> ['request_tag']
> RequestCallbackHandler on_llm_start
```


# LCEL中的回调处理器
回调的概念及其在组件中的集成使用相对简单。但当涉及到为LCEL链路集成回调处理函数时，情况就会变得复杂。而在我们的实践中，LCEL链路接入回调函数是一种十分常见的做法。

在开始介绍之前，我先直接给出总结论：**LCEL链中每个环节都可以看成单独的执行模块，当模块本身是上面介绍的组件（`Tool`，`LLM`, `Agent`, `Retriever`）时，会触发对应组件的回调事件；当模块是`RunnableParallel`、`RunnableLambda`等这类LangChain为LCEL设计的`Runnable`对象时，会触发`on_chain_xxx`相关回调事件。** 希望大家默念3遍后再往下阅读。

下面，我们将会以几个由浅到深的例子，来说明和理解LCEL中回调函数的逻辑。




## 示例一： RunnableSequence
我们来看一个最简单的LCEL链, 并在调用该链时添加一个回调函数。
```python
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import OpenAI
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, TypeVar, Union
import json

class CustomCallbackHandler(BaseCallbackHandler):
    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        print("on_chain_start")
        print("id: " + json.dumps(serialized['id']))
        print("inputs: " + json.dumps(inputs))
        print("------------------")
        
    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        print("on_llm_start")
        print("id: " + json.dumps(serialized['id']))
        print("------------------")
    
prompt = ChatPromptTemplate.from_messages(["Tell me a joke about {animal}"])
model = OpenAI()
chain = prompt | model
response = chain.invoke({"animal": "bears"}, config={"callbacks": [CustomCallbackHandler()]})
```
首先，我们构造了一条LCEL调用链，该链只有一个提示词模版和一个LLM模型实例。

在实际调用`invoke`时，传入了自定义的回调处理函数`CustomCallbackHandler`。该回调函数实现了`on_chain_start`和`on_llm_start`两个回调事件。这两个回调事件函数都有`serialized`参数，里面保存着调用函数时的一些元信息，在这里，我们打印出`serialized['id']`方便分析。`on_chain_start`还有`inputs`参数，表示链接收的入参，我们也一并打印出来。

下面是代码执行结果：
```shell
on_chain_start
id: ["langchain", "schema", "runnable", "RunnableSequence"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "prompts", "chat", "ChatPromptTemplate"]
inputs: {"animal": "bears"}
------------------
on_llm_start
id: ["langchain", "llms", "openai", "OpenAI"]
------------------
```
不知道大家第一次看到这个结果会不会一脸懵逼，这个`RunnableSequence`是哪来的？为什么`RunnableSequence`和`ChatPromptTemplate`触发的是`on_chain_start`， 而`OpenAI`触发的是`on_llm_start`？

我先带大家复习下，在[LCEL：轻松构建复杂 LLM 链](https://juejin.cn/book/7352849785881591823/section/7352518697464660022》)小节中有介绍过，`RunnableSequence`对象表示由多个 `Runnable` 对象组成的序列，也就是说，每个LCEL调用链其实是一个`RunnableSequence`对象。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6ee5153ea70f4a1eacac8fbe9a2a8e91~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1522&h=540&s=44546&e=png&b=ffffff)

我们再来看看`RunnableSequence.invoke`的源码：
```python
class RunnableSequence(RunnableSerializable[Input, Output]):
    def invoke(self, ...) -> Output:
        ...
        run_manager = callback_manager.on_chain_start(...)
        ...
```
所以，`RunnableSequence`会触发一次`on_chain_start`。

用同样的分析方法，我们可以在源码中找到`ChatPromptTemplate`触发的是`on_chain_start`，而`OpenAI`触发的是`on_llm_start`。

## 示例二：RunnableParallel
下面例子中，我们探讨并行执行（`RunnableParallel`）的复杂LCEL链中回调函数的调用情况。
```python
# CustomCallbackHandler定义保持不变
...
def get_num(animal):
    if animal == "bears":
        return 1
    else:
        return 2

prompt = ChatPromptTemplate.from_messages(["Tell me {num} joke about {animal}"])
model = OpenAI()
chain = {"num": get_num, "animal": RunnablePassthrough()}|prompt | model
response = chain.invoke({"animal": "bears"}, config={"callbacks": [CustomCallbackHandler()]})
```
我们先直接看输出情况：
```shell
on_chain_start
id: ["langchain", "schema", "runnable", "RunnableSequence"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "schema", "runnable", "RunnableParallel"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain_core", "runnables", "base", "RunnableLambda"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "schema", "runnable", "RunnablePassthrough"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "prompts", "chat", "ChatPromptTemplate"]
inputs: {"num": 2, "animal": {"animal": "bears"}}
------------------
on_llm_start
id: ["langchain", "llms", "openai", "OpenAI"]
------------------
```
上面输出中，相信第1(`RunnableSequence`)，第5(`ChatPromptTemplate`)和第6(`OpenAI`)大家都清楚了。我们主要看看剩下3个。

先仔细分析我们的代码，在这个例子中，提示词模版添加了`num`占位符变量，并通过`get_num`函数获取。

在构造的LCEL链中，`{"num": get_num, "animal": RunnablePassthrough()}`是并行执行的意思，将会变转变成`RunnableParallel("num": RunnableLambda(get_num), "animal": RunnablePassthrough())`。该链执行流程图如下：



![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/984e560be74a4b3cafe97a9bed03c573~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1213&h=411&s=37630&e=png&b=ffffff)
现在，我们已经知道输出中的`RunnableParallel`、`RunnableLambda`和`RunnablePassthrough`是哪来的了，我们再看看它们的`invoke`函数，看触发的是哪个事件函数：

**RunnableParallel**
```python
class RunnableParallel(RunnableSerializable[Input, Dict[str, Any]]):
    ...
    def invoke(...):
        ...
        run_manager = callback_manager.on_chain_start(...)
        ...
```

**RunnableLambda**
```python
class RunnableLambda(Runnable[Input, Output]):
    ...
    def invoke(...):
        ...
        return self._call_with_config(...)
        ...

class Runnable(Generic[Input, Output], ABC):
    ...
    def _call_with_config(...):
        ...
        run_manager = callback_manager.on_chain_start(...)
        ...
```

**RunnablePassthrough**
```python
class RunnablePassthrough(RunnableSerializable[Other, Other]):
    ...
    def invoke(...):
        ...
        # _call_with_config为Runnable._call_with_config
        return self._call_with_config(...)

```
根据上面三段源码可以看出，这几种`Runnable`触发的都是`on_chain_xxx`类型的回调事件。

## 示例三 - 嵌套子链
现在，我们再加大难度，构造一个更复杂的LCEL链并为其添加回调函数，看大家能否自行判断并解释其回调函数调用情况。
```python
# CustomCallbackHandler定义保持不变
...
def get_num(animal):
    if animal == "bears":
        return 1
    else:
        return 2

def add_one(num):
    return num + 1

prompt = ChatPromptTemplate.from_messages(["Tell me {num} joke about {animal}"])
model = OpenAI()
chain = {"num": RunnableLambda(get_num) | RunnableLambda(add_one), "animal": RunnablePassthrough()}|prompt | model
response = chain.invoke({"animal": "bears"}, config={"callbacks": [CustomCallbackHandler()]})
```
我们在**示例二**的基础上，进一步增加`num`的获取环节: 在`get_num`后，还需经过`add_one`在原来的基础上+1。我们看下其输出结果：
```shell
on_chain_start
id: ["langchain", "schema", "runnable", "RunnableSequence"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "schema", "runnable", "RunnableParallel"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "schema", "runnable", "RunnablePassthrough"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain", "schema", "runnable", "RunnableSequence"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain_core", "runnables", "base", "RunnableLambda"]
inputs: {"animal": "bears"}
------------------
on_chain_start
id: ["langchain_core", "runnables", "base", "RunnableLambda"]
inputs: 2
------------------
on_chain_start
id: ["langchain", "prompts", "chat", "ChatPromptTemplate"]
inputs: {"num": 3, "animal": {"animal": "bears"}}
------------------
on_llm_start
id: ["langchain", "llms", "openai", "OpenAI"]
------------------
```

大家可以先暂停一下，尝试自己分析并解释上述内容。如果你能够理解这些结果，那么恭喜你，已经掌握了LCEL链中回调函数的工作机制了。

现在，我来给出答案。

与**示例二**相比, 整个LCEL链的区别在于将`"num": get_num`换成了`"num": RunnableLambda(get_num) | RunnableLambda(add_one)`。 这个地方经过管道符(`|`)的修饰，由原本的`RunnableLambda`变成了一个`RunnableSequence`序列对象。整条链的执行流程图如下：


![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/db71ed1751784259b1ee9d86829d4787~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1309&h=397&s=37044&e=png&b=ffffff)

配合前面对这些`Runnable`对象触发回调事件类型的介绍，不难得出上述结果。

# 实战：Token消耗审计
在一些LLM应用中，对用户的token消耗进行统计并以此计费是很常见的功能，比如，大家购买的OpenAI转发服务，一般是以token额度进行计费。

使用LangChain提供的`on_llm_new_token`回调事件可以很方便得将审计统计功能集成到我们的LCEL调用链中。
```python
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import OpenAI
from typing import Any, Optional


class CustomCallbackHandler(BaseCallbackHandler):
    def __init__(self):
        self.token_used = 0
    
    def on_llm_new_token(
        self,
        token: str,
        **kwargs: Any,
    ) -> Any:
        self.token_used+=1

prompt = ChatPromptTemplate.from_messages(["Tell me a joke about {animal}"])
model = OpenAI(streaming=True)
chain = prompt | model
callbackHandler = CustomCallbackHandler()
response = chain.invoke({"animal": "bears"}, config={"callbacks": [callbackHandler]})
print(callbackHandler.token_used)
```
代码比较简单，就是在每次新token生成时计数加1。使用`on_llm_new_token`有以下两点需要注意：
1. 需要LLM支持流输出，并且设置streaming=True。
2. 这个事件在输出新token被触发，所以统计的只是输出token的数量。在实际审计系统中，需要记录输入token和输出token的总和，可以配合`on_llm_start`或`on_chat_model_start`事件进行完整的统计。

# 总结
1. 回调的概念很简单，但也很重要，通过实现特定事件的回调函数，我们可以更好得了解LLM应用的执行情况，有助于我们对系统更好地监控和调试。
2. LangChain中每个组件都在关键环节设计了相应的回调hook，我们可以通过继承`BaseCallbackHandler`，实现对应事件方法，让LLM在指定环节执行我们的自定义逻辑。定义好我们的回调类后，我们一般可以在构造组件实例时指定回调函数或在请求调用时指定。
3. LCEL链中每个环节都可以看成单独的执行模块，当模块本身是上面介绍的组件（`Tool`，`LLM`, `Agent`, `Retriever`）时，会触发对应组件的回调事件；当模块是`RunnableParallel`、`RunnableLambda`等这类LangChain为LCEL设计的`Runnable`对象时，会触发`on_chain_xxx`相关回调事件。
4. LangChain的迭代较快，为了更好地适应版本的变化，也为了更好地了解回调的处理机制，建议大家学会查看相关源码实现。本小节中重复了几个对象的回调源码走读，大家可以举一反三，看看其他事件函数都是在哪里被调用的。

