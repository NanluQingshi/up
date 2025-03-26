大家好，欢迎继续学习 LangChain 实战课程。

在前面两节课中，我们分别学习了构建 RAG 应用的文档加载和文档分割。为了读取不同类型，不同来源的外部数据，需要不同的文档加载器。当数据被加载成 LangChain 能够识别的 Document 对象后，因为原始文档可能会很大，比如 pdf 可能会有几十甚至上百页，为了方便后续的处理，需要选择合适的分块策略将原始大文档分割成尺寸较小的小文档。

文档被切成块后，会将每个块进行嵌入处理转成向量，再将其存入向量数据库中，供后续检索使用。今天，我们将会一口气学完`文本嵌入`和`向量存储`这两部分内容。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02eef880c53f4bdca0180aba6513cc0a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1956&h=1196&s=572357&e=png&b=fefdfd" alt=""  /></p>


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/635c078734ec4ea9b346c69030976087~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1878&h=850&s=128346&e=png&b=ffffff" alt="image.png"  /></p>



## 嵌入技术快速入门

### 嵌入技术基本原理

我们先简单介绍下嵌入技术的一些概念知识，让大家对后面的一些选型和评估指标能有更好的了解。

嵌入技术是自然语言处理（NLP）领域中的一项关键技术，它能将输入的内容经过分析，拆分成不同维度的多个标签，并将这些标签表示为浮点数，最终，这些浮点数组成一组多维向量。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/33d40ccdc8a64eb88098d042121e82fc~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1210&h=446&s=50420&e=png&b=ffffff" alt=""  /></p>

语义相近的两个词，其生成的向量在空间中比较靠近，计算机通过综合比较两个文本在不同维度的向量之间的距离，可以理解两个文本之间的相关性。

比如，我们有以下三个句子：

1.  我喜欢吃苹果；
1.  他喜欢吃香蕉；
1.  俩小孩在公园玩耍。

提取句子的维度标签信息，并进行向量化后，将向量数据描绘在图表上，结果会类似下图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/862c7a84669f478d8ff20606605cf6a0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1252&h=650&s=42774&e=png&b=ffffff" alt=""  /></p>

可以看到，将三个句子向量化后，由于句子 1 和句子 2 的含义接近，所以它们在图上位置彼此比较靠近。当我们搜索“他喜欢吃什么水果？”时，句子 1 和句子 2 都带有“水果”属性，其中句子 2 描述的对象是“他”，所以最终句子 2 会被检索到。

上面例子中，我们只有两个维度，但实际上的嵌入模型，可能会有成百上千个维度，比如 OpenAI 的嵌入模型 text-embedding-ada-002，有 1536 个维度；开源的 GRITLM-7B 嵌入模型更有 4096 个维度。

维度越多，计算机理解文本语义越准确，但嵌入和检索需要的计算资源和耗时也会更多，所以我们必须基于自己的业务文档数据，在检索的准确性和资源消耗之间做出权衡。



### 如何挑选嵌入模型

随着 AI 技术的爆火，嵌入技术也在快速发展，每天都有新的嵌入模型涌现，但这么多嵌入模型，我们该如何选择呢？

