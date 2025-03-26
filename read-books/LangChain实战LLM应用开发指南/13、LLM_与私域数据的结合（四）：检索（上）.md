大家好，欢迎继续学习 LangChain 实战课程。

今天，我们终于来到构建 RAG 的最后一个环节 —— `检索`。

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7c877fd8a8a54be2bc76eea2459081fa~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1770&h=1056&s=461207&e=png&b=fefdfd" alt="image.png"  /></p>


有些读者可能有疑惑：上节课中提到的`VectorStore`，不是已经有`search/similarity_search/max_marginal_relevance_search`这几种基于向量的检索方法了吗？的确如此，但实际开发中，仅仅简单地将问题传入向量数据库查询获取 `top k`个结果，然后将结果文档与问题一并传给 LLM，并不一定能达到很好的效果。

这个有很多方面原因，比如提问的方式有问题，无法在向量数据库中找到相关性较高的文档；或者前面的文档分割选择的文档块过大或过小，导致检索回来的结果不够精准；或者由于 LLM 的一些限制和特性，将检索后的文档直接输入到模型效果不佳，等等。

所以，从向量数据库中检索返回相关文档，到确定最终传给 LLM 的文档列表，这个过程需要考虑的因素有很多，对应可以选择的检索策略也有很多。所以，在 LangChain 中，检索是一个单独的模块，并且根据不同的检索策略设计了一系列检索器（`Retriever`）。

与`VectorStore`相比，`Retriever`不负责向量的存储，而是解决如何从向量数据库中查询文档数据，如何优化处理文档数据，返回最终传给 LLM 的文档列表。

今天，我们会先学习 LangChain 中检索器的框架代码设计，再通过介绍 LangChain 的几种检索器，来学习其背后的检索策略原理。

由于检索器类型较多，但这些检索策略对于构建高召回率的 RAG 应用有重要作用，所以会分两节介绍，今天只介绍其中一部分。



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef0c2750a70a4bdcbe5f7f8a0932bc90~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2282&h=894&s=147523&e=png&b=ffffff" alt="image.png"  /></p>




## Retriever 框架代码设计

为了各类检索策略的检索器可以无缝替换使用，LangChain 中检索器还是采用 **`抽象接口 + 具体实现`** 的设计模式：先抽象出一个基础类`BaseRetriever`，并规定相关接口，具体逻辑实现由各自实现类完成。

