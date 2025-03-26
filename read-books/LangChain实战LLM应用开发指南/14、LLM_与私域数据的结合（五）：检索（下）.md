大家好，欢迎继续学习 LangChain 实战课程。

上节课，我们介绍了`MultiQueryRetriever`和`SelfQueryRetriever`，这两种检索器的特点是在实际检索前，先对查询进行一些预处理。

今天，我们继续学习剩下几种作用于其他环节的检索器。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b89152f324264cebb025d438d5e1f87a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1688&h=520&s=71797&e=png&b=ffffff" alt="image.png"  /></p>




## ContextualCompressionRetriever

`ContextualCompressionRetriever`要解决的问题是检索回来的文档数量太多，或文档太大，导致查询问题的相关信息只占返回文档很小一部分。将大量不相关的文档全部传给 LLM，不仅会增加调用成本，还会降低响应质量。

我们先看看下面例子：

```python
texts = [
    "LLM是一种基于大量文本数据训练的深度学习模型，它能够捕捉语言的复杂性和多样性。通过学习，LLM能够理解用户的输入，并生成连贯、准确的文本回复。这种模型通常具有数十亿甚至数万亿个参数，使其能够处理复杂的语言任务。LLM可以作为聊天机器人，提供24/7的客户支持，回答客户的常见问题，提高服务效率;程序员可以利用LLM辅助编写和优化代码，提高开发效率。随着技术的进步，LLM将在更多领域得到应用，为人们的工作和生活带来便利。同时，开发者也需要关注模型的伦理和社会责任问题，确保技术的健康发展。",
    "今天天气真好"]
vectorstore = Chroma.from_texts(texts, OpenAIEmbeddings())
# 使用语义相似度检索 top2 的文档
base_retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 2})
original_docs = base_retriever.get_relevant_documents("LLM对程序员有什么帮助？")
print("original_docs: ", original_docs)
```
```shell
original_docs:  [Document(page_content='LLM是一种基于大量文本数据训练的深度学习模型，它能够捕捉语言的复杂性和多样性。通过学习，LLM能够理解用户的输入，并生成连贯、准确的文本回复。这种模型通常具有数十亿甚至数万亿个参数，使其能够处理复杂的语言任务。LLM可以作为聊天机器人，提供24/7的客户支持，回答客户的常见问题，提高服务效率;程序员可以利用LLM辅助编写和优化代码，提高开发效率。随着技术的进步，LLM将在更多领域得到应用，为人们的工作和生活带来便利。同时，开发者也需要关注模型的伦理和社会责任问题，确保技术的健康发展。'), Document(page_content='今天天气真好')]
```

由于我们在查询时，强制指定返回 2 个文档，所以即使有个完全不相关的文档，也会被返回。

`ContextualCompressionRetriever`的解决思路是**对检索到的文档进行一次 “裁剪”，只保留与查询问题强相关的文档内容**。

我们可以简单看下其`_get_relevant_documents`的实现：

```python
class ContextualCompressionRetriever(BaseRetriever):
    # 压缩器，用于检索后裁剪文档
    base_compressor: BaseDocumentCompressor
    # 实际检索使用的检索器
    base_retriever: BaseRetriever
    ...

    def _get_relevant_documents(
        self,
        query: str,
        ...
    ) -> List[Document]:
        docs = self.base_retriever.get_relevant_documents(query, ...)
        if docs:
            compressed_docs = self.base_compressor.compress_documents(
                docs, query, ...
            )
            return list(compressed_docs)
        else:
            return []
```


上面代码很简单，在检索得到文档列表后，调用压缩器的`compress_documents`方法，得到精简后的文档列表。所以，理解`ContextualCompressionRetriever`的关键，在于这些文档压缩器（DocumentCompressor）。


**LLMChainFilter**

`LLMChainFilter`是一种最简单的文档压缩器，它会遍历检索得到的文档列表，利用 LLM 进行判断，只保留与问题相关的文档块。其使用到的 prompt 如下：
```python
prompt_template = """Given the following question and context, return YES if the context is relevant to the question and NO if it isn't.

> Question: {question}
> Context:
>>>
{context}
>>>
> Relevant (YES / NO):"""
"""
翻译后：
给定以下问题和上下文，如果上下文与问题相关，则返回YES；如果不相关，则返回NO。

> 问题：{question}
> 上下文：
>>>
{context}
>>>
相关（YES/NO）：
"""
```


