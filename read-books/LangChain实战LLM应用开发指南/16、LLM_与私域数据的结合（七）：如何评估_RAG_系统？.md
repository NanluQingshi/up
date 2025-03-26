大家好，欢迎继续学习 LangChain 实战课程。

经过前面几节课的学习，大家应该对如何从 0 构造一个 RAG 系统有了全面的认识。大家可以发现，有了 LangChain 各种工具的辅助，开发一个能运行的 RAG 系统很容易，几行代码就完成了。

然而，要开发一个能够投入实际生产的 RAG 系统，我们的工作才刚刚开始。我们需要不断对其进行评估测试，调整各个组件策略，才能确保其在实际生产环境中的稳定性和响应质量。

今天，我们将通过一个 RAG 系统评估框架 —— `RAGAs`（Retrieval-Augmented Generation Assessment），深入探讨如何对 RAG 系统进行有效的评估。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/70c78da194f141c29655df4e98963fd6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2476&h=1016&s=198553&e=png&b=ffffff" alt="image.png"  /></p>


## RAG 应用示例

在正式开始之前，我们先快速搭建一个 RAG 应用示例，用于后续评估演示。

我们以《乔布斯 2005 年斯坦福大学经典演讲》为检索内容，大家可以从这里[下载](https://github.com/huiwan-code/llm-tutorial/blob/main/SteveJobsSpeech.txt)。
```python
from langchain.document_loaders import TextLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
# 注意需要安装 langchain-chroma：pip install langchain-chroma
from langchain_chroma import Chroma

# 加载数据
loader = TextLoader('./SteveJobsSpeech.txt')
documents = loader.load()

# 分块数据
text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = text_splitter.split_documents(documents)

# 数据嵌入向量化
vectorStore = Chroma.from_documents(chunks, OpenAIEmbeddings())

# 创建检索器
retriever = vectorStore.as_retriever()
```

接下来，使用上面生成的检索器，构造一个基础的 RAG 应用。

```python
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser

llm = ChatOpenAI(model_name="gpt-3.5-turbo")

template = """
You are an assistant for question-answering tasks. 
Use the following pieces of retrieved context to answer the question. 
If you don't know the answer, just say that you don't know. 
keep the answer concise.
Question: 
-------
{question}
------- 

Context: 
-------
{context} 
-------
Answer:
"""
prompt = ChatPromptTemplate.from_template(template)
rag_chain = (
    {"context": retriever,  "question": RunnablePassthrough()} 
    | prompt 
    | llm
    | StrOutputParser()
)
```



## RAG 评估概述

### 评估粒度

在评估一个 RAG 系统的性能时, 第一个要考虑的就是：我们应该从哪些方面来衡量和评价一个 RAG 系统的表现？

大家可以回想下学生时代。考试会有个最终成绩和各科成绩，最终成绩反映了学生的综合能力；每门学科的成绩也反映了学生在该学科领域的掌握程度。

所以，对一个 RAG 系统，我们可以从`整体系统`和`各模块组件`两个层面进行评估。

整体评估关注的是 RAG 系统作为一个整体的输出质量，包括生成文本的流畅性、相关性、一致性以及信息的准确性；组件评估则更侧重于 RAG 系统中各个组成部分的性能。

那 RAG 系统在评估的时候，我们应该如何对其进行组件划分呢？

一个 RAG 系统，无非做两件事：**检索数据、LLM 生成答案**。所以，我们可以将其分成检索器组件和生成器组件。

- 检索器组件：负责从数据库中检索数据，并利用一系列检索规则优化检索结果，供 LLM 辅助回答。
- 生成器组件：根据检索器提供的上下文和用户输入的问题，生成答案。


### 评估指标

确定好评估粒度后，我们需要为不同的粒度设计多个评估指标。比如对于整体评估有答案正确性和完整性指标，而检索器组件更关注文档检索的精确度、召回率。

确定了要评估的指标及其计算公式后，我们还需要准备测试数据集，供待评估的 RAG 系统测试，得到各项指标的分数，量化系统性能。这样，我们才能知道如何对系统进行进一步优化。

除了上述的量化评估，RAG 系统的评估还应包括定性分析，如通过特定案例来深入了解系统在特定场景下的表现，或者通过用户反馈来获取关于系统可用性和用户满意度的直观信息。

我们这节课着重介绍的还是量化评估。



### 什么是 RAGAs

RAGAs 是一个专门用于评估 RAG 的开源框架（[GitHub](https://github.com/explodinggradients/ragas "GitHub")、[文档](https://docs.ragas.io/en/latest/ "文档")），其一大亮点是可以利用 LLM 代替传统的人工打分，通过自动化的方法来评估 RAG 系统的性能。

比如在传统评估模式中，判断`答案相关性`指标时，需要评估者判断生成的答案是否直接回应了原始问题，对结果进行打分。而 RAGAs 会通过 LLM 生成与预先给定答案相关的多个潜在问题，然后计算原始问题与这些问题之间的相似度。

RAGAs 这种自动化评估的方法极大减少了人力成本和时间延迟，能够加速开发优化流程。

使用 RAGAs 框架进行评估时，我们只需要设计一套问题和对应的标准答案，剩下的可以全部交给 RAGAs。RAGAs 就像一台智能答题评分机，出题老师出试卷和对应的标准答案，学生做完题后把试卷丢给它就能自动出分数。

RAGAs 提供了一系列评估指标，用于从组件层面和整体层面对系统进行全面的评估。

在**组件层面**上，我们可以使用`context_precision（上下文精度）` 和 `context_recall（上下文召回率）`来评估检索器组件；使用`faithfulness（答案忠实度）` 和 `answer_relevancy（答案相关性）`评估生成器组件。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5908c89e7c6448d78ef8492b1302f375~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1000&h=563&s=82757&e=png&b=ffffff" alt="image.png"  /></p>

<p align=center>图片来源：RAGAs官网</p>

在**整体流程**上，可以使用`answer_similarity(答案语义相似度)`和`answer_correctness(答案正确性)`作为评估 RAG 整体性能的指标。

所有指标的分数在 [0, 1] 之间，得分越高表示性能越好。

下面，我们将详细介绍 RAGAs 框架的使用，并对上述提到的指标进行深入讲解。




## 创建评估数据集

为了计算以上各项指标的分数，RAGAs 会用到下面 4 类数据。

- question（问题）：RAG 系统的输入，即用户输入的查询问题。
- context（上下文）：从检索器中返回的信息，用于传给 LLM，增强响应。
- answer（答案）：RAG 系统的实际输出。
- ground_truths（真实事实）：评估前我们已确认的 “标准答案”。

这 4 类数据也是我们需要准备的评估数据集。评估数据集的准备工作很简单，我们只需要设计好`question`和`ground_truths`，剩下的`context`和`answer`可根据实际的检索器和待评估的 RAG 系统生成。


如下所示：

```python
from datasets import Dataset
# 问题
questions = [
    "Why did Steve Jobs's biological mother decide to put him up for adoption?",
    "How did Steve Jobs's calligraphy class at Reed College impact his future work?",
    "What event catalyzed the creation of Pixar and Steve Jobs's return to Apple?"
]
# 标准答案
ground_truths = [
    "She was a young, unwed college graduate who wanted her child to be raised by college graduates.",
    "The knowledge of typography he gained was later used to design the Macintosh computer with high-quality typography, influencing the industry.",
    "Being fired from Apple led to the founding of NeXT and Pixar, and eventually to his return to Apple after NeXT was acquired."
]

answers = []
contexts = []

for query in questions:
    # 添加LLM 输出结果
    answers.append(rag_chain.invoke(query))
    # 添加检索结果
    contexts.append([docs.page_content for docs in retriever.get_relevant_documents(query)])
    
# 构造评估数据集
dataset = Dataset.from_dict({
    "question": questions,
    "contexts": contexts,
    "answer": answers, 
    "ground_truth": ground_truths
})
```

需要注意的是，评估问题设计的好坏会直接影响评估结果。比如，如果评估问题不够明确或具体，LLM 可能无法准确理解问题的意图。或者设计的问题无法覆盖想要测量的关键指标，都有可能导致评估结果不准确。

为了方便问题的设计，RAGAs 还提供了自动生成评估数据集的方法。

```python
from langchain.document_loaders import TextLoader
from ragas.testset.generator import TestsetGenerator
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

loader = TextLoader('./SteveJobsSpeech.txt')
documents = loader.load()

generator_llm = ChatOpenAI()
critic_llm = ChatOpenAI()
embeddings = OpenAIEmbeddings()

generator = TestsetGenerator.from_langchain(
    generator_llm,
    critic_llm,
    embeddings
)

testset = generator.generate_with_langchain_docs(documents, test_size=8)

df = testset.to_pandas()
# 将数据集保存到 csv 文件中
df.to_csv('testset.csv')
```

上面代码中，我们已经使用 RAGAs 创建了 8 个问题（`test_size=8`），`testset.csv`内容如下：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/44e15af7f98b45018616f464006dcb88~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2852&h=498&s=335743&e=png&b=fdfdfd" alt="image.png"  /></p>

一般情况下，我们可以判断生成的问题是否符合测试要求，然后取其中`question`和`ground_truth`这两列，按照前面的步骤使用我们自己的 RAG 和检索器生成`answer`和`context`。


## RAGAs 中的评估指标

下面，我们将分别介绍 RAGAs 中的`检索器组件`、`生成器组件`和 `RAG 系统整体性能`的各类指标。

### 检索器指标

#### context_precision（上下文精度）

`上下文精度`主要用于评估检索结果中，与问题相关的信息是否都被正确地排在前面。该指标使用 `question` 、 `ground_truth` 和 `contexts` 进行计算。

该指标分三个步骤计算：

1. 对于检索到的每个块（`context`），检查它是否与给定问题（`question`）的基本事实（`ground_truth`）相关，相关得分 1，不相关等分 0。

2. 计算每个块的上下文精度（precision@k）。这里 k 是指当前块在检索结果中的排名，计算单个块的精度时，我们只考虑当前块及前面排名的文档块。比如当前 k=3，计算时就只会考虑前 3 个文档块。

    计算公式：`Precision@k=(1/k) * 前 k 块中相关的文档数量`。

3. 计算所有信息块的精度的平均值，得到整个检索结果的精度分数。计算公式：`Context Precision@k = (所有信息块的精度值相加)/块总数`。

```python
from ragas import evaluate
from ragas.metrics import context_precision

result = evaluate(
    dataset = dataset,
    metrics=[
        context_precision
    ]
)

df = result.to_pandas()
df.to_csv('context_precision.csv')
```

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0a38c5ab11b24658aa78210d023e9feb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2748&h=462&s=258649&e=png&b=fefefe" alt="image.png"  /></p>


#### context_recall（上下文召回率）

`上下文召回率`用于判断基本事实（`ground_truth`）的多少内容可以在检索返回的上下文（`context`）中找到。值范围在 0 到 1 之间，值越高表示检索结果越全面。

该指标分三个步骤计算：

1. 将基本事实（`ground_truth`）拆分成 n 个单独的句子。
2. 检查每个句子的信息能否在检索结果中找到。假设其中 k 个句子信息能找到。
3. k/n 得到最终结果。

```python
from ragas import evaluate
from ragas.metrics import context_recall

result = evaluate(
    dataset = dataset,
    metrics=[
        context_recall
    ]
)

df = result.to_pandas()
df.to_csv('context_recall.csv')
```

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5e496a490f304f08838918aefbe129d1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2374&h=386&s=212636&e=png&b=fefefe" alt="image.png"  /></p>


### 生成器指标

#### faithfulness（答案忠实度）

`答案忠实度`衡量生成答案（`answer`）与给定上下文（`context`）的事实一致性。简单来说，就是看生成的答案是否完全基于提供的上下文，如果答案中的所有信息都可以从上下文中推断出来，那么这个答案就被认为是忠实的。

其计算方法与`context_recall（上下文召回率）`类似，只是将其中的`ground_truth`换成`answer`：

1. 将生成的答案（`answer`）拆分成 n 个单独的句子。
2. 检查每个句子的信息能否在检索结果中找到。假设其中 k 个句子信息能找到。
3. k/n 得到最终结果。

```python
from ragas import evaluate
from ragas.metrics import faithfulness

result = evaluate(
    dataset = dataset,
    metrics=[
        faithfulness
    ]
)

df = result.to_pandas()
df.to_csv('faithfulness.csv')
```

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7a4ee3fceab5431d82e87b4cd46fb9b3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2814&h=460&s=264219&e=png&b=fefefe" alt="image.png"  /></p>



#### answer_relevancy（答案相关性）

`答案相关性`评估的是生成的答案（`answer`）与给定问题（`question`）的相关程度。如果答案不完整或者包含冗余信息，分数会比较低；如果答案与问题高度相关，分数就会比较高。

该指标的计算思路是：利用根据生成的答案（`answer`）“逆向”生成多个问题，然后计算这些问题与原始问题之间的平均余弦相似度。因为生成的答案如果能回答原始问题，则 LLM 应该能够从答案中生成与原始问题类似的问题。

```python
from ragas import evaluate
from ragas.metrics import answer_relevancy

result = evaluate(
    dataset = dataset,
    metrics=[
        answer_relevancy
    ]
)

df = result.to_pandas()
df.to_csv('answer_relevancy.csv')
```

<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b5e383266ecc4a6cbdc69ba00925cec5~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2720&h=460&s=270500&e=png&b=fefefe" alt="image.png"  /></p>

需要注意的是，`答案相关性`只检查答案是否与问题相关，即是否完整或是否冗余，而不关注答案是否正确。

比如，对于问题：“地球绕太阳转一圈需要多长时间？”，生成了答案 1：“地球围绕太阳旋转”和答案 2：“地球绕太阳转一圈需要 1 天”。答案 1 没有提供地球绕太阳转一圈所需时间的具体信息，因此它是一个不完整的答案，得分较低；而答案 2 虽然答案不准确，但明确回答了问题，因此它是一个高度相关的回答，得分较高。



### RAG 整体指标

#### answer_similarity（答案语义相似度）

`答案语义相似度`用于衡量生成答案（`answer`）与正确答案（`ground_truth`）之间的语义相似度。得分范围从 0 到 1，得分越高，表示生成的答案与正确答案的对齐程度越好。

RAGAs 先使用相同的嵌入模型将 LLM 生成的答案（`answer`）和正确答案（`ground_truth`）转换成向量，然后计算这两个向量之间的余弦相似度，作为指标得分。

```python
from ragas import evaluate
from ragas.metrics import answer_similarity

result = evaluate(
    dataset = dataset,
    metrics=[
        answer_similarity
    ]
)

df = result.to_pandas()
df.to_csv('answer_similarity.csv')
```

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5a63c3218edb4311809e6988cb6a6a8c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2812&h=458&s=284083&e=png&b=fefefe" alt="image.png"  /></p>


#### answer_correctness（答案正确性）

`答案正确性`衡量了 LLM 生成的答案（`answer`）在多大程度上接近于真实事实（`ground_truth`）。答案正确性包括两个关键部分：

1.  **语义相似度**：生成答案与真实事实的语义相似度。
2.   **事实相似度**：生成答案与真实事实在内容上的相似度。

`答案正确性`指标将这两部分结合起来，得到最终分数。其中，`语义相似度`的计算方法我们在上面`answer_similarity`中已经介绍过了，接下来我们具体看看`事实相似度`的计算方法。

`事实相似度`表示了`answer`和`ground_truth`中事实的重叠程度。为了量化这个程度，需要定义以下几个概念：

1. TP（True Positive）：同时存在`answer`和`ground_truth`的事实数量。
2. FP（False Positive）：`answer`中存在但`ground_truth`不存在的事实数量。
3. FN（False Negative）：`ground_truth`中存在但`answer`不存在的事实数量。

在得到上面三个数值后，利用下面的 F1 分数的公式，作为`事实相似度`的得分。

$$
\text{F1 Score} = {\text{TP} \over {(|\text{TP}| + 0.5 \times (|\text{FP}| + |\text{FN}|))}}
$$


以[官网](https://docs.ragas.io/en/latest/concepts/metrics/answer_correctness.html)中的一个例子来具体解释下上面 F1 的计算逻辑：

* `ground_truth`："爱因斯坦在 1879 年出生于德国。"
* `answer`："爱因斯坦在 1879 年出生于西班牙。"

`ground_truth`可以拆分为“爱因斯坦在 1879 年出生”和“爱因斯坦出生在德国”两个事实。

同样的，`answer`也可以拆分为“爱因斯坦在 1879 年出生”和“爱因斯坦出生在西班牙”两个事实。

接下来，我们分别计算 TP、FP、FN：

* **TP**：两个答案都提到了“爱因斯坦在 1879 年出生”，所以 TP = 1。
* **FP**：仅存在于`answer`的事实是“爱因斯坦出生在西班牙”，所以 FP = 1。
* **FN**：仅存在于`ground_truth`的事实是“爱因斯坦出生在德国”，所以 FN = 1。

套入公式得到 F1 = 1 / (1 + 0.5 * (1 + 1)) = 0.5。

得到`语义相似度`和`事实相似度`两个分数后，RAGAs 会通过权重数组（`weights`）将这两个分数进行加权平均，得出最终分数。**默认情况下，`事实相似度`的权重是 0.75，`语义相似度`的权重是 0.25。**

```python
from ragas import evaluate
from ragas.metrics import answer_correctness

result = evaluate(
    dataset = dataset,
    metrics=[
        answer_correctness
    ]
)

df = result.to_pandas()
df.to_csv('answer_correctness.csv')
```

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/238d35245f49478aafc8a7afb8a85d93~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2840&h=510&s=277651&e=png&b=fefefe" alt="image.png"  /></p>


## 总结

 1. 一个 RAG 系统投入生产前，需要经过多个维度指标的评估，不断迭代，才能保证其性能。
 
 2. 为了更全面地评估 RAG 系统，我们需要从组件级别和整体级别对系统进行评估。其中，组件级别包括对检索器的评估和对生成器的评估。
 3. RAGAs 框架是一个专门用于评估 RAG 系统的评估框架，利用 LLM 代替传统的人工打分，通过自动化的方法来评估 RAG 系统，加快 RAG 的迭代优化效率。
 4. RAGAs 提供了多个维度的评估指标，组件层面上，我们常用`context_precision（上下文精度）` 和 `context_recall（上下文召回率）`来评估检索器组件；使用`faithfulness（答案忠实度）` 和 `answer_relevancy（答案相关性）`评估生成器组件。整体流程上，可以使用`answer_similarity（答案语义相似度）`和`answer_correctness（答案正确性）`作为评估 RAG 整体性能的指标。
 5. 评估测试数据集的设计会直接影响最终评估结果的准确性，我们需要合理、全面地设计评估问题。可以使用 RAGAs 提供的自动创建测试数据集的方法，在其生成的问题上进一步做优化调整。