Niklas Muennighoff 等人提出了 [MTEB（Massive Text Embedding Benchmark）海量文本嵌入基准测试](https://arxiv.org/abs/2210.07316)，它收集了 58 个公开数据集，涵盖了 112 种语言，设计了文本分类、聚类、检索、文本相似性等 8 个测试任务，用于评估文本嵌入模型的性能。

MTEB 在 GitHub 上开源了[代码](https://github.com/embeddings-benchmark/mteb)和使用方法，我们可以轻松地使用这些数据集对指定模型进行评估。

此外，MTEB 还在 Hugging Face 上设有[公共排行榜](https://huggingface.co/spaces/mteb/leaderboard)，我们可以在上面找到各种文本嵌入模型及其 MTEB 各项指标的统计数据。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5a2e207be3894793a9cfead8b87d4f64~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2578&h=1332&s=367518&e=png&b=ffffff" alt=""  /></p>

在这里介绍构建 RAG 系统时，我们比较关注的几个指标：

-   **Retrieval Average（检索平均值）**。表示检索结果与查询问题的相关性，相关性越高，Retrieval Average 排名越靠前。

-   **Embedding Dimensions（嵌入维度）**。嵌入时的维度数量，较少的嵌入维度能够提供更快的嵌入速度和更高的存储效率，而更多的维度可以捕获数据中的细微差别，提供更准确的检索结果，但也会需要更多的检索耗时和消耗更多的计算资源，我们需要在数据的复杂度和检索性能之间做好权衡。

-   **Model Size（模型大小）**。给出了运行模型所需的计算资源，以 GB 为单位，一般来说，嵌入维度越多，模型越大。

-   **Max Tokens（最大令牌数）**。模型单个嵌入能支持的最大令牌数，由于我们此前已经对数据分割成多个小文档块，所以这个一般不会作为我们选择的一个指标，相反，在前一步的文档分割策略中，需要考虑所使用的嵌入模型最大的令牌数。


  


另外，上面的嵌入模型排行榜是基于 MTEB 公开的数据集得到的排名，其统计结果可能与我们实际使用的数据集有差异，所以，更好的做法是先根据我们所关心的指标，在排行榜上挑选几个较靠前的模型，然后使用我们自己的数据集再次对其进行评估测试，找到效果最好的嵌入模型。

在构建 RAG 系统中，评估一个嵌入模型，我们一般从 Embedding latency（嵌入延迟）和 Retrieval quality（检索质量）两个角度考虑。

-   Embedding latency（嵌入延迟）：文本向量化所需要的时间。
-   Retrieval quality（检索质量）：检索结果与问题之间的相关性。





## LangChain 中进行文本嵌入

### `Embeddings` 类

LangChain 设计了抽象类`Embeddings`，专门用于与文本嵌入模型交互，该类有`embed_documents`和`embed_query`两个比较重要的方法，分别用于对多个文档和单个查询文本进行嵌入操作，生成对应的向量数据。

```python
class Embeddings(ABC):
    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed search docs."""

    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Embed query text."""
```

`Embeddings`类为各种嵌入模型接入 LangChain 提供了统一的接口。嵌入模型可以通过实现`Embeddings`类，创建自己的嵌入类。LangChain 中已经集成了 OpenAI、Cohere 等几十种嵌入模型，我们可以开箱即用。具体列表可以点击[这里](https://python.langchain.com/docs/integrations/text_embedding/)查看。

我们下面以`OpenAIEmbeddings`为例详细学习下嵌入模型在 LangChain 中的实现和使用。

```python
class OpenAIEmbeddings(BaseModel, Embeddings):
    ...
    model: str = "text-embedding-ada-002"
    ...
    def embed_documents(
        self, texts: List[str], chunk_size: Optional[int] = 0
    ) -> List[List[float]]:
        # self.deployment = self.model
        engine = cast(str, self.deployment)
        # 为每个文本创建嵌入
        return self._get_len_safe_embeddings(texts, engine=engine)
    
    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]
    
    ...
```

`OpenAIEmbeddings`默认使用 OpenAI 的 text-embedding-ada-002 作为嵌入模型，在`embed_documents`中调用`_get_len_safe_embeddings`进行嵌入操作；而`embed_query`只是简单调用`embed_documents`实现单文本的嵌入。

```python
from langchain_openai import OpenAIEmbeddings

embeddings_model = OpenAIEmbeddings()
embeddings = embeddings_model.embed_documents(
    [
        "Hi there!",
        "Oh, hello!",
        "What's your name?",
        "My friends call me World",
        "Hello World!"
    ]
)
print(len(embeddings)) # 5 
print(len(embeddings[0])) # 1536
```

可以看到，`embeddings_model`对每个文本都进行了嵌入操作。text-embedding-ada-002 模型有 1536 个嵌入维度，所以，每个文本最终都转换成 1536 个向量值。



### CacheBackedEmbeddings

考虑下面使用场景：

```python
from langchain_openai import OpenAIEmbeddings

embeddings_model = OpenAIEmbeddings()
text = "What's your name?"
embedded1 = embeddings_model.embed_documents([text])
...
embedded2 = embeddings_model.embed_documents([text])
```

由于某些业务需要，对同一个文本数据进行了两次嵌入，这个时候会重复调用两次嵌入模型，这会白白浪费计算资源，增加系统耗时。

为了避免重复嵌入计算，LangChain 设计了一个嵌入类包装器`CacheBackedEmbeddings`，在文本首次调用模型进行嵌入后，会将文本和嵌入结果以 K-V 形式存储起来。在文本下次需要嵌入时，可以从缓存中直接返回。

下面我们看看`CacheBackedEmbeddings`是如何设计实现的：

```python
class CacheBackedEmbeddings(Embeddings):
    def __init__(
        ...
        underlying_embeddings: Embeddings,
        document_embedding_store: BaseStore[str, List[float]],
        ...
    ) -> None:
    
    ...
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # 尝试从缓存中获取texts列表的嵌入缓存
        vectors: List[Union[List[float], None]] =                       
            self.document_embedding_store.mget(
            texts
        )
        # 过滤出缓存查询不到的文本序号
        all_missing_indices: List[int] = [
            i for i, vector in enumerate(vectors) if vector is None
        ]

        for missing_indices in batch_iterate(self.batch_size, all_missing_indices):
            missing_texts = [texts[i] for i in missing_indices]
            # 调用嵌入模型对文本进行批量嵌入操作
            missing_vectors = self.underlying_embeddings.embed_documents(missing_texts)
            # 缓存嵌入结果
            self.document_embedding_store.mset(
                list(zip(missing_texts, missing_vectors))
            )
            # 将嵌入结果合并到最终结果数组中
            for index, updated_vector in zip(missing_indices, missing_vectors):
                vectors[index] = updated_vector

        return cast(
            List[List[float]], vectors
        )  # Nones should have been resolved by now
        
    def embed_query(self, text: str) -> List[float]:
        # 直接调用嵌入模型，不从缓存获取
        return self.underlying_embeddings.embed_query(text)
```

上面`CacheBackedEmbeddings`的实现代码中，有几个点我们需要注意。

-   **继承抽象类 Embeddings**

`CacheBackedEmbeddings`继承自`Embeddings`，所以，对外看来`CacheBackedEmbeddings`还是一个嵌入模型类，我们可以很轻易地将无缓存版的嵌入模型类实例传入`underlying_embeddings`变量，替换成对应的`CacheBackedEmbeddings`实例。

-   **支持多种缓存存储方式**

成员变量`document_embedding_store`代表用于缓存嵌入结果的存储对象。该对象是一个`BaseStore`实例，`BaseStore`是一个抽象类，设计了`mget`、`mset`、`mdelete`等多个抽象方法，用于管理嵌入缓存。

```python
class BaseStore(Generic[K, V], ABC):
    @abstractmethod
    def mget(self, keys: Sequence[K]) -> List[Optional[V]]:
        """Get the values associated with the given keys."""

    @abstractmethod
    def mset(self, key_value_pairs: Sequence[Tuple[K, V]]) -> None:
        """Set the values for the given keys."""
    
    @abstractmethod
    def mdelete(self, keys: Sequence[K]) -> None:
        """Delete the given keys and their associated values."""
    
    @abstractmethod
    def yield_keys(
        self, *, prefix: Optional[str] = None
    ) -> Union[Iterator[K], Iterator[str]]:
    """Get an iterator over keys that match the given prefix."""
```

这样，不同的存储介质（比如 MySQL、Redis、内存、本地文件等）可以继承`BaseStore`，就能实现不同方式的存储。

当然，“贴心”的 LangChain 已经为我们实现了常见的几种存储方式：

```python
# langchain.storage
__all__ = [
    "EncoderBackedStore",
    "InMemoryStore",
    "InMemoryByteStore",
    "LocalFileStore",
    "RedisStore",
    "create_lc_store",
    "create_kv_docstore",
    "UpstashRedisByteStore",
    "UpstashRedisStore",
]
```

-   **`embed_query`** **不使用缓存，直接调用嵌入模型**

`embed_query`主要用于查询问题的嵌入，之所以没有先从缓存中尝试获取，主要是考虑到查询问题一般具有扩散性和不确定性。用户的问题有可能千奇百怪，同一个问题也有可能会有多种问法，所以，对问题的嵌入结果进行缓存意义不大，反而会影响查询效率。

现在，我们演示下`CacheBackedEmbeddings`的使用，并看下其效果：

```python
import time
from langchain_openai import OpenAIEmbeddings
from langchain.embeddings import CacheBackedEmbeddings
from langchain.storage import LocalFileStore
embeddings_model = OpenAIEmbeddings()
store = LocalFileStore("./cache/")

cached_embedder = CacheBackedEmbeddings.from_bytes_store(embeddings_model, store)

text = "What's your name?"
start_time = time.time()
embedded1 = cached_embedder.embed_documents([text])
embedded1_end_time = time.time()
embedded1_cost_time = embedded1_end_time - start_time
print(f"Time taken for first embedding: {embedded1_cost_time} seconds")
embedded2 = cached_embedder.embed_documents([text])
print(f"Time taken for second embedding: {time.time() - embedded1_end_time} seconds")
```

```
Time taken for first embedding: 0.6359801292419434 seconds
Time taken for second embedding: 0.0006630420684814453 seconds
```

`LocalFileStore`是 LangChain 基于本地文件实现的一个缓存存储类，可以看到，使用`CacheBackedEmbeddings`后，第二次嵌入的效率有了很大的提升。




## 向量存储

文档块通过嵌入后得到对应向量，下一步就是将这些向量存储到数据库中，供后续检索查询。

向量数据库的种类有很多，比如 Chroma、Faiss、Pinecone 等，LangChain 集成了市面上常见的向量数据库，集成的方式还是跟之前其他组件一样，设计一个抽象类`VectorStore`，提供了同一的接口，具体的实现由各自数据库负责。

下面我们具体介绍`VectorStore`几个比较常见的方法。

```python
class VectorStore(ABC):
    # 将原始文本列表向量化后追加到数据库
    @abstractmethod
    def add_texts(
        self,
        texts: Iterable[str],
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> List[str]:

    # 删除数据库中指定文本
    def delete(self, ids: Optional[List[str]] = None, **kwargs: Any) -> Optional[bool]:
    
    # 将文档对象列表向量化后追加到数据库
    def add_documents(self, documents: List[Document], **kwargs: Any) -> List[str]:
        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        return self.add_texts(texts, metadatas, **kwargs)
    
    # 查询函数，支持similarity（相似性搜索）和mmr（最大边际相关性搜索）两种检索方式
    def search(self, query: str, search_type: str, **kwargs: Any) -> List[Document]:
        """Return docs most similar to query using specified search type."""
        if search_type == "similarity":
            return self.similarity_search(query, **kwargs)
        elif search_type == "mmr":
            return self.max_marginal_relevance_search(query, **kwargs)
        else:
            raise ValueError(
                f"search_type of {search_type} not allowed. Expected "
                "search_type to be 'similarity' or 'mmr'."
            )
    
    # 将原始文本列表向量化后存入数据库
    @classmethod
    @abstractmethod
    def from_texts(
        cls: Type[VST],
        texts: List[str],
        embedding: Embeddings,
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> VST:

    # 将文档对象列表向量化后存入数据库
    @classmethod
    def from_documents(
        cls: Type[VST],
        documents: List[Document],
        embedding: Embeddings,
        **kwargs: Any,
    ) -> VST:
        texts = [d.page_content for d in documents]
        metadatas = [d.metadata for d in documents]
        return cls.from_texts(texts, embedding, metadatas=metadatas, **kwargs)
```

从上面方法中可以发现，`VectorStore`在存储时并不直接接收向量值，而是传入原始文本或`Document`对象。所以，上面嵌入小节介绍的向量数据库需要实现自己的`similarity_search`和`max_marginal_relevance_search`来支持查询；实现`delete`来支持删除；实现`add_texts`和`from_texts`来支持数据的存储。而`add_documents`和`from_documents`只是为了方便对接前面文档加载器和分割器得到的`Document`对象，最终是调用`add_texts`和`from_texts`。

> `similarity_search`和`max_marginal_relevance_search`的区别和使用场景我们留到下节再详细介绍。

  


### Chroma 安装使用

下面，我们以 Chroma 为例，介绍一下 LangChain 中向量数据库的使用。

Chroma 是一个开源的嵌入式向量数据库，它足够简单，性能也足够快，运行时，会将数据保存在本地磁盘中。安装 Chroma 很简单，直接 pip 安装即可。

```shell
pip install chromadb
```

Chroma 提供了常见的增删改查的数据库操作的 API，LangChain 基于这些接口，开发了 Chroma 的 `VectorStore`实现。

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
import bs4
from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
loader = WebBaseLoader(
    web_path="https://www.gov.cn/jrzg/2013-10/25/content_2515601.htm",
    bs_kwargs=dict(parse_only=bs4.SoupStrainer(
            class_=("p1")
        ))
)
docs = loader.load()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=200)
splits = text_splitter.split_documents(docs)

persist_directory = "db/chroma"

vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=OpenAIEmbeddings(), 
    persist_directory=persist_directory
)
```

我们使用《消费者权益保护法》内容进行演示。

-   `persist_directory`：数据落库的存储路径，若指定的路径不存在，会自动创建该目录；默认为空，表示不落库，数据仅加载到内存中。

  


运行后，我们可以在脚本所在目录下看到一个名为 `db/chroma` 的文件夹，里面包含了 Chroma 数据库的相关文件。

  


### 重复存储

考虑以下代码场景：

```python
...
vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=OpenAIEmbeddings(), 
    persist_directory=persist_directory
)
vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=OpenAIEmbeddings(), 
    persist_directory=persist_directory
)
```

上面对同一文档列表`splits`执行了两次相同的落库操作，会导致数据库重复存储了两份相同的数据，这不仅浪费了存储空间，还会对后续的检索造成影响。因为可能检索到两个相同的文档块。

因此，在使用向量数据库存储数据时，避免重复数据入库是一个重要的考虑因素。避免重复存储的手段有很多，比如，我们可以维护一个 hash 过滤器，为每个文档块生成一个 hash 值，在插入前检查过滤器中是否已存在相同的哈希值，如果相同就不再插入。

Chroma 中添加/更新数据时，支持传入文档 id 参数，我们可以先为每个文档块生成一个唯一的 id，这样就可以避免重复入库。

```python
class Chroma(VectorStore):
    @classmethod
    def from_documents(
        ...
        ids: Optional[List[str]] = None,
        ...
    )
