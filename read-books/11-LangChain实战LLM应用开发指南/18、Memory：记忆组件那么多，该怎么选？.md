上节课中，我们详细介绍了 LangChain 接入 Memory 的原理和实现。如果大家认真理解了上节课中的相关代码实现细节，相信已经能够开发实现自己的自定义 Memory 组件了。

但其实，LangChain 已经内置了多种 Memory 组件，可以适用大部分的应用场景。而且这些组件所使用的数据结构和算法，都是经过实际验证的。所以，学习这些组件的实现原理并学会在不同的场景使用合适的组件，对我们 LLM 应用开发技能有重要提升。

今天，我们会详细介绍和学习`ConversationBufferMemory`、`ConversationBufferWindowMemory`、`ConversationSummaryMemory`、`ConversationSummaryBufferMemory`、`ConversationEntityMemory`、`VectorStoreRetrieverMemory`、`ConversationKGMemory`这 7 个常用内置 Memory 组件的实现原理和优缺点。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2cc1706ea3a2423d944568ab6963b1b3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2050&h=844&s=189376&e=png&b=ffffff" alt=""  /></p>

截至目前（0.1.13 版本），上面的 Memory 组件都是只有传统链的版本，我们在上节课中提到，在传统链的 Memory 组件实现中，有两个最重要的方法：**`load_memory_variables`** **用于获取对话历史；`save_context`用于存储本次对话。** 这两个方法也是今天学习每个组件的入口。



## ConversationBufferMemory（会话缓冲记忆组件）

`ConversationBufferMemory`是 LangChain 中最简单的记忆组件，将全部的原始对话记录都保存到内存中，查询时返回全量的对话记录。

`ConversationBufferMemory`甚至没有实现自己的`save_context`，直接复用`BaseChatMemory`的。下面是`BaseChatMemory.save_context`的源码：

```python
class BaseChatMemory(BaseMemory, ABC):
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save context from this conversation to buffer."""
        # 获取本次对话的输入和模型响应
        input_str, output_str = self._get_input_output(inputs, outputs)
        # 封装成消息对象，并存入chat_memory.messages数组中
        self.chat_memory.add_messages(
            [HumanMessage(content=input_str), AIMessage(content=output_str)]
        )
```

**`load_memory_variables`** **源码：**

```python
class ConversationBufferMemory(BaseChatMemory):
    ...
    # 用户提示模板中历史记录的占位符变量名
    memory_key: str = "history"
    # 获取历史记录（buffer内部实际是调用其他方法去获取self.chat_memory.messages，这里简化了）
    @property
    def buffer(self) -> Any:
        """返回self.chat_memory.messages的全部内容"""
        ...
    # 直接拼接key和全部对话历史
    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Return history buffer."""
        return {self.memory_key: self.buffer}
```

可以看到，`ConversationBufferMemory`确实足够简单：使用一个内存数组保存全部对话记录，每次存储时将本次对话追加到数组中；查询时再将整个数组返回。

这个组件在用户与 AI 交互次数较少的场景中非常有用，比如客服咨询场景。当然，缺点也很明显，互动次数过多时，会超出模型的 token 数量限制。



## ConversationBufferWindowMemory（有限窗口会话缓冲记忆组件）

`ConversationBufferWindowMemory`是对`ConversationBufferMemory`组件的一种简单优化，它允许我们设置一个最大返回对话轮数 k，查询时最多返回最新的 k 次对话内容，以此来控制提示的长度。

`ConversationBufferWindowMemory`的实现代码绝大部分与`ConversationBufferMemory`都一样，只是在返回对话记录时有些差别。

```python
class ConversationBufferWindowMemory(BaseChatMemory):
    ...
    # 最大返回轮数
    k: int = 5
    # 获取历史记录（buffer内部实际是调用其他方法去获取self.chat_memory.messages，所以实际代码中这个函数也是不变的，这里只是为了方便讲解，收敛到这里了）
    @property
    def buffer(self) -> Any:
        ...
        # 因为每轮对话都有Human和AI两条消息，所以这里需要返回k*2个消息
        messages = self.chat_memory.messages[-self.k * 2 :] if self.k > 0 else []
        ...
```