下面我们看看使用`LLMChainFilter`后，得到的结果有什么不同。

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_openai import OpenAI
from langchain.retrievers.document_compressors import LLMChainFilter
compressor = LLMChainFilter.from_llm(llm)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor, base_retriever=base_retriever
)
docs = compression_retriever.get_relevant_documents("LLM对程序员有什么帮助？")
print(docs)
```
```shell
[Document(page_content='LLM是一种基于大量文本数据训练的深度学习模型，它能够捕捉语言的复杂性和多样性。通过学习，LLM能够理解用户的输入，并生成连贯、准确的文本回复。这种模型通常具有数十亿甚至数万亿个参数，使其能够处理复杂的语言任务。LLM可以作为聊天机器人，提供24/7的客户支持，回答客户的常见问题，提高服务效率;程序员可以利用LLM辅助编写和优化代码，提高开发效率。随着技术的进步，LLM将在更多领域得到应用，为人们的工作和生活带来便利。同时，开发者也需要关注模型的伦理和社会责任问题，确保技术的健康发展。')]
```

可以看到，与问题无关的文档已经被过滤掉了。

**LLMChainExtractor**

对于原始检索器返回一个超大文档块的情况，`LLMChainFilter`还是无能为力，因为返回的文档块确实与问题有关。这个时候，我们可以考虑使用`LLMChainExtractor`，它会提取出文档块中与查询问题相关的部分。注意，**这里不是提取块的摘要，而是提取出文档块的部分原文信息。** 

其使用到的 prompt 如下：

```python
prompt_template = """Given the following question and context, extract any part of the context *AS IS* that is relevant to answer the question. If none of the context is relevant return {no_output_str}. 

Remember, *DO NOT* edit the extracted parts of the context.

> Question: {{question}}
> Context:
>>>
{{context}}
>>>
Extracted relevant parts:"""

"""
翻译后：
根据以下问题和上下文，提取与回答问题相关的上下文部分*原样*。如果没有上下文相关，返回{no_output_str}。

记住，*不要*编辑提取的上下文部分。

> 问题：{{question}}
> 上下文：
> >
{{context}}
> >
提取的相关部分：
"""
```
在上面的 prompt 中，特别强调了保持提取的原文不变，可以将`LLMChainExtractor`理解为向量检索后的二次分块和检索。

下面我们看看`LLMChainExtractor`的使用和效果：

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_openai import OpenAI

llm = OpenAI(temperature=0)
compressor = LLMChainExtractor.from_llm(llm)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor, base_retriever=base_retriever
)
docs = compression_retriever.get_relevant_documents("LLM对程序员有什么帮助？")
print(docs)
```
```shell
[Document(page_content='LLM是一种基于大量文本数据训练的深度学习模型，它能够捕捉语言的复杂性和多样性。LLM可以作为聊天机器人，提供24/7的客户支持，回答客户的常见问题，提高服务效率;程序员可以利用LLM辅助编写和优化代码，提高开发效率。随着技术的进步，LLM将在更多领域得到应用，为人们的工作和生活带来便利。同时，开发者也需要关注模型的伦理和社会责任问题，确保技术的健康发展。')]
```
可以看到，经过`LLMChainExtractor`后，不仅与问题无关的文档块被过滤掉了，剩下的文档块也经过裁剪，只保留了与问题相关的部分。



## LongContextReorder