```



### 相似性搜索

插入数据后，我们可以直接使用`VectorStore.similarity_search`进行相似性搜索，找到与查询文本最相关的文档。

```python
query = "经营者有什么义务?"
docs_resp = vectorstore.similarity_search(query=query, k=2)
print(len(docs_resp)) # 2
print(docs_resp[0].page_content)
"""
第三章 经营者的义务
    第十六条 经营者向消费者提供商品或者服务，应当依照本法和其他有关法律、法规的规定履行义务。
    经营者和消费者有约定的，应当按照约定履行义务，但双方的约定不得违背法律、法规的规定。
    经营者向消费者提供商品或者服务，应当恪守社会公德，诚信经营，保障消费者的合法权益；不得设定不公平、不合理的交易条件，不得强制交易。
    第十七条 经营者应当听取消费者对其提供的商品或者服务的意见，接受消费者的监督。
    ...
"""
```

可以看到，通过`similarity_search`方法，我们已经检索出与“经营者义务”最相关的 2 个文档。




## 总结

1.  嵌入技术能够将文本转换为多维向量，使得语义相近的文本在向量空间中距离较近。这样，通过计算向量之间的距离，可以评估文本间的相关性。
1.  Hugging Face 的 MTEB 排行榜上有最新的嵌入模型及其评估指标，我们可以先在上面按照自己的需求场景挑选意向指标较高的模型，然后使用自己的数据集进一步测试，选择最优的模型。
1.  LangChain 提供了 Embeddings 抽象类，用于集成不同的文本嵌入模型。同时，为了避免重复的嵌入计算，设计了 CacheBackedEmbeddings 类，通过缓存嵌入结果来提高效率。当需要嵌入相同的文本时，可以直接从缓存中获取，不需要重新计算。
1.  文档块嵌入后得到的向量需要存储在向量数据库中。LangChain 集成了多种向量数据库，并通过`VectorStore`抽象类提供统一的管理接口。在使用向量数据库时，应注意避免重复存储，可以提前为文档块生成唯一的文档 id 来确保数据的唯一性。