`ConversationBufferWindowMemory`利用的是对话的连贯性，新的对话往往会基于最近的交流内容，所以从概率上讲，最新几轮的对话内容与新对话的相关性通常会比老对话历史的相关性更高。

但这也并不是绝对的，特别对于一些长期对话，老对话历史可能包含关键信息，对新对话有着直接影响。所以，`ConversationBufferWindowMemory`更多地还是用在一些短期对话中。



## ConversationSummaryMemory（会话总结记忆组件）

为了解决`ConversationBufferWindowMemory`历史消息丢失的问题，我们可以考虑使用`ConversationSummaryMemory`组件，它不再存储原始对话内容，而是保存整个对话的摘要。在每次存储时，调用 LLM，生成整个对话新的摘要。

我们先看`save_context`的实现：

```python
class ConversationSummaryMemory(BaseChatMemory, SummarizerMixin):
    ...
    # 整个对话的摘要
    buffer: str = ""
    ...
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save context from this conversation to buffer."""
        super().save_context(inputs, outputs)
        # self.chat_memory.messages[-2:] 表示本轮对话的Human消息和AI消息
        # self.buffer表示此前的对话摘要
        self.buffer = self.predict_new_summary(
            self.chat_memory.messages[-2:], self.buffer
        )
```

在`predict_new_summary`中，会调用 LLM，将本次对话内容和之前的对话摘要进行合并，生成新的对话摘要。使用到的总结提示模板如下（这里翻译成中文了）：

```python
_DEFAULT_SUMMARIZER_TEMPLATE = """
逐步总结提供的对话内容，添加到之前的摘要中，返回一个新的摘要。

例子
当前摘要：
人类询问人工智能对人工智能的看法。人工智能认为人工智能是一股正能量。

新的对话内容：
人类：你为什么认为人工智能是一股正能量？
人工智能：因为人工智能将帮助人类实现他们的全部潜力。

新摘要：
人类询问人工智能对人工智能的看法。人工智能认为人工智能是一股正能量，因为它将帮助人类实现他们的全部潜力。
例子结束

当前摘要：
{summary}

新的对话内容：
{new_lines}

新摘要：
"""
```

`load_memory_variables`就比较简单了，直接返回对话摘要`self.buffer`即可，这里就不贴代码了。

`ConversationSummaryMemory`的优点很明显，通过不断合成摘要的方式保留了整个会话的对话内容。但缺点也很明显，每次都需要多调用一次 LLM 进行摘要的合并，这无疑会增加用户交互的耗时和对话的费用成本，而且，摘要也会有“失真”的问题，有时候会丢失某些关键的对话内容。



## ConversationSummaryBufferMemory（对话摘要缓冲记忆组件）

LangChain 提供了另外一种摘要记忆组件——`ConversationSummaryBufferMemory`，该组件结合了`ConversationSummaryMemory`的会话摘要总结特性和原始对话内容的存储。

`ConversationSummaryBufferMemory`会在缓存区中保存最近的原始交互内容，通过设置`max_token_limit`限制缓存区内 token 的最大数量，当超出限制后，才会调用 LLM，将较老对话内容汇总成摘要。查询时返回缓存区中的原始对话记录和旧对话摘要。

这样做有两个好处：

1.  前面提到的，越新的历史对话，会有更大概率与后续对话相关，保留这部分的原始记录，一定程度上减少了摘要的“失真”问题导致信息丢失的可能性。
1.  只有在超出`max_token_limit`限制时，才会调用 LLM 汇总摘要，可以避免频繁调用 LLM，提高性能和用户体验。

我们还是先来看下组件的存储逻辑：