此外，检索器最终是作为 LLM 链上的一个组件使用的。所以，检索器也是一个`Runnable`对象，在[《LCEL：轻松构建复杂 LLM 链》](https://juejin.cn/book/7352849785881591823/section/7352518697464660022)中我们介绍过，`Runnable`的执行入口是`invoke`方法。

所以，我们从`BaseRetriever.invoke()`方法开始，看看检索器的执行流程：

```python
class BaseRetriever(RunnableSerializable[RetrieverInput, RetrieverOutput], ABC):
    def invoke(self, input: str, ...) -> List[Document]:
        ...
        return self.get_relevant_documents(
            input,
            ...
        )

    def get_relevant_documents(...) -> List[Document]:
        run_manager = callback_manager.on_retriever_start(...)
        ...
        result = self._get_relevant_documents(...)
        ...
        run_manager.on_retriever_end(result)
        return result
    
    @abstractmethod
    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
```


从上面代码可以简单看出，检索器的调用路径为：`invoke` -> `get_relevant_documents` -> `_get_relevant_documents`。其中，`get_relevant_documents`在检索开始前和返回数据后注册了回调事件，真正执行检索的逻辑是`_get_relevant_documents`，这也是每个具体的检索器需要实现的方法。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fff569c7915d43f8981c8142a6e7054d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1368&h=818&s=105235&e=png&b=ffffff" alt="image.png"  /></p>




## VectorStoreRetriever（矢量存储检索器）

`VectorStoreRetriever`是基于 `VectorStore`实现的检索器，由`VectorStore.as_retriever`方法创建。

```python
class VectorStore(ABC):
    def as_retriever(self, **kwargs: Any) -> VectorStoreRetriever:
        ...
        return VectorStoreRetriever(vectorstore=self, **kwargs, ...)
```


`VectorStoreRetriever`是`VectorStore`的一个轻量检索包装器，在`as_retriever`中，`VectorStore`将本身实例作为入参传入，创建一个`VectorStoreRetriever`对象，在`VectorStoreRetriever._get_relevant_documents`中，会使用`VectorStore`实现的搜索方法来查询向量存储中的文本。


```python
class VectorStoreRetriever(BaseRetriever):
    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        # 使用语义相似性搜索
        if self.search_type == "similarity":
            docs = self.vectorstore.similarity_search(query, **self.search_kwargs)
        # 限制相似度分数搜索
        elif self.search_type == "similarity_score_threshold":
            docs_and_similarities = (
                self.vectorstore.similarity_search_with_relevance_scores(
                    query, **self.search_kwargs
                )
            )
            docs = [doc for doc, _ in docs_and_similarities]
        # 最大边际相关性搜索
        elif self.search_type == "mmr":
            docs = self.vectorstore.max_marginal_relevance_search(
                query, **self.search_kwargs
            )
        else:
            raise ValueError(f"search_type of {self.search_type} not allowed.")
        return docs
```

在`VectorStoreRetriever`中，支持使用`similarity`、`similarity_score_threshold`、`mmr`三种不同的搜索方式（search_type 可在`VectorStore.as_retriever`中传入）。

下面，我们将通过一个例子，重点介绍这几种搜索方式的区别。


在开始之前，我们先完成一些准备工作：

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma


texts = [
    "我家的狗全身大部分都是黑色的，但尾巴是白色的，特别喜欢出去玩",
    "我家狗狗身上黑乎乎的，就尾巴那一块儿白，它老爱往外跑",
    "我家的猫全身黑色，也很喜欢出门",
    "夏天特别适合游泳"
]

vector_store = Chroma.from_texts(texts, embedding=OpenAIEmbeddings())

question = "简单描述下我家的狗"
```


我们准备了 4 个句子，将它们向量化后存入 Chroma 中。还准备了一个问题。



### 语义相似性搜索（similarity）

现在，我们直接使用相似性搜索去 Chroma 中查找与问题最相关的 3 个答案：

```python
retriever = vector_store.as_retriever(search_type ="similarity", search_kwargs={"k": 3})
print(retriever.get_relevant_documents(question))
```
```python
[Document(page_content='我家的狗全身大部分都是黑色的，但尾巴是白色的，特别喜欢出去玩'), 
Document(page_content='我家狗狗身上黑乎乎的，就尾巴那一块儿白，它老爱往外跑'), 
Document(page_content='我家的猫全身黑色，也很喜欢出门')]
```


我们可以看到，由于我们指定了返回 3 个答案，所以即使句子 3（“我家的猫全身黑色，也很喜欢出门”）的相关性比较小，也会被返回。



### 限制相似度阈值（similarity_score_threshold）



在语义搜索中，算法会分析两个文本之间的相似度，并给出一个 0 到 1 的数值，数值越接近 1，表示两者越相似。因此，我们可以设定一个阈值，用于判断搜索结果的相关性，只有当文档与问题的相似度大于阈值，才会作为结果返回。

在`VectorStoreRetriever`中，我们可以通过指定`search_type = "similarity_score_threshold"`，并在
`search_kwargs.score_threshold`传入阈值。

下面，我们看看具体效果：

```python
retriever = vector_store.as_retriever(search_type ="similarity_score_threshold", search_kwargs={"k": 3, "score_threshold": 0.78})
print(retriever.get_relevant_documents(question))
```
```python
[Document(page_content='我家的狗全身大部分都是黑色的，但尾巴是白色的，特别喜欢出去玩'), 
Document(page_content='我家狗狗身上黑乎乎的，就尾巴那一块儿白，它老爱往外跑')]
```

`score_threshold`就相当一个过滤器，在语义相似性搜索完成后，将其中相似性较低的内容过滤掉再返回。



### 最大边际相关性搜索（MMR）


上面的例子中，由于句子 1 和句子 2 的相似度比较高，所以都会作为答案返回。但这其实是有问题的，仔细观察这两个句子，会发现它们的语义内容一模一样，只要返回其中一个就已经足够了。

**Maximum Marginal Relevance** 是一种用于改进搜索结果相关性的算法，在评估一个文档时，不仅会计算文档与问题之间的相关性，还会考虑文档与已选文档列表的相似度，避免搜索的结果列表中有过于相似的内容，保证结果的多样性和全面性。

因此，当文档列表中有过多重复内容时，我们可以考虑使用 MMR 算法进行搜索，避免冗余结果，提高搜索质量。

```python
retriever = vector_store.as_retriever(search_type ="mmr", search_kwargs={"k": 2})
print(retriever.get_relevant_documents(question))
```
```python
[Document(page_content='我家的狗全身大部分都是黑色的，但尾巴是白色的，特别喜欢出去玩'), 
Document(page_content='夏天特别适合游泳')]
```

这里我们看到只返回了句子 1，没有返回句子 2。另外，句子 4 和句子 3 相比，句子 4 的相关性评分比较小，但为了增加结果的多样性，MMR 算法还是选择了句子 4。




## MultiQueryRetriever（多查询检索器）

基于距离的向量数据库检索方法十分依赖用户的提问方式和提问质量，比如，用户想要查找有关 “人工智能” 的资料，但他使用了不同的查询词，如“AI”、“机器智能”或“智能系统”。这时候向量检索可能无法准确地识别这些词之间的语义关联，从而导致检索结果不完整。

既然一种提问无法覆盖全部的文档，那我们换着法多提问几次就好了。`MultiQueryRetriever`就是这么干的，它先将用户的问题使用 LLM 从不同角度生成多个类似的问题，然后再将这些问题全部进行向量检索，每个问题都会返回一组文档列表，将多组文档列表去重后作为最终的查询结果，从而获得更丰富的结果集。

注意上面的“将这些问题全部进行向量检索”，`MultiQueryRetriever`在初始化时，需要传入一个检索器实例，用于实际检索。可以将`MultiQueryRetriever`理解为其他检索器的一种包装或增强。

完整流程图如下：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/88bf496b42254516b3a377c60ea08ce6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2414&h=788&s=121522&e=png&b=ffffff" alt="image.png"  /></p>

下面我们来看看`MultiQueryRetriever`中用于生成多个问题的提示模板是怎么写的：

```python
template=
"""
You are an AI language model assistant. Your task is 
    to generate 3 different versions of the given user 
    question to retrieve relevant documents from a vector  database. 
    By generating multiple perspectives on the user question, 
    your goal is to help the user overcome some of the limitations 
    of distance-based similarity search. Provide these alternative 
    questions separated by newlines. Original question: {question}
"""
```


翻译如下：

```shell
你是一位人工智能语言模型助手。您的任务是为给定的用户问题生成3个不同版本，以便从向量数据库中检索相关文档。通过针对用户问题生成多种视角，您的目标是帮助用户克服基于距离的相似性搜索的一些局限性。请在换行符分隔的情况下提供这些替代问题。原始问题：{question}
```


我们使用前面小节中的`VectorStoreRetriever`作为底层检索器，演示下`MultiQueryRetriever`的具体使用：

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_openai import ChatOpenAI

texts = [...]
vector_store = Chroma.from_texts(texts, embedding=OpenAIEmbeddings())
vector_store_retriever = vector_store.as_retriever(search_type ="mmr", search_kwargs={"k": 2})

multi_query_retriever = MultiQueryRetriever.from_llm(
    retriever=vector_store_retriever, llm=ChatOpenAI()
)
```


我们可以通过设置 logger 日志的打印级别，来观察生成的几个问题：

```python
import logging

logging.basicConfig()
# 注意下面的 logger 名称不能写错
logging.getLogger("langchain.retrievers.multi_query").setLevel(logging.INFO)

print(multi_query_retriever.get_relevant_documents("简单描述下我家的狗"))
```
```shell
INFO:langchain.retrievers.multi_query:Generated queries: 
['1. 我家的狗有什么特点？', '2. 我家狗的品种是什么？', '3. 我家狗的性格如何？']
...
```


可以看到，通过 LLM，生成了不同角度的几个问题。



## SelfQueryRetriever（自查询检索器）

我们在[《LLM 与私域数据的结合（一）：文档加载》](https://juejin.cn/book/7352849785881591823/section/7353140543268290570)中介绍 `Document` 对象时提到过除了 `page_content`属性用于存储文档内容外，还有一个`metadata`属性，用于记录文档的元信息。

而在将文档存储进向量数据库时，会将这些元信息一并存储。

```python
class VectorStore(ABC):
    @classmethod
    @abstractmethod
    def from_texts(
        cls: Type[VST],
        texts: List[str],
        embedding: Embeddings,
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> VST:
```

查询时，向量数据库基本上都支持先按元信息进行过滤，再根据问题进行语义搜索。有时候这能大幅度降低检索的范围，加快查询速度，提高查询精度。

比如，我们加载了 `A.pdf`和 `B.pdf`两个文件，我们如果提前知道问题的答案只会出现在`A.pdf`中，查询时可以附带`where source = "A.pdf"`，避免数据库搜索`B.pdf`相关的内容。

`SelfQueryRetriever`正是基于这个思路，先将用户的问题利用 LLM 提取其中可能出现的元信息，构成过滤器，在实际查询时带上这个过滤器。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e95a0e87f9864a4fbab6e536911ebe00~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2270&h=542&s=80577&e=png&b=ffffff" alt="image.png"  /></p>


不同向量数据库的过滤器语法不同，所以，需要有一层`Query Translator`，将过滤条件转换成所用向量数据库的写法。

上面流程中使用 LLM 提取元信息的 prompt 比较长，这里不做展开，感兴趣的同学可以在[这里查看](https://github.com/langchain-ai/langchain/blob/v0.1.13/libs/langchain/langchain/chains/query_constructor/prompt.py)，其中的`DEFAULT_SCHEMA`就是使用的模板内容。

下面，我们将简单介绍`SelfQueryRetriever`的使用。

我们会以这篇介绍 ReAct 的 [pdf 论文](https://arxiv.org/pdf/2210.03629.pdf)进行演示。首先，我们先使用`PyPDFLoader`对论文进行加载，然后存储到 Chroma 数据库中。

```python
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

loader = PyPDFLoader("ReAct.pdf")
pages = loader.load()

Chroma.from_documents(documents=pages, embedding=OpenAIEmbeddings(), persist_directory="./chroma_db")
```


加载完成后，我们以后可以直接使用以下方法，避免每次都重复加载过程。

```python
vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=OpenAIEmbeddings())
```

创建`SelfQueryRetriever`时，我们需要先声明元信息字段列表，用于告诉 LLM 可以从问题中提取哪些元信息数据用于过滤查询。

对于当前例子，我们可以观察到 Document 有`page`和`source`两个元信息字段。

```python
[Document(page_content="xxx", metadata={'page': 1, 'source': 'ReAct.pdf'})]
```


我们可以创建以下列表：

```python
from langchain.chains.query_constructor.base import AttributeInfo
metadata_field_info = [
    AttributeInfo(
        name="page",
        description="The page number of the document.",
        type="integer",
    ),
    AttributeInfo(
        name="source",
        description="The source of the document.",
        type="string"
    )
]
```
其中，`name`表示字段名称；`description`表示字段信息描述；`type`表示字段类型。

下一步，我们使用`SelfQueryRetriever.from_llm`初始化一个自查询检索器。

```python
from langchain.retrievers.self_query.base import SelfQueryRetriever
from langchain_openai import ChatOpenAI

# 文档内容描述
document_content_description = "SYNERGIZING REASONING AND ACTING IN LANGUAGE MODELS"
self_query_retriever = SelfQueryRetriever.from_llm(
    ChatOpenAI(),
    vectorstore,
    document_content_description,
    metadata_field_info,
    verbose = True
)

import logging
logging.basicConfig()
# 注意下面的 logger 名称不能写错
logging.getLogger("langchain.retrievers.self_query").setLevel(logging.INFO)
```


除了元信息描述列表`metadata_field_info`，在`from_llm`方法中我们还需要传入一个 llm 实例，用于提取问题的元信息数据；`vectorstore`用于最终向量数据库的查询；`document_content_description`是文档内容描述，这里我们直接传入论文的标题；`verbose=True`时，可以配合下面的 `logger`设置打印结构化后的查询和过滤条件。

假设现在我们想查询第二页中介绍了 ReAct 的哪些信息，将问题传入`get_relevant_documents`，看能得到什么结果：

```python
print(self_query_retriever.get_relevant_documents("I want to query something about ReAct in page 2"))
```
```python
# 日志打印出结构化后的查询信息
INFO:langchain.retrievers.self_query.base:Generated Query: query='ReAct' filter=Comparison(comparator=<Comparator.EQ: 'eq'>, attribute='page', value=2) limit=None

# 查询的结果
[Document(page_content='xxx', metadata={'page': 2, 'source': 'ReAct.pdf'})]
```


可以看到，LLM 成功从原始问题中提取出查询的过滤条件（`filter=Comparison(comparator=<Comparator.EQ: 'eq'>, attribute='page', value=2)`），最终答案也确实出自第二页文档。


## 总结

1. 从向量数据库中检索出完整准确的文档，对于构建高性能 RAG 应用有重要作用，LangChain 中的检索器设计采用 **“抽象接口 + 具体实现”** 的模式，可以方便扩展各类检索策略的检索器，满足不同的使用场景。
2. **VectorStoreRetriever（矢量存储检索器）** 是最基础的一种检索器，直接复用`VectorStore`的搜索方法，支持`语义相似性搜索（similarity）`、`限制相似度阈值搜索（similarity_score_threshold）`和`最大边际相关性搜索（mmr）`三种不同检索方式。其中，`最大边际相关性搜索（mmr）`不仅考虑文档的相关性，还会考虑结果的多样性。其他的检索器一般是`VectorStoreRetriever`的增强包装器。
3. **MultiQueryRetriever（多查询检索器）** 通过从不同角度生成多个问题来克服单一查询的局限性。它使用 LLM 生成多个问题，然后对每个问题进行向量检索，并将结果集合并去重。
4. **SelfQueryRetriever（自查询检索器）** 利用 LLM 从用户问题中提取可能的元信息，作为查询时的过滤器，通过减少检索范围来提高查询速度和精度。