有相关[研究](https://arxiv.org/abs/2307.03172)发现， 模型处理上下文信息的性能与相关信息在上下文中的位置有关：当相关信息出现在输入上下文的开始或结束时，性能通常最高；而当模型需要从上下文的中间检索相关信息时，性能会显著下降。 

所以，从向量数据库中查询到相关文档列表后，可以对其重新排序再传给 LLM，**将最相关的放在首尾，而把最不相关的放在中间位置，能有效提高 LLM 的响应质量**。

LangChain 提供了`LongContextReorder`来支持对文档列表的重排。下面是重排的实现代码：

```python
class LongContextReorder(BaseDocumentTransformer, BaseModel):
    def transform_documents(
        self, documents: Sequence[Document], **kwargs: Any
    ) -> Sequence[Document]:
        """Reorders documents."""
        return _litm_reordering(list(documents))
    
def _litm_reordering(documents: List[Document]) -> List[Document]:
    documents.reverse()
    reordered_result = []
    for i, value in enumerate(documents):
        if i % 2 == 1:
            reordered_result.append(value)
        else:
            reordered_result.insert(0, value)
    return reordered_result
```
上面`_litm_reordering`函数中，先将文档列表倒序，然后从头（也就是排名最低）开始，不断向新数组首尾插入文档，这样，排名较高的文档就会分布在新数组的两头。


<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/52b2a0e2c28e44459e510398fe158ea7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1656&h=642&s=104721&e=png&b=ffffff" alt="image.png"  /></p>


下面是实际代码效果：

```python
from langchain_core.documents import Document
from langchain_community.document_transformers import (
    LongContextReorder,
)

# 模拟原始检索器返回的文档列表
docs = [Document(page_content="A"), Document(page_content="B"), Document(page_content="C"), 
        Document(page_content="D"), Document(page_content="E"), Document(page_content="F"), 
        Document(page_content="G")]
        
reordering = LongContextReorder()
reordered_docs = reordering.transform_documents(docs)
print(reordered_docs)
```
```shell
[Document(page_content='A'), Document(page_content='C'), Document(page_content='E'), Document(page_content='G'), Document(page_content='F'), Document(page_content='D'), Document(page_content='B')]
```

## EnsembleRetriever

[倒数排名融合（RRF）](<https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf>)是一种用于结合多个信息检索系统文档排名的算法，通过一个简单的评分公式对文档进行排序，在多个实验表现中，RRF 能得到比任何单一系统及其他排名学习方法都要好的结果。

RRF 的原理很简单，假设我们有三个信息检索系统 A、B 和 C，它们分别对同一个查询任务返回了不同的文档排名结果：

**系统 A 的排名**：
1.  文档 1
1.  文档 2
1.  文档 3
1.  文档 4

**系统 B 的排名**：

1.  文档 3
1.  文档 1
1.  文档 4
1.  文档 2

**系统 C 的排名**：

1.  文档 2
1.  文档 4
1.  文档 1
1.  文档 3

现在，我们使用 RRF 方法来综合计算这些文档的排名。

首先，我们需要为每个文档计算一个 RRF 得分。根据 RRF 的公式，`RRFscore(d) = Σ(1/(k + r(d)))`，其中 k 是一个常数（在论文中 k 被设定为 60），r(d) 是文档在排名中的位置。

文档 1 的 RRF 得分：
-   在系统 A 中，文档 1 的排名是 1，所以 r(d) = 1；
-   在系统 B 中，文档 1 的排名是 2，所以 r(d) = 2；
-   在系统 C 中，文档 1 的排名是 3，所以 r(d) = 3。

根据 RRF 公式，文档 1 的 RRF 得分为： 

RRFscore(文档 1) = 1/(60 + 1) + 1/(60 + 2) + 1/(60 + 3) = 1/61 + 1/62 + 1/63 ≈ 0.04836

以此类推，可以计算出另外几个文档的 RRF 得分分别为：

RRFscore(文档 2) = 1/(60 + 2) + 1/(60 + 4) + 1/(60 + 1) = 1/62 + 1/64 + 1/61 ≈ 0.04814

RRFscore(文档 3) = 1/(60 + 3) + 1/(60 + 1) + 1/(60 + 4) = 1/63 + 1/61 + 1/64 ≈ 0.04789

RRFscore(文档 4) = 1/(60 + 4) + 1/(60 + 3) + 1/(60 + 2) = 1/64 + 1/63 + 1/62 ≈ 0.04762

所以，各文档的最终排名如下：

1. 文档 1
2. 文档 2
3. 文档 3
4. 文档 4

这个综合排名反映了所有三个系统对文档相关性的整体评估。通过 RRF，我们可以看到一个更加平衡和可能更准确的排名结果，它结合了不同系统的优势和减少了单个系统可能存在的偏差。

以 RRF 为理论依据，LangChain 设计了`EnsembleRetriever`，使用多个检索器查询得到多组文档列表，然后使用 RRF 算法，得到一个更准确的文档排名。



下面，我们基于官网的例子改造，使用 BM25 相关度搜索和向量语义相似度检索，看看`EnsembleRetriever`的使用效果。

> 这里简单解释下 BM25 搜索算法，它基于关键字搜索，结合词频（关键字出现的次数）、逆文档频率（关键词在整个文档中的罕见程度）、文档长度因子等因素来计算文档与查询的相关性得分。

使用 BM25，我们需要先安装依赖包`rank_bm25`：

```shell
pip install rank_bm25
```

```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

doc_list_1 = [
    "I like apples",
    "I like oranges",
    "Apples and oranges are fruits",
]

bm25_retriever = BM25Retriever.from_texts(
    doc_list_1, metadatas=[{"source": 1}] * len(doc_list_1)
)
bm25_retriever.k = 2

doc_list_2 = [
    "I like apples",
    "You like apples",
    "You like oranges",
]

vectorstore = Chroma.from_texts(
    doc_list_2, OpenAIEmbeddings(), metadatas=[{"source": 2}] * len(doc_list_2)
)

chroma_retriever = vectorstore.as_retriever(search_kwargs={"k": 2})
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, chroma_retriever], weights=[0.5, 0.5]
)

docs = ensemble_retriever.get_relevant_documents("apples")
print(docs)
```
```shell
[Document(page_content='I like apples', metadata={'source': 2}), Document(page_content='Apples and oranges are fruits', metadata={'source': 1}), Document(page_content='You like apples', metadata={'source': 2})]
```

在初始化`EnsembleRetriever`时，需要注意的是，LangChain 引入了权重(`weight`)，可以对每个检索器都分配一个权重，默认情况下，每个检索器的权重都相同。

有了权重后，每个文档最终计算分数时的公式如下：

- RRFscore(文档) = weight(检索器 A) * 1/(k + rank(检索器 A)) + weight(检索器 B) * 1/(k + rank(检索器 B)) + ...





## MultiVectorRetriever

先思考这样一个问题：嵌入文档块越大，检索时越容易找到与用户问题匹配的结果吗？

其实并不会，文档嵌入模型支持的嵌入维度是有限制的，文档越大，包含的内容越多，当其转换成固定维度的向量时，该向量可能无法涵盖文档块全部的信息，导致用户搜索不到这个文档。

那将嵌入文档设置得比较小呢？

也是会有问题的，文档较小，转换的向量虽然能够准确反映出该文档块中的内容，但小文档包含的信息比较少，检索到的答案可能会不完整。

所以，文档嵌入的大小与检索结果存在一定的矛盾性。

- 嵌入文档块过大，会丢失语义信息，导致检索结果丢失。
- 嵌入文档块过小，虽然保留了完整语义信息，但由于每一块的信息较少，也会导致结果不完整。

**使用分层策略，分开嵌入时使用的文档块和检索返回的文档块**，可以很好地解决这个问题。

这样说可能比较懵，假设现在有文档块 A，我们觉得文档块 A 包含的信息比较完整，传给 LLM 刚刚好。但直接将文档块 A 嵌入向量化，会丢失语义信息。

这个时候，我们可以使用一种转换方法，将文档块 A 拆成多个小文档，将这些小文档进行嵌入存储，向量数据库查询时，根据返回的小文档找到对应的大文档 A，作为检索结果。

这样，我们同时保证了嵌入的语义完整和最终检索结果的准确。


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0dd9971e5cd44a27954548d4a57e61e6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2034&h=1052&s=133899&e=png&b=ffffff" alt="image.png"  /></p>

针对这种解决方案，LangChain 提供了`MultiVectorRetriever`。我们直接看看该检索器的实现：

```python
class MultiVectorRetriever(BaseRetriever):
    vectorstore: VectorStore
    docstore: BaseStore[str, Document]
    id_key: str = "doc_id"
    ...
    def _get_relevant_documents(self, query: str, ...) -> List[Document]:
        ...
        sub_docs = self.vectorstore.similarity_search(query, ...)
        ...
        ids = []
        for d in sub_docs:
            if self.id_key in d.metadata and d.metadata[self.id_key] not in ids:
                ids.append(d.metadata[self.id_key])
        docs = self.docstore.mget(ids)
        return [d for d in docs if d is not None]
```


- `vectorstore`：嵌入文档和从向量数据库中查询文档所使用的向量存储对象。
- `docstore`：在《[LLM 与私域数据的结合（三）：数据嵌入与向量存储](https://juejin.cn/book/7352849785881591823/section/7353248115098386458)》中我们有介绍过`BaseStore`，这是一个 KV 设计，用于存储并管理数据的抽象类。这里用于存储原始大文档块。


在`_get_relevant_documents`执行检索时，先使用`vectorstore`查询获取子文档块列表，然后，通过子文档块中元信息的`id_key`对应的 value，在`docstore`找出对应的大文档。

现在，我们重点讲讲这个过程中大文档拆分小文档的几种常见做法。

**使用分割器进一步对文档分割**

这是最直观也是最容易理解的一种做法。嵌入时尽可能接近地捕获语义，检索时尽可能传递更多的上下文信息。

LangChain 也专门为了这种处理方案设计了`ParentDocumentRetriever`（父文档检索器）。在这里，我们仍然以`MultiVectorRetriever`进行演示：

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.storage import InMemoryByteStore
import uuid

# 原始文档列表
docs = [
    Document(page_content="LangChain is a framework for developing applications powered by large language models (LLMs)"),
    Document(page_content="Build your applications using LangChain's open-source building blocks and components. Hit the ground running using third-party integrations and Templates.Use LangSmith to inspect, monitor and evaluate your chains, so that you can continuously optimize and deploy with confidence.Turn any chain into an API with LangServe")
]

# 用于存储原始文档列表
store = InMemoryByteStore()

vectorstore = Chroma(embedding_function=OpenAIEmbeddings())
# 指定子文档metadata 中标识对应大文档的 key
id_key = "doc_id"

retriever = MultiVectorRetriever(
    vectorstore=vectorstore,
    byte_store=store,
    id_key=id_key,
)
# 为每个原始文档指定一个 id
doc_ids = [str(uuid.uuid4()) for _ in docs]
# 用于分割原始文档为小文档
child_text_splitter = RecursiveCharacterTextSplitter(chunk_size=400)
sub_docs = []
for i, doc in enumerate(docs):
    _id = doc_ids[i]
    _sub_docs = child_text_splitter.split_documents([doc])
    for _doc in _sub_docs:
        # 子文档 metadata 存储对应大文档的 id
        _doc.metadata[id_key] = _id
    sub_docs.extend(_sub_docs)
# 子文档嵌入存储到向量数据库中
retriever.vectorstore.add_documents(sub_docs)
# 原始文档存储到 docstore 中
retriever.docstore.mset(list(zip(doc_ids, docs)))

print(retriever.vectorstore.similarity_search("LangServe"))
```

**总结提炼文档块摘要**

有时候，摘要信息能有效提炼文档块的内容，保证嵌入后的语义不丢失，所以，我们可以先利用 LLM 将原始文档分点总结成多个摘要信息文档，然后再将这些摘要文档进行嵌入存储与检索查询。


具体代码与上面类似，这里不再重复。或者大家可以直接参考[官网示例](https://python.langchain.com/docs/modules/data_connection/retrievers/multi_vector/#summary)。

**构造假设查询**

最后，再介绍一种比较有趣的做法：我们通过 LLM 为每个文档块生成若干个假设的问题。参考如下提示词：

```python
"""
Generate a list of exactly 3 hypothetical questions that the below document could be used to answer:\n\n{doc}
"""
```
生成的假设问题就是我们的子文档块，下一步将这些假设问题嵌入存储。 

这种模式下，我们检索模式由`问题 -> 答案`变成`问题 -> 问题`。

使用代码也比较简单，大家可以直接参考[官网示例](https://python.langchain.com/docs/modules/data_connection/retrievers/multi_vector/#hypothetical-queries)。



## 总结

今天课程中，我们继续上节课的内容，又介绍了几种高阶的文档检索器：

1. **ContextualCompressionRetriever**：向量存储检索器返回文档列表后，会进行二次过滤，保留与问题强相关的内容。不同的过滤逻辑可以通过继承`BaseDocumentCompressor`来实现自己的文档压缩器。

2. **LongContextReorder**：通过对检索到的文档列表进行重新排序，将最相关的文档放在首尾，最不相关的放在中间，从而提高 LLM 的响应质量。

3. **EnsembleRetriever**：使用 RRF 算法结合多个检索器查询得到的文档列表，得到一个更准确的文档排名。

4. **MultiVectorRetriever**：通过将大文档拆分为多个小文档进行嵌入存储，检索时根据小文档找到对应的大文档，保证嵌入的语义完整和检索结果的准确。常见的拆分方法有：**使用分割器进一步对文档分割**、**总结提炼文档块摘要**、**构造假设查询**等。