```python
class ConversationSummaryBufferMemory(BaseChatMemory, SummarizerMixin):
   # 限制原始对话内容缓存区的最大token数量，默认为2000
   max_token_limit: int = 2000
   # 存储旧对话的摘要
   moving_summary_buffer: str = ""
   def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save context from this conversation to buffer."""
        super().save_context(inputs, outputs)
        self.prune()

    def prune(self) -> None:
        """Prune buffer if it exceeds max token limit"""
        # 获取当前缓冲区内全部的对话内容
        buffer = self.chat_memory.messages
        # 计算当前缓存区的token数量
        curr_buffer_length = self.llm.get_num_tokens_from_messages(buffer)
        if curr_buffer_length > self.max_token_limit:
            pruned_memory = []
            while curr_buffer_length > self.max_token_limit:
                pruned_memory.append(buffer.pop(0))
                # 去掉缓冲区中第一个（即最老的）消息后，再次计算缓冲区的token数量
                curr_buffer_length = self.llm.get_num_tokens_from_messages(buffer)
            # 当缓冲区的token数量未超出限制后，才会退出循环，并调用LLM将这次超出限制移除的消息和旧的摘要一起合并成新的摘要
            self.moving_summary_buffer = self.predict_new_summary(
                pruned_memory, self.moving_summary_buffer
            )
```

在保存本次对话时，如果当前缓冲区（`chat_memory.messages`）内消息较少，直接将本次的消息内容追加到缓冲区末尾即可；如果当前缓冲区的 token 数量超过`max_token_limit`，则先将最老的消息（即第一个）从缓冲区中移除，然后再次计算缓冲区的 token 数量，直到缓冲区的 token 数量小于等于`max_token_limit`，才会退出循环，并调用 LLM 将这次超出限制移除的消息和旧的摘要一起合并成新的摘要。

> `ConversationSummaryBufferMemory`中调用 LLM 生成摘要时用到的提示模板与`ConversationBufferWindowMemory`相同。

查询时就没有什么逻辑，直接把旧对话摘要（`moving_summary_buffer`）和缓存区中的原始对话记录（`chat_memory.messages`）返回即可。



## ConversationEntityMemory（会话实体记忆组件）

`ConversationSummaryBufferMemory`虽然已经通过保留最近的原始对话内容来缓解信息丢失的问题，但随着对话交互次数增多，不断增加的摘要还是会逐渐丢失一些关键的信息。

这里有个很重要的原因：**对话可能涉及多个互不相关的内容，但却只生成了一份摘要**。这无疑加剧了信息丢失的风险。

比如，一段对话中，用户先是聊到了一会天气，后面一直在聊旅游相关的话题，随着对话深入，LLM 不断对前面的对话进行汇总摘要，因为天气的内容在对话中占比越来越小，所以天气相关的信息就可能在某次汇总中被丢失了。

**既然一份摘要无法兼顾所有的内容，那我们为每一个话题/实体各自生成一份摘要就好了**。基于这个思路，LangChain 设计了`ConversationEntityMemory`组件。

还是以上面例子说明：我们分别为“天气”和“旅游”生成一份摘要，这样即使天气相关的信息在对话中占比很小，也不会在后续的对话中被丢掉。

下面，我们看看`ConversationEntityMemory`是如何实现的。

首先，我们看下`load_memory_variables`的相关代码：

```python
class ConversationEntityMemory(BaseChatMemory):
   ...
   # Memory组件本身需要用到的LLM实例
   llm: BaseLanguageModel
   # 保存本轮会话中涉及到的实体列表
   entity_cache: List[str] = []
   # 从原始对话内容中获取对话信息的最大数量（单位：轮数）
   k: int = 3
   # 实体抽取的提示模板 
   entity_extraction_prompt: BasePromptTemplate = ENTITY_EXTRACTION_PROMPT
   ...
   # 用于保存各个实体的摘要
   entity_store:BaseEntityStore = Field(default_factory=InMemoryEntityStore)
   ...
   def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
      # 用于提取实体的LLM链
      chain = LLMChain(llm=self.llm, prompt=self.entity_extraction_prompt)
      # 从chat_memory.messages中获取最近的k轮对话内容
      buffer_string = get_buffer_string(self.buffer[-self.k * 2 :],...)
      ...
      # 调用LLM获取本次提问中涉及的实体列表
      output = chain.predict(
         history=buffer_string,
         input=inputs[prompt_input_key],
      )
      ...
      entities = [w.strip() for w in output.split(",")]
      entity_summaries = {}
      # 获取涉及到的各个实体的摘要
      for entity in entities:
         entity_summaries[entity] = self.entity_store.get(entity, "")
      # 将本轮会话中涉及到的实体列表保存到entity_cache中
      self.entity_cache = entities
      ...
      return {
         self.chat_history_key: buffer,
         "entities": entity_summaries,
      }
```

