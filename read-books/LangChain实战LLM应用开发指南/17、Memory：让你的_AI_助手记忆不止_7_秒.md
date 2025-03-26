大家好，欢迎继续学习 LangChain 实战课程。

今天我们将步入一个新的模块—— `Memory（记忆）模块`。这是 LLM 应用开发中极其重要但我们之前一直没讨论过的话题。

大多数 LLM 应用都需要与用户进行多轮交互。如果 LLM 在交互过程中，无法记住之前的对话历史，就像得了“老年痴呆”一样，无法提供连贯和有意义的回应，用户体验将大打折扣。如下图所示：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3810ee5bbee54e6382a867be209ca838~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1256&h=784&s=48839&e=png&b=ffffff" alt=""  /></p>

Memory 模块正是为了解决这个问题，它就像人类的海马体一样，负责存储和回忆关键信息，从而确保对话的流畅和准确。


在今天的课程中，我们先简单探讨 Memory 模块的基本概念和原理，随后，通过一个简单的 LLM 示例，让你亲身体验 Memory 模块的强大。最后，我们将深入源码，学习 LangChain 中传统链和 LCEL 链分别是如何使用和现实 Memory 的。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57a5e9bf60574a4eaefba10766131b4b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1726&h=534&s=88600&e=png&b=ffffff" alt=""  /></p>



## Memory 模块的基本原理

如何能够让 LLM 根据对话历史进行回答呢？根据前面构造 RAG 应用的学习经验，很容易联想到可以在构造 prompt 做手脚，我们直接把过往的历史对话内容与问题一起发送给 LLM，让 LLM 在回答时参考历史对话内容。

比如，下面提示模板：

```python
promptTemplate = """
以下<history>标签中是AI与Human的历史对话记录，参考历史上下文，回答用户输入的问题。
历史对话:
<history>
{chat_history}
</history>
Human: {question}
AI:"""
```

我们在提示模板中给历史对话内容留了一个占位符，在发送 LLM 执行前，查询相关的历史对话，填充到 prompt 中；在 LLM 回答后，我们再想办法把本次问题与答案存储起来，以便下次查询引用。

是的，Memory 的基本原理就是这么简单：**LLM 执行前查询历史记录，LLM 执行后存储本次对话记录。**

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4f03e1c9db9d457c9b59af88199d00ef~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2276&h=870&s=157934&e=png&b=ffffff" alt=""  /></p>

虽然 Memory 集成到 LLM 的基本原理不复杂，但设计一个好用准确的 Memory 系统可不简单。


**第一个问题：该如何查询？**

当前的大语言模型都有 token 数量限制，所以如果我们每次都把全量对话内容合并到 prompt，随着对话次数变多，提示词会超出模型的上下文长度限制。

即使模型可支持的 token 数量足够多，全量的对话内容也会导致对话费用暴增。而且，LLM 可能会难以从中提取出与当前对话强关联的重点历史内容，导致回答质量下降。

所以，如何从历史对话中查询和当前问题相关的上下文，也就是查询的算法，将直接影响大模型的回答质量。



**第二个问题：该如何存储？**