在`load_memory_variables`中，先是利用 LLM 获取到本轮对话中涉及的实体列表，然后从实体摘要存储缓存（`entity_store`）中获取各个实体的摘要。

`ConversationEntityMemory`维护了一个变量 k，用于获取最近 k 轮对话内容。这 k 轮对话内容有两个作用：

1.  作为`load_memory_variables`返回的一部分，提供给用户提示词需要时使用。
1.  传入提取实体列表的提示词模板，协助提取出本轮会话中涉及到的实体列表。

为什么提取实体列表需要用到最近 k 轮对话内容呢？主要是为了解析对话中代词指向的实体。思考下面对话：

> Human：你了解 LangChain 框架吗？
>
> AI：当然啦。
>
> Human：那你能使用**它**来进行 LLM 应用开发吗？

如果我们要提取最后一轮对话的实体列表，由于对话中使用了代词“它”，仅靠最后一轮的对话内容是无法正确识别到实体 “LangChain” 的。

最后，我们来欣赏下提取实体列表的提示模板（翻译后）：

```python
_DEFAULT_ENTITY_EXTRACTION_TEMPLATE = """
你是一个人工智能助手，正在阅读一段人工智能与人类之间的对话记录。从对话的最后一行中提取所有的专有名词。作为指导，专有名词通常是首字母大写的。你应该明确提取所有的名字和地点。

提供对话历史记录只是为了应对核心指代（例如，“你对他了解多少？”中的“他”在前一行已经定义了）——忽略那些不在最后一行中提及的项目。

如果没有什么值得注意的内容要返回（例如，用户只是在打招呼或进行简单的对话），则返回结果为一个单独的逗号分隔列表，或者NONE。

例子：
对话历史：
人物 #1: 今天过得怎么样？
AI: “非常好！你呢？”
人物 #1: 很好！忙着做Langchain。有很多事要做。
AI: “听起来工作量很大！你在做哪些事情来让Langchain变得更好呢？”
最后一行：
人物 #1: 我正在尝试改进Langchain的接口、用户体验，以及它与用户可能想要的各种产品的集成……很多事情。
输出：Langchain
例子结束

例子：
对话历史：
人物 #1: 今天过得怎么样？
AI: “非常好！你呢？”
人物 #1: 很好！忙着做Langchain。有很多事要做。
AI: “听起来工作量很大！你在做哪些事情来让Langchain变得更好呢？”
最后一行：
人物 #1: 我正在尝试改进Langchain的接口、用户体验，以及它与用户可能想要的各种产品的集成……很多事情。我正在和人物 #2 一起工作。
输出：Langchain, 人物 #2
例子结束

对话历史（仅供参考）：
{history}
对话的最后一行（用于提取）：
人类：{input}

输出：
"""
```

我们继续学习`ConversationEntityMemory`是如何存储对话内容的：

```python
class ConversationEntityMemory(BaseChatMemory):
    # 保存本轮会话中涉及到的实体列表
    entity_cache: List[str] = []
    ...
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        super().save_context(inputs, outputs)
        # 从chat_memory.messages中获取最近的k轮对话内容
        buffer_string = get_buffer_string(self.buffer[-self.k * 2 :],...)
        # 用于生成摘要的LLM链
        chain = LLMChain(llm=self.llm, prompt=self.entity_summarization_prompt)
        
        for entity in self.entity_cache:
            # 实体此前的摘要
            existing_summary = self.entity_store.get(entity, "")
            # 合并本轮对话内容和此前的摘要生成新的摘要
            output = chain.predict(
                summary=existing_summary,
                entity=entity,
                history=buffer_string,
                input=input_data,
            )
            # 更新缓存区中实体的摘要信息
            self.entity_store.set(entity, output.strip())
```

`load_memory_variables`中，在调用 LLM 获取本轮对话的实体列表后，使用变量`entity_cache`将这些实体列表缓存了下来，在`save_context`中，遍历`entity_cache`中的全部实体，再次调用 LLM，结合本轮对话和旧实体摘要，生成新的摘要。

用于更新实体摘要信息的提示模板（翻译后）如下：

```python
_DEFAULT_ENTITY_SUMMARIZATION_TEMPLATE="""
你是一个人工智能助手，帮助人类跟踪他们生活中相关人物、地点和概念的事实。根据你与人类的最后一句对话，在“实体”部分更新所提供实体的摘要。如果你是第一次编写摘要，请返回一个单独的句子。
更新应该只包括关于所提供实体的最后一句对话中传递的事实，并且只应包含关于所提供实体的事实。
如果关于所提供实体没有新信息，或者信息不值得注意（不是长期记忆的重要或相关事实），则返回现有的摘要不变。
完整对话历史（供参考）： 
{history}
要总结的实体： 
{entity}
{entity}的现有摘要： 
{summary}
最后一句对话： 
人类：{input} 
更新后的摘要：
"""
```

与`ConversationSummaryBufferMemory`相比，`ConversationEntityMemory`优点很明显，但也存在一个问题：在 save_context 中，会遍历为每个实体更新摘要，这意味着每轮对话涉及到的实体越多，存储记忆时需要调用的 LLM 次数越多。

  


## VectorStoreRetrieverMemory（向量存储检索记忆组件）

尽管`ConversationEntityMemory`通过按实体生成摘要的方式尽量避免信息的丢失，但只要是摘要，信息就有丢失的风险。而且，存储记忆时多次调用 LLM 也会导致对话耗时增加，影响用户体验。

其实，类比 RAG 应用，不断增加的对话内容可以看成是 RAG 应用中的外部资料数据。**选择一种向量存储方式，将原始对话内容向量化后存储；查询时指定一种向量查询算法进行相关记忆的检索**。这就是 LangChain 中`VectorStoreRetrieverMemory`的基本原理。

与其他记忆组件不同，`VectorStoreRetrieverMemory`本身并不直接负责记忆的存储方式和查询算法。它通过初始化时传入一个`VectorStoreRetriever`，由`retriever`来管理记忆数据。

```python
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
# 使用Chroma对记忆数据进行存储，并指定了数据向量化的方式
vectorstore = Chroma(embedding_function=OpenAIEmbeddings())
# 定义了向量查询算法和返回的个数
retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 4})
# 实例化VectorStoreRetrieverMemory对象
memory = VectorStoreRetrieverMemory(retriever=retriever)
```

因此，`load_memory_variables`和`save_context`的逻辑很轻：

```python
class VectorStoreRetrieverMemory(BaseMemory):
    retriever: VectorStoreRetriever = Field(exclude=True)
    ...
    def load_memory_variables(
        self, inputs: Dict[str, Any]
    ) -> Dict[str, Union[List[Document], str]]:
        """Return history buffer."""
        input_key = self._get_prompt_input_key(inputs)
        query = inputs[input_key]
        # 使用retriever查询与用户输入最相关的记忆文档内容
        docs = self.retriever.get_relevant_documents(query)
        result: Union[List[Document], str]
        if not self.return_docs:
            result = "\n".join([doc.page_content for doc in docs])
        else:
            result = docs
        return {self.memory_key: result}
    def _form_documents(
        self, inputs: Dict[str, Any], outputs: Dict[str, str]
    ) -> List[Document]:
        """
        格式化输入和输出为文档对象
        return [Document(page_content="input:output")]
        """
        ...
   
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save context from this conversation to buffer."""
        documents = self._form_documents(inputs, outputs)
        self.retriever.add_documents(documents)
```

查询记忆时，使用传入的`retriever`查询与用户输入最相关的记忆文档内容并返回；由于每轮对话的消息一般不会特别大，所以在存储时并没有进行分块处理，而是直接生成文档对象，再使用`retriever`向量化存储。