对话记录的存储比较简单，LangChain 集成了多种数据库，可以很方便地使用 LangChain 封装好的类和方法将记忆保存到不同的数据库中。具体集成链接可点击[这里](https://python.langchain.com/docs/integrations/memory/)。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a00b8651e8b940429bc4adf040e75578~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2732&h=1404&s=371767&e=png&b=fefefe" alt=""  /></p>

当然，使用哪种存储方式，更多是取决于查询的数据结构和算法，比如使用向量相似度或知识图谱作为查询算法，我们需要选择不同的数据库进行存储。

是否需要存储全量的对话内容也需要基于实际系统的设计。比如，为了避免存储空间的浪费，我们可能会只保留最近一个月的数据。

有时候我们存储的不是原始的对话记录，基于查询的准确性和存储空间考虑，可以在存储前先将相关的对话进行合并。


LangChain 提供了不同的存储方式和查询算法的 Memory 组件，我们可以开箱即用，对于这些组件的实现原理和使用，我们下一节再详细讲解。



现在，让我们先通过一个简单的示例，提前感受下加了 Memory 后 LLM 的“蜕变”。

  


## 一个例子感受 Memory 的魔力

为 LLM “补脑” 的第一步，就是实例化一个 Memory 对象。这里我们选用`ConversationBufferMemory`，这是 LangChain 中一种比较简单的 Memory 实现。


```python
from langchain.memory import ConversationBufferMemory

memory = ConversationBufferMemory(memory_key="chat_history")
```

赋值给`memory_key`的是提示模板中代表历史对话的占位符变量名，提示模板如下：

```python
from langchain.prompts import PromptTemplate

template_str = """
You are a chatbot having a conversation with a human.
Previous conversation:
{chat_history}
Human: {question}
AI:"""

prompt_template = PromptTemplate.from_template(template_str)
```




接下来，创建一个模型实例，并使用`LLMChain`进行链的构建，将上面创建的`ConversationBufferMemory`对象传入 LLMChain 构造方法的`memory`参数。

```python
from langchain_openai import ChatOpenAI
from langchain.chains import LLMChain

llm = ChatOpenAI(temperature=0)
memory_chain = LLMChain(
    llm=llm,
    prompt=prompt_template,
    verbose=True, # verbose 表示打印详细过程
    memory=memory,
)
```

这样，我们就拥有了一个带记忆功能的 LLM 应用链。我们再来尝试提问下：

```python
memory_chain.predict(question="你好，我是jack")
"""
> Entering new LLMChain chain...
Prompt after formatting:

You are a chatbot having a conversation with a human.
Previous conversation:

Human: 你好，我是jack
AI:

> Finished chain.
 你好，jack。我是一个聊天机器人。你有什么需要我帮助的吗？
"""
memory_chain.predict(question="你还记得我叫什么吗？")
"""
> Entering new LLMChain chain...
Prompt after formatting:

You are a chatbot having a conversation with a human.
Previous conversation:
Human: 你好，我是jack
AI:  你好，jack。我是一个聊天机器人。你有什么需要我帮助的吗？
Human: 你还记得我叫什么吗？
AI:

> Finished chain.
 当然，你刚刚告诉我你叫jack。你有什么其他问题吗？
"""
```

可以发现，在后续的对话中，发送给 LLM 的提示词都带上了历史对话内容，LLM 也确实做出令人满意的回答。

  



## LangChain 中 Memory 模块的接入实现

Memory 模块中最基本也是最重要的两个动作就是`查询`和`存储`，这一小节，我们将从源码分析 LangChain 是如何将 Memory 的这两个动作集成到链的构造中去的。


我们前面学过，LangChain 中链有传统链和 LCEL 两种构造方式，这两种链接入 Memory 模块的方式也有所不同。


### 传统链中 Memory 的实现

传统链中，全部的实现链类都继承自`Chain`，并且，执行链时，执行路径一般为`XXXChain.predict/XXXChain(...)` -> `Chain.__call__` -> `Chain.invoke`。

```python
class LLMChain(Chain):
    ...
    def predict(self, callbacks: Callbacks = None, **kwargs: Any) -> str:
        return self(kwargs, callbacks=callbacks)[self.output_key]
        
 class Chain(RunnableSerializable[Dict[str, Any], Dict[str, Any]], ABC):
     ...
     def __call__(...) -> Dict[str, Any]:
         ...
         return self.invoke(...)
    
```

也就是说，最终都会调用到`Chain`的`invoke`方法。

```python
class Chain(RunnableSerializable[Dict[str, Any], Dict[str, Any]], ABC):
    def invoke(...):
        ...
        inputs = self.prep_inputs(input)
        ...
        # 调用具体Chain的_call接口，去执行实际的llm调用
        outputs = self._call(inputs)
        ...
        final_outputs: Dict[str, Any] = self.prep_outputs(...)
        ...
        return final_outputs
```

从`invoke`的实现代码中，我们可以看出，模型调用前，会先调用`prep_input`方法去执行一些前置处理。在模型响应后，也会先调用`prep_outputs`执行一些输出的前置处理再返回用户。


Memory 的查询和存储就是在这两个地方处理的。我们先看看`prep_input`：

```python
class Chain(RunnableSerializable[Dict[str, Any], Dict[str, Any]], ABC):
    ...
    memory: Optional[BaseMemory] = None
    ...
    def prep_inputs(self, inputs: Union[Dict[str, Any], Any]) -> Dict[str, str]:
    ...
    if self.memory is not None:
        external_context = self.memory.load_memory_variables(inputs)
        inputs = dict(inputs, **external_context)
    ...
    return inputs
```

还记得上一小节示例中传给`LLMChain`的 Memory 对象`ConversationBufferMemory`吗？该对象就是赋值给了`Chain.memory`变量。


当`Chain.memory`有赋值时，就会调用 **Memory 对象的** **`load_memory_variables`** **查询获取历史记录**。获取的历史记录会添加到最终的提示词中。


了解完历史记录的获取路径，我们再来看看`prep_outputs`是如何存储本次对话的。

```python
class Chain(RunnableSerializable[Dict[str, Any], Dict[str, Any]], ABC):
    ...
    memory: Optional[BaseMemory] = None
    ...
    def prep_outputs(
        self,
        inputs: Dict[str, str],
        outputs: Dict[str, str],
        return_only_outputs: bool = False,
    ) -> Dict[str, str]:
        ...
        if self.memory is not None:
            self.memory.save_context(inputs, outputs)
        ...
```

`prep_outputs`中，**会将本次用户输入与模型响应传给** **`Chain.memory`** **变量的** **`save_context`** **方法进行存储。**



现在，我们来重点讲讲`Chain.memory`，该变量是一个`BaseMemory`实例。`BaseMemory`是 LangChain 为 Memory 设计的一个接口，该接口包含了`load_memory_variables` 和`save_context`等一些必要的抽象方法：


```python
class BaseMemory(Serializable, ABC):
    @abstractmethod
    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Return key-value pairs given the text input to the chain."""
    @abstractmethod
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save the context of this chain run to memory."""
    ...
```



任何 Memory 具体类，只要实现这些方法，就可以无缝接入 LangChain 的链中。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c4c5676847b34f4ca64ab65711bc00c3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1284&h=1154&s=249737&e=png&b=fdfcfc" alt=""  /></p>

  


### LCEL 链中 Memory 的实现

LCEL 是 LangChain 推荐的一种建链方式，虽然目前（截至 LangChain 0.1.13 版本）LangChain 上很多 Memory 组件还都是以传统链的接入方式（实现`BaseMemory`接口）开发的。但是，LCEL 接入 Memory 的框架代码已经实现了。


我们先使用 LCEL 的方式重写前面 Memory 示例，快速了解下如何为 LCEL 链添加 Memory 功能。


提示模板与模型的实例化跟前面一致，为了方便阅读，我直接把代码复制过来：

```python
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

template_str = """
You are a chatbot having a conversation with a human.
Previous conversation:
{chat_history}
Human: {question}
AI:"""
prompt_template = PromptTemplate.from_template(template_str)
llm = ChatOpenAI(temperature=0)
```

  


然后，我们直接使用 LCEL 语法构建一个链：

```python
memory_chain = prompt_template | llm
```

接下来，我们需要实现一个函数，用于获取对话记录：

```python
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory

store = {}
def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]
```

该函数接收一个字符串变量`session_id`（LangChain 默认要求，后面源码讲解会介绍到），并返回一个`BaseChatMessageHistory`类实例，表示根据`session_id`查询到的历史记录。


最后，传入上面的`memory_chain`和`get_session_history`去实例化一个`RunnableWithMessageHistory`对象。

```python
from langchain_core.runnables.history import RunnableWithMessageHistory

with_message_history = RunnableWithMessageHistory(
    memory_chain,
    get_session_history,
    input_messages_key="question",
    history_messages_key="chat_history",
)
```

`input_messages_key`表示提示模板中用户输入的变量名；`history_messages_key`表示提示模板中历史记录的变量名。

调用`invoke`方法执行链时，需要指定本次的`session_id`。

```python
with_message_history.invoke(
    {"question": "你好，我是jack"},
    config={"configurable": {"session_id": "abc123"}},
)

with_message_history.invoke(
    {"question": "我的名字叫什么?"},
    config={"configurable": {"session_id": "abc123"}},
)
```

第一次看到上面代码时，肯定会有同学一脸懵逼，整个过程中好像没有记忆存储的代码呀？？


其实关键在于`get_session_history`返回的`BaseChatMessageHistory`。

`BaseChatMessageHistory`是 LangChain 设计用于保存历史对话的类，作用与 Memory 在传统链中的`BaseMemory`类似，它提供了`add_message`关键抽象方法用于添加历史记录。后续的 Memory 组件继承它并编写自己的`add_message`逻辑即可。

```python
class BaseChatMessageHistory(ABC):
    ...
    messages: List[BaseMessage]
    ...
    def add_message(self, message: BaseMessage) -> None:
```

  


以上面例子中的`ChatMessageHistory`为例，该类继承自`BaseChatMessageHistory`，`add_message`就只是简单地将本次对话消息加入到`messages`数组中。

```python
class ChatMessageHistory(BaseChatMessageHistory, BaseModel):
    ...
    def add_message(self, message: BaseMessage) -> None:
        """Add a self-created message to the store"""
        self.messages.append(message)
    ...
```

所以，在模型响应后，`get_session_history` 返回的`BaseChatMessageHistory`调用`add_message`就可以将本次对话保留下来。


我们再将目光移到`RunnableWithMessageHistory`上。`RunnableWithMessageHistory`继承自`RunnableBindingBase`，与`RunnableBinding`一样也是一种`Runnable`对象装饰器，可装饰`Runnable` 并为其管理聊天消息历史记录。

与以往一样，我们从其调用方法出发，看看整个链的执行过程。`with_message_history.invoke`调用到的是`RunnableBindingBase`的`invoke`方法：

```python
class RunnableBindingBase(RunnableSerializable[Input, Output]):
    def invoke(...) -> Output:
        return self.bound.invoke(
            input,
            self._merge_configs(config),
            **{**self.kwargs, **kwargs},
        )
```

这里第一个要关注的是`self._merge_configs(config)`，这里的`config`即我们传入的`{"configurable": {"session_id": "abc123"}}`，`self._merge_configs`调的是`RunnableWithMessageHistory`的`_merge_configs`方法：

```python
class RunnableWithMessageHistory(RunnableBindingBase):
    def _merge_configs(self, *configs: Optional[RunnableConfig]) -> RunnableConfig:
        ...
        # 使用RunnableBindingBase的_merge_configs进行格式化
        config = super()._merge_configs(*configs)
        # 获取传入的configurable相关内容
        configurable = config.get("configurable", {})
        """
        history_factory_config用于配置get_session_history的参数列表，默认配置有session_id，这也是为什么我们的get_session_history函数默认需要传入session_id的原因。
        self.history_factory_config = [
            ConfigurableFieldSpec(
                id="session_id",
                annotation=str,
                name="Session ID",
                description="Unique identifier for a session.",
                default="",
                is_shared=True,
            ),
        ]
        """
        expected_keys = [field_spec.id for field_spec in self.history_factory_config]
        ...
        message_history = self.get_session_history(
                **{key: configurable[key] for key in expected_keys}
        )
        config["configurable"]["message_history"] = message_history
        return config
        
```

在`RunnableWithMessageHistory._merge_configs`中，就已经使用我们传入的`get_session_history`函数获取到对应的`BaseChatMessageHistory`对象了，并将该对象往下传递。


再看回`RunnableBindingBase`的`invoke`方法，底层调用的是成员变量`bound`的`invoke`方法。`RunnableWithMessageHistory`中`bound`变量的赋值相关源码如下：

```python
class RunnableWithMessageHistory(RunnableBindingBase):
    def __init__(
        self,
        # 传入的LCEL链
        runnable,
        get_session_history,
        ...
        input_messages_key: Optional[str] = None,
        ...
        history_messages_key: Optional[str] = None,
        ...
    ) -> None:
        # 使用RunnableLambda新创建了一个Runnable，执行self._enter_history（同步）/self._aenter_history（异步）方法
        history_chain: Runnable = RunnableLambda(
            self._enter_history, self._aenter_history
        ).with_config(run_name="load_history")
        messages_key = history_messages_key or input_messages_key
        if messages_key:
            history_chain = RunnablePassthrough.assign(
                **{messages_key: history_chain}
            ).with_config(run_name="insert_history")
        # 为传入的LCEL链添加一个退出前回调函数，并将新创建的history_chain添加到LCEL链前面。
        bound = (
            history_chain | runnable.with_listeners(on_end=self._exit_history)
        ).with_config(run_name="RunnableWithMessageHistory")
```

在`RunnableWithMessageHistory`的构造函数中，为传入的 LCEL 链添加了前置处理`_enter_history`和后置处理`_exit_history`，构成一条新的 LCEL 链，赋值给`bound`变量。



所以，`RunnableBindingBase.invoke`调用逻辑可表示为下图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df1e4f651fe94b62a143f435df82ea56~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2316&h=770&s=112384&e=png&b=ffffff" alt=""  /></p>

现在，我们看看`_enter_history`和`_exit_history`都做了哪些工作。

```python
class RunnableWithMessageHistory(RunnableBindingBase):
    def _enter_history(self, input: Any, config: RunnableConfig) -> List[BaseMessage]:
        hist = config["configurable"]["message_history"]
        ...
        return hist.messages.copy()
    
    def _exit_history(self, run: Run, config: RunnableConfig) -> None:
        hist = config["configurable"]["message_history"]
        ...
        # input_messages：用户消息 HumanMessage
        # output_messages：模型返回的消息 AIMessage
        for m in input_messages + output_messages:
            hist.add_message(m)
```

在`_enter_history`中，就只是简单地复制`BaseChatMessageHistory.messages`的内容。而`_exit_history`则是调用`BaseChatMessageHistory.add_message`将本次用户消息和模型响应消息存储起来。


看到这里，不知道大家有没有一个疑惑：如何在查询历史记录添加一些复杂逻辑？比如要自定义一种 Memory 组件，将对话记录向量化存储然后进行向量化查询。


当前需要利用 Python 的`property`装饰器，它允许使用属性的方式来访问方法的返回值，也就是说我们定义一个名字为`messages`的方法，并使用`@property`修饰，这样访问`hist.messages`就会调用该方法。

```python
class VectorMessageHistory(BaseChatMessageHistory, BaseModel):
    @property
    def messages(self) -> List[BaseMessage]:
        """使用向量相似度查询相关对话记录"""
        ...
```

其实我个人觉得，`BaseChatMessageHistory`应该提供一个`get_messages`抽象方法让开发者继承实现会比较直观一些。


## 总结

1.  Memory 模块是 LLM 应用开发一个重要的话题，接入 Memory 的原理比较简单：LLM 执行前查询历史记录合并到提示词中，LLM 执行后存储本次对话记录。
1.  设计一个 Memory 系统最关键的是查询和存储历史记录的数据结构和算法。LangChain 实现了多种类型的 Memory 组件，适用于不同的使用场景。截至目前（0.1.7 版本），大多数 Memory 组件都是适用于传统链的，但相信随着版本的迭代，会提供 LECL 链的组件版本。
1.  LangChain 中传统链和 LECL 链集成 Memory 的方式各不相同。本文带大家进行了详细的源码解读，相信大家跟着走一遍后会有更深的了解，也能更快适应后续版本的迭代。