使用`VectorStoreRetrieverMemory`，我们可以持久化记忆数据，用户能重新进入对话框后继续之前的对话。而且，由于存储的是原始对话内容，不存在信息丢失的问题。该组件非常适用于长期对话的场景。



## ConversationKGMemory（知识图谱记忆组件）

`VectorStoreRetrieverMemory`看似很完美，但大家思考下面这段对话：

> Human：有什么好看的电影推荐吗？
>
> AI：您可以考虑下《星际穿越》和《盗梦空间》，这两部都是克里斯托弗·诺兰导演的科幻片。
>
> Human：他还导演了哪些其他的电影？
>
> AI：《记忆碎片》、《蝙蝠侠：黑暗骑士》和《蝙蝠侠：黑暗骑士崛起》等。

如果我们继续提问：“诺兰导演都有哪些作品？”，因为第二轮对话中使用了“他”代指“克里斯托弗·诺兰”，在这种情况下，基于向量查询算法，只能检索到第一轮的对话。

这其实是由于**向量查询无法得知对话内容之间语义上的关联，导致查询返回信息不全**。

另外，对话过程中我们可能会对 AI 回答进行纠错，比如下面对话：

> Human：说出 3 个当前世界上最帅的男人。
>
> AI：吴彦祖、刘德华、还有你！
>
> Human：你错了，低调一点，我不是。
>  
> AI：抱歉，我之前说错了，你确实不是。

在上面对话中，AI 错误地以为我很帅，随后被我纠正了。现在将上述对话内容进行向量化存储，然后再进行提问：“说出 3 个当前世界上最帅的男人”，然而历史记录中的纠错对话并不会被检索到，所以依然会返回错误的答案。这个例子也说明了，**向量存储无法进行信息的纠正更新**。

使用**知识图谱（Knowledge Graph）** 作为管理记忆数据的数据结构能有效解决以上问题。

知识图谱是一种结构化的语义数据结构，它通过图形的方式组织信息。简单举个例子，把世界上所有的信息都画成一张巨大的网络图，每个节点代表一个实体（比如人、地点、物体），而节点之间的边代表实体之间的关系。这样，我们就可以通过这张图来了解世界的各种联系。

知识图谱的核心组成部分包括：

1.  实体（Entity）：图中的节点，代表现实世界中的对象，如人、地点、组织等。
1.  关系（Relation）：连接两个实体的边，表示它们之间的某种联系。例如，“居住在”、“创立了”等。
1.  属性（Attribute）：与实体相关联的信息，用来描述实体的特征。比如，一个人可能有“年龄”、“职业”等属性。

LangChain设计了`ConversationKGMemory`，使用知识图谱来重建和存储对话中的信息。

考虑到很多同学第一次接触知识图谱，`ConversationKGMemory`的源码讲解我们将结合具体的示例日志，以便更好理解其代码原理。

首先，我们先创建一个`ConversationKGMemory`，然后再调用`save_context`插入几条对话。

```python
from langchain.memory import ConversationKGMemory
from langchain_openai import OpenAI

llm = OpenAI(temperature=0)
memory = ConversationKGMemory(llm=llm)
memory.save_context({"input": "say hi to sam"}, {"output": "who is sam"})
memory.save_context({"input": "sam is a friend"}, {"output": "okay"})
```

准备好示例后，我们开始看下`save_context`的具体实现：

```python
class ConversationKGMemory(BaseChatMemory):
    ...
    # 知识图谱的实现,底层使用networkx
    kg: NetworkxEntityGraph = Field(default_factory=NetworkxEntityGraph)
    # 用于获取图谱三元组的提示模板
    knowledge_extraction_prompt: BasePromptTemplate = KNOWLEDGE_TRIPLE_EXTRACTION_PROMPT
    llm: BaseLanguageModel
    # 指定返回的对话消息数量
    k: int = 2
    ...
    def get_knowledge_triplets(self, input_string: str) -> List[KnowledgeTriple]:
        chain = LLMChain(llm=self.llm, prompt=self.knowledge_extraction_prompt)
        # 从chat_memory.messages中获取最近的k轮对话内容
        buffer_string = get_buffer_string(self.buffer[-self.k * 2 :],...)
        # 调用LLM获取三元组信息
        output = chain.predict(
            history=buffer_string,
            input=input_string,
            verbose=True,
        )
        # 格式化成List[KnowledgeTriple]
        knowledge = parse_triples(output)
        return knowledge
    
    def _get_and_update_kg(self, inputs: Dict[str, Any]) -> None:
        """Get and update knowledge graph from the conversation history."""
        prompt_input_key = self._get_prompt_input_key(inputs)
        knowledge = self.get_knowledge_triplets(inputs[prompt_input_key])
        for triple in knowledge:
            self.kg.add_triple(triple)
    
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save context from this conversation to buffer."""
        super().save_context(inputs, outputs)
        self._get_and_update_kg(inputs)
```

变量`kg`是底层知识图谱的具体实现，负责维护消息知识图谱。主要逻辑是：**`get_knowledge_triplets`** **中调用 LLM 获取消息的实体三元组列表，格式化成** **`KnowledgeTriple`** **后，再传给** **`kg`** **，更新知识图谱**。

值得注意的是，获取图谱实体三元组的提示词中，也需要传入最近 k 轮对话内容，目的也是解决代词关联问题。

我们尝试将新消息传入`get_knowledge_triplets`，观察该函数返回的三元组到底长什么样子。

```python
memory.get_knowledge_triplets("her favorite color is red")
# [KnowledgeTriple(subject='sam', predicate='has a favorite color', object_='red')]
```

可以看到，根据前面两轮的对话记录，LLM 正确判断出“her”代表“sam”，并生成相关的实体关联信息。

我们再看看`load_memory_variables`的代码：

```python
class ConversationKGMemory(BaseChatMemory):
    ...
    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Return history buffer."""
        # 获取本轮对话涉及的全部实体列表
        entities = self._get_current_entities(inputs)
        summary_strings = []
        for entity in entities:
            # 获取指定实体的图谱信息
            knowledge = self.kg.get_entity_knowledge(entity)
            if knowledge:
                summary = f"On {entity}: {'. '.join(knowledge)}."
                summary_strings.append(summary)
        ...
        context = "\n".join(summary_strings)

        return {self.memory_key: context}
```



查询记忆时，逻辑与`ConversationEntityMemory`很相似，都需要先调用 LLM 分析抽取本轮对话的实体列表，用到的提示模板都是同一个。之后，通过知识图谱获取每个实体的信息。



## 总结

1.  `ConversationBufferMemory` VS `ConversationBufferWindowMemory`：适用于短对话场景，`ConversationBufferMemory`每次查询都返回全量对话内容，有可能会超出模型 token 数量限制；`ConversationBufferWindowMemory`通过限制返回对话窗口大小，避免超出 token 数量的风险，但有可能导致消息丢失。
1.  `ConversationSummaryMemory` VS `ConversationSummaryBufferMemory`：通过生成对话摘要，有效规避了 token 数量限制的风险；其中`ConversationSummaryBufferMemory`利用对话连贯性的特征，额外返回最近数轮原始对话内容，可以减少关键信息丢失的概率。
1.  `ConversationEntityMemory`：利用 LLM 进行对话实体的抽取，为每个实体生成一份单独的摘要，避免不同实体之间互相影响。但需要多次调用 LLM，会增加对话响应耗时。
1.  `VectorStoreRetrieverMemory`：通过将对话数据进行向量化存储和查询，从根本上解决了摘要类实现导致的信息丢失问题。但由于向量算法无法捕捉对话上下文关联，可能导致返回记忆数据不准确。
1.  `ConversationKGMemory`：知识图谱使用图数据结构存储实体信息，这允许实时更新对话实体之间的关系，从而提供更加准确的记忆检索结果。

具体选择哪类记忆组件，需要从实际应用场景出发。理解各自组件的特点和解决的痛点，并根据实际需要进行改造和组合，才能更好地 “赋能 LLM，形成一套完美的组合拳”。

欢迎大家在评论区留下自己的想法和理解，我们可以进一步交流学习。